const zigbeeHerdsmanConverters = require("zigbee-herdsman-converters");
const exposes = zigbeeHerdsmanConverters.exposes || require("zigbee-herdsman-converters/lib/exposes");
const modernExtend = require("zigbee-herdsman-converters/lib/modernExtend");
const tuya = require("zigbee-herdsman-converters/lib/tuya");

const e = exposes.presets;
const ea = exposes.access;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const brightness10To1000 = {
    to: (value) => {
        const brightness = clamp(Number(value), 1, 254);
        return Math.round(10 + ((brightness - 1) * 990) / 253);
    },
    from: (value) => {
        const level = clamp(Number(value), 10, 1000);
        return Math.round(1 + ((level - 10) * 253) / 990);
    },
};

const rawText = {
    from: (value) => {
        const buf = Buffer.isBuffer(value) ? value : Buffer.from(value || []);
        if (buf.length >= 3 && buf[0] === 0x00) {
            const declaredLength = buf.readUInt16BE(1);
            return buf.subarray(3, 3 + declaredLength).toString("utf8").replace(/\0+$/g, "");
        }
        return buf.toString("utf8").replace(/\0+$/g, "");
    },
    to: (value) => [...Buffer.from(String(value ?? ""), "utf8")],
};

const enumLookup = (values) =>
    tuya.valueConverterBasic.lookup(Object.fromEntries(values.map((value, index) => [value, tuya.enum(index)])));

const lightType = enumLookup(["led", "incandescent", "halogen"]);
const relayStatus = enumLookup(["off", "on", "memory"]);
const indicatorStatus = enumLookup(["none", "relay", "pos"]);
const colorIndex = enumLookup(["1", "2", "3", "4", "5", "6", "7", "8", "9"]);
const screenOffTime = enumLookup(["none", "10", "20", "30", "45", "60"]);
const ignoredDatapoint = {from: () => undefined, to: null};
const lastTimeSyncByDevice = new Map();

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

const uint32Bytes = (value) => {
    const buffer = Buffer.alloc(4);
    buffer.writeUInt32BE(value >>> 0);
    return [...buffer];
};

