'use strict';

// ─── Constants ────────────────────────────────────────────────────────────────

const TUYA_CLUSTER = 'manuSpecificTuya';

const DP = {
    PRESENCE_STATE:     1,
    DETECTION_RANGE:    2,
    ILLUMINANCE:        101,
    ENERGY_VALUE:       102,
    AI_SELF_LEARNING:   103,
    HEARTBEAT_ENABLE:   104,
    HEART:              105,
    SENSITIVITY_PRESET: 112,
    ZONE_MAP:           117,
    NO_PERSON_TIME:     119,
    INDICATOR:          123,
    ENERGY_THRESHOLD:   124,
};

const DT = { RAW: 0x00, BOOL: 0x01, VALUE: 0x02, ENUM: 0x04 };

const ZONE_COUNT = 10;

// ─── Scaling helpers (0–100 ↔ 0–255) ─────────────────────────────────────────

function toApp(raw)  { return Math.round((raw  / 255) * 100); }
function toRaw(app)  { return Math.round((app  / 100) * 255); }

// ─── Keep-alive (DP104) ──────────────────────────────────────────────────────

const keepAliveTimers = {};

function startKeepAlive(device, endpoint) {
    stopKeepAlive(device.ieeeAddr);
    keepAliveTimers[device.ieeeAddr] = setInterval(async () => {
        try {
            await endpoint.command(
                TUYA_CLUSTER, 'dataRequest',
                { seq: Math.round(Math.random() * 0xFFFF), dpValues: [{ dp: DP.HEARTBEAT_ENABLE, datatype: DT.BOOL, data: [1] }] },
                { disableDefaultResponse: true },
            );
        } catch (_) { /* transient error — will retry in 5 s */ }
    }, 5000);
}

