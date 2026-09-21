const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '../zemismart-zps-z1-z2m.js'), 'utf8');
const flush = async () => { for (let i = 0; i < 40; i++) await Promise.resolve(); };

function harness() {
    let now = 1000, sequence = 0;
    const timers = new Map(), commands = [], states = [], warnings = [];
    const raw = new Map([
        [1, [4, Buffer.from([1])]], [2, [2, Buffer.from([0, 0, 0, 0])]],
        [101, [2, Buffer.from([0, 0, 0, 42])]],
        [112, [4, Buffer.from([1])]], [117, [0, Buffer.from([2, 0, 1, 2, 1, 0, 2, 1, 1, 2])]],
        [119, [2, Buffer.from([0, 0, 0, 15])]], [123, [1, Buffer.from([1])]],
        [124, [0, Buffer.from(Array.from({length: 20}, (_, i) => i * 7 + 3))]],
    ]);
    const stored = new Map();
    const store = {getValue: (entity, key, fallback) => stored.get(`${entity}/${key}`) ?? fallback,
        putValue: (entity, key, value) => stored.set(`${entity}/${key}`, value)};
    const sandbox = {module: {exports: {}}, Buffer,
        require: id => id.endsWith('/logger') ? {logger: {warning(message) {warnings.push(message);}, debug() {}}} : id.endsWith('/store') ? store : require(id),
        Date: class extends Date { static now() { return now; } },
        setTimeout: (fn, delay) => {
            const id = {id: ++sequence, unref() {}};
            timers.set(id, {fn, at: now + delay, delay}); return id;
        },
        clearTimeout: id => timers.delete(id),
    };
    vm.runInNewContext(source, sandbox, {filename: 'zemismart-zps-z1-z2m.js'});
    let definition = sandbox.module.exports;
    let hook;
    const device = {ieeeAddr: '0x0000000000000001', getEndpoint: () => endpoint};
    const meta = {device, state: {}};
    const report = (dp, datatype, data) => {
        const output = definition.fromZigbee[0].convert(definition, {data: {dpValues: [{dp, datatype, data}]}}, () => {}, {}, meta);
        const plain = JSON.parse(JSON.stringify(output));
        Object.assign(meta.state, plain); states.push(plain); return plain;
    };
    const endpoint = {command: async (cluster, command, payload) => {
        commands.push({time: now, cluster, command, payload: JSON.parse(JSON.stringify(payload))});
        if (hook && await hook(command, payload) === false) return;
        if (command === 'dataQuery') {
            for (const [dp, [datatype, data]] of raw) report(dp, datatype, data);
        } else if (command === 'dataRequest') {
            for (const entry of payload.dpValues) {
                if (entry.dp === 104) continue; // Write-only: ACK without fabricating a state report.
                raw.set(entry.dp, [entry.datatype, Buffer.from(entry.data)]);
                report(entry.dp, entry.datatype, Buffer.from(entry.data));
            }
        }
    }};
    async function driveQueryDelays(promise) {
        let done = false;
        promise.then(() => {done = true;}, () => {done = true;});
        while (!done) {
            await flush();
            const next = [...timers].filter(([, timer]) => timer.delay <= 3000).sort((a, b) => a[1].at - b[1].at)[0];
            if (next) await api.tick(Math.max(0, next[1].at - now));
            else if (!done) await new Promise(setImmediate);
        }
        return promise;
    }
    const api = {get definition() { return definition; }, device, meta, commands, states, raw, timers, report, warnings,
        setHook: value => { hook = value; },
        set: (key, value) => driveQueryDelays(definition.toZigbee[0].convertSet(endpoint, key, value, meta)),
        setWithoutDrivingClock: (key, value) => definition.toZigbee[0].convertSet(endpoint, key, value, meta),
        get: key => definition.toZigbee[0].convertGet(endpoint, key, meta),
        writes: () => commands.filter(x => x.command === 'dataRequest').flatMap(x => x.payload.dpValues),
        stop: () => definition.onEvent({type: 'stop', data: {ieeeAddr: device.ieeeAddr}}),
        reload: () => {
            const next = {...sandbox, module: {exports: {}}};
            vm.runInNewContext(source, next); definition = next.module.exports; return definition;
        },
        tick: async ms => {
            const end = now + ms;
            await flush();
            for (;;) {
                const next = [...timers].sort((a, b) => a[1].at - b[1].at)[0];
                if (!next || next[1].at > end) break;
                now = next[1].at; timers.delete(next[0]); next[1].fn(); await flush();
            }
            now = end; await flush();
        },
    };
    return api;
}

