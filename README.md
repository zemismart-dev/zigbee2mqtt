# zigbee2mqtt

用于存储 Zemismart 公司产品相关的 Zigbee2MQTT external converter 配置文件。

| 配置文件 | Zigbee2MQTT 匹配型号 | 指纹型号 / manufacturerName | 说明 |
| --- | --- | --- | --- |
| `214c.js` | `TS0601` | `_TZE284_vuwtqx0t`, `_TZE200_vuwtqx0t` | 超声波水表阀，支持累计/日/月用水、阀门和告警等 DP |
| `DN15-223F.js` | `TS0601` | `_TZE200_jt50ea5d` | DN15-223F 超声波热/冷表，支持 DP7 热量计量开关、DP8 累计热量、水量、温度、电压和周期上报 |
| `KES-606-composite.js` | `TS0726` | `_TZ3000_ovbvmhiq`, `_TZ3000_icoxotza`, `_TZ3000_cziew6eu`, `_TZ3000_hurauima` | KES 606 复合场景开关 1/2/3/4 路，支持普通开关/场景模式；场景模式下 App 点击通断无效，避免误操作 |
| `ZMD-208.js` | `TS0601` | 1 路: `_TZE28C1000000_huc4fueh`<br>2 路: `_TZE28C1000000_gheewd2t`<br>3 路: `_TZE28C1000000_8jwv5lbl`, `_TZE284_8jwv5lbl` | ZMD-208 屏显调光开关，支持 1/2/3 路开关与亮度、最小/最大亮度、负载类型、倒计时、屏显名称、背光、颜色、童锁和息屏时间；带重复 DP 去重、MCU 时间同步节流及 `0xE000` 私有状态应答，1/2 路 DP 映射待实机验证 |
| `ZN2S-RS1E.js` | `TS0601` | `_TZE204_e1hutaaj`, `_TZE284_e1hutaaj`, `_TZE284_2jnoy8dj` | ZN2S-RS1E 触摸风扇控制器，支持开关、风速、倒计时、上电行为、指示灯、背光、童锁、最低风速和风扇开关状态指示灯颜色 |
| `ZN2S-L01E-SMB.js` | `TS0601` | `_TZE200_ephrk8to`, `_TZE200_ahyyfhqk`, `_TZE200_zuphzsmo`, `_TZE200_6si1pnia` | Zemismart 1/2/3/4 路场景开关，支持每路在开关模式和场景模式之间切换 |
| `zemismart_zm16b.js` | `TS0601` | `_TZE284_3mzb0sdz` | ZM16B 电池管状窗帘电机，支持开关停、位置、电机方向、上下限设置和电量；配置、设备上线和每 12 小时主动查询 DP，避免电量长时间为空 |
| `zemismart_zm86_2z.js` | `TS0601` | `_TZE200_cf1sl3tj` | ZM86-2Z 罗马杆 I/U 型窗帘电机，外部转换器精确指纹优先匹配；支持开关停、DP2 位置、电机方向、限位、点动、电量和故障状态，并将语义未确认的 DP3 保留为只读诊断值，避免覆盖位置和运行状态 |
| `zemismart-zpm1-z2m.js` | `TS0601` | `_TZE284_6hrnp30w` | ZMP1 电池窗帘电机，支持开关停、位置、方向、限位和每 12 小时通过 Tuya dataQuery 主动读取电量 |
| `zemismart-zps-z1-z2m.js` | `TS0601` | `_TZE284_ft7qqpx3` | ZPS-Z1 24 GHz 毫米波人体存在传感器；仅匹配该完整指纹，支持存在、照度、检测距离、灵敏度及区域设置 |
| `zemismart_zmr4.js` | `TS0044` | `_TZ3000_xwuveizv` | ZMR4 四键无线遥控器，支持每键单击、双击、长按动作、电池/电压及 12 个本地动作模拟按钮；精确指纹优先于上游定义 |
| `zm25z.js` | `TS0301` | `_TZE200_cirjrpxe` | ZM25Z 强电窗帘电机，支持开关停、位置、方向和限位设置 |
| `zms1.js` | `TS0601` | `_TZE284_zuq5xxib`, `_TZE200_fu14oapz` | ZMS1-TYZ 窗帘电机，支持开关停、整数百分比及运行指示；284 版本另提供方向和原始速度设置，fu14oapz 版本另提供 DP7/DP12 原始诊断。实测范围与限制见下文 |
| `zmd206_screen_dimmer.js` | `TS0601` | 1 路: `_TZE28C1000000_5aico93l`, `_TZE284_5aico93l`<br>2 路: `_TZE284_pyh4zt7w`<br>3 路: `_TZE28C1000000_k9e7ihec`, `_TZE284_k9e7ihec` | ZMD-206 屏显调光开关，支持每路开关/亮度、亮度上下限、负载类型、倒计时、屏显名称、上电行为、背光、指示灯、童锁和渐变速度 |
| `zm208.js` | `TS0601` | 3 路: `_TZE284_xvywzhmi`, `_TZE28C1000000_xvywzhmi` | ZMS-208US-3 非调光屏显开关，支持每路开关、倒计时、屏显名称和童锁；带重复 DP 去重、MCU 时间同步节流及 `0xE000` 私有状态应答 |
| `zms206.js` | `TS0601` | 1 路: `_TZE204_lnyz4a6v`, `_TZE204_sa2ueffe`, `_TZE204_zuepxzck`, `_TZE28C1000000_lnyz4a6v`, `_TZE284_lnyz4a6v`, `_TZE284_1tnysxwl`, `_TZE284_sa2ueffe`, `_TZE284_rzdkn5rx`<br>2 路: `_TZE204_3ctwoaip`, `_TZE204_dmckrsxg`, `_TZE28C1000000_dmckrsxg`, `_TZE284_3ctwoaip`, `_TZE284_dmckrsxg`, `_TZE284_a2teqi5u`, `_TZE28C1000000_a2teqi5u`<br>3 路: `_TZE204_e4pf6l87`, `_TZE204_k7v0eqke`, `_TZE204_iyki9kjp`, `_TZE284_k7v0eqke`, `_TZE284_e4pf6l87`, `_TZE28C1000000_e4pf6l87`<br>4 路: `_TZE204_y4jqpry8`, `_TZE284_y4jqpry8`, `_TZE28C1000000_y4jqpry8`, `by _TZE28C1000000_y4jqpry8`, `_TZE204_wwaeqnrf`, `_TZE284_wwaeqnrf`, `_TZE204_xibaabmu`, `_TZE284_xibaabmu`, `_TZE28C1000000_xibaabmu`, `_TZE204_08qc13ct` | ZMS206 屏显开关，支持每路开关、屏显名称、倒计时、继电器上电状态、背光、童锁、指示灯颜色和循环计划；带 MCU 时间同步节流及 `0xE000` 私有状态应答 |
| `zmz609.js` | `ZMZ609-2`, `ZMZ609-3` | 2 路: `_TZE284_o409r73p`, `_TZE28C1000000_o409r73p`<br>3 路: `_TZE284_oy1nuaa5` | ZMZ609 美标屏显开关，支持两路/三路开关、计量、屏显和配置项；自动同步日期、当前天气和三天天气预报，无需 Home Assistant 自动化，可自动定位或配置经纬度 |