function stopKeepAlive(ieeeAddr) {
    if (keepAliveTimers[ieeeAddr]) {
        clearInterval(keepAliveTimers[ieeeAddr]);
        delete keepAliveTimers[ieeeAddr];
    }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function sendDP(endpoint, dp, datatype, data) {
    await endpoint.command(
        TUYA_CLUSTER, 'dataRequest',
        { seq: Math.round(Math.random() * 0xFFFF), dpValues: [{ dp, datatype, data }] },
        { disableDefaultResponse: true },
    );
}

/** Read current cached zone active states from Z2M state, falling back to true (active). */
function currentZoneArray(meta) {
    const state = meta.state ?? {};
    return Array.from({ length: ZONE_COUNT }, (_, i) => {
        const v = state[`zone_${i + 1}_active`];
        return (v === false) ? false : true;
    });
}

/** Encode array of zone active booleans → 10-byte Buffer. 1=active, 0=blocked. */
function encodeZoneMap(zones) {
    const buf = Buffer.alloc(ZONE_COUNT, 1);
    zones.forEach((active, i) => { buf[i] = active ? 1 : 0; });
    return buf;
}

/** Decode 20-byte energy/threshold Buffer → { a: number[10], b: number[10] } */
function decodeEnergyBuffer(data) {
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
    const a = [], b = [];
    for (let i = 0; i < ZONE_COUNT; i++) {
        a.push(buf[i] ?? 0);
        b.push(buf[ZONE_COUNT + i] ?? 0);
    }
    return { a, b };
}

/** Encode two number[10] arrays (raw 0–255) → 20-byte Buffer. */
function encodeEnergyBuffer(arrA, arrB) {
    const buf = Buffer.alloc(20, 0);
    for (let i = 0; i < ZONE_COUNT; i++) {
        buf[i]              = Math.max(0, Math.min(255, Math.round(arrA[i] ?? 0)));
        buf[ZONE_COUNT + i] = Math.max(0, Math.min(255, Math.round(arrB[i] ?? 0)));
    }
    return buf;
}

// ─── fromZigbee ───────────────────────────────────────────────────────────────
const fzConverter = {
    cluster: TUYA_CLUSTER,
    type: ['commandDataResponse', 'commandDataReport'],
    convert(model, msg, publish, options, meta) {
        const result = {};

        for (const dpv of (msg.data?.dpValues ?? [])) {
            const { dp, data } = dpv;
            const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);

            switch (dp) {

                // ── DP1: Presence state ───────────────────────────────────────
                case DP.PRESENCE_STATE: {
                    const map = { 0: 'absence', 1: 'presence', 2: 'sensor_close' };
                    const state = map[buf[0]] ?? 'unknown';
                    result.presence_state = state;
                    result.occupancy = (state === 'presence');
                    break;
                }

                // ── DP2: Detection range ──────────────────────────────────────
                case DP.DETECTION_RANGE:
                    result.detection_range = buf.readUInt32BE(0);
                    break;

                // ── DP101: Illuminance ────────────────────────────────────────
                case DP.ILLUMINANCE:
                    result.illuminance = buf.readUInt32BE(0);
                    break;

                // ── DP102: Per-zone energy values (live, when streaming on) ───
                case DP.ENERGY_VALUE: {
                    if (buf.length < 20) break;
                    const { a: motion, b: presence } = decodeEnergyBuffer(buf);
                    for (let i = 0; i < ZONE_COUNT; i++) {
                        result[`zone_${i + 1}_motion_energy`]   = toApp(motion[i]);
                        result[`zone_${i + 1}_presence_energy`] = toApp(presence[i]);
                    }
                    break;
                }

                // ── DP103: Auto-calibration status ────────────────────────────
                case DP.AI_SELF_LEARNING: {
                    const map = { 0: 'standby', 1: 'start', 2: 'learning', 3: 'success', 4: 'fail', 5: 'cancel' };
                    result.auto_calibration_status = map[buf[0]] ?? 'unknown';
                    break;
                }

                // ── DP104: Energy streaming ack ───────────────────────────────
                case DP.HEARTBEAT_ENABLE:
                    result.energy_streaming = (buf[0] === 1);
                    break;

                // ── DP105: Device keepalive (no user-visible state) ───────────
                case DP.HEART:
                    break;

                // ── DP112: Sensitivity preset ─────────────────────────────────
                case DP.SENSITIVITY_PRESET: {
                    const map = { 0: 'high', 1: 'medium', 2: 'low', 3: 'custom' };
                    result.sensitivity_preset = map[buf[0]] ?? 'unknown';
                    break;
                }

                // ── DP117: Zone mode map ──────────────────────────────────────
                case DP.ZONE_MAP: {
                    if (buf.length < ZONE_COUNT) break;
                    for (let i = 0; i < ZONE_COUNT; i++) {
                        // 1 = active, 0 = blocked (shielded), 2 = treat as active
                        result[`zone_${i + 1}_active`] = (buf[i] !== 0);
                    }
                    break;
                }

                // ── DP119: Presence clear cooldown ────────────────────────────
                case DP.NO_PERSON_TIME:
                    result.presence_clear_cooldown = buf.readUInt32BE(0);
                    break;

                // ── DP123: LED indicator ──────────────────────────────────────
                case DP.INDICATOR:
                    result.led_indicator = (buf[0] === 1);
                    break;

                // ── DP124: Per-zone energy thresholds ─────────────────────────
                case DP.ENERGY_THRESHOLD: {
                    if (buf.length < 20) break;
                    const { a: motionThr, b: presenceThr } = decodeEnergyBuffer(buf);
                    // Cache raw values for safe read-modify-write in toZigbee
                    meta.device._lastThresholds = { motionThr: [...motionThr], presenceThr: [...presenceThr] };
                    for (let i = 0; i < ZONE_COUNT; i++) {
                        result[`zone_${i + 1}_motion_threshold`]   = toApp(motionThr[i]);
                        result[`zone_${i + 1}_presence_threshold`] = toApp(presenceThr[i]);
                    }
                    break;
                }

                default:
                    meta.logger.debug(`[ZPS-Z1] Unknown DP ${dp}: ${buf.toString('hex')}`);
            }
        }

        return result;
    },
};

// ─── toZigbee ─────────────────────────────────────────────────────────────────