test('valid occupancy and illuminance reports survive; malformed data never invents absence', () => {
    const h = harness();
    assert.deepEqual(h.report(1, 4, Buffer.from([1])), {presence_state: 'presence', occupancy: true});
    assert.deepEqual(h.report(1, 4, Buffer.from([0])), {presence_state: 'absence', occupancy: false});
    assert.deepEqual(h.report(101, 2, Buffer.from([0, 0, 0, 49])), {illuminance: 49});
    for (const payload of [undefined, null, '1', {}, [], [1, 0], [3], [256], [-1], [1.5], Array(1)]) {
        assert.deepEqual(h.report(1, 4, payload), {});
    }
    assert.deepEqual(h.report(1, 1, Buffer.from([0])), {});
    for (const length of [0, 1, 3, 5]) assert.deepEqual(h.report(101, 2, Buffer.alloc(length)), {});
    assert.deepEqual(h.report(104, 1, Buffer.from([2])), {});
    assert.deepEqual(h.report(117, 0, Buffer.alloc(10, 3)), {});
    assert.deepEqual(h.report(124, 0, Buffer.alloc(19)), {});
});

test('energy and thresholds use raw bytes with no lossy percent round trip', () => {
    const h = harness();
    const data = Buffer.from(Array.from({length: 20}, (_, i) => i === 0 ? 255 : i));
    assert.equal(h.report(102, 0, data).zone_1_motion_energy, 255);
    assert.equal(h.report(124, 0, data).zone_2_motion_threshold, 1);
    assert.equal(h.report(124, 0, data).zone_10_presence_threshold, 19);
});

test('sensor_close preserves the last occupancy rather than inventing an absence reading', () => {
    const h = harness(); h.report(1, 4, Buffer.from([1]));
    assert.deepEqual(h.report(1, 4, Buffer.from([2])), {presence_state: 'sensor_close'});
    assert.equal(h.meta.state.occupancy, true);
    assert.deepEqual(h.report(106, 4, Buffer.from([0])), {});
    assert.deepEqual(h.report(107, 1, Buffer.from([0])), {});
});

test('write-only energy commands accept legacy booleans but never query or publish a state', async () => {
    const h = harness();
    await assert.rejects(h.get('energy_streaming'), /write-only/);
    assert.equal(h.commands.length, 0);
    await h.set('energy_streaming', 'ON'); await h.tick(5000);
    await h.set('energy_streaming', false);
    await h.set('energy_streaming', true); await h.set('energy_streaming', 'OFF');
    assert.equal(h.commands.filter(x => x.command === 'dataQuery').length, 0);
    assert.equal(h.meta.state.energy_streaming, undefined);
    assert.deepEqual(h.report(104, 1, Buffer.from([1])), {});
    assert.deepEqual(h.report(104, 1, Buffer.from([0])), {});
    assert.equal(h.meta.state.energy_streaming, undefined);
    await h.stop();
});

test('documented distance values use exact four-byte payloads and confirmed readback', async () => {
    const h = harness();
    for (const value of [0, 50, 1500]) {
        assert.equal(await h.set('detection_range', value), undefined);
        const expected = Buffer.alloc(4); expected.writeUInt32BE(value);
        assert.deepEqual(h.writes().at(-1), {dp: 2, datatype: 2, data: [...expected]});
        assert.equal(h.meta.state.detection_range, value);
    }
});

