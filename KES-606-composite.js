const {definitions} = require("zigbee-herdsman-converters/devices/tuya");
const tuya = require("zigbee-herdsman-converters/lib/tuya");
const utils = require("zigbee-herdsman-converters/lib/utils");

const stateKey = (meta) => `state${meta.endpoint_name ? `_${meta.endpoint_name}` : ""}`;

const currentState = (endpoint, meta) => {
    const onOff = endpoint.getClusterAttributeValue?.("genOnOff", "onOff");

    if (onOff !== undefined) {
        return onOff ? "ON" : "OFF";
    }

    return meta.state?.[stateKey(meta)];
};

const endpointMode = (endpoint, meta) => {
    const property = meta.endpoint_name ? `switch_mode_${meta.endpoint_name}` : "switch_mode";
    const cachedState = meta.state?.[property];

    if (cachedState !== undefined) {
        return cachedState;
    }

    const rawMode = endpoint.getClusterAttributeValue?.("manuSpecificTuya3", "switchMode");
    return rawMode === 1 ? "scene" : rawMode === 0 ? "switch" : undefined;
};

const shouldBlockRelayCommand = (entity, key, meta) => {
    if (key !== "state" && !Object.hasOwn(meta.message ?? {}, "state")) {
        return false;
    }

    const endpoint = utils.determineEndpoint(entity, meta, "manuSpecificTuya3");
    return endpointMode(endpoint, meta) === "scene";
};

const sceneModeNoopState = (entity, meta) => {
    const endpoint = utils.determineEndpoint(entity, meta, "genOnOff");
    const state = currentState(endpoint, meta);

    return state ? {state: {state}} : {};
};

const guardStateConverter = (converter) => {
    if (!converter.key?.includes("state") || !converter.convertSet) {
        return converter;
    }

    return {
        ...converter,
        convertSet: async (entity, key, value, meta) => {
            if (shouldBlockRelayCommand(entity, key, meta)) {
                return sceneModeNoopState(entity, meta);
            }

            return converter.convertSet(entity, key, value, meta);
        },
    };
};

const guardExtend = (extension) => ({
    ...extension,
    toZigbee: extension.toZigbee?.map(guardStateConverter),
});

const withSceneModeRelayGuard = (definition) => ({
    ...definition,
    toZigbee: definition.toZigbee?.map(guardStateConverter),
    extend: definition.extend?.map(guardExtend),
});

const cloneWithFingerprint = (baseModel, manufacturerNames, overrides = {}) => {
    const definition = definitions.find((item) => item.model === baseModel);

    if (!definition) {
        throw new Error(`Base definition for ${baseModel} was not found`);
    }

    return withSceneModeRelayGuard({
        ...definition,
        fingerprint: tuya.fingerprint("TS0726", manufacturerNames),
        ...overrides,
    });
};

module.exports = [
    cloneWithFingerprint("TS0726_1_gang_scene_switch", ["_TZ3000_ovbvmhiq"], {
        model: "TS0726_1_gang_scene_switch_ovbvmhiq",
        vendor: "Zemismart",
        description: "KES 606 composite 1 gang switch with scene-mode relay guard",
    }),
    cloneWithFingerprint("TS0726_2_gang_scene_switch", ["_TZ3000_icoxotza"], {
        model: "TS0726_2_gang_scene_switch_icoxotza",
        vendor: "Zemismart",
        description: "KES 606 composite 2 gang switch with scene-mode relay guard",
    }),
    cloneWithFingerprint("TS0726_3_gang_scene_switch", ["_TZ3000_cziew6eu"], {
        model: "TS0726_3_gang_scene_switch_cziew6eu",
        vendor: "Zemismart",
        description: "KES 606 composite 3 gang switch with scene-mode relay guard",
    }),
    cloneWithFingerprint("TS0726_4_gang_scene_switch", ["_TZ3000_hurauima"], {
        model: "TS0726_4_gang_scene_switch_hurauima",
        vendor: "Zemismart",
        description: "KES 606 composite 4 gang switch with scene-mode relay guard",
    }),
];
