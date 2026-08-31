// Standalone external converter extracted from the upstream
// zigbee-herdsman-converters/src/devices/zemismart.ts definition for:
// TS0601 / _TZE284_xvywzhmi / _TZE28C1000000_xvywzhmi /
// Zemismart ZMS-208US-3.

const exposes = require("zigbee-herdsman-converters/lib/exposes");
const modernExtend = require("zigbee-herdsman-converters/lib/modernExtend");
const tuya = require("zigbee-herdsman-converters/lib/tuya");

const e = exposes.presets;
const ea = exposes.access;
const lastTimeSyncByDevice = new Map();

const uint32Bytes = (value) => {
    const buffer = Buffer.alloc(4);
    buffer.writeUInt32BE(value >>> 0);
    return [...buffer];
};

const privateScreenCluster = modernExtend.deviceAddCustomCluster("manuSpecificTuyaScreen", {
    name: "manuSpecificTuyaScreen",
    ID: 0xe000,
    attributes: {},
    commands: {},
    commandsResponse: {
        unknownD0: {name: "unknownD0", ID: 0xd0, parameters: []},
        unknownD2: {name: "unknownD2", ID: 0xd2, parameters: []},
    },
});

const fzLocal = {
    throttledMcuSyncTime: {
        cluster: "manuSpecificTuya",
        type: ["commandMcuSyncTime"],
        convert: (model, msg) => {
            const now = Date.now();
            const ieeeAddr = msg.device.ieeeAddr;
            const lastTimeSync = lastTimeSyncByDevice.get(ieeeAddr) || 0;

            if (now - lastTimeSync < 55000) {
                return undefined;
            }

            lastTimeSyncByDevice.set(ieeeAddr, now);
            const utcTime = Math.round(now / 1000);
            const localTime = utcTime - new Date().getTimezoneOffset() * 60;
            msg.endpoint.command("manuSpecificTuya", "mcuSyncTime", {
                payloadSize: 8,
                payload: [...uint32Bytes(utcTime), ...uint32Bytes(localTime)],
            }, {}).catch(() => undefined);

            return undefined;
        },
    },
    ignorePrivateClusterStatus: {
        cluster: "manuSpecificTuyaScreen",
        type: ["commandUnknownD0", "commandUnknownD2"],
        convert: () => undefined,
    },
    datapoints: {
        ...tuya.fz.datapoints,
        convert: (model, msg, publish, options, meta) => {
            const result = tuya.fz.datapoints.convert(model, msg, publish, options, meta);
            if (!result || typeof result !== "object") {
                return result;
            }

            return Object.entries(result).some(([key, value]) => meta.state?.[key] !== value) ? result : undefined;
        },
    },
    ignoreTuyaConfigureResponse: {
        cluster: 0xe000,
        type: ["raw"],
        convert: () => undefined,
    },
};

const name = {
    to: (value) => {
        const limitedString = String(value ?? "").slice(0, 12);
        return Array.from(new TextEncoder().encode(limitedString));
    },
    from: (value) => {
        const data = Object.values(value);
        return new TextDecoder("utf-8").decode(new Uint8Array(data));
    },
};

const definition = {
    fingerprint: tuya.fingerprint("TS0601", [
        "_TZE284_xvywzhmi",
        "_TZE28C1000000_xvywzhmi",
    ]),
    model: "ZMS-208US-3",
    vendor: "Zemismart",
    description: "Smart screen switch 3 gang",
    extend: [tuya.modernExtend.tuyaBase({timeStart: "off", queryOnConfigure: true}), privateScreenCluster],
    fromZigbee: [
        fzLocal.throttledMcuSyncTime,
        fzLocal.ignorePrivateClusterStatus,
        fzLocal.datapoints,
        fzLocal.ignoreTuyaConfigureResponse,
    ],
    toZigbee: [tuya.tz.datapoints],
    exposes: [
        e.switch(),
        e.switch().withEndpoint("l1"),
        e.switch().withEndpoint("l2"),
        e.switch().withEndpoint("l3"),
        e.child_lock(),
        e.text("name", ea.STATE_SET).withEndpoint("l1").withDescription("Name for Switch 1"),
        e.text("name", ea.STATE_SET).withEndpoint("l2").withDescription("Name for Switch 2"),
        e.text("name", ea.STATE_SET).withEndpoint("l3").withDescription("Name for Switch 3"),
        e.numeric("countdown", ea.STATE_SET)
            .withEndpoint("l1")
            .withDescription("Countdown for Switch 1")
            .withUnit("s")
            .withValueMin(0)
            .withValueMax(43200)
            .withValueStep(1),
        e.numeric("countdown", ea.STATE_SET)
            .withEndpoint("l2")
            .withDescription("Countdown for Switch 2")
            .withUnit("s")
            .withValueMin(0)
            .withValueMax(43200)
            .withValueStep(1),
        e.numeric("countdown", ea.STATE_SET)
            .withEndpoint("l3")
            .withDescription("Countdown for Switch 3")
            .withUnit("s")
            .withValueMin(0)
            .withValueMax(43200)
            .withValueStep(1),
    ],
    endpoint: () => ({l1: 1, l2: 1, l3: 1}),
    meta: {
        multiEndpoint: true,
        tuyaDatapoints: [
            [1, "state_l1", tuya.valueConverter.onOff, {skip: tuya.skip.stateOnAndBrightnessPresent}],
            [2, "state_l2", tuya.valueConverter.onOff, {skip: tuya.skip.stateOnAndBrightnessPresent}],
            [3, "state_l3", tuya.valueConverter.onOff, {skip: tuya.skip.stateOnAndBrightnessPresent}],
            [7, "countdown_l1", tuya.valueConverter.raw],
            [8, "countdown_l2", tuya.valueConverter.raw],
            [9, "countdown_l3", tuya.valueConverter.raw],
            [13, "state", tuya.valueConverter.onOff, {skip: tuya.skip.stateOnAndBrightnessPresent}],
            [24, "test_bit", tuya.valueConverter.raw],
            [101, "child_lock", tuya.valueConverter.lockUnlock],
            [105, "name_l1", name],
            [106, "name_l2", name],
            [107, "name_l3", name],
        ],
    },
};

module.exports = [definition];