test('an unconfirmed distance write rejects without inventing the requested value', async () => {
    const h = harness(); h.setHook(command => command === 'dataRequest' ? false : undefined);
    const pending = assert.rejects(h.set('detection_range', 50), /No confirmed DP2/);
    await h.tick(10000); await pending;
    assert.equal(h.meta.state.detection_range, 0);
});

test('stop waits for an initial ON before the final safety OFF', async () => {
    const h = harness(); let release;
    h.setHook((command, payload) => command === 'dataRequest' && payload.dpValues[0].data[0] === 1 && !release ?
        new Promise(resolve => {release = resolve;}) : undefined);
    const on = h.set('energy_streaming', true); await flush();
    const stop = h.stop(); await flush();
    assert.deepEqual(h.writes().map(x => x.data), [[1]]);
    release(false); await on; await stop;
    assert.deepEqual(h.writes().map(x => x.data), [[1], [0]]);
    await h.tick(600000); assert.equal(h.writes().length, 2);
});

test('reload cleanup cannot turn off a newer session, including consecutive replacements', async () => {
    const h = harness(); let release;
    h.setHook((command, payload) => command === 'dataRequest' && payload.dpValues[0].data[0] === 1 && !release ?
        new Promise(resolve => {release = resolve;}) : undefined);
    const on = h.set('energy_streaming', true); await flush();
    h.reload(); h.reload();
    const newOn = h.set('energy_streaming', true); await flush();
    assert.deepEqual(h.writes().map(x => x.data), [[1]]);
    release(false); await on; await newOn;
    assert.deepEqual(h.writes().map(x => x.data), [[1], [0], [1]]);
    assert.deepEqual(h.report(104, 1, Buffer.from([0])), {});
    await h.tick(5000);
    assert.deepEqual(h.writes().map(x => x.data), [[1], [0], [1], [1]]);
    await h.stop();
    assert.deepEqual(h.writes().at(-1).data, [0]);
});

test('inactive shutdown is silent; active shutdown failure clears timers and reports the failure', async () => {
    const idle = harness(); await idle.get('led_indicator');
    const count = idle.commands.length; await idle.stop(); idle.reload(); await flush();
    assert.equal(idle.commands.length, count);
    const active = harness(); await active.set('energy_streaming', true);
    active.setHook(() => {throw Error('offline');});
    await active.stop();
    assert.equal(active.timers.size, 0);
    assert(active.warnings.some(x => x.includes('shutdown OFF failed')));
});

test('invalid SET input and invalid protocol distance values send nothing', async () => {
    const h = harness();
    for (const value of [null, undefined, '', '  ', '15', true, false, [], {}, NaN, Infinity, 1.5, -1, 61]) {
        await assert.rejects(h.set('presence_clear_cooldown', value));
    }
    for (const key of ['led_indicator', 'energy_streaming', 'zone_1_active']) {
        for (const value of [null, undefined, 0, 1, 'true', 'false', {}, []]) await assert.rejects(h.set(key, value));
    }
    for (const key of ['sensitivity_preset', 'auto_calibration']) {
        for (const value of [null, true, '__proto__', 'constructor', 'toString']) await assert.rejects(h.set(key, value));
    }
    for (const value of [null, false, '50', NaN, Infinity, -50, 1, 49, 50.5, 1501, 1550]) await assert.rejects(h.set('detection_range', value), /integer/);
    for (const value of [null, 1.5, -1, 256, '20']) await assert.rejects(h.set('zone_1_motion_threshold', value));
    assert.equal(h.commands.length, 0);
});

test('GET sends dataQuery with rate limiting and recovers after a failed query', async () => {
    const h = harness();
    await h.get('detection_range'); await h.get('led_indicator');
    assert.equal(h.commands.length, 1);
    await h.tick(3000); await h.get('sensitivity_preset');
    assert.equal(h.commands.length, 2);
    await h.tick(3000); h.setHook(() => { throw Error('offline'); });
    await assert.rejects(h.get('detection_range'), /offline/);
    h.setHook(undefined); await h.get('detection_range');
    assert.equal(h.commands.length, 4);
});

