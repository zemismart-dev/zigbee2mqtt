const zigbeeHerdsmanConverters = require("zigbee-herdsman-converters");
const exposes = zigbeeHerdsmanConverters.exposes || require("zigbee-herdsman-converters/lib/exposes");
const modernExtend = require("zigbee-herdsman-converters/lib/modernExtend");
const tuya = require("zigbee-herdsman-converters/lib/tuya");

const ea = exposes.access;
const e = exposes.presets;

const actions = [
    "1_single",
    "1_double",
    "1_hold",
    "2_single",
    "2_double",
    "2_hold",
    "3_single",
    "3_double",
    "3_hold",
    "4_single",
    "4_double",
    "4_hold",
];

const simulatedActions = [
    {property: "simulate_button_1_single_press", action: "1_single", label: "Button 1 single press"},
    {property: "simulate_button_1_double_press", action: "1_double", label: "Button 1 double press"},
    {property: "simulate_button_1_long_press", action: "1_hold", label: "Button 1 long press"},
    {property: "simulate_button_2_single_press", action: "2_single", label: "Button 2 single press"},
    {property: "simulate_button_2_double_press", action: "2_double", label: "Button 2 double press"},
    {property: "simulate_button_2_long_press", action: "2_hold", label: "Button 2 long press"},
    {property: "simulate_button_3_single_press", action: "3_single", label: "Button 3 single press"},
    {property: "simulate_button_3_double_press", action: "3_double", label: "Button 3 double press"},
    {property: "simulate_button_3_long_press", action: "3_hold", label: "Button 3 long press"},
    {property: "simulate_button_4_single_press", action: "4_single", label: "Button 4 single press"},
    {property: "simulate_button_4_double_press", action: "4_double", label: "Button 4 double press"},
    {property: "simulate_button_4_long_press", action: "4_hold", label: "Button 4 long press"},
];

const actionByProperty = Object.fromEntries(simulatedActions.map(({property, action}) => [property, action]));

const tzLocal = {
    simulate_action: {
        key: Object.keys(actionByProperty),
        convertSet: async (_entity, key, value, meta) => {
            if (value !== "PRESS") {
                throw new Error(`Unsupported ${key} value: ${value}`);
            }

            const action = actionByProperty[key];
            if (!action) {
                throw new Error(`Unknown simulated ZMR4 action: ${key}`);
            }

            await meta.publish({action});
        },
    },
};

const definition = {
    // Override Zigbee2MQTT's built-in definition for this exact device so the
    // local HA simulation buttons are exposed as well.
    fingerprint: [{modelID: "TS0044", manufacturerName: "_TZ3000_xwuveizv", priority: 1}],
    model: "ZMR4_1",
    vendor: "Zemismart",
    description: "4 button portable remote control (without dimmer), with local action simulation buttons",
    extend: [
        tuya.modernExtend.tuyaBase(),
        modernExtend.battery({voltage: true, percentageReporting: false}),
    ],
    fromZigbee: [tuya.fz.on_off_action],
    toZigbee: [tzLocal.simulate_action],
    exposes: [
        e.action(actions),
        ...simulatedActions.map(({property, label, action}) =>
            e.enum(property, ea.SET, ["PRESS"])
                .withLabel(label)
                .withDescription(`Locally publish the same '${action}' action as the physical ZMR4 remote`)
                .withCategory("config"),
        ),
    ],
    configure: tuya.configureMagicPacket,
};

module.exports = definition;
