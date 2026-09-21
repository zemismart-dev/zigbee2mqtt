const assert = require("node:assert/strict");
const test = require("node:test");
const zhc = require("zigbee-herdsman-converters");
const definition = require("../zemismart-zps-z1-z2m.js");

test("ZPS-Z1 selection requires both the exact model and manufacturer", async () => {
    const converterName = "zemismart-zps-z1-z2m.js";
    zhc.setLogger({debug() {}, info() {}, warning() {}, error() {}});
    zhc.addExternalDefinition({...definition, externalConverterName: converterName});
    const device = (modelID, manufacturerName) => ({
        modelID,
        manufacturerName,
        ieeeAddr: "0x0000000000000001",
        endpoints: [],
    });
    try {
        const selected = await zhc.findByDevice(device("TS0601", "_TZE284_ft7qqpx3"), false);
        assert.equal(selected?.externalConverterName, converterName);
        assert.equal(selected.model, "ZPS-Z1");

        // Check a known Tuya curtain motor as well as unsupported/missing identities.
        // This exercises the actual upstream selection logic, including fallbacks.
        for (const [modelID, manufacturerName] of [
            ["TS0601", "_TZE200_fu14oapz"],
            ["TS0601", "_TZE284_unrelated"],
            ["TS0601", "_TZE200_ft7qqpx3"],
            ["TS0601", "_TZE284_ft7qqpx3_extra"],
            ["TS0601", undefined],
            ["TS0601", ""],
            ["TS0001", "_TZE284_ft7qqpx3"],
            [undefined, "_TZE284_ft7qqpx3"],
        ]) {
            const actual = await zhc.findByDevice(device(modelID, manufacturerName), false);
            assert.notEqual(actual?.externalConverterName, converterName,
                `must not select ZPS-Z1 for ${modelID} / ${manufacturerName}`);
        }
    } finally {
        zhc.removeExternalDefinitions(converterName);
    }
});