## ZPS-Z1 匹配与验证范围

`zemismart-zps-z1-z2m.js` 仅匹配 `modelID: TS0601` 与 `manufacturerName: _TZE284_ft7qqpx3` 同时满足的设备，不再使用通用 `TS0601` 匹配。其他厂家名称或批次需要核实后单独适配；本次仅收紧匹配范围，保留原有 DP 解析、设置和功能入口。

已使用 zigbee-herdsman-converters 26.105.0（Zigbee2MQTT 2.14.1 所用版本）验证模块加载和设备选择，目标指纹可选中本转换器，其他厂家、其他型号及缺失厂家名称不会选中。运行 `node tests/zps-z1.test.cjs` 需先在模块搜索路径中提供该依赖。

2026-09-21 在公司同指纹样机上完成 Z2M 2.14.1 热加载和设备配置，运行时选中 `ZPS-Z1 / external`。配合现场离开、走近和灯光测试，已收到 DP1 的“有人→无人→有人”以及 DP101 照度 42→51→49 lx 的真实上报。转换器已保存到持久目录；未重启服务，未验证照度绝对精度、设置写入、自学习、区域阈值、长期耗电和重启后重新加载。此结果只覆盖公司样机，客户设备仍需安装验证。

## ZMS1-TYZ 功能与验证范围

将 `zms1.js` 添加到 Zigbee2MQTT 的外部转换器中。两种指纹分别匹配，功能不会混用：

| 指纹 | 功能 | 验证情况 |
| --- | --- | --- |
| `TS0601 / _TZE284_zuq5xxib` | 开、关、停止；0–100 整数百分比；`invert_cover`；`running`；`options.reverse_direction`；`options.motor_speed`（原始值 0–255） | 已在 Z2M 加载并选中；开/关各运行约 3 秒后停止，经现场确认输出轴反向转动并正常停止。无轨道，实际行程和百分比未验证；方向设置和调速未实测 |
| `TS0601 / _TZE200_fu14oapz` | 开、关、停止；0–100 整数百分比；`invert_cover`；`running`；`work_state_raw`（DP7）和 `fault_raw`（DP12） | 按已合并的上游 PR #13208 适配；仅完成源码、指纹选择和模拟协议测试，未进行该指纹实机测试。不提供方向和调速入口 |

`running` 由位置上报推断，缺少持续上报时会在约 3 秒后复位，不是独立运动传感器。`work_state_raw` 和 `fault_raw` 保留 datatype 与十六进制字节；枚举及故障位含义尚未确认，不能把原始值当作已解释的故障状态。方向和速度只在收到对应设备回报后更新显示，不把下发成功当作状态回读。校准、限位和点动不在本配置范围内。

位置输入严格限定为数值整数 0–100；空值、布尔值、字符串、小数和越界值均拒绝，避免上游 legacy 类型转换导致误动作。已通过 zigbee-herdsman-converters 26.105.0 和 26.109.0 的定向测试；运行 `node tests/test_zms1.cjs` 需先在模块搜索路径中提供该依赖。

来源：[ZMS1-TYZ 上游功能](https://www.zigbee2mqtt.io/devices/ZMS1-TYZ.html)、[原始 ZMS1 支持 PR #9235](https://github.com/Koenkk/zigbee-herdsman-converters/pull/9235)、[fu14oapz 支持 PR #13208](https://github.com/Koenkk/zigbee-herdsman-converters/pull/13208)。方向/速度在 284 版本上属于依据 204 同族实现提供的待验证功能。仓库发布不代表所有功能已完成实机验收。

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
