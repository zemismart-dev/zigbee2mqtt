const fz = require('zigbee-herdsman-converters/converters/fromZigbee');
const tz = require('zigbee-herdsman-converters/converters/toZigbee');
const exposes = require('zigbee-herdsman-converters/lib/exposes');
const e = exposes.presets;
const ea = exposes.access;
const tuya = require('zigbee-herdsman-converters/lib/tuya');

const definition = {
    fingerprint: tuya.fingerprint("TS0601", ["_TZE200_jt50ea5d"]),
    model: "TS0601_heat_meter",
    vendor: "Tuya",
    description: "Ultrasonic heat meter",
    extend: [tuya.modernExtend.tuyaBase({ dp: true })],
    exposes: [
        e.numeric("cumulative_flow", ea.STATE).withUnit("m³").withDescription("Cumulative water flow").withValueMin(0).withValueStep(0.01),
        e.numeric("monthly_water_consumption", ea.STATE).withUnit("m³").withDescription("Monthly water consumption").withValueMin(0).withValueStep(0.001),
        e.numeric("daily_water_consumption", ea.STATE).withUnit("m³").withDescription("Daily water consumption").withValueMin(0).withValueStep(0.001),
        e.enum("report_period", ea.STATE_SET, ["1h", "2h", "3h", "4h", "6h", "8h", "12h", "24h", "48h", "72h"]).withDescription("Report period"),
        e.text("fault", ea.STATE).withDescription("Active fault status"),
        e.binary("prepayment_switch", ea.STATE_SET, "ON", "OFF").withDescription("Cumulative metering switch"),
        e.numeric("cumulative_heat", ea.STATE).withUnit("kWh").withDescription("Cumulative heat").withValueMin(0).withValueStep(0.01),
        e.text("meter_id", ea.STATE).withDescription("Meter identification number"),
        e.numeric("instantaneous_flow_rate", ea.STATE).withUnit("m³/h").withDescription("Instantaneous flow rate").withValueMin(0).withValueStep(0.001),
        e.numeric("inlet_water_temperature", ea.STATE).withUnit("°C").withDescription("Inlet water temperature").withValueMin(0).withValueStep(0.01),
        e.numeric("outlet_water_temperature", ea.STATE).withUnit("°C").withDescription("Outlet water temperature").withValueMin(0).withValueStep(0.01),
        e.numeric("voltage", ea.STATE).withUnit("V").withDescription("Power supply voltage").withValueMin(0).withValueStep(0.01),
    ],
    meta: {
        tuyaDatapoints: [
            // DP 1 - Cumulative Flow
            [
                1,
                "cumulative_flow",
                {
                    from: (value, meta) => {
                        // Multiplier: 2, so divide by 100 to get m³
                        return value / 100;
                    },
                },
            ],
            // DP 2 - Monthly Water Consumption
            [
                2,
                "monthly_water_consumption",
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
            // DP 3 - Daily Water Consumption
            [
                3,
                "daily_water_consumption",
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
            // DP 4 - Report Period Setting
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
                    "48h": tuya.enum(8),
                    "72h": tuya.enum(9),
                }),
            ],
            // DP 5 - Fault bitmap
            [
                5,
                "fault",
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
                            2048: "empty_pip_alarm",
                            4096: "transduce_alarm",
                        };

                        if (value === 0) {
                            return "OK";
                        }

                        for (const [bit, name] of Object.entries(faultMap)) {
                            if (value & parseInt(bit)) {
                                faults.push(name);
                            }
                        }
                        return faults.join(", ");
                    },
                },
            ],
            // DP 6 - Prepayment Switch
            [6, "prepayment_switch", tuya.valueConverter.onOff],
            // DP 7 - Cumulative Heat
            [
                7,
                "cumulative_heat",
                {
                    from: (value, meta) => {
                        // Multiplier: 2, so divide by 100 to get kWh
                        return value / 100;
                    },
                },
            ],
            // DP 16 - Meter ID
            [16, "meter_id", tuya.valueConverter.raw],
            // DP 19 - Instantaneous Flow Rate
            [
                19,
                "instantaneous_flow_rate",
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
            // DP 21 - Inlet Water Temperature
            [
                21,
                "inlet_water_temperature",
                {
                    from: (value, meta) => {
                        // Multiplier: 2, so divide by 100 to get °C
                        return value / 100;
                    },
                },
            ],
            // DP 22 - Outlet Water Temperature
            [
                22,
                "outlet_water_temperature",
                {
                    from: (value, meta) => {
                        // Multiplier: 2, so divide by 100 to get °C
                        return value / 100;
                    },
                },
            ],
            // DP 24 - Power Supply Voltage
            [
                24,
                "voltage",
                {
                    from: (value, meta) => {
                        // Multiplier: 2, so divide by 100 to get V
                        return value / 100;
                    },
                },
            ],
        ],
    },
    options: [
        exposes.options.precision("cumulative_flow"),
        exposes.options.calibration("cumulative_flow"),
        exposes.options.precision("monthly_water_consumption"),
        exposes.options.calibration("monthly_water_consumption"),
        exposes.options.precision("daily_water_consumption"),
        exposes.options.calibration("daily_water_consumption"),
        exposes.options.precision("instantaneous_flow_rate"),
        exposes.options.calibration("instantaneous_flow_rate"),
        exposes.options.precision("cumulative_heat"),
        exposes.options.calibration("cumulative_heat"),
        exposes.options.precision("inlet_water_temperature"),
        exposes.options.calibration("inlet_water_temperature"),
        exposes.options.precision("outlet_water_temperature"),
        exposes.options.calibration("outlet_water_temperature"),
        exposes.options.precision("voltage"),
        exposes.options.calibration("voltage"),
    ],
};

module.exports = definition;
