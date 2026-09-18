const assert = require("node:assert/strict");
const definitions = require("../zms1.js");

async function checkVariant(manufacturerName) {
    const definition = definitions.find(d => d.fingerprint[0].manufacturerName === manufacturerName);
    assert.deepEqual(definition.fingerprint, [{modelID: "TS0601", manufacturerName, priority: 1}]);
    const device = {manufacturerName};
    class Endpoint {
        ID = 1;
        deviceIeeeAddress = "test-device";
    }
    const endpoint = new Endpoint();
    const meta = {device, options: {}, state: {}};
    const incoming = definition.fromZigbee[0];
    const report = (dp, datatype, data, options = {}) => incoming.convert(
        definition,
        {endpoint, data: {dpValues: [{dp, datatype, data: Buffer.from(data)}]}},
        () => {}, options, meta,
    );
    // Captured from the 284 variant; synthetic fixtures for fu14oapz.
    // STOP must not claim a position.
    assert.deepEqual(report(1, 4, [1]), {});
    assert.deepEqual(report(3, 2, [0, 0, 0, 50]), {running: false, position: 50, state: "OPEN"});
    assert.deepEqual(report(3, 2, [0, 0, 0, 0]), {running: false, position: 0, state: "CLOSE"});
    assert.deepEqual(report(3, 2, [0, 0, 0, 25], {invert_cover: true}),
        {running: false, position: 75, state: "OPEN"});
    assert.deepEqual(report(3, 2, [0, 0, 0, 255]), {running: false});
    const commands = [];
    const entity = {command: async (...args) => commands.push(args)};
    const setter = definition.toZigbee[0];
    for (const [state, expected] of [["OPEN", 0], ["STOP", 1], ["CLOSE", 2]]) {
        await setter.convertSet(entity, "state", state, meta);
        const [cluster, command, payload] = commands.at(-1);
        assert.equal(cluster, "manuSpecificTuya");
        assert.equal(command, "dataRequest");
        assert.equal(payload.dpValues[0].dp, 1);
        assert.equal(payload.dpValues[0].datatype, 4);
        assert.deepEqual([...payload.dpValues[0].data], [expected]);
    }
    await setter.convertSet(entity, "position", 25, meta);
    assert.deepEqual([...commands.at(-1)[2].dpValues[0].data], [0, 0, 0, 25]);
    assert.equal(commands.at(-1)[2].dpValues[0].dp, 2);
    await setter.convertSet(entity, "position", 25, {...meta, options: {invert_cover: true}});
    assert.deepEqual([...commands.at(-1)[2].dpValues[0].data], [0, 0, 0, 75]);
    const beforeInvalid = commands.length;
    await assert.rejects(setter.convertSet(entity, "position", 101, meta), /out of range/);
    for (const invalid of [null, false, true, [], {}, "25", 25.5, NaN, Infinity, -1]) {
        await assert.rejects(setter.convertSet(entity, "position", invalid, meta), /integer/);
    }
    for (const invalid of [null, false, 0, [], {}, "TOGGLE", ""]) {
        await assert.rejects(setter.convertSet(entity, "state", invalid, meta), /State must/);
    }
    assert.equal(commands.length, beforeInvalid);
    const fields = definition.exposes.map(x => x.name || x.type);
    assert(fields.includes("running"));
    if (manufacturerName === "_TZE284_zuq5xxib") {
        assert(fields.includes("options"));
        assert(!fields.includes("fault_raw"));
        const optionSetter = definition.toZigbee[1];
        const before = commands.length;
        for (const invalid of [{reverse_direction: "false"}, {reverse_direction: true, motor_speed: 256}, {motor_speed: 1.5}, {motor_speed: null}, {unknown: 1}, {}]) {
            await assert.rejects(optionSetter.convertSet(entity, "options", invalid, meta));
        }
        await assert.rejects(optionSetter.convertSet(entity, "options", {motor_speed: 50}, {...meta, device: {manufacturerName: "_TZE200_fu14oapz"}}));
        assert.equal(commands.length, before);
        const response = await optionSetter.convertSet(entity, "options", {reverse_direction: false, motor_speed: 100}, meta);
        assert.equal(response, undefined); // No fabricated setting readback.
        assert.deepEqual(commands.slice(-2).map(x => [x[2].dpValues[0].dp, x[2].dpValues[0].datatype, [...x[2].dpValues[0].data]]),
            [[5, 4, [0]], [105, 2, [0, 0, 0, 100]]]);
        await optionSetter.convertSet(entity, "options", {reverse_direction: true}, meta);
        assert.deepEqual([...commands.at(-1)[2].dpValues[0].data], [1]);
        meta.state = {options: {motor_speed: 100}};
        assert.deepEqual(report(5, 4, [1]), {options: {motor_speed: 100, reverse_direction: true}});
        meta.state = {options: {reverse_direction: true}};
        assert.deepEqual(report(105, 2, [0, 0, 0, 80]), {options: {reverse_direction: true, motor_speed: 80}});
        assert.deepEqual(report(5, 4, [2]), {});
        assert.deepEqual(report(105, 2, [0, 0, 1, 0]), {});
        assert.deepEqual(report(5, 1, [1]), {});
    } else {
        assert(!fields.includes("options"));
        assert(fields.includes("work_state_raw") && fields.includes("fault_raw"));
        assert.equal(definition.toZigbee.length, 1);
        assert.deepEqual(report(105, 2, [0, 0, 0, 80]), {});
        assert.deepEqual(report(5, 4, [1]), {});
        assert.deepEqual(report(7, 4, [2]), {work_state_raw: '{"datatype":4,"hex":"02"}'});
        assert.deepEqual(report(12, 5, [0, 128]), {fault_raw: '{"datatype":5,"hex":"0080"}'});
        assert.deepEqual(report(12, 0, [255, 0]), {fault_raw: '{"datatype":0,"hex":"ff00"}'});
    }
    console.log(`PASS ${manufacturerName}: report fixtures, boundary/inverted position, command encoding and range rejection; no hardware commands sent`);
}
async function main() {
    const zhc = require("zigbee-herdsman-converters");
    zhc.setLogger({debug() {}, info() {}, warning() {}, error() {}});
    for (const definition of definitions) zhc.addExternalDefinition({...definition, externalConverterName: "zms1.js"});
    try {
        for (const manufacturerName of ["_TZE284_zuq5xxib", "_TZE200_fu14oapz"]) {
            const selected = await zhc.findByDevice({modelID: "TS0601", manufacturerName, ieeeAddr: "0x0000000000000001", endpoints: []}, false);
            assert.equal(selected.externalConverterName, "zms1.js");
            await checkVariant(manufacturerName);
        }
        const unrelated = await zhc.findByDevice({modelID: "TS0601", manufacturerName: "_TZE200_unrelated", endpoints: []}, false);
        assert.notEqual(unrelated?.externalConverterName, "zms1.js");
    } finally {
        zhc.removeExternalDefinitions("zms1.js");
    }
}
main().catch(error => {console.error(error); process.exitCode = 1;});
