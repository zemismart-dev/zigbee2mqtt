'use strict';

const {logger} = require('zigbee-herdsman-converters/lib/logger');
const store = require('zigbee-herdsman-converters/lib/store');
const TUYA_CLUSTER = 'manuSpecificTuya';
const NS = 'zhc:zemismart-zps-z1';
const DP = {
    PRESENCE_STATE: 1, DETECTION_RANGE: 2, ILLUMINANCE: 101, ENERGY_VALUE: 102,
    AI_SELF_LEARNING: 103, HEARTBEAT_ENABLE: 104, HEART: 105, SENSITIVITY_PRESET: 112,
    ZONE_MAP: 117, NO_PERSON_TIME: 119, INDICATOR: 123, ENERGY_THRESHOLD: 124,
};
const DT = {RAW: 0, BOOL: 1, VALUE: 2, ENUM: 4};
const ZONE_COUNT = 10;
const REPORT_TIMEOUT_MS = 10000;
const QUERY_INTERVAL_MS = 3000;
const STREAM_INTERVAL_MS = 5000;
const STREAM_MAX_MS = 5 * 60 * 1000;
// The loader does not emit stop for the old module on hot replacement.
// Keep a shared registry solely to cancel that module's local tasks on the next load.
const runtime = new Map();
for (const state of store.getValue('zemismart-zps-z1', 'runtime', new Map()).values()) {
    state.stopped = true;
    stopKeepAlive(state);
    for (const cancel of state.delays || []) cancel();
    for (const waiter of [...state.waiters]) waiter.finish(new Error('[ZPS-Z1] Converter reloaded'));
}
store.putValue('zemismart-zps-z1', 'runtime', runtime);

function getRuntime(device) {
    if (!runtime.has(device.ieeeAddr)) {
        runtime.set(device.ieeeAddr, {queue: Promise.resolve(), waiters: new Set(), generation: 0,
            energyPending: Promise.resolve(), queryQueue: Promise.resolve(), delays: new Set(), stopped: false, lastQuery: -Infinity});
    }
    return runtime.get(device.ieeeAddr);
}

function stopKeepAlive(state) {
    state.generation++;
    clearTimeout(state.energyTimer);
    clearTimeout(state.energyDeadline);
    state.energyTimer = state.energyDeadline = undefined;
}

async function sendDP(endpoint, dp, datatype, data, state) {
    if (state.stopped) throw new Error('[ZPS-Z1] Device stopped');
    await endpoint.command(TUYA_CLUSTER, 'dataRequest', {
        seq: Math.round(Math.random() * 0xFFFF), dpValues: [{dp, datatype, data: [...data]}],
    }, {disableDefaultResponse: true});
}

function queryDelay(state, ms) {
    return new Promise((resolve, reject) => {
        const cancel = () => {
            clearTimeout(timer);
            state.delays.delete(cancel);
            reject(new Error('[ZPS-Z1] Device stopped'));
        };
        const timer = setTimeout(() => {state.delays.delete(cancel); resolve();}, ms);
        state.delays.add(cancel);
    });
}

async function queryState(endpoint, state, force = false, beforeSend) {
    const job = state.queryQueue.then(async () => {
        if (state.stopped) throw new Error('[ZPS-Z1] Device stopped');
        const remaining = QUERY_INTERVAL_MS - (Date.now() - state.lastQuery);
        if (remaining > 0) {
            if (!force) return;
            // Some battery firmware suppresses closely spaced dataQuery requests.
            // SET/read-modify-write queries wait their turn instead of being discarded.
            await queryDelay(state, remaining);
        }
        if (state.stopped) throw new Error('[ZPS-Z1] Device stopped');
        state.lastQuery = Date.now();
        beforeSend?.();
        try {
            await endpoint.command(TUYA_CLUSTER, 'dataQuery', {}, {disableDefaultResponse: true});
        } catch (error) {
            state.lastQuery = -Infinity;
            throw error;
        }
    });
    state.queryQueue = job.catch(() => {});
    return job;
}

