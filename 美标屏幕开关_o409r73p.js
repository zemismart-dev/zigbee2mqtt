const zigbeeHerdsmanConverters = require('zigbee-herdsman-converters');
const exposes = zigbeeHerdsmanConverters.exposes || require('zigbee-herdsman-converters/lib/exposes');
const tuya = require('zigbee-herdsman-converters/lib/tuya');

const e = exposes.presets;
const ea = exposes.access;

const screenNameConverter = {
    from: (value) => {
        const buf = Buffer.isBuffer(value) ? value : Buffer.from(value || []);
        if (buf.length >= 3 && buf[0] === 0x00) {
            const declaredLength = buf.readUInt16BE(1);
            return buf.subarray(3, 3 + declaredLength).toString('utf8').replace(/\0+$/g, '');
        }
        return buf.toString('utf8').replace(/\0+$/g, '');
    },
    to: (value) => {
        const text = String(value ?? '');
        const raw = Buffer.from(text, 'utf8');
        return [...raw];
    },
};

const tzLocal = {
    switch1_name: {
        key: ['switch1_name'],
        convertSet: async (entity, key, value) => {
            await tuya.sendDataPointRaw(entity, 105, screenNameConverter.to(value));
            return {state: {switch1_name: String(value ?? '')}};
        },
    },
    switch2_name: {
        key: ['switch2_name'],
        convertSet: async (entity, key, value) => {
            await tuya.sendDataPointRaw(entity, 106, screenNameConverter.to(value));
            return {state: {switch2_name: String(value ?? '')}};
        },
    },
};

const definition = {
    fingerprint: tuya.fingerprint('TS0601', ['_TZE284_o409r73p']),
    model: 'ZT3L_2G_metering',
    vendor: 'Zemismart',
    description: 'US standard screen switch 2 gangs with metering',
    extend: [tuya.modernExtend.tuyaBase({dp: true})],
    fromZigbee: [tuya.fz.datapoints],
    toZigbee: [tzLocal.switch1_name, tzLocal.switch2_name, tuya.tz.datapoints],
    onEvent: tuya.onEventSetTime,
    configure: async (device, coordinatorEndpoint) => {
        await tuya.configureMagicPacket(device, coordinatorEndpoint);
    },
    endpoint: () => ({l1: 1, l2: 1}),
    meta: {
        multiEndpoint: true,
        tuyaDatapoints: [
            [1, 'state_l1', tuya.valueConverter.onOff],
            [2, 'state_l2', tuya.valueConverter.onOff],
            [7, 'countdown_l1', tuya.valueConverter.countdown],
            [8, 'countdown_l2', tuya.valueConverter.countdown],
            [16, 'backlight_switch', tuya.valueConverter.onOff],
            [20, 'energy', tuya.valueConverter.divideBy1000],
            [21, 'current', tuya.valueConverter.divideBy1000],
            [22, 'power', tuya.valueConverter.divideBy10],
            [23, 'voltage', tuya.valueConverter.divideBy10],
            [29, 'power_on_behavior_l1', tuya.valueConverter.powerOnBehaviorEnum],
            [30, 'power_on_behavior_l2', tuya.valueConverter.powerOnBehaviorEnum],
            [101, 'child_lock', tuya.valueConverter.lockUnlock],
            [102, 'backlight', tuya.valueConverter.raw],
            [104, 'sensitivity_set', tuya.valueConverterBasic.lookup({
                short: tuya.enum(0),
                medium_short: tuya.enum(1),
                medium: tuya.enum(2),
                medium_long: tuya.enum(3),
                long: tuya.enum(4),
            })],
            [105, 'switch1_name', {from: screenNameConverter.from, to: null}],
            [106, 'switch2_name', {from: screenNameConverter.from, to: null}],
            [111, 'mode', tuya.valueConverterBasic.lookup({
                none: tuya.enum(0),
                '10': tuya.enum(1),
                '20': tuya.enum(2),
                '30': tuya.enum(3),
                '45': tuya.enum(4),
                '60': tuya.enum(5),
            })],
        ],
    },
    exposes: [
        e.switch().withEndpoint('l1').setAccess('state', ea.STATE_SET),
        e.switch().withEndpoint('l2').setAccess('state', ea.STATE_SET),
        exposes.numeric('countdown_l1', ea.STATE_SET)
            .withUnit('s')
            .withValueMin(0)
            .withValueMax(86400)
            .withDescription('Countdown for gang 1'),
        exposes.numeric('countdown_l2', ea.STATE_SET)
            .withUnit('s')
            .withValueMin(0)
            .withValueMax(86400)
            .withDescription('Countdown for gang 2'),
        exposes.enum('power_on_behavior_l1', ea.STATE_SET, ['off', 'on', 'previous'])
            .withDescription('Power-on behavior for gang 1'),
        exposes.enum('power_on_behavior_l2', ea.STATE_SET, ['off', 'on', 'previous'])
            .withDescription('Power-on behavior for gang 2'),
        exposes.binary('backlight_switch', ea.STATE_SET, 'ON', 'OFF')
            .withDescription('Backlight switch'),
        exposes.binary('child_lock', ea.STATE_SET, 'LOCK', 'UNLOCK')
            .withDescription('Child lock'),
        exposes.numeric('backlight', ea.STATE_SET)
            .withUnit('%')
            .withValueMin(0)
            .withValueMax(100)
            .withDescription('Backlight brightness'),
        exposes.enum('sensitivity_set', ea.STATE_SET, ['short', 'medium_short', 'medium', 'medium_long', 'long'])
            .withDescription('Touch sensitivity'),
        exposes.enum('mode', ea.STATE_SET, ['none', '10', '20', '30', '45', '60'])
            .withDescription('Screen off time'),
        exposes.text('switch1_name', ea.STATE_SET)
            .withDescription('Display name for gang 1'),
        exposes.text('switch2_name', ea.STATE_SET)
            .withDescription('Display name for gang 2'),
        e.energy(),
        e.current(),
        e.power(),
        e.voltage(),
    ],
};

module.exports = definition;