const ZONE_ACTIVE_KEYS       = Array.from({ length: ZONE_COUNT }, (_, i) => `zone_${i + 1}_active`);
const ZONE_MOTION_THR_KEYS   = Array.from({ length: ZONE_COUNT }, (_, i) => `zone_${i + 1}_motion_threshold`);
const ZONE_PRESENCE_THR_KEYS = Array.from({ length: ZONE_COUNT }, (_, i) => `zone_${i + 1}_presence_threshold`);

const tzConverter = {
    key: [
        'detection_range',
        'sensitivity_preset',
        'presence_clear_cooldown',
        'led_indicator',
        'energy_streaming',
        'auto_calibration',
        ...ZONE_ACTIVE_KEYS,
        ...ZONE_MOTION_THR_KEYS,
        ...ZONE_PRESENCE_THR_KEYS,
    ],

    async convertSet(entity, key, value, meta) {
        const endpoint = meta.device.getEndpoint(1);

        // ── detection_range (DP2) ─────────────────────────────────────────────
        if (key === 'detection_range') {
            const clamped = Math.max(0, Math.min(500, Math.round(value / 50) * 50));
            const buf = Buffer.alloc(4);
            buf.writeUInt32BE(clamped, 0);
            await sendDP(endpoint, DP.DETECTION_RANGE, DT.VALUE, [...buf]);
            return { state: { detection_range: clamped } };
        }

        // ── sensitivity_preset (DP112) ────────────────────────────────────────
        if (key === 'sensitivity_preset') {
            const map = { high: 0, medium: 1, low: 2, custom: 3 };
            const val = map[value];
            if (val === undefined) throw new Error(`[ZPS-Z1] Invalid sensitivity_preset: ${value}`);
            await sendDP(endpoint, DP.SENSITIVITY_PRESET, DT.ENUM, [val]);
            return { state: { sensitivity_preset: value } };
        }

        // ── presence_clear_cooldown (DP119) ───────────────────────────────────
        if (key === 'presence_clear_cooldown') {
            const clamped = Math.max(2, Math.min(60, Math.round(value)));
            const buf = Buffer.alloc(4);
            buf.writeUInt32BE(clamped, 0);
            await sendDP(endpoint, DP.NO_PERSON_TIME, DT.VALUE, [...buf]);
            return { state: { presence_clear_cooldown: clamped } };
        }

        // ── led_indicator (DP123) ─────────────────────────────────────────────
        if (key === 'led_indicator') {
            const on = value === true || value === 'ON';
            await sendDP(endpoint, DP.INDICATOR, DT.BOOL, [on ? 1 : 0]);
            return { state: { led_indicator: on } };
        }

        // ── energy_streaming (DP104) ──────────────────────────────────────────
        if (key === 'energy_streaming') {
            const on = value === true || value === 'ON';
            await sendDP(endpoint, DP.HEARTBEAT_ENABLE, DT.BOOL, [on ? 1 : 0]);
            if (on) startKeepAlive(meta.device, endpoint);
            else stopKeepAlive(meta.device.ieeeAddr);
            return { state: { energy_streaming: on } };
        }

        // ── auto_calibration (DP103) ──────────────────────────────────────────
        if (key === 'auto_calibration') {
            const map = { start: 1, cancel: 5 };
            const cmd = map[value];
            if (cmd === undefined) throw new Error(`[ZPS-Z1] Invalid auto_calibration value: ${value}`);
            await sendDP(endpoint, DP.AI_SELF_LEARNING, DT.ENUM, [cmd]);
            return { state: {} };
        }

        // ── zone_N_active (DP117) ─────────────────────────────────────────────
        // Read-modify-write: update only the changed zone, preserve all others.
        if (ZONE_ACTIVE_KEYS.includes(key)) {
            const zoneIdx = parseInt(key.split('_')[1], 10) - 1;
            const active  = value === true || value === 'ON';
            const zones   = currentZoneArray(meta);
            zones[zoneIdx] = active;
            const buf = encodeZoneMap(zones);
            await sendDP(endpoint, DP.ZONE_MAP, DT.RAW, [...buf]);
            const stateUpdate = {};
            zones.forEach((a, i) => { stateUpdate[`zone_${i + 1}_active`] = a; });
            return { state: stateUpdate };
        }

        // ── zone_N_motion_threshold (DP124) ───────────────────────────────────
        // Value arrives as 0–100; convert to raw 0–255 before sending.
        if (ZONE_MOTION_THR_KEYS.includes(key)) {
            const zoneIdx = parseInt(key.split('_')[1], 10) - 1;
            const cached  = meta.device._lastThresholds;
            const state   = meta.state ?? {};
            const motionThr   = cached
                ? [...cached.motionThr]
                : Array.from({ length: ZONE_COUNT }, (_, i) => toRaw(state[`zone_${i + 1}_motion_threshold`]   ?? 50));
            const presenceThr = cached
                ? [...cached.presenceThr]
                : Array.from({ length: ZONE_COUNT }, (_, i) => toRaw(state[`zone_${i + 1}_presence_threshold`] ?? 50));
            motionThr[zoneIdx] = toRaw(Math.max(0, Math.min(100, Math.round(value))));
            const buf = encodeEnergyBuffer(motionThr, presenceThr);
            await sendDP(endpoint, DP.ENERGY_THRESHOLD, DT.RAW, [...buf]);
            await new Promise((r) => setTimeout(r, 150));
            await sendDP(endpoint, DP.SENSITIVITY_PRESET, DT.ENUM, [3]);
            const stateUpdate = { sensitivity_preset: 'custom' };
            motionThr.forEach((v, i)   => { stateUpdate[`zone_${i + 1}_motion_threshold`]   = toApp(v); });
            presenceThr.forEach((v, i) => { stateUpdate[`zone_${i + 1}_presence_threshold`] = toApp(v); });
            return { state: stateUpdate };
        }

        // ── zone_N_presence_threshold (DP124) ─────────────────────────────────
        if (ZONE_PRESENCE_THR_KEYS.includes(key)) {
            const zoneIdx = parseInt(key.split('_')[1], 10) - 1;
            const cached  = meta.device._lastThresholds;
            const state   = meta.state ?? {};
            const motionThr   = cached
                ? [...cached.motionThr]
                : Array.from({ length: ZONE_COUNT }, (_, i) => toRaw(state[`zone_${i + 1}_motion_threshold`]   ?? 50));
            const presenceThr = cached
                ? [...cached.presenceThr]
                : Array.from({ length: ZONE_COUNT }, (_, i) => toRaw(state[`zone_${i + 1}_presence_threshold`] ?? 50));
            presenceThr[zoneIdx] = toRaw(Math.max(0, Math.min(100, Math.round(value))));
            const buf = encodeEnergyBuffer(motionThr, presenceThr);
            await sendDP(endpoint, DP.ENERGY_THRESHOLD, DT.RAW, [...buf]);
            await new Promise((r) => setTimeout(r, 150));
            await sendDP(endpoint, DP.SENSITIVITY_PRESET, DT.ENUM, [3]);
            const stateUpdate = { sensitivity_preset: 'custom' };
            motionThr.forEach((v, i)   => { stateUpdate[`zone_${i + 1}_motion_threshold`]   = toApp(v); });
            presenceThr.forEach((v, i) => { stateUpdate[`zone_${i + 1}_presence_threshold`] = toApp(v); });
            return { state: stateUpdate };
        }

        meta.logger.warn(`[ZPS-Z1] convertSet: unhandled key "${key}"`);
    },

    async convertGet(entity, key, meta) {
        // TS0601 Tuya devices do not support ZCL attribute reads for DPs.
        // State is populated via the dataQuery in configure().
    },
};