function startKeepAlive(device, endpoint, state) {
    stopKeepAlive(state);
    const generation = state.generation;
    const active = () => !state.stopped && state.generation === generation;
    const schedule = () => {
        state.energyTimer = setTimeout(async () => {
            if (!active()) return;
            // One heartbeat at a time, even when the device is slow to reply.
            state.energyPending = sendDP(endpoint, DP.HEARTBEAT_ENABLE, DT.BOOL, [1], state);
            try { await state.energyPending; }
            catch (error) { logger.warning(`Energy heartbeat failed: ${error.message}`, NS); }
            if (active()) schedule();
        }, STREAM_INTERVAL_MS);
        state.energyTimer.unref?.();
    };
    schedule();
    state.energyDeadline = setTimeout(async () => {
        if (!active()) return;
        stopKeepAlive(state);
        const expiredGeneration = state.generation;
        // An in-flight ON must finish before the final OFF, never after it.
        await state.energyPending.catch(() => {});
        if (state.stopped || state.generation !== expiredGeneration) return;
        try {
            await enqueue(state, async () => {
                if (state.generation !== expiredGeneration) return;
                await sendDP(endpoint, DP.HEARTBEAT_ENABLE, DT.BOOL, [0], state);
                await queryState(endpoint, state, true);
            });
        } catch (error) { logger.warning(`Energy streaming auto-off failed: ${error.message}`, NS); }
        // Only a real DP104 report changes the displayed state.
    }, STREAM_MAX_MS);
    state.energyDeadline.unref?.();
}

function enqueue(state, work) {
    const job = state.queue.then(() => {
        if (state.stopped) throw new Error('[ZPS-Z1] Device stopped');
        return work();
    });
    state.queue = job.catch(() => {});
    return job;
}

function waitForReport(state, dp, matches = () => true) {
    let waiter;
    const promise = new Promise((resolve, reject) => {
        const finish = (error, data) => {
            clearTimeout(waiter.timer);
            state.waiters.delete(waiter);
            if (error) reject(error); else resolve(Buffer.from(data));
        };
        waiter = {dp, matches, finish};
        waiter.timer = setTimeout(() => finish(new Error(`[ZPS-Z1] No confirmed DP${dp} report; no default values will be written`)), REPORT_TIMEOUT_MS);
        state.waiters.add(waiter);
    });
    // A failed Zigbee command may precede the await below; avoid an unhandled rejection.
    promise.catch(() => {});
    return {promise, cancel: error => waiter.finish(error)};
}

async function readRaw(endpoint, state, dp) {
    let waiting;
    try {
        // Do not accept an older report while this query is still waiting its turn.
        await queryState(endpoint, state, true, () => {waiting = waitForReport(state, dp);});
        return await waiting.promise;
    } catch (error) { waiting?.cancel(error); throw error; }
}

async function writeConfirmed(endpoint, state, dp, datatype, data, matches) {
    const expected = Buffer.from(data);
    const waiting = waitForReport(state, dp, matches || (actual => actual.equals(expected)));
    try {
        await sendDP(endpoint, dp, datatype, expected, state);
        await queryState(endpoint, state, true);
        await waiting.promise;
    } catch (error) { waiting.cancel(error); throw error; }
}

function numberValue(key, value, min, max, step = 1) {
    if (typeof value !== 'number' || !Number.isFinite(value) || !Number.isInteger(value) ||
        value < min || value > max || (value - min) % step !== 0) {
        throw new Error(`[ZPS-Z1] ${key} requires an integer ${min}..${max}, step ${step}`);
    }
    return value;
}

function booleanValue(key, value) {
    if (value === true || value === 'ON') return true;
    if (value === false || value === 'OFF') return false;
    throw new Error(`[ZPS-Z1] ${key} requires true/false or ON/OFF`);
}

function enumValue(key, value, choices) {
    if (typeof value !== 'string' || !Object.hasOwn(choices, value)) {
        throw new Error(`[ZPS-Z1] Invalid ${key}: ${String(value)}`);
    }
    return choices[value];
}

