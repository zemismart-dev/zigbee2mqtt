const exposes = require("zigbee-herdsman-converters/lib/exposes");
const tuya = require("zigbee-herdsman-converters/lib/tuya");

const e = exposes.presets;
const ea = exposes.access;

const STATE_DPS = [1, 2, 3, 4];
const COUNTDOWN_DPS = [7, 8, 9, 10];
const RELAY_STATUS_DPS = [29, 30, 31, 32];
const NAME_DPS = [105, 106, 107, 108];
const MAX_NAME_BYTES = 50;
const STATE_PROPERTIES = STATE_DPS.map((_, index) => `state_l${index + 1}`);

const indicatorStatus = tuya.valueConverterBasic.lookup({
    off: tuya.enum(0),
    on_off_status: tuya.enum(1),
    switch_position: tuya.enum(2),
});

const relayStatus = tuya.valueConverterBasic.lookup({
    power_off: tuya.enum(0),
    power_on: tuya.enum(1),
    restart_memory: tuya.enum(2),
});

const switchColor = tuya.valueConverterBasic.lookup({
    red: tuya.enum(0),
    blue: tuya.enum(1),
    green: tuya.enum(2),
    white: tuya.enum(3),
    yellow: tuya.enum(4),
    magenta: tuya.enum(5),
    cyan: tuya.enum(6),
    warm_white: tuya.enum(7),
    warm_yellow: tuya.enum(8),
});

const rawStringConverter = {
    from: (value) => {
        const buffer = Buffer.isBuffer(value) ? value : Buffer.from(value || []);
        return buffer.toString("utf8").replace(/\0+$/g, "");
    },
    to: (value) => [...Buffer.from(String(value ?? ""), "utf8").subarray(0, MAX_NAME_BYTES)],
};

const screenNameConverter = {
    from: (value) => {
        const buffer = Buffer.isBuffer(value) ? value : Buffer.from(value || []);

        if (buffer.length >= 3 && buffer[0] === 0x00) {
            const declaredLength = buffer.readUInt16BE(1);
            return buffer.subarray(3, 3 + declaredLength).toString("utf8").replace(/\0+$/g, "");
        }

        return buffer.toString("utf8").replace(/\0+$/g, "");
    },
    to: (value) => rawStringConverter.to(value),
};

const screenNameToZigbee = (property, dp) => ({
    key: [property],
    convertSet: async (entity, key, value) => {
        const bytes = screenNameConverter.to(value);
        const name = Buffer.from(bytes).toString("utf8");
        await tuya.sendDataPointRaw(entity, dp, bytes);
        return {state: {[property]: name}};
    },
});

const fzLocal = {
    datapoints: {
        ...tuya.fz.datapoints,
        convert: (model, msg, publish, options, meta) => {
            const result = tuya.fz.datapoints.convert(model, msg, publish, options, meta);
            if (!result || msg.type !== "commandDataReport") {
                return result;
            }

            const keys = Object.keys(result);
            const isUnchangedStateReport = keys.length > 0 && keys.every((key) => (
                STATE_PROPERTIES.includes(key) && meta.state?.[key] === result[key]
            ));

            return isUnchangedStateReport ? undefined : result;
        },
    },
    ignoreTuyaConfigureResponse: {
        cluster: 0xe000,
        type: ["raw"],
        convert: () => undefined,
    },
};

const endpointMap = (channels) => {
    const endpoints = {};
    for (let channel = 1; channel <= channels; channel++) {
        endpoints[`l${channel}`] = 1;
    }
    return endpoints;
};

const switchExposes = (channels) => {
    const result = [];
    for (let channel = 1; channel <= channels; channel++) {
        result.push(e.switch().withEndpoint(`l${channel}`).setAccess("state", ea.STATE_SET));
    }
    return result;
};

const nameExposes = (channels) => {
    const result = [];
    for (let channel = 1; channel <= channels; channel++) {
        result.push(
            exposes.text(`switch${channel}_name`, ea.STATE_SET)
                .withDescription(`Display name for gang ${channel}`),
        );
    }
    return result;
};

const countdownExposes = (channels) => {
    const result = [];
    for (let channel = 1; channel <= channels; channel++) {
        result.push(
            exposes.numeric(`countdown_l${channel}`, ea.STATE_SET)
                .withUnit("s")
                .withValueMin(0)
                .withValueMax(43200)
                .withValueStep(1)
                .withDescription(`Countdown for gang ${channel}`),
        );
    }
    return result;
};

const relayStatusExposes = (channels) => {
    const result = [];
    for (let channel = 1; channel <= channels; channel++) {
        result.push(
            exposes.enum(`relay_status_l${channel}`, ea.STATE_SET, ["power_off", "power_on", "restart_memory"])
                .withDescription(`Relay power-on behavior for gang ${channel}`),
        );
    }
    return result;
};

