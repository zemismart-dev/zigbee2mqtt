# zigbee2mqtt

用于存储 Zemismart 公司产品相关的 Zigbee2MQTT external converter 配置文件。

| 配置文件 | Zigbee2MQTT model | 指纹型号 / manufacturerName | 说明 |
| --- | --- | --- | --- |
| `214c.js` | `TS0601_water_valve` | `TS0601` / `_TZE284_vuwtqx0t`, `_TZE200_vuwtqx0t` | 超声波水表阀，支持累计/日/月用水、阀门和告警等 DP |
| `DN15-223F.js` | `TS0601_heat_meter` | `TS0601` / `_TZE200_jt50ea5d` | DN15-223F 超声波热量表，支持热量、水量、温度、电压和周期上报 |
| `KES-606-composite.js` | `TS0726_1_gang_scene_switch_ovbvmhiq` | `TS0726` / `_TZ3000_ovbvmhiq` | KES 606复合 1 路开关，支持普通开关/场景模式；场景模式下 App 点击通断无效，避免误操作 |
| `KES-606-composite.js` | `TS0726_2_gang_scene_switch_icoxotza` | `TS0726` / `_TZ3000_icoxotza` | KES 606复合 2 路开关，支持普通开关/场景模式；场景模式下 App 点击通断无效，避免误操作 |
| `KES-606-composite.js` | `TS0726_3_gang_scene_switch_cziew6eu` | `TS0726` / `_TZ3000_cziew6eu` | KES 606复合 3 路开关，支持普通开关/场景模式；场景模式下 App 点击通断无效，避免误操作 |
| `KES-606-composite.js` | `TS0726_4_gang_scene_switch_hurauima` | `TS0726` / `_TZ3000_hurauima` | KES 606复合 4 路开关，支持普通开关/场景模式；场景模式下 App 点击通断无效，避免误操作 |
| `ZN2S-L01E-SMB.js` | `ZN2S-L01E-SMB` | `TS0601` / `_TZE200_ephrk8to` | 1 路场景开关，支持每路在开关模式和场景模式之间切换 |
| `ZN2S-L01E-SMB.js` | `ZN2S-L01E-SMB-2G` | `TS0601` / `_TZE200_ahyyfhqk` | 2 路场景开关，支持每路在开关模式和场景模式之间切换 |
| `ZN2S-L01E-SMB.js` | `ZN2S-L01E-SMB-3G` | `TS0601` / `_TZE200_zuphzsmo` | 3 路场景开关，支持每路在开关模式和场景模式之间切换 |
| `ZN2S-L01E-SMB.js` | `ZN2S-L01E-SMB-4G` | `TS0601` / `_TZE200_6si1pnia` | 4 路场景开关，支持每路在开关模式和场景模式之间切换 |
| `zemismart_zm16b.js` | `ZM16B` | `TS0601` / `_TZE284_3mzb0sdz` | ZM16B 电池管状窗帘电机，支持开关停、位置、电机方向、上下限设置和电量；配置、设备上线和每 12 小时主动查询 DP，避免电量长时间为空 |
| `zemismart-zpm1-z2m.js` | `ZMP1` | `TS0601` / `_TZE284_6hrnp30w` | ZMP1 电池窗帘电机，支持开关停、位置、方向、限位和每 12 小时通过 Tuya dataQuery 主动读取电量 |
| `zemismart-zps-z1-z2m.js` | `ZPS-Z1` | `zigbeeModel: TS0601`，未限制 manufacturerName | ZPS-Z1 24 GHz 毫米波人体存在传感器 |
| `zm25z.js` | `TS0301_cirjrpxe` | `TS0301` / `_TZE200_cirjrpxe` | ZM25Z 强电窗帘电机，支持开关停、位置、方向和限位设置 |
| `zms206.js` | `TS0601_1gang_screen_switch_zms206`, `TS0601_2gang_screen_switch_zms206`, `TS0601_3gang_screen_switch_zms206`, `TS0601_4gang_screen_switch_zms206` | `TS0601` / ZMS206 1/2/3/4 路屏显开关指纹 | ZMS206 屏显开关，支持每路开关、屏显名称、倒计时、继电器上电状态、背光、童锁、指示灯颜色和循环计划 |
| `zm609.js` | `TS0601_2gang_screen_switch_o409r73p` | `TS0601` / `_TZE284_o409r73p`, `_TZE28C1000000_o409r73p` | ZM609 两路美标屏显开关，支持开关、计量、屏显和配置项 |

## ZM16B 电量说明

`zemismart_zm16b.js` 用于 `TS0601 / _TZE284_3mzb0sdz` 管状电机。若设备入网后电量超过 24 小时仍为空，通常不是 DP 映射缺失，而是设备没有主动上报 `DP13`。

该转换器会在配置、设备上线、每 12 小时定时查询和手动读取电量时发送 Tuya `dataQuery`，促使设备回报 `DP13`：

```yaml
external_converters:
  - external_converters/zemismart_zm16b.js
```

也可以通过 Zigbee2MQTT 手动触发一次电量查询：

```json
topic: zigbee2mqtt/<friendly_name>/get
payload: {"battery": ""}
```