// ─── Expose builders ──────────────────────────────────────────────────────────

const e  = require('zigbee-herdsman-converters/lib/exposes');
const ea = e.access;

function buildZoneActiveExposes() {
    return Array.from({ length: ZONE_COUNT }, (_, i) =>
        e.binary(`zone_${i + 1}_active`, ea.ALL, true, false)
            .withDescription(`${i * 50}\u2013${(i + 1) * 50}cm`),
    );
}

function buildEnergyExposes() {
    const items = [];
    for (let i = 1; i <= ZONE_COUNT; i++) {
        items.push(
            e.numeric(`zone_${i}_motion_energy`, ea.STATE)
                .withDescription(`Zone ${i} live motion energy (0–100).`)
                .withValueMin(0).withValueMax(100)
                .withCategory('diagnostic'),
            e.numeric(`zone_${i}_presence_energy`, ea.STATE)
                .withDescription(`Zone ${i} live presence energy (0–100).`)
                .withValueMin(0).withValueMax(100)
                .withCategory('diagnostic'),
        );
    }
    return items;
}

function buildThresholdExposes() {
    const items = [];
    for (let i = 1; i <= ZONE_COUNT; i++) {
        items.push(
            e.numeric(`zone_${i}_motion_threshold`, ea.ALL)
                .withDescription(`Zone ${i} motion trigger threshold (0–100). Switches sensitivity to custom.`)
                .withValueMin(0).withValueMax(100).withValueStep(1),
            e.numeric(`zone_${i}_presence_threshold`, ea.ALL)
                .withDescription(`Zone ${i} presence trigger threshold (0–100). Switches sensitivity to custom.`)
                .withValueMin(0).withValueMax(100).withValueStep(1),
        );
    }
    return items;
}

