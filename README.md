# zigbee2mqtt

用于存储 Zemismart 公司产品相关的 Zigbee2MQTT external converter 配置文件。

| 配置文件 | Zigbee2MQTT 匹配型号 | 指纹型号 / manufacturerName | 说明 |
| --- | --- | --- | --- |
| `214c.js` | `TS0601` | `_TZE284_vuwtqx0t`, `_TZE200_vuwtqx0t` | 超声波水表阀，支持累计/日/月用水、阀门和告警等 DP |
| `DN15-223F.js` | `TS0601` | `_TZE200_jt50ea5d` | DN15-223F 超声波热量表，支持热量、水量、温度、电压和周期上报 |
| `KES-606-composite.js` | `TS0726` | `_TZ3000_ovbvmhiq`, `_TZ3000_icoxotza`, `_TZ3000_cziew6eu`, `_TZ3000_hurauima` | KES 606 复合场景开关 1/2/3/4 路，支持普通开关/场景模式；场景模式下 App 点击通断无效，避免误操作 |
| `ZN2S-RS1E-SF.js` | `TS0601` | `_TZE204_e1hutaaj`, `_TZE284_e1hutaaj` | ZN2S-RS1E-SF 触摸风扇控制器，支持开关、风速、倒计时、上电行为、指示灯、背光、童锁、最低风速和风扇开关状态指示灯颜色 |
| `ZN2S-L01E-SMB.js` | `TS0601` | `_TZE200_ephrk8to`, `_TZE200_ahyyfhqk`, `_TZE200_zuphzsmo`, `_TZE200_6si1pnia` | Zemismart 1/2/3/4 路场景开关，支持每路在开关模式和场景模式之间切换 |
| `zemismart_zm16b.js` | `TS0601` | `_TZE284_3mzb0sdz` | ZM16B 电池管状窗帘电机，支持开关停、位置、电机方向、上下限设置和电量；配置、设备上线和每 12 小时主动查询 DP，避免电量长时间为空 |
| `zemismart-zpm1-z2m.js` | `TS0601` | `_TZE284_6hrnp30w` | ZMP1 电池窗帘电机，支持开关停、位置、方向、限位和每 12 小时通过 Tuya dataQuery 主动读取电量 |
| `zemismart-zps-z1-z2m.js` | `TS0601` | 未限制 manufacturerName | ZPS-Z1 24 GHz 毫米波人体存在传感器 |
| `zm25z.js` | `TS0301` | `_TZE200_cirjrpxe` | ZM25Z 强电窗帘电机，支持开关停、位置、方向和限位设置 |
| `zms206.js` | `TS0601` | 1 路: `_TZE204_lnyz4a6v`, `_TZE204_sa2ueffe`, `_TZE204_zuepxzck`, `_TZE28C1000000_lnyz4a6v`, `_TZE284_lnyz4a6v`, `_TZE284_1tnysxwl`, `_TZE284_sa2ueffe`<br>2 路: `_TZE204_3ctwoaip`, `_TZE204_dmckrsxg`, `_TZE28C1000000_dmckrsxg`, `_TZE284_3ctwoaip`, `_TZE284_dmckrsxg`, `_TZE284_a2teqi5u`, `_TZE28C1000000_a2teqi5u`<br>3 路: `_TZE204_e4pf6l87`, `_TZE204_k7v0eqke`, `_TZE204_iyki9kjp`, `_TZE284_k7v0eqke`, `_TZE284_e4pf6l87`, `_TZE28C1000000_e4pf6l87`, `_TZE284_xvywzhmi`<br>4 路: `_TZE204_y4jqpry8`, `_TZE284_y4jqpry8`, `_TZE28C1000000_y4jqpry8`, `_TZE204_wwaeqnrf`, `_TZE284_wwaeqnrf`, `_TZE204_xibaabmu`, `_TZE284_xibaabmu`, `_TZE28C1000000_xibaabmu`, `_TZE204_08qc13ct` | ZMS206 屏显开关，支持每路开关、屏显名称、倒计时、继电器上电状态、背光、童锁、指示灯颜色和循环计划 |
| `zm609.js` | `TS0601` | 2 路: `_TZE284_o409r73p`, `_TZE28C1000000_o409r73p`<br>3 路: `_TZE284_oy1nuaa5` | ZM609 美标屏显开关，支持两路/三路开关、计量、屏显和配置项 |

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
