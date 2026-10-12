# Zemismart Zigbee2MQTT External Converters

English | [简体中文](README.zh-CN.md)

Zigbee2MQTT external converter files for Zemismart products. Match the complete device fingerprint in the table below before choosing a file; support and validation limits vary by model.

**Zemismart website: [www.zemismart.com](https://www.zemismart.com/)**

## About Zemismart

Zemismart offers smart-home products including motorized curtains and blinds, switches, lighting, sensors, and gateways. Visit the [official website](https://www.zemismart.com/) for product information. Protocol and platform compatibility depend on the specific model; the files in this repository cover only the listed fingerprints and features.

## Device configurations

| Configuration file | Zigbee2MQTT model match | Fingerprint model / manufacturerName | Description |
| --- | --- | --- | --- |
| `214c.js` | `TS0601` | `_TZE284_vuwtqx0t`, `_TZE200_vuwtqx0t` | Ultrasonic water meter valve: total/daily/monthly water consumption, valve control, alarms, and related DPs |
| `DN15-223F.js` | `TS0601` | `_TZE200_jt50ea5d` | DN15-223F ultrasonic heating/cooling meter: DP7 heat-metering switch, DP8 accumulated thermal energy, water volume, temperature, voltage, and periodic reporting |
| `KES-606-composite.js` | `TS0726` | `_TZ3000_ovbvmhiq`, `_TZ3000_icoxotza`, `_TZ3000_cziew6eu`, `_TZ3000_hurauima` | KES 606 composite 1/2/3/4-gang scene switches with ordinary switch/scene modes; app on/off commands have no effect in scene mode to prevent unintended operation |
| `ZMD-208.js` | `TS0601` | 1-gang: `_TZE28C1000000_huc4fueh`<br>2-gang: `_TZE28C1000000_gheewd2t`<br>3-gang: `_TZE28C1000000_8jwv5lbl`, `_TZE284_8jwv5lbl` | ZMD-208 display dimmer: 1/2/3-gang switching and brightness, minimum/maximum brightness, load type, countdown, display names, backlight, color, child lock, and screen-off timeout; includes duplicate-DP suppression, MCU time-sync throttling, and `0xE000` private-status responses; 1/2-gang DP mappings await physical-device validation |
| `ZN2S-RS1E.js` | `TS0601` | `_TZE204_e1hutaaj`, `_TZE284_e1hutaaj`, `_TZE284_2jnoy8dj` | ZN2S-RS1E touch fan controller: switching, fan speed, countdown, power-on behavior, indicator, backlight, child lock, minimum fan speed, and indicator colors for the fan's on/off states |
| `ZN2S-L01E-SMB.js` | `TS0601` | `_TZE200_ephrk8to`, `_TZE200_ahyyfhqk`, `_TZE200_zuphzsmo`, `_TZE200_6si1pnia` | Zemismart 1/2/3/4-gang scene switches with per-gang switch/scene mode selection |
| `zemismart_zm16b.js` | `TS0601` | `_TZE284_3mzb0sdz` | ZM16B battery-powered tubular curtain motor: open/close/stop, position, motor direction, upper/lower limit setting, and battery; queries DPs during configuration, when the device comes online, and every 12 hours to prevent prolonged missing battery readings |
| `zemismart_zm86_2z.js` | `TS0601` | `_TZE200_cf1sl3tj` | ZM86-2Z I/U-type curtain-rod motor; the external converter's exact fingerprint takes precedence; supports open/close/stop, DP2 position, motor direction, limits, inching, battery, and fault status; DP3 has unconfirmed semantics and remains a read-only diagnostic so it cannot overwrite position or running state |
| `zemismart-zpm1-z2m.js` | `TS0601` | `_TZE284_6hrnp30w` | ZMP1 battery-powered curtain motor: open/close/stop, position, direction, limits, and battery queries every 12 hours using Tuya dataQuery |
| `zemismart-zps-z1-z2m.js` | `TS0601` | `_TZE284_ft7qqpx3` | ZPS-Z1 24 GHz mmWave presence sensor; exact fingerprint, compact default interface, and optional advanced settings; distance parameters follow the manufacturer's protocol, and energy commands include explicit shutdown protection |
| [`zemismart_ts1201_ir.mjs`](zemismart_ts1201_ir.mjs) | `TS1201` | `_TZ3290_qazgdsae` | IR remote version 1.4.0 single-file pilot; the codebook and license are embedded, so only this `.mjs` file needs installing; supports brand matching, air-conditioner control, named learning, and HA MQTT controls; see below |
| `zemismart_zmr4.js` | `TS0044` | `_TZ3000_xwuveizv` | ZMR4 four-button wireless remote: single/double/long-press actions for each button, battery/voltage, and 12 local action-simulation buttons; the exact fingerprint takes precedence over the upstream definition |
| `zm25z.js` | `TS0301` | `_TZE200_cirjrpxe` | ZM25Z mains-powered curtain motor: open/close/stop, position, direction, and limit setting |
| `zms1.js` | `TS0601` | `_TZE284_zuq5xxib`, `_TZE200_fu14oapz` | ZMS1-TYZ curtain motor: open/close/stop, integer position percentages, and running indication; the 284 variant additionally exposes direction and raw speed settings, while the fu14oapz variant provides raw DP7/DP12 diagnostics; see the tested scope and limitations below |
| `zmd206_screen_dimmer.js` | `TS0601` | 1-gang: `_TZE28C1000000_5aico93l`, `_TZE284_5aico93l`<br>2-gang: `_TZE284_pyh4zt7w`<br>3-gang: `_TZE28C1000000_k9e7ihec`, `_TZE284_k9e7ihec` | ZMD-206 display dimmer: per-gang switching/brightness, brightness limits, load type, countdown, display names, power-on behavior, backlight, indicator, child lock, and fade speed |
| `zm208.js` | `TS0601` | 3-gang: `_TZE284_xvywzhmi`, `_TZE28C1000000_xvywzhmi` | ZMS-208US-3 non-dimming display switch: per-gang switching, countdowns, display names, and child lock; includes duplicate-DP suppression, MCU time-sync throttling, and `0xE000` private-status responses |
| `zms206.js` | `TS0601` | 1-gang: `_TZE204_lnyz4a6v`, `_TZE204_sa2ueffe`, `_TZE204_zuepxzck`, `_TZE28C1000000_lnyz4a6v`, `_TZE284_lnyz4a6v`, `_TZE284_1tnysxwl`, `_TZE284_sa2ueffe`, `_TZE284_rzdkn5rx`<br>2-gang: `_TZE204_3ctwoaip`, `_TZE204_dmckrsxg`, `_TZE28C1000000_dmckrsxg`, `_TZE284_3ctwoaip`, `_TZE284_dmckrsxg`, `_TZE284_a2teqi5u`, `_TZE28C1000000_a2teqi5u`<br>3-gang: `_TZE204_e4pf6l87`, `_TZE204_k7v0eqke`, `_TZE204_iyki9kjp`, `_TZE284_k7v0eqke`, `_TZE284_e4pf6l87`, `_TZE28C1000000_e4pf6l87`<br>4-gang: `_TZE204_y4jqpry8`, `_TZE284_y4jqpry8`, `_TZE28C1000000_y4jqpry8`, `by _TZE28C1000000_y4jqpry8`, `_TZE204_wwaeqnrf`, `_TZE284_wwaeqnrf`, `_TZE204_xibaabmu`, `_TZE284_xibaabmu`, `_TZE28C1000000_xibaabmu`, `_TZE204_08qc13ct` | ZMS206 display switch: per-gang switching, display names, countdowns, relay power-on state, backlight, child lock, indicator color, and recurring schedules; includes MCU time-sync throttling, duplicate-state suppression, `0xE000`/`0xFC03` private-message compatibility, and retained diagnostics for four-gang DP112–DP114 |
| `zmz609.js` | `ZMZ609-2`, `ZMZ609-3` | 2-gang: `_TZE284_o409r73p`, `_TZE28C1000000_o409r73p`<br>3-gang: `_TZE284_oy1nuaa5` | ZMZ609 US-style display switch: two/three-gang switching, metering, display, and configuration options; automatically synchronizes the date, current weather, and three-day forecast without Home Assistant automation, using automatic location or configured latitude/longitude |

## TS1201 IR remote

Matches only `TS1201 / _TZ3290_qazgdsae`. **Version 1.4.0 requires downloading and installing just one configuration file: [zemismart_ts1201_ir.mjs](zemismart_ts1201_ir.mjs).** The complete codebook and MIT license notice are embedded; no adjacent JSON file or runtime codebook download is required.

Save and load the file through Z2M's external converter interface. To upgrade, overwrite the file with the same name. Existing learned data and matching results are retained, and re-pairing is unnecessary. The repository's `data/` directory and `scripts/embed-ts1201-z2m-codebook.py` are only for maintenance and rebuilding; they do not need to be copied into the customer installation directory. The older JSON/license sources have moved to `data/` without content changes. When rolling back to 1.3.0, restore all dependencies from the older release.

The single-file package retains sequential brand/code-set testing, an air-conditioner panel created after user confirmation, named learning, and on-demand controls. The air-conditioner panel displays command-based estimates; a completed transmission still requires observing the appliance's physical response.

See the [single-file installation guide (Chinese)](docs/ts1201_z2m_installation.md), [user guide (Chinese)](docs/ts1201_z2m_customer_guide.md), and [validation record (Chinese)](docs/ts1201_validation.md) for installation, everyday use, and the limits of testing and physical-device evidence. This configuration is a company pilot intended for engineering deployment. It does not represent native upstream support or completed physical acceptance of every feature.

## ZPS-Z1 matching, settings, and upgrades

`zemismart-zps-z1-z2m.js` matches only `TS0601 / _TZE284_ft7qqpx3`. The protocol source is the manufacturer's *MCU SDK Quick Start Guide* for product ID `ft7qqpx3` (2025-12-15, file `lowpower_protocol_ft7qqpx3_20251215.pdf`). MCU serial commands and Zigbee EF00 framing are handled separately; their command numbers are not used interchangeably.

**Customers only need this one converter file.** The default feature page shows presence, illuminance, sensitivity, absence delay, the indicator, and link quality added automatically by Z2M. Zones/thresholds, energy debugging, self-learning, and radar distance settings are hidden by default. Enable `show_advanced` under the device's **Settings (specific) → Advanced controls** to restore the advanced fields. Disabling it returns to the compact page without restarting or re-pairing. An unsaved option is treated as disabled.

**Home Assistant impact:** exposes also drive HA discovery. Hiding advanced controls withdraws the corresponding advanced entities; enabling them triggers discovery again. Automations using advanced HA entities should keep `show_advanced: true`. All existing flat MQTT reporting/setting interfaces remain available, and the display toggle itself does not write device parameters.

### Protocol corrections

- **Radar distance, DP2:** the protocol defines a read/write integer of `0–1500 cm` in steps of `50`. Writes wait for an actual device report for confirmation. A company sample was tested through `0→50→0` and restored to its original value. This does not prove a 15-meter detection range or establish the special meaning of `0`.
- **Energy command, DP104:** `energy_streaming` is a write-only `ON/OFF` command that still accepts the original boolean and `ON/OFF` MQTT inputs. It is not a queryable switch: GET is explicitly rejected, and passive echoes are not used to fabricate state.
- Manufacturer documentation specifies a heartbeat every 5 seconds and reporting shutdown after 10 seconds without one. **Within a 15-second observation window, this sample still reported 14.73 seconds after the last heartbeat**, stopping only after explicit OFF. The converter therefore does not rely on the firmware timeout: a local session lasts at most 5 minutes, and OFF, shutdown, or hot replacement clears heartbeats and explicitly requests shutdown when needed. Final OFF is sent only after any in-flight ON completes; a new session waits for the previous cleanup. If confirmation of the initial ON fails, the same queue also attempts OFF before returning the original error, preventing late cleanup from stopping a subsequent session. A failed OFF is logged as a warning and does not confirm that reporting stopped.
- **Zones, DP117:** 10 bytes, with `0=masked`, `1=occupied`, and `2=unoccupied`. Zone enablement is derived from nonzero values. Per-zone centimeter boundaries unsupported by the protocol are no longer labeled. Changes query a complete snapshot and preserve the other zones' raw bytes.
- **Energy, DP102:** the first 10 bytes are motion energy and the following 10 bytes are presence energy, displayed as raw `0–255` values. Writing energy values with unclear semantics is not exposed.
- **Thresholds, DP124:** two groups of 10 bytes; the protocol does not explain the physical role of each group. The interface labels them `Threshold group 1/2` and retains the legacy `motion_threshold/presence_threshold` keys for compatibility. It does not blindly swap their order or automatically rewrite sensitivity presets.
- `sensor_close` retains only its protocol enumeration meaning; it is not interpreted as confirmed physical obstruction or absence and does not overwrite the last occupancy value. The purpose/period of DP105 and the functions of DP106/107 remain unconfirmed, so they are not enabled or mapped speculatively. Self-learning retains explicit numeric enumerations, with unsupported warm-up and learning-duration descriptions removed.

### Safety behavior and upgrading

Setting inputs, report types, lengths, and enumerations are strictly validated. Malformed packets do not become “unoccupied,” and invalid inputs do not become 0. Zone/threshold writes first read a complete raw snapshot, operate serially per device, change only the target bytes, and confirm the report. Missing or timed-out snapshots cause writes to be rejected; writing the existing value only queries it. Queries for GET and SET operations requiring readback are spaced at least 3 seconds apart to avoid firmware dropping dense requests. DP104 sends no meaningless state query.

Zone energy and thresholds previously used normalized `0–100` values; they now use raw `0–255` values. Convert old threshold constants in automations using `round(old_value * 255 / 100)` (old 50 becomes 128; old 100 becomes 255), and account for the scale change in historical graphs. With advanced discovery enabled in the protocol-corrected version, distance changes from a read-only sensor to a number entity, while the energy stream changes from a state switch to a command select. The select represents the last chosen command, not the device's live streaming state; review related existing HA automations. Changing thresholds no longer implicitly switches to `custom`.

### Validation scope

Company testing used ZHC 26.105.0 with `node --test tests/zps-z1.test.cjs tests/zps-z1-safety.test.cjs` (this dependency must be provided), with 35 tests passing in the recorded run. Coverage includes exact matching, malformed data, raw-byte preservation, queued snapshots, concurrent writes, write-only commands, distance validation/confirmation, shutdown ordering for initial/timed ON, successive hot replacements, stale passive echoes, cleanup failure, lost initial ON confirmation and retry ordering, and the 5-minute local time limit.

Earlier sample testing verified presence transitions “occupied→unoccupied→occupied,” illuminance of 42→51→49 lx, LED on→off→on, and absence delay 15→16→15. The LED, delay, and sensitivity were restored to on, 15 seconds, and medium. Enabling the display option showed 61 fields; disabling it showed 6 (including link quality), without issuing device commands. Raw-protocol testing confirmed distance `0→50→0`, documented the mismatch between the stated 10-second heartbeat timeout and physical behavior, and confirmed that explicit OFF stopped reporting. The final protocol-corrected version's normal settings interface also passed `0→50→0` readback. Hot replacement while energy streaming was active caused the old session to stop reporting after explicit OFF; subsequent observation found no late energy frames. Distance was finally restored to 0, energy streaming was explicitly stopped, and logs contained no errors for the target device.

The patch for failed initial ON confirmation was verified through software fault simulation and has not yet been installed on the sample; the physical records above come from the preceding protocol-corrected version.

Customer devices, full ranging coverage, absolute illuminance accuracy, self-learning, detection behavior after threshold changes, long-term power consumption, and recovery after a full device restart have not been verified. The manufacturer's PDF is cited as a source only and is not redistributed in this repository.

## ZMS206 private-message compatibility

`zms206.js` preserves the standard responses for `0xE000` D0/D2 and adds complete binary-payload parsing for `0xFC03` command `0x00`, with the Zigbee stack handling default-response rules. Private payloads are written only to debug logs and do not change device fingerprints or switch state. The meanings of DP112–DP114 on four-gang devices are unconfirmed; they remain diagnostic logs with no read/write controls. Other unknown DPs continue to produce undefined-DP notices.

Run the 7 focused tests using `node --test tests/zms206.test.js`. Captured `0xFC03` messages were also replayed with Zigbee2MQTT 2.14.1, zigbee-herdsman 10.9.2, and zigbee-herdsman-converters 26.105.0 to verify lossless parsing, error boundaries, and DP conversion. Two state queries and approximately 3 minutes of idle observation were completed on a `_TZE28C1000000_y4jqpry8` sample; D0/D2 responses were normal, with no duplicate frames or parsing errors observed. `0xFC03` did not recur naturally during this physical-device observation. Long-term operation and customer networks with multiple devices remain unverified. Converter compatibility handling and MQTT deduplication do not establish that every abnormal report from the device has been fixed.

## ZMS1-TYZ features and validation scope

Add `zms1.js` to Zigbee2MQTT's external converters. The two fingerprints are matched separately and do not share unsupported features:

| Fingerprint | Features | Validation |
| --- | --- | --- |
| `TS0601 / _TZE284_zuq5xxib` | Open, close, stop; integer percentages 0–100; `invert_cover`; `running`; `options.reverse_direction`; `options.motor_speed` (raw values 0–255) | Loaded and selected in Z2M; open and close each ran for approximately 3 seconds before stopping, with on-site confirmation that the output shaft turned in opposite directions and stopped normally. No track was installed, so actual travel and percentage positioning were not verified; direction settings and speed adjustment were not physically tested |
| `TS0601 / _TZE200_fu14oapz` | Open, close, stop; integer percentages 0–100; `invert_cover`; `running`; `work_state_raw` (DP7) and `fault_raw` (DP12) | Adapted from the merged upstream PR #13208; only source checks, fingerprint selection, and simulated protocol tests were completed, with no physical testing of this fingerprint. No direction or speed controls are provided |

`running` is inferred from position reports and resets after approximately 3 seconds without continuing reports; it is not an independent motion sensor. `work_state_raw` and `fault_raw` preserve the datatype and hexadecimal bytes. The enumeration and fault-bit meanings remain unconfirmed, so raw values must not be treated as interpreted fault states. Direction and speed displays update only after the corresponding device reports arrive; successful command transmission is not treated as state readback. Calibration, limits, and inching are outside this configuration's scope.

Position inputs must be numeric integers from 0–100. Null values, booleans, strings, fractions, and out-of-range values are rejected to prevent unintended actions caused by upstream legacy type conversion. Focused tests passed with zigbee-herdsman-converters 26.105.0 and 26.109.0. To run `node tests/test_zms1.cjs`, first make that dependency available in the module search path.

Sources: [upstream ZMS1-TYZ features](https://www.zigbee2mqtt.io/devices/ZMS1-TYZ.html), [original ZMS1 support PR #9235](https://github.com/Koenkk/zigbee-herdsman-converters/pull/9235), and [fu14oapz support PR #13208](https://github.com/Koenkk/zigbee-herdsman-converters/pull/13208). Direction/speed controls on the 284 variant are unverified features based on the related 204 implementation. Publishing this repository does not mean every feature has completed physical acceptance testing.

## ZM16B battery reporting

`zemismart_zm16b.js` supports the `TS0601 / _TZE284_3mzb0sdz` tubular motor. If the battery value remains empty more than 24 hours after joining, the usual cause is that the device has not spontaneously reported `DP13`, rather than a missing DP mapping.

The converter sends Tuya `dataQuery` during configuration, when the device comes online, every 12 hours, and on manual battery reads to prompt the device to report `DP13`:

```yaml
external_converters:
  - external_converters/zemismart_zm16b.js
```

You can also manually request a battery reading through Zigbee2MQTT:

```json
topic: zigbee2mqtt/<friendly_name>/get
payload: {"battery": ""}
```