test('normal SET does not report an optimistic state without device confirmation', async () => {
    const h = harness(); h.setHook(() => false);
    assert.equal(await h.set('led_indicator', false), undefined);
    assert.equal(h.states.length, 0);
    assert.deepEqual(h.writes(), [{dp: 123, datatype: 1, data: [0]}]);
});

test('SET readback is not suppressed by a recent GET', async () => {
    const h = harness(); await h.get('led_indicator');
    h.setHook((command, payload) => {
        if (command !== 'dataRequest') return;
        const entry = payload.dpValues[0];
        h.raw.set(entry.dp, [entry.datatype, Buffer.from(entry.data)]);
        return false; // Device ACKs but reports the new state only on dataQuery.
    });
    await h.set('led_indicator', false);
    assert.equal(h.commands.filter(x => x.command === 'dataQuery').length, 2);
    assert.equal(h.meta.state.led_indicator, false);
    const times = h.commands.filter(x => x.command === 'dataQuery').map(x => x.time);
    assert(times[1] - times[0] >= 3000);
});

test('hot replacement explicitly stops an active energy session and leaves no timers', async () => {
    const h = harness(); await h.set('energy_streaming', true);
    h.reload(); await h.tick(600000);
    assert.deepEqual(h.writes().map(x => x.data), [[1], [0]]);
    assert.equal(h.timers.size, 0);
});

test('stop cancels queued query spacing and prevents a query after stop', async () => {
    const h = harness(); await h.get('led_indicator');
    const pending = assert.rejects(h.setWithoutDrivingClock('led_indicator', false), /Device stopped/);
    await flush();
    assert([...h.timers.values()].some(x => x.delay === 3000));
    await h.stop(); await pending;
    const count = h.commands.length; await h.tick(30000);
    assert.equal(h.commands.length, count);
    assert.equal(h.timers.size, 0);
});

test('a report received before the queued query is sent cannot become its write snapshot', async () => {
    const h = harness(); await h.get('led_indicator');
    const old = Buffer.from(h.raw.get(117)[1]);
    const pending = h.setWithoutDrivingClock('zone_3_active', false);
    await flush();
    h.report(117, 0, old); // Unsolicited/older response during query spacing.
    h.raw.get(117)[1][1] = 1; // The actual query must observe this newer zone setting.
    await h.tick(3000); await h.tick(3000); await pending;
    const written = h.writes().find(x => x.dp === 117);
    assert.equal(written.data[1], 1);
    assert.equal(written.data[2], 0);
});

test('unchanged array settings query but do not rewrite data or sensitivity', async () => {
    const h = harness();
    await h.set('zone_1_active', true);
    await h.set('zone_1_motion_threshold', h.raw.get(124)[1][0]);
    assert.equal(h.writes().length, 0);
});

test('editing one zone queries a full snapshot and preserves other raw modes including 2', async () => {
    const h = harness();
    const expected = [...h.raw.get(117)[1]]; expected[2] = 0;
    assert.equal(await h.set('zone_3_active', false), undefined);
    assert.equal(h.commands[0].command, 'dataQuery');
    assert.deepEqual(h.writes(), [{dp: 117, datatype: 0, data: expected}]);
    await h.set('zone_1_active', true);
    assert.equal(h.writes().at(-1).data[0], 2);
});

test('concurrent threshold edits preserve all untouched raw bytes and both edits', async () => {
    const h = harness();
    const expected = [...h.raw.get(124)[1]];
    await Promise.all([h.set('zone_2_motion_threshold', 254), h.set('zone_7_presence_threshold', 1)]);
    expected[1] = 254; expected[16] = 1;
    assert.deepEqual([...h.raw.get(124)[1]], expected);
    assert.equal(h.writes().filter(x => x.dp === 124).length, 2);
    assert.deepEqual(h.writes().filter(x => x.dp === 112), []);
    assert.equal(h.raw.get(112)[1][0], 1); // Preserve the existing preset.
});

