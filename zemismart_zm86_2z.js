const exposes = require("zigbee-herdsman-converters/lib/exposes");
const tuya = require("zigbee-herdsman-converters/lib/tuya");

const e = exposes.presets;
const ea = exposes.access;

/**
 * Zemismart ZM86-2Z Roman Rod I/U-type curtain track.
 *
 * Exact live fingerprint:
 *   TS0601 / _TZE200_cf1sl3tj
 *
 * Upstream data source:
 *   zigbee-herdsman-converters 26.90.0
 *   src/devices/tuya.ts, definition TS0601_cover_3
 *
 * The upstream definition identifies this fingerprint through the
 * ZM85EL-2Z white label. This external converter intentionally keeps the
 * upstream exposes and Tuya datapoint mappings while presenting the local
 * commercial model as ZM86-2Z.
 */
const definition = {
    // priority: 1 makes this exact external definition take precedence over
    // Zigbee2MQTT's built-in TS0601_cover_3 definition.
    fingerprint: [{modelID: "TS0601", manufacturerName: "_TZE200_cf1sl3tj", priority: 1}],
    model: "ZM86-2Z",
    vendor: "Zemismart",
    description: "Roman Rod I/U-type curtain track",
    extend: [tuya.modernExtend.tuyaBase({dp: true})],
    options: [exposes.options.invert_cover()],
    exposes: [
        e.battery(),
        e.cover_position().setAccess("position", ea.STATE_SET),
        e
            .numeric("raw_dp_3", ea.STATE)
            .withDescription("Undocumented DP3 raw value; live ZM86-2Z reports prove that it is not a curtain position")
            .withCategory("diagnostic"),
        e.enum("reverse_direction", ea.STATE_SET, ["forward", "back"]).withDescription("Reverse the motor direction"),
        e.enum("border", ea.STATE_SET, ["up", "down", "up_delete", "down_delete", "remove_top_bottom"]),
        e.enum("click_control", ea.STATE_SET, ["up", "down"]).withDescription("Single motor steps"),
        e.binary("motor_fault", ea.STATE, true, false),
    ],
    meta: {
        tuyaDatapoints: [
            [
                1,
                "state",
                tuya.valueConverterBasic.lookup({
                    OPEN: tuya.enum(0),
                    STOP: tuya.enum(1),
                    CLOSE: tuya.enum(2),
                }),
            ],
            [2, "position", tuya.valueConverter.coverPosition],
            // Unlike the upstream ZM85EL-2Z mapping, the live ZM86-2Z reports
            // values such as 12, 119, 135 and 129 on DP3. Mapping those values
            // to position overwrites valid DP2 percentages and can falsely
            // publish OPEN immediately after a STOP acknowledgement.
            [3, "raw_dp_3", tuya.valueConverter.raw],
            [
                5,
                "reverse_direction",
                tuya.valueConverterBasic.lookup({
                    forward: tuya.enum(0),
                    back: tuya.enum(1),
                }),
            ],
            [12, "motor_fault", tuya.valueConverter.trueFalse1],
            [13, "battery", tuya.valueConverter.raw],
            [
                16,
                "border",
                tuya.valueConverterBasic.lookup({
                    up: tuya.enum(0),
                    down: tuya.enum(1),
                    up_delete: tuya.enum(2),
                    down_delete: tuya.enum(3),
                    remove_top_bottom: tuya.enum(4),
                }),
            ],
            [
                20,
                "click_control",
                tuya.valueConverterBasic.lookup({
                    up: tuya.enum(0),
                    down: tuya.enum(1),
                }),
            ],
        ],
    },
};

module.exports = definition;