function uint32(value) {
    const data = Buffer.alloc(4);
    data.writeUInt32BE(value);
    return data;
}

const reportFormats = new Map([
    [DP.PRESENCE_STATE, [DT.ENUM, 1, [0, 1, 2]]],
    [DP.DETECTION_RANGE, [DT.VALUE, 4]], [DP.ILLUMINANCE, [DT.VALUE, 4]],
    [DP.ENERGY_VALUE, [DT.RAW, 20]], [DP.AI_SELF_LEARNING, [DT.ENUM, 1, [0, 1, 2, 3, 4, 5]]],
    [DP.HEARTBEAT_ENABLE, [DT.BOOL, 1, [0, 1]]], [DP.SENSITIVITY_PRESET, [DT.ENUM, 1, [0, 1, 2, 3]]],
    [DP.ZONE_MAP, [DT.RAW, 10]], [DP.NO_PERSON_TIME, [DT.VALUE, 4]],
    [DP.INDICATOR, [DT.BOOL, 1, [0, 1]]], [DP.ENERGY_THRESHOLD, [DT.RAW, 20]],
]);

function validatedData(dpv) {
    if (!dpv || !reportFormats.has(dpv.dp)) return;
    const [datatype, length, allowed] = reportFormats.get(dpv.dp);
    if (dpv.datatype !== datatype) return;
    const data = dpv.data;
    if (!Buffer.isBuffer(data) && !(Array.isArray(data) &&
        Array.from(data).every(value => Number.isInteger(value) && value >= 0 && value <= 255))) return;
    if (data.length !== length) return;
    const buf = Buffer.from(data);
    if (allowed && !allowed.includes(buf[0])) return;
    if (dpv.dp === DP.ZONE_MAP && !buf.every(value => value <= 2)) return;
    return buf;
}

const fzConverter = {
    cluster: TUYA_CLUSTER,
    type: ['commandDataResponse', 'commandDataReport'],
    convert(model, msg, publish, options, meta) {
        const result = {};
        if (!Array.isArray(msg.data?.dpValues)) return result;
        for (const dpv of msg.data.dpValues) {
            const buf = validatedData(dpv);
            if (!buf) continue;
            const state = getRuntime(meta.device);
            for (const waiter of [...state.waiters]) {
                if (waiter.dp === dpv.dp && waiter.matches(buf)) waiter.finish(undefined, buf);
            }
            switch (dpv.dp) {
                case DP.PRESENCE_STATE:
                    result.presence_state = ['absence', 'presence', 'sensor_close'][buf[0]];
                    result.occupancy = buf[0] === 1;
                    break;
                case DP.DETECTION_RANGE: result.detection_range = buf.readUInt32BE(0); break;
                case DP.ILLUMINANCE: result.illuminance = buf.readUInt32BE(0); break;
                case DP.AI_SELF_LEARNING:
                    result.auto_calibration_status = ['standby', 'start', 'learning', 'success', 'fail', 'cancel'][buf[0]];
                    break;
                case DP.HEARTBEAT_ENABLE:
                    result.energy_streaming = buf[0] === 1;
                    if (!result.energy_streaming) stopKeepAlive(state);
                    break;
                case DP.SENSITIVITY_PRESET:
                    result.sensitivity_preset = ['high', 'medium', 'low', 'custom'][buf[0]];
                    break;
                case DP.ZONE_MAP:
                    for (let i = 0; i < ZONE_COUNT; i++) result[`zone_${i + 1}_active`] = buf[i] !== 0;
                    break;
                case DP.NO_PERSON_TIME: result.presence_clear_cooldown = buf.readUInt32BE(0); break;
                case DP.INDICATOR: result.led_indicator = buf[0] === 1; break;
                case DP.ENERGY_VALUE:
                case DP.ENERGY_THRESHOLD: {
                    const field = dpv.dp === DP.ENERGY_VALUE ? 'energy' : 'threshold';
                    for (let i = 0; i < ZONE_COUNT; i++) {
                        result[`zone_${i + 1}_motion_${field}`] = buf[i];
                        result[`zone_${i + 1}_presence_${field}`] = buf[ZONE_COUNT + i];
                    }
                    break;
                }
            }
        }
        return result;
    },
};