test('missing or malformed full report times out without any settings write', async () => {
    for (const [key, dp] of [['zone_1_active', 117], ['zone_1_motion_threshold', 124]]) {
        const h = harness(); h.raw.set(dp, [0, Buffer.alloc(2)]);
        const pending = assert.rejects(h.set(key, key.endsWith('active') ? false : 20), /No confirmed DP/);
        await h.tick(10000); await pending;
        assert.equal(h.writes().length, 0);
    }
});

test('an unconfirmed threshold write fails and does not switch sensitivity to custom', async () => {
    const h = harness(); h.setHook(command => command === 'dataRequest' ? false : undefined);
    const pending = assert.rejects(h.set('zone_1_motion_threshold', 200), /No confirmed DP124/);
    await h.tick(10000); await pending;
    assert.deepEqual(h.writes().map(x => x.dp), [124]);
});

test('modern stop clears timers; repeated ON never creates duplicate heartbeat loops', async () => {
    const h = harness();
    await h.set('energy_streaming', true); await h.set('energy_streaming', true);
    await h.tick(5000);
    assert.equal(h.writes().length, 3);
    await h.stop(); const count = h.commands.length;
    await h.tick(600000);
    assert.equal(h.commands.length, count);
    assert.equal(h.timers.size, 0);
});

test('explicit OFF clears local timers even if sending OFF fails', async () => {
    const h = harness(); await h.set('energy_streaming', true);
    h.setHook(() => { throw Error('offline'); });
    await assert.rejects(h.set('energy_streaming', false), /offline/);
    const count = h.commands.length; await h.tick(600000);
    assert.equal(h.commands.length, count);
    assert.equal(h.timers.size, 0);
});

test('OFF requested while initial ON awaits ACK prevents a later heartbeat restart', async () => {
    const h = harness();
    let release;
    h.setHook((command, payload) => command === 'dataRequest' && payload.dpValues[0].data[0] === 1 && !release ?
        new Promise(resolve => { release = resolve; }) : undefined);
    const on = h.set('energy_streaming', true); await flush();
    const off = h.set('energy_streaming', false); await flush();
    release(false); await Promise.all([on, off]);
    await h.tick(600000);
    assert.deepEqual(h.writes().map(x => x.data), [[1], [0]]);
    assert.equal(h.timers.size, 0);
});

test('stop after snapshot arrival but before query ACK prevents the pending settings write', async () => {
    const h = harness();
    let release;
    h.setHook(command => {
        if (command !== 'dataQuery') return;
        h.report(117, 0, h.raw.get(117)[1]);
        return new Promise(resolve => { release = resolve; });
    });
    const pending = assert.rejects(h.set('zone_1_active', false), /Device stopped/);
    await flush(); const stopping = h.stop(); release(false); await pending; await stopping;
    assert.equal(h.writes().length, 0);
});

test('a newer ON queued behind OFF still starts exactly one heartbeat loop', async () => {
    const h = harness();
    await Promise.all([h.set('energy_streaming', false), h.set('energy_streaming', true)]);
    await h.tick(5000);
    assert.deepEqual(h.writes().map(x => x.data), [[0], [1], [1]]);
    await h.stop();
});

test('five minute deadline sends OFF and leaves no heartbeat loop', async () => {
    const h = harness(); await h.set('energy_streaming', true);
    await h.tick(300000);
    assert.deepEqual(h.writes().at(-1), {dp: 104, datatype: 1, data: [0]});
    assert.equal(h.meta.state.energy_streaming, undefined);
    assert.equal(h.commands.filter(x => x.command === 'dataQuery').length, 0);
    const count = h.commands.length; await h.tick(600000);
    assert.equal(h.commands.length, count);
    assert.equal(h.timers.size, 0);
});