// ─── Device definition ────────────────────────────────────────────────────────
const definition = {
    zigbeeModel: ['TS0601'],
    model: 'ZPS-Z1',
    vendor: 'Zemismart',
    description: '24 GHz mmWave presence sensor',
    fromZigbee: [fzConverter],
    toZigbee: [tzConverter],

    onEvent: async (type, data, device) => {
        if (type === 'deviceLeave' || type === 'deviceRemoved') {
            stopKeepAlive(device.ieeeAddr);
        }
    },

    configure: async (device, coordinatorEndpoint, logger) => {
        const endpoint = device.getEndpoint(1);
        await endpoint.bind(TUYA_CLUSTER, coordinatorEndpoint);
        await endpoint.command(TUYA_CLUSTER, 'dataQuery', {}, { disableDefaultResponse: true });
        const log = logger?.debug ?? logger?.info ?? logger?.log ?? (() => {});
        log('[ZPS-Z1] Configured — initial state query sent.');
    },

    exposes: [
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
        e.numeric('detection_range', ea.ALL)
            .withUnit('cm')
            .withDescription('Maximum radar detection distance (0–500 cm, 50 cm steps). Firmware limits radar distance to 500 cm (5 meters).')
            .withValueMin(0).withValueMax(500).withValueStep(50),

        e.numeric('presence_clear_cooldown', ea.ALL)
            .withUnit('s')
            .withDescription('Presence clear time before the sensor switches state to "absence". (2–60 s).')
            .withValueMin(2).withValueMax(60).withValueStep(1),

        e.enum('sensitivity_preset', ea.ALL, ['high', 'medium', 'low', 'custom'])
            .withDescription(
                '"high" — detects subtle movement and stationary presence. ' +
                '"medium" — balanced default. ' +
                '"low" — only strong or close-range activity triggers detection. ' +
                '"custom" — per-zone thresholds active (set automatically when any zone threshold is written).',
            ),

        // ── Auto-calibration ──────────────────────────────────────────────────
        e.enum('auto_calibration', ea.SET, ['start', 'cancel'])
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
        e.binary('led_indicator', ea.ALL, true, false)
            .withDescription('Physical LED indicator of the sensor.'),

        // ── Real-time energy streaming ────────────────────────────────────────
        e.binary('energy_streaming', ea.ALL, true, false)
            .withDescription(
                'Enable diagnostic per-zone radar energy reporting. ' +
                'Turn ON only when tuning thresholds, turn OFF when done to reduce Zigbee traffic.',
            ),

        // ── Per-zone live energy (DP102, diagnostic) ──────────────────────────
        ...buildEnergyExposes(),

        // ── Zone active toggles (DP117) ───────────────────────────────────────
        ...buildZoneActiveExposes(),

        // ── Per-zone thresholds (DP124) ───────────────────────────────────────
        ...buildThresholdExposes(),
    ],

    meta: {
        tuyaDatapoints: null, // custom fz/tz above; disable built-in Tuya DP handler
    },
};

module.exports = definition;