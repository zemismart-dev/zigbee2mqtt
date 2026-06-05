const exposes = require("zigbee-herdsman-converters/lib/exposes");
const tuya = require("zigbee-herdsman-converters/lib/tuya");

const e = exposes.presets;
const ea = exposes.access;

const batteryQueryIntervalSeconds = 12 * 60 * 60;

const queryDatapoints = async (entity) => {
    await entity.command("manuSpecificTuya", "dataQuery", {});
};

const tzLocal = {
    battery_query: {
        key: ["battery"],
        convertGet: async (entity) => {
            await queryDatapoints(entity);
        },
    },
};

const definition = {
    fingerprint: tuya.fingerprint("TS0601", ["_TZE284_6hrnp30w"]),
    model: "ZMP1",
    vendor: "Zemismart",
    description: "Roller shade driver",
    extend: [tuya.modernExtend.tuyaBase({
        dp: true,
        queryOnConfigure: true,
        queryOnDeviceAnnounce: true,
        queryIntervalSeconds: batteryQueryIntervalSeconds,
    })],
    fromZigbee: [tuya.fz.datapoints],
    toZigbee: [tzLocal.battery_query, tuya.tz.datapoints],
    onEvent: tuya.onEventSetTime,
    configure: async (device, coordinatorEndpoint) => {
        await tuya.configureMagicPacket(device, coordinatorEndpoint);
        await queryDatapoints(device.getEndpoint(1));
    },
    exposes: [
        e.cover_position().setAccess("position", ea.STATE_SET),
        e.enum("click_control", ea.SET, ["up", "down"])
            .withDescription("Nudge the shade up or down by one step"),
        e.enum("motor_direction", ea.STATE_SET, ["forward", "back"])
            .withDescription("Reverse motor direction if open and close are inverted"),
        e.enum("mode", ea.STATE_SET, ["morning", "night"])
            .withDescription("Morning or night mode"),
        e.enum("work_state", ea.STATE, ["opening", "closing"])
            .withDescription("Current motor motion state"),
        e.numeric("time_total", ea.STATE)
            .withUnit("ms")
            .withValueMin(0)
            .withValueMax(120000)
            .withDescription("Total calibrated travel time in milliseconds"),
        e.enum("situation_set", ea.STATE, ["fully_open", "fully_close"])
            .withDescription("Reports when the shade physically reaches a set limit"),
        e.binary("motor_fault", ea.STATE, true, false)
            .withDescription("Motor fault detected"),
        e.battery(),
        e.enum("set_limit", ea.SET, ["Set upper limit", "Set lower limit"])
            .withDescription("Save the current motor position as a travel limit"),
        e.enum("remove_limit", ea.SET, ["Remove upper limit", "Remove lower limit", "Clear both limits"])
            .withDescription("Remove one or both travel limits"),
    ],
    meta: {
        tuyaDatapoints: [
            [1, "state", tuya.valueConverterBasic.lookup({
                OPEN: tuya.enum(0),
                STOP: tuya.enum(1),
                CLOSE: tuya.enum(2),
            })],
            [2, "position", {
                from: null,
                to: (value) => value,
            }],
            [3, "position", {
                from: (value) => value,
                to: null,
            }],
            [4, "mode", tuya.valueConverterBasic.lookup({
                morning: tuya.enum(0),
                night: tuya.enum(1),
            })],
            [5, "motor_direction", tuya.valueConverterBasic.lookup({
                forward: tuya.enum(0),
                back: tuya.enum(1),
            })],
            [7, "work_state", tuya.valueConverterBasic.lookup({
                opening: tuya.enum(0),
                closing: tuya.enum(1),
            })],
            [10, "time_total", tuya.valueConverter.raw],
            [11, "situation_set", tuya.valueConverterBasic.lookup({
                fully_open: tuya.enum(0),
                fully_close: tuya.enum(1),
            })],
            [12, "motor_fault", {
                from: (value) => value !== 0,
                to: null,
            }],
            [13, "battery", tuya.valueConverter.raw],
            [16, "set_limit", {
                from: null,
                to: (value) => {
                    const lookup = {
                        "Set upper limit": tuya.enum(0),
                        "Set lower limit": tuya.enum(1),
                    };
                    return lookup[value];
                },
            }],
            [16, "remove_limit", {
                from: null,
                to: (value) => {
                    const lookup = {
                        "Remove upper limit": tuya.enum(2),
                        "Remove lower limit": tuya.enum(3),
                        "Clear both limits": tuya.enum(4),
                    };
                    return lookup[value];
                },
            }],
            [20, "click_control", tuya.valueConverterBasic.lookup({
                up: tuya.enum(0),
                down: tuya.enum(1),
            })],
        ],
    },
};

module.exports = definition;
