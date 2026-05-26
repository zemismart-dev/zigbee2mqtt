const fz = require('zigbee-herdsman-converters/converters/fromZigbee');
const tz = require('zigbee-herdsman-converters/converters/toZigbee');
const exposes = require('zigbee-herdsman-converters/lib/exposes');
const e = exposes.presets;
const ea = exposes.access;
const tuya = require('zigbee-herdsman-converters/lib/tuya');

const definition = {
    fingerprint: tuya.fingerprint("TS0601", ["_TZE284_vuwtqx0t", "_TZE200_vuwtqx0t"]),
    model: "TS0601_water_valve",
    vendor: "Tuya",
    description: "Ultrasonic water meter valve",
    extend: [tuya.modernExtend.tuyaBase({ dp: true })],
    exposes: [
        e.switch().setAccess("state", ea.STATE_SET),
        e.numeric("water_consumed", ea.STATE).withUnit("m³").withDescription("Total water consumption").withValueMin(0).withValueStep(0.001),
        e.numeric("month_consumption", ea.STATE).withUnit("m³").withDescription("Month consumption").withValueMin(0).withValueStep(0.001),
        e.numeric("daily_consumption", ea.STATE).withUnit("m³").withDescription("Daily consumption").withValueMin(0).withValueStep(0.001),
        e.numeric("flow_rate", ea.STATE).withUnit("m³/h").withDescription("Instantaneous water flow rate").withValueMin(0).withValueStep(0.001),
        e.binary("auto_clean", ea.STATE_SET, "ON", "OFF").withDescription("Auto clean"),
        e.temperature(),
        e.voltage(),
        e.numeric("reverse_water_consumed", ea.STATE)
            .withUnit("m³")
            .withDescription("Reverse water consumption")
            .withValueMin(0)
            .withValueStep(0.001),
        e.text("meter_id", ea.STATE).withDescription("Meter identification number"),
        e.enum("report_period", ea.STATE_SET, ["1h", "2h", "3h", "4h", "6h", "8h", "12h", "24h"]).withDescription("Report period"),
        e.text("faults", ea.STATE).withDescription("Active fault status"),
    ],
    meta: {
        tuyaDatapoints: [
            [1, "water_consumed", tuya.valueConverter.divideBy1000],
            [
                2,
                "month_consumption",
                {
                    from: (v) => {
                        const buf = Buffer.isBuffer(v) ? v : Buffer.from(v || []);
                        if (buf.length >= 8) {
                            const value = (buf.readUInt8(4) << 24) + (buf.readUInt8(5) << 16) + (buf.readUInt8(6) << 8) + buf.readUInt8(7);
                            return value / 1000;
                        }
                        return 0;
                    },
                },
            ],
            [
                3,
                "daily_consumption",
                {
                    from: (v) => {
                        const buf = Buffer.isBuffer(v) ? v : Buffer.from(v || []);
                        if (buf.length >= 8) {
                            const value = (buf.readUInt8(4) << 24) + (buf.readUInt8(5) << 16) + (buf.readUInt8(6) << 8) + buf.readUInt8(7);
                            return value / 1000;
                        }
                        return 0;
                    },
                },
            ],
            [
                4,
                "report_period",
                tuya.valueConverterBasic.lookup({
                    "1h": tuya.enum(0),
                    "2h": tuya.enum(1),
                    "3h": tuya.enum(2),
                    "4h": tuya.enum(3),
                    "6h": tuya.enum(4),
                    "8h": tuya.enum(5),
                    "12h": tuya.enum(6),
                    "24h": tuya.enum(7),
                }),
            ],
            [
                5,
                "faults",
                {
                    from: (value, meta) => {
                        const faults = [];
                        const faultMap = {
                            1: "battery_alarm",
                            2: "magnetism_alarm",
                            4: "cover_alarm",
                            8: "credit_alarm",
                            16: "switch_gaps_alarm",
                            32: "meter_body_alarm",
                            64: "abnormal_water_alarm",
                            128: "arrearage_alarm",
                            256: "overflow_alarm",
                            512: "revflow_alarm",
                            1024: "over_pre_alarm",
                            2048: "empty_pipe_alarm",
                            4096: "transducer_alarm",
                        };

                        if (value === 0) {
                            return "";
                        }

                        for (const [bit, name] of Object.entries(faultMap)) {
                            if (value & parseInt(bit)) {
                                faults.push(name);
                            }
                        }
                        // Return as comma-separated string
                        return faults.join(",");
                    },
                },
            ],
            [13, "state", tuya.valueConverter.onOffNotStrict],
            [14, "auto_clean", tuya.valueConverter.onOff],
            [16, "meter_id", tuya.valueConverter.raw],
            [
                18,
                "reverse_water_consumed",
                {
                    from: (value, meta) => {
                        const buffer = Buffer.from(value);
                        if (buffer.length >= 4) {
                            try {
                                const uintValue = buffer.readUInt32BE(0);
                                return uintValue / 1000;
                            } catch (_error) {
                                return null;
                            }
                        }
                        return null;
                    },
                },
            ],
            [
                21,
                "flow_rate",
                {
                    from: (v) => {
                        const buf = Buffer.isBuffer(v) ? v : Buffer.from(v || []);
                        if (buf.length >= 4) {
                            const value = buf.readUInt32BE(0);
                            return value / 1000;
                        }
                        return 0;
                    },
                },
            ],
            [22, "temperature", tuya.valueConverter.divideBy100],
            [26, "voltage", tuya.valueConverter.divideBy100],
        ],
    },
    options: [
        exposes.options.precision("water_consumed"),
        exposes.options.calibration("water_consumed"),
        exposes.options.precision("month_consumption"),
        exposes.options.calibration("month_consumption"),
        exposes.options.precision("daily_consumption"),
        exposes.options.calibration("daily_consumption"),
        exposes.options.precision("flow_rate"),
        exposes.options.calibration("flow_rate"),
        exposes.options.precision("reverse_water_consumed"),
        exposes.options.calibration("reverse_water_consumed"),
        exposes.options.precision("temperature"),
        exposes.options.calibration("temperature"),
    ],
};

module.exports = definition;
