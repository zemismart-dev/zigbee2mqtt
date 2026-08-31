const zigbeeHerdsmanConverters = require("zigbee-herdsman-converters");
const exposes = zigbeeHerdsmanConverters.exposes || require("zigbee-herdsman-converters/lib/exposes");
const tuya = require("zigbee-herdsman-converters/lib/tuya");

const ea = exposes.access;
const e = exposes.presets;

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
    fingerprint: tuya.fingerprint("TS0601", ["_TZE284_3mzb0sdz"]),
    model: "ZM16B",
    vendor: "Zemismart",
    description: "Tubular motor",
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
    options: [exposes.options.invert_cover()],
    exposes: [
        e.cover_position().setAccess("position", ea.STATE_SET),
        e.enum("motor_direction", ea.STATE_SET, ["forward", "back"]).withDescription("Motor direction"),
        e.enum("border", ea.STATE_SET, ["up", "down", "up_delete", "down_delete", "remove_top_bottom"]).withDescription("Limit setting"),
        e.battery(),
    ],
    meta: {
        tuyaDatapoints: [
            [1, "state", tuya.valueConverterBasic.lookup({
                OPEN: tuya.enum(0),
                STOP: tuya.enum(1),
                CLOSE: tuya.enum(2),
            })],
            [9, "position", tuya.valueConverter.coverPosition],
            [8, "position", tuya.valueConverter.coverPosition],
            [11, "motor_direction", tuya.valueConverterBasic.lookup({
                forward: tuya.enum(0),
                back: tuya.enum(1),
            })],
            [13, "battery", tuya.valueConverter.raw],
            [16, "border", tuya.valueConverterBasic.lookup({
                up: tuya.enum(0),
                down: tuya.enum(1),
                up_delete: tuya.enum(2),
                down_delete: tuya.enum(3),
                remove_top_bottom: tuya.enum(4),
            })],
        ],
    },
};

module.exports = definition;
