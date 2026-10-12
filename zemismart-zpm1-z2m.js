const exposes = require('zigbee-herdsman-converters/lib/exposes');
const tuya = require('zigbee-herdsman-converters/lib/tuya');
const { logger } = require('zigbee-herdsman-converters/lib/logger');
const e = exposes.presets;
const ea = exposes.access;

const NS = 'zhc:zmp1';

// Ask the motor for all datapoints every 12 h (battery otherwise rarely reports)
const QUERY_INTERVAL_SECONDS = 12 * 60 * 60;

// DP1 STOP ends a move; the travel time plus this margin is the fallback
const STOP_MARGIN_MS = 10000;
const DEFAULT_TRAVEL_MS = 60000;

// DP3 only arrives at the end of a move, so the position is estimated meanwhile.
// DP10 is not the real travel time after a speed change, so real times are learned
// per direction and per DP10 value in `travel_profiles`.
const ESTIMATE_INTERVAL_MS = 1000;
const MIN_SAMPLE_DISTANCE = 30;
const MAX_SAMPLE_FACTOR = 4;
const MAX_PROFILES = 8;
const motions = new Map();
const motionTimers = new Map();
const estimators = new Map();
const targets = new Map();
const lastCommand = new Map();
const lastPositionReport = new Map();

const profileFor = (state, timeTotal) => state?.travel_profiles?.[String(timeTotal)] || {};
const travelTime = (state, motorState, timeTotal = state?.time_total) =>
    Number(profileFor(state, timeTotal)[motorState]) || Number(timeTotal) || 0;
const profileState = (state, timeTotal) => ({
    travel_time_opening: travelTime(state, 'opening', timeTotal) || null,
    travel_time_closing: travelTime(state, 'closing', timeTotal) || null,
});

// A DP7 in a status dump (query, rejoin) is the last motion, not a new one
const isStatusDump = (ieee, msg) => {
    const recentCommand = Date.now() - (lastCommand.get(ieee) || 0) < 5000;
    if (recentCommand) return false;
    const withPosition = msg?.data?.dpValues?.some((dp) => dp.dp === 3);
    const recentPosition = Date.now() - (lastPositionReport.get(ieee) || 0) < 500;
    return withPosition || recentPosition;
};

const activeMotion = (ieee) => {
    const motion = motions.get(ieee);
    return motion && !motion.ended ? motion : undefined;
};

// Ended motions are kept briefly so a DP3 that follows DP1 STOP or DP11 can still be learned from
const clearMotion = (ieee) => {
    const motion = motions.get(ieee);
    if (motion && !motion.ended) Object.assign(motion, { ended: true, endedAt: Date.now() });
    clearTimeout(motionTimers.get(ieee));
    motionTimers.delete(ieee);
    clearInterval(estimators.get(ieee)?.interval);
    estimators.delete(ieee);
    targets.delete(ieee);
};

const startEstimate = (meta, publish, motorState, from = {}) => {
    const ieee = meta.device.ieeeAddr;
    clearInterval(estimators.get(ieee)?.interval);
    estimators.delete(ieee);
    const travel = from.travel ?? travelTime(meta.state, motorState);
    const start = from.position ?? Number(meta.state?.position);
    if (!travel || !Number.isFinite(start)) return;
    const sign = motorState === 'opening' ? 1 : -1;
    // Read each tick so a new command mid-move moves the end point
    const endFor = () => {
        const target = targets.get(ieee);
        if (target === undefined || (target - start) * sign <= 0) return sign > 0 ? 100 : 0;
        return target;
    };
    const startedAt = Date.now();
    const estimator = { motorState, position: start };
    estimator.interval = setInterval(() => {
        const moved = (Date.now() - startedAt) / travel * 100;
        const end = endFor();
        let estimate = sign > 0 ? Math.min(start + moved, end) : Math.max(start - moved, end);
        const last = estimator.position;
        estimate = sign > 0 ? Math.max(estimate, last) : Math.min(estimate, last);
        if (Math.round(estimate) !== Math.round(last)) publish({ position: Math.round(estimate) });
        estimator.position = estimate;
    }, ESTIMATE_INTERVAL_MS);
    estimator.interval.unref?.();
    estimators.set(ieee, estimator);
};

