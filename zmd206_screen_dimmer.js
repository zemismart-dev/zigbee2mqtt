/**
 * Zemismart ZMD-206 screen dimmer family for Zigbee2MQTT.
 *
 * Evidence source: Homey live Tuya dataQuery / command-report round trips for
 * TS0601 / _TZE28C1000000_k9e7ihec. The exact _TZE284_k9e7ihec three-gang
 * fingerprint was observed in a Zigbee2MQTT interview and uses the same family
 * mapping; its full functional surface is not yet physically verified.
 */

const zigbeeHerdsmanConverters = require("zigbee-herdsman-converters");
const exposes = zigbeeHerdsmanConverters.exposes || require("zigbee-herdsman-converters/lib/exposes");
const tuya = require("zigbee-herdsman-converters/lib/tuya");

const e = exposes.presets;
const ea = exposes.access;

const BRIGHTNESS_MIN = 10;
const BRIGHTNESS_MAX = 1000;
const CHANNEL_DP_BASES = [1, 7, 15];

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const brightness10To1000 = {
    from: (value) => {
        const raw = clamp(Number(value), BRIGHTNESS_MIN, BRIGHTNESS_MAX);
        return Math.round(((raw - BRIGHTNESS_MIN) * 253) / (BRIGHTNESS_MAX - BRIGHTNESS_MIN) + 1);
    },
    to: (value) => {
        const brightness = clamp(Number(value), 1, 254);
        return Math.round(BRIGHTNESS_MIN + ((brightness - 1) * (BRIGHTNESS_MAX - BRIGHTNESS_MIN)) / 253);
    },
};

const rawText = {
    from: (value) => {
        const buffer = Buffer.isBuffer(value) ? value : Buffer.from(value || []);
        if (buffer.length >= 3 && buffer[0] === 0x00) {
            return buffer.subarray(3, 3 + buffer.readUInt16BE(1)).toString("utf8").replace(/\0+$/g, "");
        }
        return buffer.toString("utf8").replace(/\0+$/g, "");
    },
    to: (value) => [...Buffer.from(String(value ?? ""), "utf8").subarray(0, 12)],
};

const enumLookup = (values) => tuya.valueConverterBasic.lookup(
    Object.fromEntries(values.map((value, index) => [value, tuya.enum(index)])),
);

const loadType = enumLookup(["led", "incandescent", "halogen"]);
const powerOnBehavior = enumLookup(["off", "on", "memory"]);
const indicatorStatus = enumLookup(["off", "follow_switch", "position"]);
const indicatorColor = enumLookup(["1", "2", "3", "4", "5", "6", "7", "8", "9"]);
const screenOffTime = enumLookup(["never", "10", "20", "30", "45", "60"]);

const numeric = (property, min, max, description, unit) => {
    const expose = exposes.numeric(property, ea.STATE_SET)
        .withValueMin(min)
        .withValueMax(max)
        .withValueStep(1)
        .withDescription(description);
    return unit ? expose.withUnit(unit) : expose;
};

const nameSetter = (dp, property) => ({
    key: [property],
    convertSet: async (entity, key, value) => {
        const text = String(value ?? "").slice(0, 12);
        await tuya.sendDataPointRaw(entity, dp, rawText.to(text));
        return {state: {[property]: text}};
    },
});

const lightExpose = (endpoint) => e.light_brightness()
    .withEndpoint(endpoint)
    .setAccess("state", ea.STATE_SET)
    .setAccess("brightness", ea.STATE_SET);

const channelExposes = (channels) => Array.from({length: channels}, (_, index) => {
    const channel = index + 1;
    return [
        lightExpose(`l${channel}`),
        numeric(`brightness_min_l${channel}`, 10, 1000, `Minimum brightness for channel ${channel}`),
        exposes.enum(`load_type_l${channel}`, ea.STATE_SET, ["led", "incandescent", "halogen"])
            .withDescription(`Load type for channel ${channel}`),
        numeric(`brightness_max_l${channel}`, 10, 1000, `Maximum brightness for channel ${channel}`),
        numeric(`countdown_l${channel}`, 0, 86400, `Countdown for channel ${channel}`, "s"),
        exposes.text(`switch${channel}_name`, ea.STATE_SET).withDescription(`Panel name for channel ${channel}`),
    ];
}).flat();

