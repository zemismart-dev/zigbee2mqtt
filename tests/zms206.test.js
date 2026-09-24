const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const sourcePath = path.join(__dirname, "..", "zms206.js");
const source = fs.readFileSync(sourcePath, "utf8");

const chainableExpose = () => new Proxy({}, {get: () => () => chainableExpose()});
const lookup = (values) => ({
    from: (value) => Object.entries(values).find(([, expected]) => Number(expected) === Number(value))?.[0],
    to: (value) => values[value],
});

const load = () => {
    const messages = [];
    const clusters = {};
    let now = 1800000000000;
    const exposes = new Proxy({
        access: {STATE: 1, STATE_SET: 3},
        presets: new Proxy({}, {get: () => () => chainableExpose()}),
    }, {get: (target, key) => target[key] ?? (() => chainableExpose())});
    const logger = {debug: (message, namespace) => messages.push({message, namespace})};
    const tuya = {
        enum: (value) => value,
        fingerprint: (modelID, names) => names.map((manufacturerName) => ({modelID, manufacturerName})),
        modernExtend: {tuyaBase: (options) => ({options})},
        valueConverterBasic: {lookup},
        valueConverter: {
            raw: {from: (value) => value},
            onOff: lookup({ON: 1, OFF: 0}),
            lockUnlock: lookup({LOCK: 1, UNLOCK: 0}),
            countdown: {from: (value) => value},
        },
        tz: {datapoints: {key: ["state"]}},
        fz: {datapoints: {
            cluster: "manuSpecificTuya",
            type: ["commandDataReport", "commandDataResponse"],
            convert: (model, msg, publish, options, meta) => {
                const result = {};
                for (const dp of msg.data.dpValues) {
                    const entry = model.meta.tuyaDatapoints.find(([id]) => id === dp.dp);
                    if (!entry?.[2]?.from) {
                        logger.debug(`Datapoint ${dp.dp} not defined`, "zhc:tuya");
                        continue;
                    }
                    const value = entry[2].from(dp.value, meta, options, publish, msg);
                    if (entry[1]) result[entry[1]] = value;
                    else Object.assign(result, value);
                }
                return result;
            },
        }},
    };
    const modernExtend = {deviceAddCustomCluster: (name, cluster) => {
        clusters[name] = cluster;
        return {customCluster: name};
    }};
    const sandbox = {
        Buffer,
        Date: class extends Date {static now() {return now;}},
        module: {exports: {}},
        require: (name) => {
            if (name === "zigbee-herdsman-converters/lib/exposes") return exposes;
            if (name === "zigbee-herdsman-converters/lib/modernExtend") return modernExtend;
            if (name === "zigbee-herdsman-converters/lib/tuya") return tuya;
            if (name === "zigbee-herdsman-converters/lib/logger") return {logger};
            if (name === "zigbee-herdsman") return {Zcl: {BuffaloZclDataType: {BUFFER: 1008}}};
            throw new Error(`Unexpected dependency: ${name}`);
        },
    };
    vm.runInNewContext(source, sandbox, {filename: sourcePath});
    return {definitions: sandbox.module.exports, clusters, messages, tuya, setTime: (value) => {now = value;}};
};

const report = (definition, values, state = {}, type = "commandDataReport") => {
    const converter = definition.fromZigbee.find((item) => item.type.includes("commandDataReport"));
    return converter.convert(definition, {type, data: {dpValues: values}}, () => {}, {}, {state});
};

test("keeps exact family fingerprints and one explicit datapoint translation path", () => {
    const {definitions, tuya} = load();
    assert.deepEqual(Array.from(definitions, (d) => d.fingerprint.length), [8, 7, 6, 10]);
    for (const definition of definitions) {
        assert.ok(definition.fingerprint.every((f) => f.modelID === "TS0601" && !f.ieeeAddr));
        assert.equal(definition.zigbeeModel, undefined);
        assert.equal(definition.extend[0].options.dp, undefined);
        assert.equal(definition.extend[0].options.timeStart, "off");
        assert.equal(definition.toZigbee.filter((item) => item === tuya.tz.datapoints).length, 1);
    }
});