const ZONE_ACTIVE_KEYS = Array.from({length: ZONE_COUNT}, (_, i) => `zone_${i + 1}_active`);
const ZONE_MOTION_THR_KEYS = Array.from({length: ZONE_COUNT}, (_, i) => `zone_${i + 1}_motion_threshold`);
const ZONE_PRESENCE_THR_KEYS = Array.from({length: ZONE_COUNT}, (_, i) => `zone_${i + 1}_presence_threshold`);
const tzConverter = {
    key: ['detection_range', 'sensitivity_preset', 'presence_clear_cooldown', 'led_indicator',
        'energy_streaming', 'auto_calibration', ...ZONE_ACTIVE_KEYS, ...ZONE_MOTION_THR_KEYS, ...ZONE_PRESENCE_THR_KEYS],
    async convertSet(entity, key, value, meta) {
        // Validate before querying or writing anything to a real device.
        let dp, datatype, data;
        const zone = ZONE_ACTIVE_KEYS.includes(key);
        const motion = ZONE_MOTION_THR_KEYS.includes(key);
        const presence = ZONE_PRESENCE_THR_KEYS.includes(key);
        if (key === 'detection_range') {
            throw new Error('[ZPS-Z1] detection_range is read-only until DP2 units and semantics are verified');
        } else if (key === 'presence_clear_cooldown') {
            dp = DP.NO_PERSON_TIME; datatype = DT.VALUE; data = uint32(numberValue(key, value, 2, 60));
        } else if (key === 'sensitivity_preset') {
            dp = DP.SENSITIVITY_PRESET; datatype = DT.ENUM; data = [enumValue(key, value, {high: 0, medium: 1, low: 2, custom: 3})];
        } else if (key === 'auto_calibration') {
            dp = DP.AI_SELF_LEARNING; datatype = DT.ENUM; data = [enumValue(key, value, {start: 1, cancel: 5})];
        } else if (key === 'led_indicator' || key === 'energy_streaming' || zone) {
            value = booleanValue(key, value);
            dp = zone ? DP.ZONE_MAP : key === 'led_indicator' ? DP.INDICATOR : DP.HEARTBEAT_ENABLE;
            datatype = zone ? DT.RAW : DT.BOOL; data = [value ? 1 : 0];
        } else if (motion || presence) {
            value = numberValue(key, value, 0, 255);
            dp = DP.ENERGY_THRESHOLD; datatype = DT.RAW;
        } else { throw new Error(`[ZPS-Z1] Unsupported key: ${key}`); }

        const state = getRuntime(meta.device);
        const endpoint = meta.device.getEndpoint(1);
        // New requests supersede an older ON immediately, including one awaiting its ACK.
        if (key === 'energy_streaming') {
            stopKeepAlive(state);
            state.energyRequest = (state.energyRequest || 0) + 1;
        }
        const requestedEnergy = state.energyRequest;
        await enqueue(state, async () => {
            if (zone || motion || presence) {
                // Fresh complete raw bytes preserve other zones, including mode 2 and rounding bits.
                data = await readRaw(endpoint, state, dp);
                const index = Number(key.split('_')[1]) - 1;
                if (zone ? (data[index] !== 0) === value : data[index + (presence ? ZONE_COUNT : 0)] === value) return;
                data[index + (presence ? ZONE_COUNT : 0)] = zone ? (value ? (data[index] || 1) : 0) : value;
                const matches = zone ? actual => actual.every((v, i) => (v !== 0) === (data[i] !== 0)) : undefined;
                await writeConfirmed(endpoint, state, dp, datatype, data, matches);
                if (!zone) await writeConfirmed(endpoint, state, DP.SENSITIVITY_PRESET, DT.ENUM, [3]);
            } else if (key === 'energy_streaming') {
                if (!value) stopKeepAlive(state);
                await state.energyPending.catch(() => {});
                await sendDP(endpoint, dp, datatype, data, state);
                if (value && !state.stopped && state.energyRequest === requestedEnergy) startKeepAlive(meta.device, endpoint, state);
                await queryState(endpoint, state, true);
            } else {
                await sendDP(endpoint, dp, datatype, data, state);
                await queryState(endpoint, state, true);
            }
            // No optimistic state: fromZigbee publishes only device-confirmed values.
        });
    },
    async convertGet(entity, key, meta) {
        const state = getRuntime(meta.device);
        await queryState(meta.device.getEndpoint(1), state);
    },
};

