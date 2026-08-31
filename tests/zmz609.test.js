const assert = require("node:assert/strict");
const test = require("node:test");

const definitions = require("../zmz609");

const twoGang = definitions.find((definition) => definition.model === "ZMZ609-2");
const threeGang = definitions.find((definition) => definition.model === "ZMZ609-3");

test("uses the ZMZ609 model family and preserves both channel variants", () => {
    assert(twoGang);
    assert(threeGang);
    assert.deepEqual(twoGang.fingerprint, [
        {modelID: "TS0601", manufacturerName: "_TZE284_o409r73p"},
        {modelID: "TS0601", manufacturerName: "_TZE28C1000000_o409r73p"},
    ]);
    assert.deepEqual(threeGang.fingerprint, [
        {modelID: "TS0601", manufacturerName: "_TZE284_oy1nuaa5"},
    ]);
    assert.deepEqual(twoGang.meta.tuyaDatapoints.map(([dp]) => dp), [13, 14, 16, 20, 21, 22, 23, 101, 102, 104, 111, 112, 113, 114, 1, 7, 29, 105, 2, 8, 30, 106]);
    assert.deepEqual(threeGang.meta.tuyaDatapoints.map(([dp]) => dp), [13, 14, 16, 20, 21, 22, 23, 101, 102, 104, 111, 112, 113, 114, 1, 7, 29, 105, 2, 8, 30, 106, 3, 9, 31, 107]);
});

test("keeps removed controls hidden and exposes standalone weather settings", () => {
    const exposedProperties = twoGang.exposes.map((expose) => expose.property).filter(Boolean);
    for (const removed of ["night_mode", "power_up_times", "run_time"]) {
        assert(!exposedProperties.includes(removed), `${removed} must remain hidden`);
    }

    const options = twoGang.extend.flatMap((extension) => extension.options || []).map((option) => option.property);
    assert.deepEqual(options, ["weather_latitude", "weather_longitude", "weather_auto_location", "weather_refresh_minutes"]);
});

test("encodes date and a current plus three-day weather payload", async (t) => {
    const extendedFromZigbee = twoGang.extend.flatMap((extension) => extension.fromZigbee || []);
    const timeConverter = extendedFromZigbee.find((converter) => converter.type?.includes("commandMcuSyncTime"));
    const weatherConverter = extendedFromZigbee.find((converter) => converter.type?.includes("commandTuyaWeatherRequest"));
    assert(timeConverter);
    assert(weatherConverter);

    const commands = [];
    const endpoint = {
        ID: 1,
        command: async (cluster, command, payload, options) => commands.push({cluster, command, payload, options}),
    };
    const device = {
        ieeeAddr: "0x12345678",
        getEndpoint: (id) => id === 1 ? endpoint : undefined,
    };

    const weatherResponse = {
        utc_offset_seconds: 28800,
        current: {temperature_2m: 27, relative_humidity_2m: 78, weather_code: 0},
        daily: {
            time: ["2026-08-31", "2026-09-01", "2026-09-02", "2026-09-03"],
            weather_code: [0, 61, 3, 95],
            temperature_2m_max: [30, 31, 29, 28],
        },
        hourly: {
            time: ["2026-09-01T00:00", "2026-09-01T12:00", "2026-09-02T12:00", "2026-09-03T12:00"],
            relative_humidity_2m: [70, 80, 75, 85],
        },
    };

    const originalFetch = global.fetch;
    t.after(() => {
        global.fetch = originalFetch;
    });
    global.fetch = async (url) => {
        assert(String(url).startsWith("https://api.open-meteo.com/v1/forecast?"));
        assert(String(url).includes("latitude=22.5431"));
        assert(String(url).includes("longitude=114.0579"));
        return {ok: true, json: async () => weatherResponse};
    };

    await timeConverter.convert(null, {device});
    const timeCommand = commands.at(-1);
    assert.equal(timeCommand.cluster, "manuSpecificTuya");
    assert.equal(timeCommand.command, "mcuSyncTime");
    assert.equal(timeCommand.payload.payloadSize, 8);
    assert.equal(timeCommand.payload.payload.length, 8);

    await weatherConverter.convert(null, {
        device,
        data: {payload: Buffer.from([0, 18, 17, 0, 1, 2, 3, 18, 3, 19, 1])},
    }, null, {weather_latitude: 22.5431, weather_longitude: 114.0579}, {state: {}});

    const weatherCommand = commands.at(-1);
    assert.equal(weatherCommand.cluster, "manuSpecificTuya");
    assert.equal(weatherCommand.command, "tuyaWeatherSync");
    const payload = weatherCommand.payload.payload;
    assert.equal(payload.length, 30);
    assert.equal(payload.readInt16BE(7), 27);
    assert.equal(payload.readInt16BE(9), 31);
    assert.equal(payload.readInt16BE(11), 29);
    assert.equal(payload.readInt16BE(13), 28);
    assert.equal(payload.readInt16BE(16), 78);
    assert.equal(payload.readInt16BE(18), 75);
    assert.equal(payload.readInt16BE(20), 75);
    assert.equal(payload.readInt16BE(22), 85);
    assert.deepEqual([...payload.subarray(25, 29)], [100, 118, 114, 143]);
});
