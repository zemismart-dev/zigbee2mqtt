const exposes = require("zigbee-herdsman-converters/lib/exposes");
const {logger} = require("zigbee-herdsman-converters/lib/logger");
const tuya = require("zigbee-herdsman-converters/lib/tuya");

const e = exposes.presets;
const ea = exposes.access;
const NS = "zhc:zm609";

const WEATHER_FORECAST_DAYS = 3;
const DEFAULT_WEATHER_REFRESH_MINUTES = 60;
const weatherRuntime = new Map();

const screenNameConverter = {
    from: (value) => {
        const buffer = Buffer.isBuffer(value) ? value : Buffer.from(value || []);

        if (buffer.length >= 3 && buffer[0] === 0x00) {
            const declaredLength = buffer.readUInt16BE(1);
            return buffer.subarray(3, 3 + declaredLength).toString("utf8").replace(/\0+$/g, "");
        }

        return buffer.toString("utf8").replace(/\0+$/g, "");
    },
    to: (value) => [...Buffer.from(String(value ?? ""), "utf8")],
};

const screenNameToZigbee = (property, dp) => ({
    key: [property],
    convertSet: async (entity, key, value) => {
        const name = String(value ?? "");
        await tuya.sendDataPointRaw(entity, dp, screenNameConverter.to(name));
        return {state: {[property]: name}};
    },
});

const fzLocal = {
    ignoreTuyaConfigureResponse: {
        cluster: 0xe000,
        type: ["raw"],
        convert: () => undefined,
    },
};

const clampInt16 = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    return Math.max(-32768, Math.min(32767, Math.round(numeric)));
};

const appendInt16 = (bytes, value) => {
    const encoded = Buffer.alloc(2);
    encoded.writeInt16BE(clampInt16(value));
    bytes.push(...encoded);
};

const weatherPayload = (state, requestedDays = WEATHER_FORECAST_DAYS, includeCurrent = true) => {
    const dayCount = Math.max(0, Math.min(7, Number(requestedDays) || 0));
    const indexes = [...(includeCurrent ? [0] : []), ...Array.from({length: dayCount}, (_, index) => index + 1)];
    const bytes = [0x11, 0x00, 0x12, dayCount, 0x13, includeCurrent ? 1 : 0, 0x01];

    for (const index of indexes) appendInt16(bytes, state[`temperature_${index}`]);
    bytes.push(0x02);
    for (const index of indexes) appendInt16(bytes, state[`humidity_${index}`]);
    bytes.push(0x03);
    for (const index of indexes) {
        bytes.push(tuya.M8ProTuyaWeatherCondition[state[`condition_${index}`]] ?? tuya.M8ProTuyaWeatherCondition.cloudy);
    }
    bytes.push(0x00);
    return Buffer.from(bytes);
};

const timePayload = (utcOffsetSeconds) => {
    const utcTime = Math.floor(Date.now() / 1000);
    const localTime = utcTime + utcOffsetSeconds;
    const payload = Buffer.alloc(8);
    payload.writeUInt32BE(utcTime, 0);
    payload.writeUInt32BE(localTime, 4);
    return [...payload];
};

const systemUtcOffsetSeconds = () => -new Date().getTimezoneOffset() * 60;

const getRuntime = (device) => {
    let runtime = weatherRuntime.get(device.ieeeAddr);
    if (!runtime) {
        runtime = {device, timer: undefined, pending: undefined, weather: undefined, utcOffsetSeconds: undefined, autoLocation: undefined};
        weatherRuntime.set(device.ieeeAddr, runtime);
    } else {
        runtime.device = device;
    }
    return runtime;
};

const fetchJson = async (url) => {
    if (typeof fetch !== "function") throw new Error("This Zigbee2MQTT Node.js runtime does not provide fetch()");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    timeout.unref?.();
    try {
        const response = await fetch(url, {signal: controller.signal, headers: {accept: "application/json"}});
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
    } finally {
        clearTimeout(timeout);
    }
};

const validCoordinate = (value, min, max) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric >= min && numeric <= max ? numeric : undefined;
};

const autoLocationEnabled = (options) => options.weather_auto_location !== false && options.weather_auto_location !== "false";