const tuyaDatapoints = (channels) => {
    const result = [
        [13, "state", tuya.valueConverter.onOff],
        [14, "relay_status", tuya.valueConverter.raw],
        [15, "indicator_status", indicatorStatus],
        [16, "backlight_mode", tuya.valueConverter.onOff],
        [24, "test_bit", tuya.valueConverter.raw],
        [101, "child_lock", tuya.valueConverter.lockUnlock],
        [102, "backlight_brightness", tuya.valueConverter.raw],
        [103, "switch_color_off", switchColor],
        [104, "switch_color_on", switchColor],
        [201, "cycle_schedule", rawStringConverter],
    ];
    for (let channel = 1; channel <= channels; channel++) {
        result.push([STATE_DPS[channel - 1], `state_l${channel}`, tuya.valueConverter.onOff]);
        result.push([COUNTDOWN_DPS[channel - 1], `countdown_l${channel}`, tuya.valueConverter.countdown]);
        result.push([RELAY_STATUS_DPS[channel - 1], `relay_status_l${channel}`, relayStatus]);
    }
    for (let channel = 1; channel <= channels; channel++) {
        result.push([
            NAME_DPS[channel - 1],
            `switch${channel}_name`,
            {from: screenNameConverter.from, to: null},
        ]);
    }
    return result;
};

const COMMON_EXPOSES = [
    exposes.binary("backlight_mode", ea.STATE_SET, "ON", "OFF")
        .withDescription("Backlight mode"),
    exposes.numeric("backlight_brightness", ea.STATE_SET)
        .withDescription("Backlight brightness")
        .withUnit("%")
        .withValueMin(0)
        .withValueMax(100)
        .withValueStep(1),
    e.child_lock().withAccess(ea.STATE_SET),
    exposes.enum("switch_color_on", ea.STATE_SET, [
        "red",
        "blue",
        "green",
        "white",
        "yellow",
        "magenta",
        "cyan",
        "warm_white",
        "warm_yellow",
    ]).withDescription("Indicator color when on"),
    exposes.enum("switch_color_off", ea.STATE_SET, [
        "red",
        "blue",
        "green",
        "white",
        "yellow",
        "magenta",
        "cyan",
        "warm_white",
        "warm_yellow",
    ]).withDescription("Indicator color when off"),
    exposes.enum("indicator_status", ea.STATE_SET, ["off", "on_off_status", "switch_position"])
        .withDescription("Indicator mode"),
    exposes.text("cycle_schedule", ea.STATE_SET)
        .withDescription("Cycle schedule"),
];

const nameConverters = (channels) => {
    const result = [];
    for (let channel = 1; channel <= channels; channel++) {
        result.push(screenNameToZigbee(`switch${channel}_name`, NAME_DPS[channel - 1]));
    }
    return result;
};

const createDefinition = ({channels, fingerprints}) => ({
    fingerprint: tuya.fingerprint("TS0601", fingerprints),
    model: `TS0601_${channels}gang_screen_switch_zms206`,
    vendor: "Zemismart",
    description: `${channels} gang Zemismart ZMS206 screen switch`,
    extend: [tuya.modernExtend.tuyaBase({dp: true, timeStart: "1970"})],
    fromZigbee: [fzLocal.datapoints, fzLocal.ignoreTuyaConfigureResponse],
    toZigbee: [
        ...nameConverters(channels),
        tuya.tz.datapoints,
    ],
    configure: async (device, coordinatorEndpoint) => {
        await tuya.configureMagicPacket(device, coordinatorEndpoint);
    },
    endpoint: () => endpointMap(channels),
    meta: {
        multiEndpoint: true,
        tuyaDatapoints: tuyaDatapoints(channels),
    },
    exposes: [
        ...COMMON_EXPOSES,
        ...switchExposes(channels),
        ...countdownExposes(channels),
        ...relayStatusExposes(channels),
        ...nameExposes(channels),
    ],
});

module.exports = [
    createDefinition({
        channels: 1,
        fingerprints: [
            "_TZE204_lnyz4a6v",
            "_TZE204_sa2ueffe",
            "_TZE204_zuepxzck",
            "_TZE28C1000000_lnyz4a6v",
            "_TZE284_lnyz4a6v",
            "_TZE284_1tnysxwl",
            "_TZE284_sa2ueffe",
        ],
    }),
    createDefinition({
        channels: 2,
        fingerprints: [
            "_TZE204_3ctwoaip",
            "_TZE204_dmckrsxg",
            "_TZE28C1000000_dmckrsxg",
            "_TZE284_3ctwoaip",
            "_TZE284_dmckrsxg",
            "_TZE284_a2teqi5u",
            "_TZE28C1000000_a2teqi5u",
        ],
    }),
    createDefinition({
        channels: 3,
        fingerprints: [
            "_TZE204_e4pf6l87",
            "_TZE204_k7v0eqke",
            "_TZE204_iyki9kjp",
            "_TZE284_k7v0eqke",
            "_TZE284_e4pf6l87",
            "_TZE28C1000000_e4pf6l87",
            "_TZE284_xvywzhmi",
        ],
    }),
    createDefinition({
        channels: 4,
        fingerprints: [
            "_TZE204_y4jqpry8",
            "_TZE284_y4jqpry8",
            "_TZE28C1000000_y4jqpry8",
            "_TZE204_wwaeqnrf",
            "_TZE284_wwaeqnrf",
            "_TZE204_xibaabmu",
            "_TZE284_xibaabmu",
            "_TZE28C1000000_xibaabmu",
            "_TZE204_08qc13ct",
        ],
    }),
];