test("preserves FC03 payload bytes without changing device identity or publishing state", () => {
    const {definitions, clusters, messages} = load();
    const cluster = clusters.manuSpecificTuyaScreenInfo;
    assert.equal(cluster.ID, 0xfc03);
    assert.equal(cluster.commandsResponse.unknown00.ID, 0);
    assert.equal(cluster.commandsResponse.unknown00.parameters[0].type, 1008);
    const payload = Buffer.from("005f545a45323843313030303030305f706d627879663937", "hex");
    const device = {manufacturerName: "_TZE28C1000000_y4jqpry8"};
    const converter = definitions[3].fromZigbee.find((item) => item.cluster === "manuSpecificTuyaScreenInfo");
    assert.equal(converter.convert(definitions[3], {device, data: {payload}}), undefined);
    assert.equal(device.manufacturerName, "_TZE28C1000000_y4jqpry8");
    assert.ok(messages.at(-1).message.includes(payload.toString("hex")));
});

test("keeps undocumented four-gang DPs in diagnostic logs without writable or MQTT state", () => {
    const {definitions, messages} = load();
    for (const dp of [112, 113, 114]) {
        const entry = definitions[3].meta.tuyaDatapoints.find(([id]) => id === dp);
        assert.equal(entry[1], null);
        assert.equal(entry[2].to, null);
        assert.equal(report(definitions[3], [{dp, value: 22}]), undefined);
        assert.ok(messages.at(-1).message.includes(`DP ${dp}: 22`));
        assert.ok(definitions.slice(0, 3).every((d) => !d.meta.tuyaDatapoints.some(([id]) => id === dp)));
    }
    assert.ok(!messages.some(({message}) => message.includes("not defined")));
});

test("does not hide future unknown datapoints", () => {
    const {definitions, messages} = load();
    assert.equal(report(definitions[3], [{dp: 250, value: 5}]), undefined);
    assert.ok(messages.some(({message}) => message.includes("Datapoint 250 not defined")));
});

test("preserves real state changes mixed with diagnostics and suppresses unchanged state", () => {
    const {definitions} = load();
    const definition = definitions[3];
    const changed = report(definition, [{dp: 112, value: 3}, {dp: 1, value: 1}], {state_l1: "OFF"});
    assert.equal(JSON.stringify(changed), JSON.stringify({state_l1: "ON"}));
    assert.equal(report(definition, [{dp: 113, value: 0}, {dp: 1, value: 1}], {state_l1: "ON"}), undefined);
    const response = report(definition, [{dp: 1, value: 1}], {state_l1: "ON"}, "commandDataResponse");
    assert.equal(response.state_l1, "ON");
});

test("preserves countdown and screen-name conversion", () => {
    const {definitions} = load();
    const result = report(definitions[3], [
        {dp: 7, value: 60},
        {dp: 105, value: Buffer.from("switch1\0")},
        {dp: 106, value: Buffer.from([0, 0, 3, 97, 98, 99])},
    ]);
    assert.equal(result.countdown_l1, 60);
    assert.equal(result.switch1_name, "switch1");
    assert.equal(result.switch2_name, "abc");
});

test("throttles MCU time replies independently per device", () => {
    const {definitions, setTime} = load();
    const converter = definitions[3].fromZigbee.find((item) => item.type.includes("commandMcuSyncTime"));
    const calls = [];
    const message = (ieeeAddr) => ({device: {ieeeAddr}, endpoint: {command: (...args) => {
        calls.push(args);
        return Promise.resolve();
    }}});
    const first = message("0x0000000000000001");
    converter.convert({}, first);
    setTime(1800000054000);
    converter.convert({}, first);
    converter.convert({}, message("0x0000000000000002"));
    assert.equal(calls.length, 2);
    setTime(1800000055000);
    converter.convert({}, first);
    assert.equal(calls.length, 3);
    assert.equal(calls[0][2].payloadSize, 8);
    assert.equal(calls[0][2].payload.length, 8);
});