const resolveLocation = async (runtime, options) => {
    const latitude = validCoordinate(options.weather_latitude, -90, 90);
    const longitude = validCoordinate(options.weather_longitude, -180, 180);
    if (latitude !== undefined && longitude !== undefined) return {latitude, longitude, source: "configured"};

    if (!autoLocationEnabled(options)) {
        throw new Error("weather location is not configured and automatic location is disabled");
    }

    const now = Date.now();
    if (runtime.autoLocation?.expiresAt > now) return runtime.autoLocation;

    const data = await fetchJson("https://ipwho.is/?fields=success,latitude,longitude,timezone");
    if (!data.success) throw new Error("automatic IP location lookup failed");

    const autoLatitude = validCoordinate(data.latitude, -90, 90);
    const autoLongitude = validCoordinate(data.longitude, -180, 180);
    if (autoLatitude === undefined || autoLongitude === undefined) throw new Error("automatic IP location returned invalid coordinates");

    runtime.autoLocation = {
        latitude: autoLatitude,
        longitude: autoLongitude,
        utcOffsetSeconds: Number(data.timezone?.offset),
        source: "automatic IP location",
        expiresAt: now + 24 * 60 * 60 * 1000,
    };
    return runtime.autoLocation;
};

const wmoToTuyaCondition = (code) => {
    const numeric = Number(code);
    if (numeric === 0 || numeric === 1) return "sunny";
    if (numeric === 2) return "cloudy";
    if (numeric === 3) return "yin";
    if (numeric === 45 || numeric === 48) return "fog";
    if ([51, 53, 55, 61, 63].includes(numeric)) return "rain";
    if ([56, 57, 66, 67].includes(numeric)) return "freezing_rain";
    if (numeric === 65) return "heavy_rain";
    if (numeric === 71) return "light_snow";
    if ([73, 77].includes(numeric)) return "snow";
    if (numeric === 75) return "heavy_snow";
    if ([80, 81].includes(numeric)) return "shower";
    if (numeric === 82) return "heavy_shower";
    if (numeric === 85) return "snow_shower";
    if (numeric === 86) return "heavy_snow";
    if (numeric === 96 || numeric === 99) return "hailstone";
    if (numeric === 95) return "thunder_shower";
    return "cloudy";
};

const dailyHumidity = (data, date, fallback) => {
    const values = [];
    for (let index = 0; index < (data.hourly?.time?.length || 0); index++) {
        if (!String(data.hourly.time[index]).startsWith(date)) continue;
        const humidity = Number(data.hourly.relative_humidity_2m?.[index]);
        if (Number.isFinite(humidity)) values.push(humidity);
    }
    if (!values.length) return fallback;
    return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
};

const normalizeWeather = (data) => {
    const currentTemperature = clampInt16(data.current?.temperature_2m);
    const currentHumidity = clampInt16(data.current?.relative_humidity_2m);
    const state = {
        temperature_0: currentTemperature,
        humidity_0: currentHumidity,
        condition_0: wmoToTuyaCondition(data.current?.weather_code),
    };

    for (let day = 1; day <= WEATHER_FORECAST_DAYS; day++) {
        const sourceIndex = Math.min(day, Math.max(0, (data.daily?.time?.length || 1) - 1));
        const date = data.daily?.time?.[sourceIndex];
        state[`temperature_${day}`] = clampInt16(data.daily?.temperature_2m_max?.[sourceIndex] ?? currentTemperature);
        state[`humidity_${day}`] = date ? dailyHumidity(data, date, currentHumidity) : currentHumidity;
        state[`condition_${day}`] = wmoToTuyaCondition(data.daily?.weather_code?.[sourceIndex] ?? data.current?.weather_code);
    }
    return state;
};

const syncTime = async (device, utcOffsetSeconds) => {
    const endpoint = device.getEndpoint(1);
    if (!endpoint) throw new Error("endpoint 1 is unavailable");
    await endpoint.command("manuSpecificTuya", "mcuSyncTime", {
        payloadSize: 8,
        payload: timePayload(Number.isFinite(utcOffsetSeconds) ? utcOffsetSeconds : systemUtcOffsetSeconds()),
    }, {});
};

const sendWeather = async (device, state, requestedDays = WEATHER_FORECAST_DAYS, includeCurrent = true) => {
    const endpoint = device.getEndpoint(1);
    if (!endpoint) throw new Error("endpoint 1 is unavailable");
    await endpoint.command("manuSpecificTuya", "tuyaWeatherSync", {
        payload: weatherPayload(state, requestedDays, includeCurrent),
    });
};

const refreshWeather = async (device, options, sendToDevice = true) => {
    const runtime = getRuntime(device);
    if (runtime.pending) return await runtime.pending;

    runtime.pending = (async () => {
        const location = await resolveLocation(runtime, options);
        const query = new URLSearchParams({
            latitude: String(location.latitude),
            longitude: String(location.longitude),
            current: "temperature_2m,relative_humidity_2m,weather_code",
            hourly: "relative_humidity_2m",
            daily: "weather_code,temperature_2m_max",
            timezone: "auto",
            forecast_days: String(WEATHER_FORECAST_DAYS + 1),
        });
        const data = await fetchJson(`https://api.open-meteo.com/v1/forecast?${query}`);
        runtime.weather = normalizeWeather(data);
        runtime.utcOffsetSeconds = Number.isFinite(Number(data.utc_offset_seconds)) ? Number(data.utc_offset_seconds) : location.utcOffsetSeconds;

        if (sendToDevice) {
            await syncTime(device, runtime.utcOffsetSeconds);
            await sendWeather(device, runtime.weather);
        }
        logger.info(() => `Updated date and weather for '${device.ieeeAddr}' using ${location.source}`, NS);
        return runtime.weather;
    })().finally(() => {
        runtime.pending = undefined;
    });

    return await runtime.pending;
};