const armMotionTimer = (meta, publish, timeTotal = meta.state?.time_total) => {
    const ieee = meta.device.ieeeAddr;
    clearTimeout(motionTimers.get(ieee));
    const travel = Math.max(
        travelTime(meta.state, 'opening', timeTotal),
        travelTime(meta.state, 'closing', timeTotal),
    ) || DEFAULT_TRAVEL_MS;
    const timer = setTimeout(() => {
        // The real stop time is unknown, so this move must not be learned from
        const motion = motions.get(ieee);
        if (motion) motion.valid = false;
        clearMotion(ieee);
        logger.warning(`${ieee} no stop signal after ${travel + STOP_MARGIN_MS} ms, marking stopped`, NS);
        publish({ motor_state: 'stopped' });
    }, travel + STOP_MARGIN_MS);
    timer.unref?.();
    motionTimers.set(ieee, timer);
};

// Single-value enums show as buttons in Home Assistant
const pressButton = (name, description) => e.enum(name, ea.SET, ['press']).withDescription(description);
const buttonDatapoint = (dp, name, value) => [dp, name, { from: null, to: () => tuya.enum(value) }, { optimistic: false }];

const stateLookup = { OPEN: tuya.enum(0), STOP: tuya.enum(1), CLOSE: tuya.enum(2) };
const stateFromDp = { 0: 'OPEN', 1: 'STOP', 2: 'CLOSE' };

const tzLocal = {
    state: {
        key: ['state'],
        convertSet: async (entity, key, value, meta) => {
            const result = await tuya.tz.datapoints.convertSet(entity, key, value, meta);
            lastCommand.set(meta.device.ieeeAddr, Date.now());
            if (String(value).toUpperCase() === 'STOP') {
                clearMotion(meta.device.ieeeAddr);
                result.state = { ...result.state, motor_state: 'stopped' };
            } else {
                targets.delete(meta.device.ieeeAddr);
            }
            return result;
        },
    },
    position: {
        key: ['position'],
        convertSet: async (entity, key, value, meta) => {
            const ieee = meta.device.ieeeAddr;
            lastCommand.set(ieee, Date.now());
            const result = await tuya.tz.datapoints.convertSet(entity, key, value, meta);
            if (!activeMotion(ieee) && Number(value) === Number(meta.state?.position)) targets.delete(ieee);
            else targets.set(ieee, Number(value));
            return result;
        },
    },
};