const nameSet = (dp, property) => ({
    key: [property],
    convertSet: async (entity, key, value) => {
        await tuya.sendDataPointRaw(entity, dp, rawText.to(value));
        return {state: {[property]: String(value ?? "")}};
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

const numericSetting = (property, min, max, unit, description) => {
    const expose = exposes.numeric(property, ea.STATE_SET).withValueMin(min).withValueMax(max).withDescription(description);
    return unit ? expose.withUnit(unit) : expose;
};

const lightExpose = (endpoint) =>
    e.light_brightness()
        .withEndpoint(endpoint)
        .setAccess("state", ea.STATE_SET)
        .setAccess("brightness", ea.STATE_SET);

const gangDpBases = [1, 7, 15];

const buildGangExposes = (gangs) =>
    Array.from({length: gangs}, (_, index) => {
        const gang = index + 1;
        return [
            lightExpose(`l${gang}`),
            numericSetting(`brightness_min_l${gang}`, 10, 1000, undefined, `Minimum brightness for gang ${gang}`),
            numericSetting(`brightness_max_l${gang}`, 10, 1000, undefined, `Maximum brightness for gang ${gang}`),
            e.enum(`led_type_l${gang}`, ea.STATE_SET, ["led", "incandescent", "halogen"])
                .withDescription(`Load type for gang ${gang}`),
            numericSetting(`countdown_l${gang}`, 0, 86400, "s", `Countdown for gang ${gang}`),
        ];
    }).flat();

const buildGangDatapoints = (gangs) =>
    Array.from({length: gangs}, (_, index) => {
        const gang = index + 1;
        const dp = gangDpBases[index];
        return [
            [dp, `state_l${gang}`, tuya.valueConverter.onOff],
            [dp + 1, `brightness_l${gang}`, brightness10To1000],
            [dp + 2, `brightness_min_l${gang}`, tuya.valueConverter.raw],
            [dp + 3, `led_type_l${gang}`, lightType],
            [dp + 4, `brightness_max_l${gang}`, tuya.valueConverter.raw],
            [dp + 5, `countdown_l${gang}`, tuya.valueConverter.countdown],
        ];
    }).flat();

const buildDefinition = (gangs, productId, manufacturerNames) => {
    const gangNumbers = Array.from({length: gangs}, (_, index) => index + 1);
    const nameProperties = gangNumbers.map((gang) => `switch${gang}_name`);

    return {
        fingerprint: tuya.fingerprint("TS0601", manufacturerNames),
        model: `ZT3L_${gangs}gang_screen_dimmer_${productId}`,
        vendor: "Zemismart",
        description: `${gangs} gang screen dimmer switch`,
        extend: [privateScreenCluster],
        fromZigbee: [
            fzLocal.throttledMcuSyncTime,
            fzLocal.ignorePrivateClusterStatus,
            fzLocal.datapoints,
            fzLocal.ignoreTuyaConfigureResponse,
        ],
        toZigbee: [
            ...gangNumbers.map((gang) => nameSet(105 + gang, `switch${gang}_name`)),
            tuya.tz.datapoints,
        ],
        configure: async (device, coordinatorEndpoint) => {
            await tuya.configureMagicPacket(device, coordinatorEndpoint);
            await tuya.configureQuery(device, coordinatorEndpoint);
        },
        endpoint: () => Object.fromEntries(gangNumbers.map((gang) => [`l${gang}`, 1])),
        exposes: [
            ...buildGangExposes(gangs),
            e.enum("relay_status", ea.STATE_SET, ["off", "on", "memory"]).withDescription("Restart status"),
            e.enum("indicator_status", ea.STATE_SET, ["none", "relay", "pos"]).withDescription("Indicator status"),
            exposes.binary("backlight_switch", ea.STATE_SET, "ON", "OFF").withDescription("Backlight switch"),
            e.enum("on_color", ea.STATE_SET, ["1", "2", "3", "4", "5", "6", "7", "8", "9"]).withDescription("ON color"),
            e.enum("off_color", ea.STATE_SET, ["1", "2", "3", "4", "5", "6", "7", "8", "9"]).withDescription("OFF color"),
            numericSetting("backlight", 0, 100, "%", "Backlight brightness"),
            exposes.binary("child_lock", ea.STATE_SET, "ON", "OFF").withDescription("Child lock"),
            numericSetting("gradient_rate", 0, 15, undefined, "Gradient rate"),
            e.enum("screen_off_time", ea.STATE_SET, ["none", "10", "20", "30", "45", "60"])
                .withDescription("Screen off time"),
            ...gangNumbers.map((gang) =>
                exposes.text(`switch${gang}_name`, ea.STATE_SET).withDescription(`Display name for gang ${gang}`)),
        ],
        meta: {
            multiEndpoint: true,
            multiEndpointSkip: [
                "relay_status",
                "indicator_status",
                "backlight_switch",
                "on_color",
                "off_color",
                "backlight",
                "child_lock",
                "gradient_rate",
                "screen_off_time",
                ...nameProperties,
            ],
            tuyaDatapoints: [
                ...buildGangDatapoints(gangs),
                [14, "relay_status", relayStatus],
                [21, "indicator_status", indicatorStatus],
                [26, "backlight_switch", tuya.valueConverter.onOff],
                [101, "on_color", colorIndex],
                [102, "off_color", colorIndex],
                [103, "backlight", tuya.valueConverter.raw],
                [104, "child_lock", tuya.valueConverter.onOff],
                [105, "gradient_rate", tuya.valueConverter.raw],
                [110, "screen_off_time", screenOffTime],
                ...gangNumbers.map((gang) => [105 + gang, `switch${gang}_name`, {from: rawText.from, to: null}]),
                // Returned by dataQuery on the 8jwv5lbl hardware, but their function is undocumented.
                [200, null, ignoredDatapoint],
                [201, null, ignoredDatapoint],
                [202, null, ignoredDatapoint],
            ],
        },
    };
};

module.exports = [
    buildDefinition(1, "huc4fueh", ["_TZE28C1000000_huc4fueh"]),
    buildDefinition(2, "gheewd2t", ["_TZE28C1000000_gheewd2t"]),
    buildDefinition(3, "8jwv5lbl", ["_TZE28C1000000_8jwv5lbl", "_TZE284_8jwv5lbl"]),
];