// ─── Expose builders ──────────────────────────────────────────────────────────

const e  = require('zigbee-herdsman-converters/lib/exposes');
const ea = e.access;

function buildZoneActiveExposes() {
    return Array.from({ length: ZONE_COUNT }, (_, i) =>
        e.binary(`zone_${i + 1}_active`, ea.ALL, true, false)
            .withDescription(`${i * 50}\u2013${(i + 1) * 50}cm`).withCategory('config'),
    );
}

function buildEnergyExposes() {
    const items = [];
    for (let i = 1; i <= ZONE_COUNT; i++) {
        items.push(
            e.numeric(`zone_${i}_motion_energy`, ea.STATE)
                .withDescription(`Zone ${i} live motion energy (raw 0–255; no physical unit).`)
                .withValueMin(0).withValueMax(255)
                .withCategory('diagnostic').withHomeAssistant({enabledByDefault: false}),
            e.numeric(`zone_${i}_presence_energy`, ea.STATE)
                .withDescription(`Zone ${i} live presence energy (raw 0–255; no physical unit).`)
                .withValueMin(0).withValueMax(255)
                .withCategory('diagnostic').withHomeAssistant({enabledByDefault: false}),
        );
    }
    return items;
}

function buildThresholdExposes() {
    const items = [];
    for (let i = 1; i <= ZONE_COUNT; i++) {
        items.push(
            e.numeric(`zone_${i}_motion_threshold`, ea.ALL)
                .withDescription(`Zone ${i} motion trigger threshold (raw 0–255). Switches sensitivity to custom.`)
                .withValueMin(0).withValueMax(255).withValueStep(1).withCategory('config'),
            e.numeric(`zone_${i}_presence_threshold`, ea.ALL)
                .withDescription(`Zone ${i} presence trigger threshold (raw 0–255). Switches sensitivity to custom.`)
                .withValueMin(0).withValueMax(255).withValueStep(1).withCategory('config'),
        );
    }
    return items;
}