const definition = {
    fingerprint: tuya.fingerprint('TS0601', ['_TZE284_6hrnp30w']),
    model: 'ZMP1',
    vendor: 'Zemismart',
    description: 'Roller shade driver',
    // Firmware updates through Z2M's OTA index (none published for this model yet)
    ota: true,
    // Magic packet, query on configure/announce and the 12 h query come from tuyaBase
    extend: [tuya.modernExtend.tuyaBase({
        dp: true,
        queryOnConfigure: true,
        queryOnDeviceAnnounce: true,
        queryIntervalSeconds: QUERY_INTERVAL_SECONDS,
    })],
    toZigbee: [tzLocal.state, tzLocal.position],
    onEvent: tuya.onEventSetTime,
    exposes: [
        // Core cover
        e.cover_position().setAccess('position', ea.STATE_SET),

        // Live motion state; Z2M uses motor_state to show opening/closing on the HA cover
        e.enum('motor_state', ea.STATE, ['opening', 'closing', 'stopped'])
            .withDescription('Current motor motion state (stopped is inferred, the motor never reports it)')
            .withCategory('diagnostic'),

        // Manual nudge
        pressButton('nudge_up', 'Nudge the blind up by one step'),
        pressButton('nudge_down', 'Nudge the blind down by one step'),

        // Motor direction
        e.enum('motor_direction', ea.STATE_SET, ['forward', 'back'])
            .withDescription('Reverse motor direction if open/close are inverted')
            .withCategory('config'),

        // Mode
        e.enum('mode', ea.STATE_SET, ['morning', 'night'])
            .withDescription('Morning or night mode')
            .withCategory('config'),

        // Calibrated full travel time (read only, set during limit calibration)
        e.numeric('time_total', ea.STATE)
            .withUnit('ms')
            .withValueMin(0)
            .withValueMax(120000)
            .withDescription(
                'Total calibrated travel time in milliseconds. ' +
                'Measured by the motor when upper and lower limits are set.'
            )
            .withCategory('diagnostic'),

        // Travel times learned from real moves (follow speed changes)
        e.numeric('travel_time_opening', ea.STATE)
            .withUnit('ms')
            .withDescription(
                'Full opening time measured from real moves of 30% or more. ' +
                'Used for the live position estimate; learned separately for each speed setting.'
            )
            .withCategory('diagnostic'),
        e.numeric('travel_time_closing', ea.STATE)
            .withUnit('ms')
            .withDescription(
                'Full closing time measured from real moves of 30% or more. ' +
                'Used for the live position estimate; learned separately for each speed setting.'
            )
            .withCategory('diagnostic'),

        // Limit hit event (read only, fires when shade reaches a limit)
        e.enum('situation_set', ea.STATE, ['fully_open', 'fully_close'])
            .withDescription('Reports when the shade physically reaches a set limit')
            .withCategory('diagnostic'),

        // Motor fault (read only, fires on fault condition)
        e.binary('motor_fault', ea.STATE, true, false)
            .withDescription('Motor fault detected')
            .withCategory('diagnostic'),

        // Battery
        e.battery(),

        // Travel limits: move the blind to the position first, then press
        pressButton('set_upper_limit', 'Save the current position as the upper (open) limit').withCategory('config'),
        pressButton('set_lower_limit', 'Save the current position as the lower (closed) limit').withCategory('config'),
        pressButton('remove_upper_limit', 'Remove the upper limit').withCategory('config'),
        pressButton('remove_lower_limit', 'Remove the lower limit').withCategory('config'),
        pressButton('clear_both_limits', 'Remove both limits; use before recalibrating from scratch').withCategory('config'),
    ],
    meta: {
        // fz.datapoints uses the first entry for a DP, tz.datapoints the first entry for a name,
        // so nameless "from" entries come before the named "to" entries.
        tuyaDatapoints: [
            // DP1 — open/stop/close report (a STOP report means the motor stopped)
            [1, null, {
                from: (value, meta) => {
                    const state = stateFromDp[value];
                    logger.debug(`${meta.device.ieeeAddr} DP1 state=${state}`, NS);
                    if (state === 'STOP') {
                        clearMotion(meta.device.ieeeAddr);
                        return { state, motor_state: 'stopped' };
                    }
                    return { state };
                },
            }],
            // DP1 — open/stop/close command
            [1, 'state', tuya.valueConverterBasic.lookup(stateLookup)],

            // DP2 — position setpoint (write only); not optimistic so HA shows the motion
            [2, 'position', { from: null, to: (value) => value }, { optimistic: false }],

            // DP3 — actual position report
            [3, null, {
                from: (value, meta) => {
                    const ieee = meta.device.ieeeAddr;
                    const target = targets.get(ieee);
                    lastPositionReport.set(ieee, Date.now());
                    logger.debug(`${ieee} DP3 position=${value} target=${target} motor=${meta.state?.motor_state}`, NS);
                    const result = { position: value };
                    clearInterval(estimators.get(ieee)?.interval);
                    estimators.delete(ieee);
                    const motion = motions.get(ieee);
                    motions.delete(ieee);
                    const endedAt = motion?.endedAt ?? Date.now();
                    const distance = motion ? Math.abs(value - motion.startPosition) : 0;
                    if (motion?.valid && Date.now() - endedAt < 3000 && distance >= MIN_SAMPLE_DISTANCE) {
                        const sample = (endedAt - motion.startedAt) / distance * 100;
                        const timeTotal = Number(meta.state?.time_total);
                        const plausible = !timeTotal ||
                            (sample >= timeTotal / MAX_SAMPLE_FACTOR && sample <= timeTotal * MAX_SAMPLE_FACTOR);
                        if (plausible) {
                            const key = String(meta.state?.time_total);
                            const profiles = { ...meta.state?.travel_profiles };
                            const profile = { ...profiles[key] };
                            const learned = Number(profile[motion.motorState]);
                            profile[motion.motorState] = Math.round(learned ? (learned + sample) / 2 : sample);
                            profile.used = Date.now();
                            profiles[key] = profile;
                            const oldest = Object.keys(profiles).sort((x, y) => profiles[y].used - profiles[x].used);
                            for (const old of oldest.slice(MAX_PROFILES)) delete profiles[old];
                            result.travel_profiles = profiles;
                            result[`travel_time_${motion.motorState}`] = profile[motion.motorState];
                            logger.debug(`${ieee} ${motion.motorState} sample ${Math.round(sample)} ms over ${distance}% at speed ${key}, learned ${profile[motion.motorState]}`, NS);
                        }
                    }
                    if (value === 0 || value === 100 || (target !== undefined && Math.abs(value - target) <= 1)) {
                        clearMotion(ieee);
                        result.motor_state = 'stopped';
                    }
                    return result;
                },
            }],

            // DP4 — mode
            [4, 'mode', tuya.valueConverterBasic.lookup({
                morning: tuya.enum(0),
                night: tuya.enum(1),
            })],

            // DP5 — motor direction
            [5, 'motor_direction', tuya.valueConverterBasic.lookup({
                forward: tuya.enum(0),
                back: tuya.enum(1),
            })],

            // DP7 — motion started (opening/closing); arms the stopped fallback
            [7, null, {
                from: (value, meta, options, publish, msg) => {
                    const motorState = value === 0 ? 'opening' : 'closing';
                    const dump = isStatusDump(meta.device.ieeeAddr, msg);
                    logger.debug(`${meta.device.ieeeAddr} DP7 ${motorState} type=${msg?.type} statusDump=${dump}`, NS);
                    if (dump) return {};
                    const ieee = meta.device.ieeeAddr;
                    motions.set(ieee, {
                        motorState,
                        startedAt: Date.now(),
                        startPosition: Number(meta.state?.position),
                        valid: !activeMotion(ieee) && Number.isFinite(Number(meta.state?.position)),
                    });
                    armMotionTimer(meta, publish);
                    startEstimate(meta, publish, motorState);
                    return { motor_state: motorState };
                },
            }],

            // DP10 — total calibrated travel time
            // (it changes with the speed setting and on recalibration; each value gets its own learned profile)
            [10, null, {
                from: (value, meta, options, publish) => {
                    const ieee = meta.device.ieeeAddr;
                    const previous = meta.state?.time_total;
                    const motion = activeMotion(ieee);
                    if (motion && previous != null && value !== Number(previous)) {
                        // Speed changed mid-move: carry on from the current estimate at the
                        // new speed, restart the stop fallback, and don't learn from this move
                        logger.debug(`${ieee} speed changed mid-move (${previous} -> ${value})`, NS);
                        motion.valid = false;
                        const estimator = estimators.get(ieee);
                        if (estimator) {
                            startEstimate(meta, publish, estimator.motorState, {
                                position: estimator.position,
                                travel: travelTime(meta.state, estimator.motorState, value),
                            });
                        }
                        armMotionTimer(meta, publish, value);
                    }
                    return { time_total: value, ...profileState(meta.state, value) };
                },
            }],

            // DP11 — limit reached, so the motor has stopped
            [11, null, {
                from: (value, meta) => {
                    const situation = value === 0 ? 'fully_open' : 'fully_close';
                    logger.debug(`${meta.device.ieeeAddr} DP11 ${situation}`, NS);
                    clearMotion(meta.device.ieeeAddr);
                    return { situation_set: situation, motor_state: 'stopped' };
                },
            }],

            // DP12 — fault bitmap
            [12, 'motor_fault', {
                from: (value) => value !== 0,
                to: null,
            }],

            // DP13 — battery percentage
            [13, 'battery', tuya.valueConverter.raw],

            // DP16 — travel limits (write only)
            buttonDatapoint(16, 'set_upper_limit', 0),
            buttonDatapoint(16, 'set_lower_limit', 1),
            buttonDatapoint(16, 'remove_upper_limit', 2),
            buttonDatapoint(16, 'remove_lower_limit', 3),
            buttonDatapoint(16, 'clear_both_limits', 4),

            // DP19 — position_best exists on device but has no recall DP,
            // so it is intentionally not exposed to avoid a useless slider.

            // DP20 — nudge one step (write only)
            buttonDatapoint(20, 'nudge_up', 0),
            buttonDatapoint(20, 'nudge_down', 1),
        ],
    },
};

module.exports = definition;
