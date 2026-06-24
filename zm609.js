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

const STATE_DPS = [1, 2, 3];
const COUNTDOWN_DPS = [7, 8, 9];
const POWER_ON_BEHAVIOR_DPS = [29, 30, 31];
const NAME_DPS = [105, 106, 107];

const endpointMap = (channels) => {
    const endpoints = {};
    for (let channel = 1; channel <= channels; channel++) {
        endpoints[`l${channel}`] = 1;
    }
    return endpoints;
};

const channelDatapoints = (channels) => {
    const datapoints = [
        [13, "_dp13", ignoredDatapoint],
        [14, "power_on_behavior", tuya.valueConverter.powerOnBehaviorEnum],
        [16, "radar_switch", tuya.valueConverter.onOff],
        [20, "energy", tuya.valueConverter.divideBy1000],
        [21, "current", tuya.valueConverter.divideBy1000],
        [22, "power", tuya.valueConverter.divideBy10],
        [23, "voltage", tuya.valueConverter.divideBy10],
        [101, "child_lock", tuya.valueConverter.onOff],
        [102, "backlight", tuya.valueConverter.raw],
        [104, "radar_distance", radarDistance],
        [111, "screen_off_time", screenOffTime],
        [112, "_dp112", ignoredDatapoint],
        [113, "_dp113", ignoredDatapoint],
        [114, "_dp114", ignoredDatapoint],
    ];

    for (let channel = 1; channel <= channels; channel++) {
        datapoints.push([STATE_DPS[channel - 1], `state_l${channel}`, tuya.valueConverter.onOff]);
        datapoints.push([COUNTDOWN_DPS[channel - 1], `countdown_l${channel}`, tuya.valueConverter.countdown]);
        datapoints.push([
            POWER_ON_BEHAVIOR_DPS[channel - 1],
            `power_on_behavior_l${channel}`,
            tuya.valueConverter.powerOnBehaviorEnum,
        ]);
        datapoints.push([
            NAME_DPS[channel - 1],
            `switch${channel}_name`,
            {from: screenNameConverter.from, to: null},
        ]);
    }

    return datapoints;
};

const channelToZigbee = (channels) => {
    const converters = [];
    for (let channel = 1; channel <= channels; channel++) {
        converters.push(screenNameToZigbee(`switch${channel}_name`, NAME_DPS[channel - 1]));
    }
    converters.push(tuya.tz.datapoints);
    return converters;
};

const channelExposes = (channels) => {
    const exposesList = [];

    for (let channel = 1; channel <= channels; channel++) {
        exposesList.push(e.switch().withEndpoint(`l${channel}`).setAccess("state", ea.STATE_SET));
    }
    for (let channel = 1; channel <= channels; channel++) {
        exposesList.push(
            exposes.numeric(`countdown_l${channel}`, ea.STATE_SET)
                .withUnit("s")
                .withValueMin(0)
                .withValueMax(43200)
                .withValueStep(1)
                .withDescription(`Countdown for gang ${channel}`),
        );
    }

    exposesList.push(e.power_on_behavior().withAccess(ea.STATE_SET));
    for (let channel = 1; channel <= channels; channel++) {
        exposesList.push(e.power_on_behavior().withEndpoint(`l${channel}`).withAccess(ea.STATE_SET));
    }

    exposesList.push(
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
    );

    for (let channel = 1; channel <= channels; channel++) {
        exposesList.push(
            exposes.text(`switch${channel}_name`, ea.STATE_SET)
                .withDescription(`Display name for gang ${channel}`),
        );
    }

    exposesList.push(e.energy(), e.current(), e.power(), e.voltage());
    return exposesList;
};

const createDefinition = ({channels, fingerprints}) => ({
    fingerprint: tuya.fingerprint("TS0601", fingerprints),
    model: `TS0601_${channels}gang_screen_switch_o409r73p`,
    vendor: "Zemismart",
    description: `${channels} gang screen switch with metering`,
    extend: [
        tuya.modernExtend.tuyaBase({dp: true}),
        tuya.modernExtend.tuyaWeatherForecast(),
    ],
    fromZigbee: [tuya.fz.datapoints, fzLocal.ignoreTuyaConfigureResponse],
    toZigbee: channelToZigbee(channels),
    onEvent: tuya.onEventSetTime,
    configure: async (device, coordinatorEndpoint) => {
        await tuya.configureMagicPacket(device, coordinatorEndpoint);
    },
    endpoint: () => endpointMap(channels),
    meta: {
        multiEndpoint: true,
        tuyaDatapoints: channelDatapoints(channels),
    },
    exposes: channelExposes(channels),
});

module.exports = [
    createDefinition({
        channels: 2,
        fingerprints: [
            "_TZE284_o409r73p",
            "_TZE28C1000000_o409r73p",
        ],
    }),
    createDefinition({
        channels: 3,
        fingerprints: [
            "_TZE284_oy1nuaa5",
        ],
    }),
];