// Keep the customer-facing default small. Advanced visibility is a standard Z2M
// device option, so importing this one converter is sufficient on either frontend.
const BASIC_PROPERTIES = ['occupancy', 'illuminance', 'sensitivity_preset', 'presence_clear_cooldown', 'led_indicator'];
function buildAllExposes() {
    return [
        // ── Primary presence & light ──────────────────────────────────────────
        e.binary('occupancy', ea.STATE, true, false)
            .withDescription('Binary presence detection. Person detected (true) or not detected (false).'),

        e.enum('presence_state', ea.STATE, ['absence', 'presence', 'sensor_close'])
            .withDescription(
                'absence — no one detected. ' +
                'presence — person detected. ' +
                'sensor_close — detection zone is physically obstructed or sensor is disabled.',
            ),

        e.numeric('illuminance', ea.STATE)
            .withUnit('lx')
            .withDescription('Ambient light level (0–1300 lx).')
            .withValueMin(0).withValueMax(1300),

        // ── Detection tuning ──────────────────────────────────────────────────
        e.numeric('detection_range', ea.STATE_GET).withCategory('diagnostic')
            .withLabel('Detection range (unverified)')
            .withDescription('Raw DP2 report. Units and the meaning of 0 are not verified; read-only to avoid changing an uncertain setting.')
            .withHomeAssistant({enabledByDefault: false}),

        e.numeric('presence_clear_cooldown', ea.ALL).withCategory('config')
            .withUnit('s')
            .withDescription('Presence clear time before the sensor switches state to "absence". (2–60 s).')
            .withValueMin(2).withValueMax(60).withValueStep(1),

        e.enum('sensitivity_preset', ea.ALL, ['high', 'medium', 'low', 'custom']).withCategory('config')
            .withDescription(
                '"high" — detects subtle movement and stationary presence. ' +
                '"medium" — balanced default. ' +
                '"low" — only strong or close-range activity triggers detection. ' +
                '"custom" — per-zone thresholds active (set automatically when any zone threshold is written).',
            ),

        // ── Auto-calibration ──────────────────────────────────────────────────
        e.enum('auto_calibration', ea.SET, ['start', 'cancel']).withCategory('config')
            .withDescription(
                'Trigger AI self-learning to auto-tune thresholds for your environment. ' +
                'Set to "start", leave the room for ~60 s, then check auto_calibration_status. ' +
                'Allow 5–10 minutes of sensor warm-up before first calibration run.',
            ),

        e.enum('auto_calibration_status', ea.STATE, ['standby', 'start', 'learning', 'success', 'fail', 'cancel'])
            .withDescription(
                '"standby" — idle. "start" — initiated. "learning" — in progress. ' +
                '"success" — thresholds updated. "fail" — failed. "cancel" — stopped by user.',
            ),

        // ── LED indicator ─────────────────────────────────────────────────────
        e.binary('led_indicator', ea.ALL, true, false).withCategory('config')
            .withDescription('Physical LED indicator of the sensor.'),

        // ── Real-time energy streaming ────────────────────────────────────────
        e.binary('energy_streaming', ea.ALL, true, false).withCategory('config')
            .withDescription(
                'Enable diagnostic per-zone radar energy reporting. ' +
                'Automatically stops sending keep-alive commands and requests OFF after 5 minutes. Reported state changes only on device confirmation.',
            ),

        // ── Per-zone live energy (DP102, diagnostic) ──────────────────────────
        ...buildEnergyExposes(),

        // ── Zone active toggles (DP117) ───────────────────────────────────────
        ...buildZoneActiveExposes(),

        // ── Per-zone thresholds (DP124) ───────────────────────────────────────
        ...buildThresholdExposes(),
    ];
}

// ─── Device definition ────────────────────────────────────────────────────────
const definition = {
    fingerprint: [{modelID: 'TS0601', manufacturerName: '_TZE284_ft7qqpx3', priority: 1}],
    model: 'ZPS-Z1',
    vendor: 'Zemismart',
    description: '24 GHz mmWave presence sensor',
    fromZigbee: [fzConverter],
    toZigbee: [tzConverter],

    onEvent: async (event) => {
        if (event.type !== 'stop') return;
        const state = runtime.get(event.data.ieeeAddr);
        if (!state) return;
        state.stopped = true;
        stopKeepAlive(state);
        for (const cancel of state.delays) cancel();
        for (const waiter of [...state.waiters]) waiter.finish(new Error('[ZPS-Z1] Device stopped'));
        runtime.delete(event.data.ieeeAddr);
    },

    configure: async (device, coordinatorEndpoint) => {
        const endpoint = device.getEndpoint(1);
        await endpoint.bind(TUYA_CLUSTER, coordinatorEndpoint);
        await queryState(endpoint, getRuntime(device), true);
    },

    options: [
        e.binary('show_advanced', ea.SET, true, false)
            .withLabel('Advanced controls')
            .withDescription('Show zone tuning, self-learning and diagnostic fields. Disabled by default. This also changes which advanced entities are discovered by Home Assistant; MQTT fields remain available.'),
    ],
    exposes: (_device, options = {}) => {
        const fields = buildAllExposes();
        if (options.show_advanced === true) return fields;
        return BASIC_PROPERTIES.map(property => fields.find(field => field.property === property));
    },

    meta: {
        tuyaDatapoints: null, // custom fz/tz above; disable built-in Tuya DP handler
    },
};

module.exports = definition;