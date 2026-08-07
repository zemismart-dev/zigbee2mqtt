// Standalone external converter extracted from the upstream
// zigbee-herdsman-converters/src/devices/zemismart.ts definition for:
// TS0601 / _TZE284_xvywzhmi / _TZE28C1000000_xvywzhmi /
// Zemismart ZMS-208US-3.

const exposes = require("zigbee-herdsman-converters/lib/exposes");
const tuya = require("zigbee-herdsman-converters/lib/tuya");

const e = exposes.presets;
const ea = exposes.access;

const name = {
    to: (value) => {
        const limitedString = String(value ?? "").slice(0, 12);
        return Array.from(new TextEncoder().encode(limitedString));
    },
    from: (value) => {
        const data = Object.values(value);
        return new TextDecoder("utf-8").decode(new Uint8Array(data));
    },
};

const definition = {
    fingerprint: tuya.fingerprint("TS0601", [
        "_TZE284_xvywzhmi",
        "_TZE28C1000000_xvywzhmi",
    ]),
    model: "ZMS-208US-3",
    vendor: "Zemismart",
    description: "Smart screen switch 3 gang",
    extend: [tuya.modernExtend.tuyaBase({dp: true})],
    exposes: [
        e.switch(),
        e.switch().withEndpoint("l1"),
        e.switch().withEndpoint("l2"),
        e.switch().withEndpoint("l3"),
        e.child_lock(),
        e.text("name", ea.STATE_SET).withEndpoint("l1").withDescription("Name for Switch 1"),
        e.text("name", ea.STATE_SET).withEndpoint("l2").withDescription("Name for Switch 2"),
        e.text("name", ea.STATE_SET).withEndpoint("l3").withDescription("Name for Switch 3"),
        e.numeric("countdown", ea.STATE_SET)
            .withEndpoint("l1")
            .withDescription("Countdown for Switch 1")
            .withUnit("s")
            .withValueMin(0)
            .withValueMax(43200)
            .withValueStep(1),
        e.numeric("countdown", ea.STATE_SET)
            .withEndpoint("l2")
            .withDescription("Countdown for Switch 2")
            .withUnit("s")
            .withValueMin(0)
            .withValueMax(43200)
            .withValueStep(1),
        e.numeric("countdown", ea.STATE_SET)
            .withEndpoint("l3")
            .withDescription("Countdown for Switch 3")
            .withUnit("s")
            .withValueMin(0)
            .withValueMax(43200)
            .withValueStep(1),
    ],
    endpoint: () => ({l1: 1, l2: 1, l3: 1}),
    meta: {
        multiEndpoint: true,
        tuyaDatapoints: [
            [1, "state_l1", tuya.valueConverter.onOff, {skip: tuya.skip.stateOnAndBrightnessPresent}],
            [2, "state_l2", tuya.valueConverter.onOff, {skip: tuya.skip.stateOnAndBrightnessPresent}],
            [3, "state_l3", tuya.valueConverter.onOff, {skip: tuya.skip.stateOnAndBrightnessPresent}],
            [7, "countdown_l1", tuya.valueConverter.raw],
            [8, "countdown_l2", tuya.valueConverter.raw],
            [9, "countdown_l3", tuya.valueConverter.raw],
            [13, "state", tuya.valueConverter.onOff, {skip: tuya.skip.stateOnAndBrightnessPresent}],
            [24, "test_bit", tuya.valueConverter.raw],
            [101, "child_lock", tuya.valueConverter.lockUnlock],
            [105, "name_l1", name],
            [106, "name_l2", name],
            [107, "name_l3", name],
        ],
    },
};

const definition4Gang = {
    fingerprint: tuya.fingerprint("TS0601", [
        "_TZE28C1000000_xibaabmu",
    ]),
    model: "ZMS-208US-4",
    vendor: "Zemismart",
    description: "Smart screen switch 4 gang",
    extend: [tuya.modernExtend.tuyaBase({dp: true})],
    exposes: [
        e.switch(),
        e.switch().withEndpoint("l1"),
        e.switch().withEndpoint("l2"),
        e.switch().withEndpoint("l3"),
        e.switch().withEndpoint("l4"),
        e.child_lock(),
        e.text("name", ea.STATE_SET).withEndpoint("l1").withDescription("Name for Switch 1"),
        e.text("name", ea.STATE_SET).withEndpoint("l2").withDescription("Name for Switch 2"),
        e.text("name", ea.STATE_SET).withEndpoint("l3").withDescription("Name for Switch 3"),
        e.text("name", ea.STATE_SET).withEndpoint("l4").withDescription("Name for Switch 4"),
        e.numeric("countdown", ea.STATE_SET).withEndpoint("l1").withUnit("s").withValueMin(0).withValueMax(43200).withValueStep(1),
        e.numeric("countdown", ea.STATE_SET).withEndpoint("l2").withUnit("s").withValueMin(0).withValueMax(43200).withValueStep(1),
        e.numeric("countdown", ea.STATE_SET).withEndpoint("l3").withUnit("s").withValueMin(0).withValueMax(43200).withValueStep(1),
        e.numeric("countdown", ea.STATE_SET).withEndpoint("l4").withUnit("s").withValueMin(0).withValueMax(43200).withValueStep(1),
    ],
    endpoint: () => ({l1: 1, l2: 1, l3: 1, l4: 1}),
    meta: {
        multiEndpoint: true,
        tuyaDatapoints: [
            [1, "state_l1", tuya.valueConverter.onOff, {skip: tuya.skip.stateOnAndBrightnessPresent}],
            [2, "state_l2", tuya.valueConverter.onOff, {skip: tuya.skip.stateOnAndBrightnessPresent}],
            [3, "state_l3", tuya.valueConverter.onOff, {skip: tuya.skip.stateOnAndBrightnessPresent}],
            [4, "state_l4", tuya.valueConverter.onOff, {skip: tuya.skip.stateOnAndBrightnessPresent}],
            [7, "countdown_l1", tuya.valueConverter.raw],
            [8, "countdown_l2", tuya.valueConverter.raw],
            [9, "countdown_l3", tuya.valueConverter.raw],
            [10, "countdown_l4", tuya.valueConverter.raw],
            [13, "state", tuya.valueConverter.onOff, {skip: tuya.skip.stateOnAndBrightnessPresent}],
            [24, "test_bit", tuya.valueConverter.raw],
            [101, "child_lock", tuya.valueConverter.lockUnlock],
            [105, "name_l1", name],
            [106, "name_l2", name],
            [107, "name_l3", name],
            [108, "name_l4", name],
        ],
    },
};

module.exports = [definition, definition4Gang];
