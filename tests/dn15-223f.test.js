const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

class EnumValue {
    constructor(value) {
        this.value = value;
    }

    valueOf() {
        return this.value;
    }
}

const lookup = (values) => ({
    from: (value) => Object.entries(values).find(([, expected]) => expected.valueOf() === value)?.[0],
    to: (value) => values[value],
});

const divideBy = (divisor) => ({
    from: (value) => value / divisor,
    to: (value) => value * divisor,
});

const chainableExpose = () => {
    const expose = {};
    const proxy = new Proxy(expose, {
        get: (target, property) => {
            if (!(property in target)) {
                target[property] = () => proxy;
            }
            return target[property];
        },
    });
    return proxy;
};

const exposes = {
    access: {STATE: 1, STATE_SET: 3},
    options: {
        calibration: (name) => ({name, type: "calibration"}),
        precision: (name) => ({name, type: "precision"}),
    },
    presets: new Proxy({}, {get: () => () => chainableExpose()}),
};

const tuya = {
    enum: (value) => new EnumValue(value),
    fingerprint: (modelID, manufacturerNames) => manufacturerNames.map((manufacturerName) => ({modelID, manufacturerName})),
    modernExtend: {tuyaBase: (options) => ({options})},
    valueConverter: {
        divideBy100: divideBy(100),
        onOff: lookup({ON: true, OFF: false}),
    },
    valueConverterBasic: {lookup},
};

const sourcePath = path.join(__dirname, "..", "DN15-223F.js");
const source = fs.readFileSync(sourcePath, "utf8");
const sandbox = {
    Buffer,
    module: {exports: {}},
    require: (request) => {
        if (request === "zigbee-herdsman-converters/lib/exposes") return exposes;
        if (request === "zigbee-herdsman-converters/lib/tuya") return tuya;
        throw new Error(`Unexpected dependency: ${request}`);
    },
};
vm.runInNewContext(source, sandbox, {filename: sourcePath});

const definition = sandbox.module.exports;
const datapoints = new Map(definition.meta.tuyaDatapoints.map((entry) => [entry[0], entry]));

test("matches only the exact 223F fingerprint and supplier datapoints", () => {
    assert.equal(JSON.stringify(definition.fingerprint), JSON.stringify([{modelID: "TS0601", manufacturerName: "_TZE200_jt50ea5d"}]));
    assert.deepEqual([...datapoints.keys()], [1, 2, 3, 4, 5, 7, 8, 16, 19, 21, 22, 24]);
    assert.equal(datapoints.has(6), false);
});

test("maps the supplier and captured read-only values", () => {
    assert.equal(datapoints.get(1)[2].from(1234), 12.34);
    assert.equal(datapoints.get(2)[2].from(Buffer.from("1a071a0700004fa2", "hex")), 20.386);
    assert.equal(datapoints.get(3)[2].from(Buffer.from("071f071f000003e8", "hex")), 1);
    assert.equal(datapoints.get(8)[2].from(1234), 12.34);
    assert.equal(datapoints.get(16)[2].from(Buffer.from("3030303030303236303131343031", "hex")), "00000026011401");
    assert.equal(datapoints.get(19)[2].from(Buffer.from("00002574", "hex")), 9.588);
    assert.equal(datapoints.get(21)[2].from(2469), 24.69);
    assert.equal(datapoints.get(22)[2].from(2473), 24.73);
    assert.equal(datapoints.get(24)[2].from(367), 3.67);
});

test("maps DP7 as the switch and DP8 as cumulative heat", () => {
    assert.equal(datapoints.get(7)[1], "prepayment_switch");
    assert.equal(datapoints.get(7)[2].from(true), "ON");
    assert.equal(datapoints.get(7)[2].to("OFF"), false);
    assert.equal(datapoints.get(8)[1], "cumulative_heat");
});

test("supports all report periods", () => {
    const converter = datapoints.get(4)[2];
    assert.equal(converter.from(6), "12h");
    assert.equal(converter.to("24h").valueOf(), 7);
});

test("preserves unknown fault bits", () => {
    const converter = datapoints.get(5)[2];
    assert.equal(converter.from(0), "OK");
    assert.equal(converter.from(0x1001), "battery_alarm, transduce_alarm");
    assert.equal(converter.from(0x2000), "unknown_bits_0x2000");
    assert.equal(converter.from("invalid"), "invalid");
});

test("does not turn malformed reports into false zero readings", () => {
    assert.equal(datapoints.get(2)[2].from(Buffer.alloc(4)), undefined);
    assert.equal(datapoints.get(3)[2].from(undefined), undefined);
    assert.equal(datapoints.get(16)[2].from(Buffer.from([0xff])), undefined);
    assert.equal(datapoints.get(19)[2].from(Buffer.alloc(3)), undefined);
});
