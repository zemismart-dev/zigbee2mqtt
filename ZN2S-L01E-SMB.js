const zigbeeHerdsmanConverters = require("zigbee-herdsman-converters");
const exposes = zigbeeHerdsmanConverters.exposes || require("zigbee-herdsman-converters/lib/exposes");
const tuya = require("zigbee-herdsman-converters/lib/tuya");

const e = exposes.presets;
const ea = exposes.access;

const sceneSafeDatapoints = {
    ...tuya.tz.datapoints,
    async convertSet(entity, key, value, meta) {
        const endpointName =
            meta?.endpoint_name ?? meta?.endpointName ?? key.match(/^state_(l[1-4])$/)?.[1];
        const modeProperty = endpointName ? `switch_mode_${endpointName}` : undefined;
        const isRelayState = key === "state" || /^state_l[1-4]$/.test(key);

        if (isRelayState && modeProperty && meta?.state?.[modeProperty] === "scene") {
            return undefined;
        }

        return tuya.tz.datapoints.convertSet(entity, key, value, meta);
    },
};

const createDefinition = ({manufacturerName, gangCount, model, description}) => {
    const endpointNames = Array.from({length: gangCount}, (_, index) => `l${index + 1}`);
    const endpointMap = Object.fromEntries(endpointNames.map((endpoint) => [endpoint, 1]));
    const tuyaDatapoints = [];

    for (let index = 1; index <= gangCount; index++) {
        tuyaDatapoints.push(
            [index, "action", tuya.valueConverter.static(`scene_${index}`)],
            [17 + index, `switch_mode_l${index}`, tuya.valueConverter.switchMode],
            [23 + index, `state_l${index}`, tuya.valueConverter.onOff],
        );
    }

    return {
        fingerprint: tuya.fingerprint("TS0601", [manufacturerName]),
        model,
        vendor: "Zemismart",
        description,
        fromZigbee: [tuya.fz.datapoints],
        toZigbee: [sceneSafeDatapoints],
        configure: async (device, coordinatorEndpoint) => {
            await tuya.configureMagicPacket(device, coordinatorEndpoint);
        },
        endpoint: () => endpointMap,
        exposes: [
            ...endpointNames.map((endpoint) => e.switch().withEndpoint(endpoint)),
            ...endpointNames.map((endpoint) =>
                e.enum(`switch_mode_${endpoint}`, ea.STATE_SET, ["switch", "scene"])
                    .withDescription(`Sets ${endpoint} to normal relay control or scene mode`)),
            e.action(endpointNames.map((_, index) => `scene_${index + 1}`)),
        ],
        meta: {
            multiEndpoint: true,
            tuyaDatapoints,
        },
    };
};

module.exports = [
    createDefinition({
        manufacturerName: "_TZE200_ephrk8to",
        gangCount: 1,
        model: "ZN2S-L01E-SMB",
        description: "Zemismart 1 gang switch with per-gang scene mode",
    }),
    createDefinition({
        manufacturerName: "_TZE200_ahyyfhqk",
        gangCount: 2,
        model: "ZN2S-L01E-SMB-2G",
        description: "Zemismart 2 gang switch with per-gang scene mode",
    }),
    createDefinition({
        manufacturerName: "_TZE200_zuphzsmo",
        gangCount: 3,
        model: "ZN2S-L01E-SMB-3G",
        description: "Zemismart 3 gang switch with per-gang scene mode",
    }),
    createDefinition({
        manufacturerName: "_TZE200_6si1pnia",
        gangCount: 4,
        model: "ZN2S-L01E-SMB-4G",
        description: "Zemismart 4 gang switch with per-gang scene mode",
    }),
];