const channelDatapoints = (channels) => Array.from({length: channels}, (_, index) => {
    const channel = index + 1;
    const base = CHANNEL_DP_BASES[index];
    return [
        [base, `state_l${channel}`, tuya.valueConverter.onOff],
        [base + 1, `brightness_l${channel}`, brightness10To1000],
        [base + 2, `brightness_min_l${channel}`, tuya.valueConverter.raw],
        [base + 3, `load_type_l${channel}`, loadType],
        [base + 4, `brightness_max_l${channel}`, tuya.valueConverter.raw],
        [base + 5, `countdown_l${channel}`, tuya.valueConverter.countdown],
        [105 + channel, `switch${channel}_name`, {from: rawText.from, to: null}],
    ];
}).flat();

const definition = (channels, manufacturerNames) => {
    const channelNumbers = Array.from({length: channels}, (_, index) => index + 1);
    return {
        fingerprint: tuya.fingerprint("TS0601", manufacturerNames),
        model: `ZMD-206_${channels}gang_screen_dimmer`,
        vendor: "Zemismart",
        description: `${channels}-gang screen dimmer`,
        // This panel actively requests MCU time; replying prevents repeated
        // time-sync retries and uses the standard Unix epoch expected by Tuya.
        extend: [tuya.modernExtend.tuyaBase({dp: true, timeStart: "1970"})],
        fromZigbee: [tuya.fz.datapoints],
        toZigbee: [
            ...channelNumbers.map((channel) => nameSetter(105 + channel, `switch${channel}_name`)),
            tuya.tz.datapoints,
        ],
        configure: async (device, coordinatorEndpoint) => {
            await tuya.configureMagicPacket(device, coordinatorEndpoint);
        },
        endpoint: () => Object.fromEntries(channelNumbers.map((channel) => [`l${channel}`, 1])),
        exposes: [
            ...channelExposes(channels),
            exposes.enum("power_on_behavior", ea.STATE_SET, ["off", "on", "memory"])
                .withDescription("State after power is restored"),
            exposes.enum("indicator_status", ea.STATE_SET, ["off", "follow_switch", "position"])
                .withDescription("Indicator behavior"),
            exposes.binary("backlight_switch", ea.STATE_SET, "ON", "OFF").withDescription("Screen backlight enabled"),
            exposes.enum("indicator_color_on", ea.STATE_SET, ["1", "2", "3", "4", "5", "6", "7", "8", "9"])
                .withDescription("Indicator color while on"),
            exposes.enum("indicator_color_off", ea.STATE_SET, ["1", "2", "3", "4", "5", "6", "7", "8", "9"])
                .withDescription("Indicator color while off"),
            numeric("backlight_brightness", 0, 100, "Screen backlight brightness", "%"),
            exposes.binary("child_lock", ea.STATE_SET, "LOCK", "UNLOCK").withDescription("Child lock"),
            numeric("gradient_rate", 0, 15, "Dimming transition rate"),
            exposes.enum("screen_off_time", ea.STATE_SET, ["never", "10", "20", "30", "45", "60"])
                .withDescription("Screen off delay in seconds"),
        ],
        meta: {
            multiEndpoint: true,
            multiEndpointSkip: [
                "power_on_behavior", "indicator_status", "backlight_switch", "indicator_color_on",
                "indicator_color_off", "backlight_brightness", "child_lock", "gradient_rate", "screen_off_time",
                ...channelNumbers.map((channel) => `switch${channel}_name`),
            ],
            tuyaDatapoints: [
                ...channelDatapoints(channels),
                [14, "power_on_behavior", powerOnBehavior],
                [21, "indicator_status", indicatorStatus],
                [26, "backlight_switch", tuya.valueConverter.onOff],
                [101, "indicator_color_on", indicatorColor],
                [102, "indicator_color_off", indicatorColor],
                [103, "backlight_brightness", tuya.valueConverter.raw],
                [104, "child_lock", tuya.valueConverter.lockUnlock],
                [105, "gradient_rate", tuya.valueConverter.raw],
                [110, "screen_off_time", screenOffTime],
            ],
        },
    };
};

module.exports = [
    definition(1, ["_TZE28C1000000_5aico93l", "_TZE284_5aico93l"]),
    definition(2, ["_TZE284_pyh4zt7w"]),
    definition(3, ["_TZE28C1000000_k9e7ihec", "_TZE284_k9e7ihec"]),
];