test('slow heartbeat does not overlap and cannot re-enable streaming after deadline OFF', async () => {
    const h = harness(); await h.set('energy_streaming', true);
    let release;
    h.setHook(command => command === 'dataRequest' && !release ? new Promise(resolve => { release = resolve; }) : undefined);
    await h.tick(300000);
    assert.equal(h.writes().length, 2);
    release(false); await flush();
    assert.deepEqual(h.writes().map(x => x.data), [[1], [1], [0]]);
    await h.tick(300000);
    assert.equal(h.writes().length, 3);
});

test('a stale DP104 OFF echo cannot cancel the current local session or publish stream state', async () => {
    const h = harness(); await h.set('energy_streaming', true);
    assert.deepEqual(h.report(104, 1, Buffer.from([0])), {});
    await h.tick(5000);
    assert.deepEqual(h.writes().map(x => x.data), [[1], [1]]);
    await h.set('energy_streaming', false);
    h.raw.delete(117);
    const pending = assert.rejects(h.set('zone_1_active', false), /Device stopped/);
    await flush(); await h.stop(); await pending;
    assert.equal(h.timers.size, 0);
});

test('protocol metadata has confirmed distance settings and a write-only energy command', () => {
    const h = harness(), fields = h.definition.exposes(h.device, {show_advanced: true});
    const range = fields.find(x => x.name === 'detection_range');
    assert.equal(range.access, 7); assert.equal(range.unit, 'cm');
    assert.equal(range.value_min, 0); assert.equal(range.value_max, 1500); assert.equal(range.value_step, 50);
    const command = fields.find(x => x.name === 'energy_streaming');
    assert.equal(command.type, 'enum'); assert.equal(command.access, 2);
    assert.deepEqual(Array.from(command.values), ['ON', 'OFF']);
    assert(!fields.find(x => x.name === 'zone_1_active').description.includes('cm'));
    assert.equal(fields.find(x => x.name === 'zone_1_motion_threshold').label, 'Zone 1 threshold group 1');
    assert.equal(fields.find(x => x.name === 'energy_streaming').category, 'config');
    const energy = fields.find(x => x.name === 'zone_1_motion_energy');
    assert.equal(energy.category, 'diagnostic');
    assert.equal(energy.value_max, 255);
    assert.equal(energy.homeassistant.enabledByDefault, false);
    assert.equal(fields.find(x => x.name === 'zone_1_motion_threshold').value_max, 255);
});

test('default UI is compact and advanced visibility never queries or writes the device', () => {
    const h = harness();
    const names = options => Array.from(h.definition.exposes(h.device, options), x => x.property);
    const basic = ['occupancy', 'illuminance', 'sensitivity_preset', 'presence_clear_cooldown', 'led_indicator'];
    assert.deepEqual(names(undefined), basic);
    assert.deepEqual(names({show_advanced: false}), basic);
    assert.deepEqual(names({show_advanced: 'false'}), basic);
    const advanced = names({show_advanced: true});
    assert.equal(advanced.length, 60);
    assert.equal(new Set(advanced).size, advanced.length);
    for (const field of [...basic, 'energy_streaming', 'auto_calibration', 'detection_range', 'zone_10_presence_threshold']) {
        assert(advanced.includes(field));
    }
    assert.deepEqual(names({show_advanced: false}), basic);
    assert.equal(h.commands.length, 0);
    assert.equal(h.timers.size, 0);
    assert.equal(h.definition.options[0].property, 'show_advanced');
});

test('advanced MQTT commands and raw reports remain available while advanced fields are hidden', async () => {
    const h = harness();
    assert(!h.definition.exposes(h.device, {}).some(x => x.property === 'zone_3_motion_threshold'));
    await h.set('zone_3_motion_threshold', 200);
    assert.equal(h.raw.get(124)[1][2], 200);
    assert.equal(h.meta.state.zone_3_motion_threshold, 200);
});
