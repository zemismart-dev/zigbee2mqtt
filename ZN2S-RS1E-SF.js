const exposes = require("zigbee-herdsman-converters/lib/exposes");
const tuya = require("zigbee-herdsman-converters/lib/tuya");

const e = exposes.presets;
const ea = exposes.access;

const numberValue = (value) => {
    if (typeof value === "number") return value;
    if (Buffer.isBuffer(value) || Array.isArray(value)) {
        const buffer = Buffer.from(value);
        if (buffer.length >= 4) return buffer.readUInt32BE(buffer.length - 4);
        return buffer.length ? buffer[buffer.length - 1] : null;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};

const numberConverter = {
    from: (value) => numberValue(value),
    to: (value) => Number(value),
};

const ignoredDatapoint = {from: () => undefined, to: null};

const fanSpeed = {
    from: (value) => numberValue(value),
    to: (value) => Math.max(0, Math.min(100, Number(value))),
};

const fanColor = tuya.valueConverterBasic.lookup({
    red: tuya.enum(0),
    blue: tuya.enum(1),
    green: tuya.enum(2),
    white: tuya.enum(3),
    yellow: tuya.enum(4),
    cyan: tuya.enum(5),
    purple: tuya.enum(6),
    warm_white: tuya.enum(7),
    warm_yellow: tuya.enum(8),
});

const powerOnBehavior = tuya.valueConverterBasic.lookup({
    off: tuya.enum(0),
    on: tuya.enum(1),
    previous: tuya.enum(2),
});

const indicatorStatus = tuya.valueConverterBasic.lookup({
    off: tuya.enum(0),
    on_off_status: tuya.enum(1),
    switch_position: tuya.enum(2),
});

const definition = {
    fingerprint: tuya.fingerprint("TS0601", [
        "_TZE204_e1hutaaj",
        "_TZE284_e1hutaaj",
    ]),
    model: "ZN2S-RS1E-SF",
    vendor: "Zemismart",
    description: "Zigbee touch fan controller",
    extend: [tuya.modernExtend.tuyaBase({
        dp: true,
        queryOnConfigure: true,
        queryOnDeviceAnnounce: true,
    })],
    configure: async (device, coordinatorEndpoint) => {
        await tuya.configureMagicPacket(device, coordinatorEndpoint);
    },
    exposes: [
        e.switch().setAccess("state", ea.STATE_SET)
            .withDescription("Fan switch"),
        exposes.numeric("fan_speed", ea.STATE_SET)
            .withDescription("Fan speed")
            .withUnit("%")
            .withValueMin(0)
            .withValueMax(100)
            .withValueStep(1),
        exposes.numeric("countdown", ea.STATE_SET)
            .withDescription("Countdown")
            .withUnit("s")
            .withValueMin(0)
            .withValueMax(86400)
            .withValueStep(1),
        exposes.enum("power_on_behavior", ea.STATE_SET, ["off", "on", "previous"])
            .withDescription("Power-on behavior"),
        exposes.enum("indicator_status", ea.STATE_SET, ["off", "on_off_status", "switch_position"])
            .withDescription("Indicator mode"),
        exposes.binary("backlight_switch", ea.STATE_SET, "ON", "OFF")
            .withDescription("Backlight switch"),
        e.child_lock().withAccess(ea.STATE_SET),
        exposes.numeric("minimum_speed", ea.STATE_SET)
            .withDescription("Minimum fan speed")
            .withUnit("%")
            .withValueMin(1)
            .withValueMax(100)
            .withValueStep(1),
        exposes.enum("fan_color_on", ea.STATE_SET, [
            "red",
            "green",
            "blue",
            "white",
            "yellow",
            "cyan",
            "purple",
            "warm_white",
            "warm_yellow",
        ]).withDescription("Indicator color when fan is on"),
        exposes.enum("fan_color_off", ea.STATE_SET, [
            "red",
            "green",
            "blue",
            "white",
            "yellow",
            "cyan",
            "purple",
            "warm_white",
            "warm_yellow",
        ]).withDescription("Indicator color when fan is off"),
        exposes.numeric("backlight_brightness", ea.STATE_SET)
            .withDescription("Backlight brightness")
            .withUnit("%")
            .withValueMin(0)
            .withValueMax(100)
            .withValueStep(1),
    ],
    meta: {
        tuyaDatapoints: [
            [1, "state", tuya.valueConverter.onOff],
            [2, "countdown", tuya.valueConverter.countdown],
            [4, "fan_speed", fanSpeed],
            [5, "_dp5", ignoredDatapoint],
            [11, "power_on_behavior", powerOnBehavior],
            [12, "indicator_status", indicatorStatus],
            [13, "backlight_switch", tuya.valueConverter.onOff],
            [23, "_dp23", ignoredDatapoint],
            [82, "_dp82", ignoredDatapoint],
            [83, "_dp83", ignoredDatapoint],
            [85, "_dp85", ignoredDatapoint],
            [86, "_dp86", ignoredDatapoint],
            [87, "_dp87", ignoredDatapoint],
            [88, "_dp88", ignoredDatapoint],
            [91, "_dp91", ignoredDatapoint],
            [92, "_dp92", ignoredDatapoint],
            [93, "_dp93", ignoredDatapoint],
            [95, "_dp95", ignoredDatapoint],
            [101, "fan_color_on", fanColor],
            [102, "fan_color_off", fanColor],
            [103, "backlight_brightness", numberConverter],
            [104, "child_lock", tuya.valueConverter.lockUnlock],
            [105, "minimum_speed", numberConverter],
            [107, "_dp107", ignoredDatapoint],
        ],
    },
};

module.exports = definition;
