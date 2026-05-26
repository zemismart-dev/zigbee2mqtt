const exposes = require("zigbee-herdsman-converters/lib/exposes");
const tuya = require("zigbee-herdsman-converters/lib/tuya");

const e = exposes.presets;
const ea = exposes.access;

const screenNameConverter = {
    from: (value) => {
        const buffer = Buffer.isBuffer(value) ? value : Buffer.from(value || []);

        if (buffer.length >= 3 && buffer[0] === 0x00) {
            const declaredLength = buffer.readUInt16BE(1);
            return buffer.subarray(3, 3 + declaredLength).toString("utf8").replace(/\0+$/g, "");
        }

        return buffer.toString("utf8").replace(/\0+$/g, "");
    },
    to: (value) => [...Buffer.from(String(value ?? ""), "utf8")],
};

const screenNameToZigbee = (property, dp) => ({
    key: [property],
    convertSet: async (entity, key, value) => {
        const name = String(value ?? "");
        await tuya.sendDataPointRaw(entity, dp, screenNameConverter.to(name));
        return {state: {[property]: name}};
    },
});

const fzLocal = {
    ignoreTuyaConfigureResponse: {
        cluster: 0xe000,
        type: ["raw"],
        convert: () => undefined,
    },
};

const ignoredDatapoint = {from: () => undefined, to: null};

const radarDistance = tuya.valueConverterBasic.lookup({
    short: tuya.enum(0),
    medium_short: tuya.enum(1),
    medium: tuya.enum(2),
    medium_long: tuya.enum(3),
    long: tuya.enum(4),
});

const screenOffTime = tuya.valueConverterBasic.lookup({
    none: tuya.enum(0),
    "10": tuya.enum(1),
    "20": tuya.enum(2),
    "30": tuya.enum(3),
    "45": tuya.enum(4),
    "60": tuya.enum(5),
});

const definition = {
    fingerprint: tuya.fingerprint("TS0601", [
        "_TZE284_o409r73p",
        "_TZE28C1000000_o409r73p",
    ]),
    model: "TS0601_2gang_screen_switch_o409r73p",
    vendor: "Zemismart",
    description: "2 gang screen switch with metering",
    extend: [
        tuya.modernExtend.tuyaBase({dp: true}),
        tuya.modernExtend.tuyaWeatherForecast(),
    ],
    fromZigbee: [tuya.fz.datapoints, fzLocal.ignoreTuyaConfigureResponse],
    toZigbee: [
        screenNameToZigbee("switch1_name", 105),
        screenNameToZigbee("switch2_name", 106),
        tuya.tz.datapoints,
    ],
    onEvent: tuya.onEventSetTime,
    configure: async (device, coordinatorEndpoint) => {
        await tuya.configureMagicPacket(device, coordinatorEndpoint);
    },
    endpoint: () => ({l1: 1, l2: 1}),
    meta: {
        multiEndpoint: true,
        tuyaDatapoints: [
            [1, "state_l1", tuya.valueConverter.onOff],
            [2, "state_l2", tuya.valueConverter.onOff],
            [7, "countdown_l1", tuya.valueConverter.countdown],
            [8, "countdown_l2", tuya.valueConverter.countdown],
            [13, "_dp13", ignoredDatapoint],
            [14, "power_on_behavior", tuya.valueConverter.powerOnBehaviorEnum],
            [16, "radar_switch", tuya.valueConverter.onOff],
            [20, "energy", tuya.valueConverter.divideBy1000],
            [21, "current", tuya.valueConverter.divideBy1000],
            [22, "power", tuya.valueConverter.divideBy10],
            [23, "voltage", tuya.valueConverter.divideBy10],
            [29, "power_on_behavior_l1", tuya.valueConverter.powerOnBehaviorEnum],
            [30, "power_on_behavior_l2", tuya.valueConverter.powerOnBehaviorEnum],
            [101, "child_lock", tuya.valueConverter.onOff],
            [102, "backlight", tuya.valueConverter.raw],
            [104, "radar_distance", radarDistance],
            [105, "switch1_name", {from: screenNameConverter.from, to: null}],
            [106, "switch2_name", {from: screenNameConverter.from, to: null}],
            [111, "screen_off_time", screenOffTime],
            [112, "_dp112", ignoredDatapoint],
            [113, "_dp113", ignoredDatapoint],
        ],
    },
    exposes: [
        e.switch().withEndpoint("l1").setAccess("state", ea.STATE_SET),
        e.switch().withEndpoint("l2").setAccess("state", ea.STATE_SET),
        exposes.numeric("countdown_l1", ea.STATE_SET)
            .withUnit("s")
            .withValueMin(0)
            .withValueMax(43200)
            .withValueStep(1)
            .withDescription("Countdown for gang 1"),
        exposes.numeric("countdown_l2", ea.STATE_SET)
            .withUnit("s")
            .withValueMin(0)
            .withValueMax(43200)
            .withValueStep(1)
            .withDescription("Countdown for gang 2"),
        e.power_on_behavior().withAccess(ea.STATE_SET),
        e.power_on_behavior().withEndpoint("l1").withAccess(ea.STATE_SET),
        e.power_on_behavior().withEndpoint("l2").withAccess(ea.STATE_SET),
        exposes.binary("radar_switch", ea.STATE_SET, "ON", "OFF")
            .withDescription("Radar switch"),
        exposes.binary("child_lock", ea.STATE_SET, "ON", "OFF")
            .withDescription("Child lock"),
        exposes.numeric("backlight", ea.STATE_SET)
            .withUnit("%")
            .withValueMin(0)
            .withValueMax(100)
            .withValueStep(1)
            .withDescription("Backlight brightness"),
        exposes.enum("radar_distance", ea.STATE_SET, ["short", "medium_short", "medium", "medium_long", "long"])
            .withDescription("Radar distance"),
        exposes.enum("screen_off_time", ea.STATE_SET, ["none", "10", "20", "30", "45", "60"])
            .withDescription("Screen off time"),
        exposes.text("switch1_name", ea.STATE_SET)
            .withDescription("Display name for gang 1"),
        exposes.text("switch2_name", ea.STATE_SET)
            .withDescription("Display name for gang 2"),
        e.energy(),
        e.current(),
        e.power(),
        e.voltage(),
    ],
};

module.exports = definition;
