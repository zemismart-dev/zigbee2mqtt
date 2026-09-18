const exposes = require("zigbee-herdsman-converters/lib/exposes");
const legacy = require("zigbee-herdsman-converters/lib/legacy");
const e = exposes.presets;
const ea = exposes.access;

const coverControl = {
    ...legacy.toZigbee.tuya_cover_control,
    convertSet: async (entity, key, value, meta) => {
        if (key === "position") {
            // legacy accepts coercible values and corrupts fractional payloads.
            if (!Number.isInteger(value) || value < 0 || value > 100) {
                throw new Error("Position is out of range or is not an integer from 0 to 100");
            }
        } else if (key === "state") {
            if (typeof value !== "string" || !["OPEN", "CLOSE", "STOP"].includes(value.toUpperCase())) {
                throw new Error("State must be OPEN, CLOSE or STOP");
            }
        } else {
            throw new Error("Unsupported cover control");
        }
        return legacy.toZigbee.tuya_cover_control.convertSet(entity, key, value, meta);
    },
};

// Upstream sources: PR #9235 / ZMS1-TYZ (_TZE204_zuq5xxib), and PR #13208
// at a496e9d3dd999cd0c16356125ceeba5fc4e0a057 (_TZE200_fu14oapz).
// Direction/speed on the 284 variant follow the 204 family implementation;
// their physical effect on 284 is not yet verified. Never send them at startup.
const directionAndSpeed = {
    key: ["options"],
    convertSet: async (entity, key, value, meta) => {
        if (meta.device.manufacturerName !== "_TZE284_zuq5xxib") {
            throw new Error("Direction and speed are not supported for this ZMS1 variant");
        }
        if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("options must be an object");
        const keys = Object.keys(value);
        if (!keys.length || keys.some(k => !["reverse_direction", "motor_speed"].includes(k))) {
            throw new Error("Unknown or empty ZMS1 options");
        }
        // Validate the entire request before sending either setting.
        if (keys.includes("reverse_direction") && typeof value.reverse_direction !== "boolean") {
            throw new Error("reverse_direction must be boolean");
        }
        if (keys.includes("motor_speed") && (!Number.isInteger(value.motor_speed) || value.motor_speed < 0 || value.motor_speed > 255)) {
            throw new Error("motor_speed must be an integer from 0 to 255");
        }
        // No optimistic state: only a device report may update a setting.
        return legacy.toZigbee.tuya_cover_options.convertSet(entity, key, value, meta);
    },
};

const variantReports = {
    ...legacy.fromZigbee.tuya_cover,
    convert: (model, msg, publish, options, meta) => {
        const configurable = meta.device.manufacturerName === "_TZE284_zuq5xxib";
        // Do not let the generic legacy parser label a customer DP105 as speed.
        const extraDPs = configurable ? [5, 105] : [5, 7, 12, 105];
        const base = {...msg, data: {...msg.data, dpValues: msg.data.dpValues.filter(dp => !extraDPs.includes(dp.dp))}};
        const result = legacy.fromZigbee.tuya_cover.convert(model, base, publish, options, meta);
        for (const dp of msg.data.dpValues) {
            const data = Buffer.from(dp.data);
            if (configurable) {
                if (dp.dp === 5 && dp.datatype === 4 && data.length === 1 && data[0] <= 1) {
                    result.options = {...meta.state?.options, ...result.options, reverse_direction: data[0] === 1};
                }
                if (dp.dp === 105 && dp.datatype === 2 && data.length === 4 && data.readUInt32BE(0) <= 255) {
                    result.options = {...meta.state?.options, ...result.options, motor_speed: data.readUInt32BE(0)};
                }
            } else if (dp.dp === 7 || dp.dp === 12) {
                // PR #13208 supplies names only, not datatypes or enum/bitmap
                // meanings. Preserve the exact frame without guessing semantics.
                result[dp.dp === 7 ? "work_state_raw" : "fault_raw"] = JSON.stringify({datatype: dp.datatype, hex: data.toString("hex")});
            }
        }
        return result;
    },
};

const base = {
    model: "ZMS1-TYZ",
    vendor: "Zemismart",
    description: "ZMS1 smart curtain track",
    fromZigbee: [variantReports],
};
const commonExposes = () => [
    e.cover_position().setAccess("position", ea.STATE_SET),
    e.binary("running", ea.STATE, true, false)
        .withDescription("Movement inferred from position reports; may time out after 3 seconds without reports"),
];

module.exports = [
    {
        ...base,
        fingerprint: [{modelID: "TS0601", manufacturerName: "_TZE284_zuq5xxib", priority: 1}],
        toZigbee: [coverControl, directionAndSpeed],
        exposes: [
            ...commonExposes(),
            e.composite("options", "options", ea.STATE_SET)
                .withFeature(e.binary("reverse_direction", ea.STATE_SET, true, false).withDescription("Reverse motor direction; 284 hardware effect not yet verified"))
                .withFeature(e.numeric("motor_speed", ea.STATE_SET).withValueMin(0).withValueMax(255).withValueStep(1)
                    .withDescription("Raw motor speed setting from the upstream family; hardware range not yet verified")),
        ],
    },
    {
        ...base,
        fingerprint: [{modelID: "TS0601", manufacturerName: "_TZE200_fu14oapz", priority: 1}],
        toZigbee: [coverControl],
        exposes: [
            ...commonExposes(),
            e.text("work_state_raw", ea.STATE).withCategory("diagnostic")
                .withDescription("DP7 work state: raw datatype and hex bytes; enum meanings not yet confirmed"),
            e.text("fault_raw", ea.STATE).withCategory("diagnostic")
                .withDescription("DP12 fault: raw datatype and hex bytes; fault meanings not yet confirmed"),
        ],
    },
];