const refreshIntervalMs = (options) => {
    const minutes = Number(options.weather_refresh_minutes ?? DEFAULT_WEATHER_REFRESH_MINUTES);
    return Math.max(30, Math.min(360, Number.isFinite(minutes) ? minutes : DEFAULT_WEATHER_REFRESH_MINUTES)) * 60 * 1000;
};

const scheduleRefresh = (device, options, delayMs = 1000) => {
    const runtime = getRuntime(device);
    clearTimeout(runtime.timer);

    const run = async () => {
        try {
            await syncTime(device, runtime.utcOffsetSeconds);
            await refreshWeather(device, options);
        } catch (error) {
            logger.warning(() => `Date/weather update failed for '${device.ieeeAddr}' (${error.message || error})`, NS);
        }
        runtime.timer = setTimeout(run, refreshIntervalMs(options));
        runtime.timer.unref?.();
    };

    runtime.timer = setTimeout(run, delayMs);
    runtime.timer.unref?.();
};

const screenServicesExtend = {
    isModernExtend: true,
    options: [
        exposes.numeric("weather_latitude", ea.SET)
            .withValueMin(-90)
            .withValueMax(90)
            .withValueStep(0.0001)
            .withDescription("Weather latitude; overrides automatic IP location"),
        exposes.numeric("weather_longitude", ea.SET)
            .withValueMin(-180)
            .withValueMax(180)
            .withValueStep(0.0001)
            .withDescription("Weather longitude; overrides automatic IP location"),
        exposes.binary("weather_auto_location", ea.SET, true, false)
            .withDescription("Use approximate public IP location when coordinates are not configured"),
        exposes.numeric("weather_refresh_minutes", ea.SET)
            .withValueMin(30)
            .withValueMax(360)
            .withValueStep(1)
            .withDescription("Weather refresh interval in minutes; default 60"),
    ],
    fromZigbee: [
        {
            cluster: "manuSpecificTuya",
            type: ["commandMcuSyncTime"],
            convert: async (model, msg) => {
                const runtime = getRuntime(msg.device);
                await syncTime(msg.device, runtime.utcOffsetSeconds);
            },
        },
        {
            cluster: "manuSpecificTuya",
            type: ["commandTuyaWeatherRequest"],
            convert: async (model, msg, publish, options, meta) => {
                const runtime = getRuntime(msg.device);
                let state = runtime.weather;
                if (!state) {
                    try {
                        state = await refreshWeather(msg.device, options, false);
                    } catch (error) {
                        logger.warning(() => `Weather request failed for '${msg.device.ieeeAddr}' (${error.message || error})`, NS);
                        state = meta.state || {};
                    }
                }

                const request = Buffer.from(msg.data?.payload || []);
                const forecastMarker = request.indexOf(0x12, 4);
                const currentMarker = request.indexOf(0x13, Math.max(4, forecastMarker + 2));
                const requestedDays = forecastMarker >= 0 ? request[forecastMarker + 1] : WEATHER_FORECAST_DAYS;
                const includeCurrent = currentMarker >= 0 ? request[currentMarker + 1] !== 0 : true;
                await sendWeather(msg.device, state, requestedDays, includeCurrent);
            },
        },
    ],
    onEvent: [
        (event) => {
            if (["start", "deviceAnnounce", "deviceJoined"].includes(event.type)) {
                scheduleRefresh(event.data.device, event.data.options, event.type === "start" ? 3000 : 500);
            } else if (event.type === "deviceOptionsChanged") {
                scheduleRefresh(event.data.device, event.data.options, 100);
            } else if (event.type === "stop") {
                const runtime = weatherRuntime.get(event.data.ieeeAddr);
                clearTimeout(runtime?.timer);
                weatherRuntime.delete(event.data.ieeeAddr);
            }
        },
    ],
};

const tuyaBaseExtend = tuya.modernExtend.tuyaBase({
    dp: true,
    queryOnConfigure: true,
    queryOnDeviceAnnounce: true,
});
tuyaBaseExtend.options = (tuyaBaseExtend.options || []).filter((option) => option.property !== "time_start");

const ignoredDatapoint = {from: () => undefined, to: null};

