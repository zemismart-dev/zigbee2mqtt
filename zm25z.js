const zigbeeHerdsmanConverters = require("zigbee-herdsman-converters");
const exposes = zigbeeHerdsmanConverters.exposes || require("zigbee-herdsman-converters/lib/exposes");
const tuya = require("zigbee-herdsman-converters/lib/tuya");

const e = exposes.presets;
const ea = exposes.access;

const definition = {
    fingerprint: tuya.fingerprint("TS0301", ["_TZE200_cirjrpxe"]),
    model: "TS0301_cirjrpxe",
    vendor: "Zemismart",
    description: "Zemismart ZM25Z curtain motor",
    extend: [tuya.modernExtend.tuyaBase({dp: true})],
    exposes: [
        e.cover_position().setAccess("position", ea.STATE_SET),
        e.battery(),
        e.enum("motor_direction", ea.STATE_SET, ["forward", "back"])
            .withDescription("Reverse motor direction if open and close are inverted"),
        e.enum("set_limit", ea.SET, ["Set upper limit", "Set lower limit", "Set middle limit"])
            .withDescription("Move the motor to the target point first, then confirm the upper, lower, or middle limit"),
        e.enum("remove_limit", ea.SET, ["Remove upper limit", "Remove lower limit", "Remove middle limit"])
            .withDescription("Delete the saved upper, lower, or middle limit"),
    ],
    meta: {
        tuyaDatapoints: [
            [1, "state", tuya.valueConverterBasic.lookup({OPEN: tuya.enum(0), STOP: tuya.enum(1), CLOSE: tuya.enum(2)})],
            [2, "position", tuya.valueConverter.coverPosition],
            [3, "position", tuya.valueConverter.coverPosition],
            [5, "motor_direction", tuya.valueConverterBasic.lookup({forward: tuya.enum(0), back: tuya.enum(1)})],
            [103, "battery", tuya.valueConverter.raw],
            [107, "limit_status", tuya.valueConverterBasic.lookup({
                no_limit: tuya.enum(0),
                limit_up_down: tuya.enum(1),
                limit_up_down_fav: tuya.enum(2),
            })],
            [118, "set_limit", {
                from: null,
                to: (value) => {
                    const lookup = {
                        "Set upper limit": tuya.enum(3),
                        "Set lower limit": tuya.enum(4),
                        "Set middle limit": tuya.enum(5),
                    };
                    return lookup[value];
                },
            }],
            [118, "remove_limit", {
                from: null,
                to: (value) => {
                    const lookup = {
                        "Remove upper limit": tuya.enum(0),
                        "Remove lower limit": tuya.enum(1),
                        "Remove middle limit": tuya.enum(2),
                    };
                    return lookup[value];
                },
            }],
            [119, "limit_result", tuya.valueConverterBasic.lookup({
                limit_del_success: tuya.enum(0),
                limit_del_fail: tuya.enum(1),
                limit_set_success: tuya.enum(2),
                limit_set_fail: tuya.enum(3),
            })],
            [124, "charging_status", tuya.valueConverterBasic.lookup({
                chg_unkown: tuya.enum(0),
                charging: tuya.enum(1),
                fully_charged: tuya.enum(2),
                not_charging: tuya.enum(3),
            })],
        ],
    },
};

module.exports = definition;