const radarDistance = tuya.valueConverterBasic.lookup({
    short: tuya.enum(0),
    medium_short: tuya.enum(1),
    medium: tuya.enum(2),
    medium_long: tuya.enum(3),
    long: tuya.enum(4),
});

const screenOffTime = tuya.valueConverterBasic.lookup({
    none: tuya.enum(0),
    "10": tuya.enum(1),
    "20": tuya.enum(2),
    "30": tuya.enum(3),
    "45": tuya.enum(4),
    "60": tuya.enum(5),
});

const definition = {
    fingerprint: tuya.fingerprint("TS0601", [
        "_TZE284_o409r73p",
        "_TZE28C1000000_o409r73p",
    ]),
    model: "TS0601_2gang_screen_switch_o409r73p",
    vendor: "Zemismart",
    description: "2 gang screen switch with metering",
    extend: [
        screenServicesExtend,
        tuyaBaseExtend,
    ],
    fromZigbee: [tuya.fz.datapoints, fzLocal.ignoreTuyaConfigureResponse],
    toZigbee: [
        screenNameToZigbee("switch1_name", 105),
        screenNameToZigbee("switch2_name", 106),
        tuya.tz.datapoints,
    ],
    configure: async (device, coordinatorEndpoint) => {
        await tuya.configureMagicPacket(device, coordinatorEndpoint);
    },
    endpoint: () => ({l1: 1, l2: 1}),
    meta: {
        multiEndpoint: true,
        tuyaDatapoints: [
            [1, "state_l1", tuya.valueConverter.onOff],
            [2, "state_l2", tuya.valueConverter.onOff],
            [7, "countdown_l1", tuya.valueConverter.countdown],
            [8, "countdown_l2", tuya.valueConverter.countdown],
            [13, "_dp13", ignoredDatapoint],
            [14, "power_on_behavior", tuya.valueConverter.powerOnBehaviorEnum],
            [16, "radar_switch", tuya.valueConverter.onOff],
            [20, "energy", tuya.valueConverter.divideBy1000],
            [21, "current", tuya.valueConverter.divideBy1000],
            [22, "power", tuya.valueConverter.divideBy10],
            [23, "voltage", tuya.valueConverter.divideBy10],
            [29, "power_on_behavior_l1", tuya.valueConverter.powerOnBehaviorEnum],
            [30, "power_on_behavior_l2", tuya.valueConverter.powerOnBehaviorEnum],
            [101, "child_lock", tuya.valueConverter.onOff],
            [102, "backlight", tuya.valueConverter.raw],
            [104, "radar_distance", radarDistance],
            [105, "switch1_name", {from: screenNameConverter.from, to: null}],
            [106, "switch2_name", {from: screenNameConverter.from, to: null}],
            [111, "screen_off_time", screenOffTime],
            [112, "_dp112", ignoredDatapoint],
            [113, "_dp113", ignoredDatapoint],
        ],
    },
    exposes: [
        e.switch().withEndpoint("l1").setAccess("state", ea.STATE_SET),
        e.switch().withEndpoint("l2").setAccess("state", ea.STATE_SET),
        exposes.numeric("countdown_l1", ea.STATE_SET)
            .withUnit("s")
            .withValueMin(0)
            .withValueMax(43200)
            .withValueStep(1)
            .withDescription("Countdown for gang 1"),
        exposes.numeric("countdown_l2", ea.STATE_SET)
            .withUnit("s")
            .withValueMin(0)
            .withValueMax(43200)
            .withValueStep(1)
            .withDescription("Countdown for gang 2"),
        e.power_on_behavior().withAccess(ea.STATE_SET),
        e.power_on_behavior().withEndpoint("l1").withAccess(ea.STATE_SET),
        e.power_on_behavior().withEndpoint("l2").withAccess(ea.STATE_SET),
        exposes.binary("radar_switch", ea.STATE_SET, "ON", "OFF")
            .withDescription("Radar switch"),
        exposes.binary("child_lock", ea.STATE_SET, "ON", "OFF")
            .withDescription("Child lock"),
        exposes.numeric("backlight", ea.STATE_SET)
            .withUnit("%")
            .withValueMin(0)
            .withValueMax(100)
            .withValueStep(1)
            .withDescription("Backlight brightness"),
        exposes.enum("radar_distance", ea.STATE_SET, ["short", "medium_short", "medium", "medium_long", "long"])
            .withDescription("Radar distance"),
        exposes.enum("screen_off_time", ea.STATE_SET, ["none", "10", "20", "30", "45", "60"])
            .withDescription("Screen off time"),
        exposes.text("switch1_name", ea.STATE_SET)
            .withDescription("Display name for gang 1"),
        exposes.text("switch2_name", ea.STATE_SET)
            .withDescription("Display name for gang 2"),
        e.energy(),
        e.current(),
        e.power(),
        e.voltage(),
    ],
};

module.exports = definition;
