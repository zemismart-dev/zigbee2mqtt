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
| `zemismart-zps-z1-z2m.js` | `TS0601` | `_TZE284_ft7qqpx3` | ZPS-Z1 24 GHz 毫米波人体存在传感器；精确指纹，支持存在、照度、灵敏度及区域设置；未核实的 DP2 距离字段只读 |
| `zemismart_zmr4.js` | `TS0044` | `_TZ3000_xwuveizv` | ZMR4 四键无线遥控器，支持每键单击、双击、长按动作、电池/电压及 12 个本地动作模拟按钮；精确指纹优先于上游定义 |
| `zm25z.js` | `TS0301` | `_TZE200_cirjrpxe` | ZM25Z 强电窗帘电机，支持开关停、位置、方向和限位设置 |
| `zms1.js` | `TS0601` | `_TZE284_zuq5xxib`, `_TZE200_fu14oapz` | ZMS1-TYZ 窗帘电机，支持开关停、整数百分比及运行指示；284 版本另提供方向和原始速度设置，fu14oapz 版本另提供 DP7/DP12 原始诊断。实测范围与限制见下文 |
| `zmd206_screen_dimmer.js` | `TS0601` | 1 路: `_TZE28C1000000_5aico93l`, `_TZE284_5aico93l`<br>2 路: `_TZE284_pyh4zt7w`<br>3 路: `_TZE28C1000000_k9e7ihec`, `_TZE284_k9e7ihec` | ZMD-206 屏显调光开关，支持每路开关/亮度、亮度上下限、负载类型、倒计时、屏显名称、上电行为、背光、指示灯、童锁和渐变速度 |
| `zm208.js` | `TS0601` | 3 路: `_TZE284_xvywzhmi`, `_TZE28C1000000_xvywzhmi` | ZMS-208US-3 非调光屏显开关，支持每路开关、倒计时、屏显名称和童锁；带重复 DP 去重、MCU 时间同步节流及 `0xE000` 私有状态应答 |
| `zms206.js` | `TS0601` | 1 路: `_TZE204_lnyz4a6v`, `_TZE204_sa2ueffe`, `_TZE204_zuepxzck`, `_TZE28C1000000_lnyz4a6v`, `_TZE284_lnyz4a6v`, `_TZE284_1tnysxwl`, `_TZE284_sa2ueffe`, `_TZE284_rzdkn5rx`<br>2 路: `_TZE204_3ctwoaip`, `_TZE204_dmckrsxg`, `_TZE28C1000000_dmckrsxg`, `_TZE284_3ctwoaip`, `_TZE284_dmckrsxg`, `_TZE284_a2teqi5u`, `_TZE28C1000000_a2teqi5u`<br>3 路: `_TZE204_e4pf6l87`, `_TZE204_k7v0eqke`, `_TZE204_iyki9kjp`, `_TZE284_k7v0eqke`, `_TZE284_e4pf6l87`, `_TZE28C1000000_e4pf6l87`<br>4 路: `_TZE204_y4jqpry8`, `_TZE284_y4jqpry8`, `_TZE28C1000000_y4jqpry8`, `by _TZE28C1000000_y4jqpry8`, `_TZE204_wwaeqnrf`, `_TZE284_wwaeqnrf`, `_TZE204_xibaabmu`, `_TZE284_xibaabmu`, `_TZE28C1000000_xibaabmu`, `_TZE204_08qc13ct` | ZMS206 屏显开关，支持每路开关、屏显名称、倒计时、继电器上电状态、背光、童锁、指示灯颜色和循环计划；带 MCU 时间同步节流及 `0xE000` 私有状态应答 |
| `zmz609.js` | `ZMZ609-2`, `ZMZ609-3` | 2 路: `_TZE284_o409r73p`, `_TZE28C1000000_o409r73p`<br>3 路: `_TZE284_oy1nuaa5` | ZMZ609 美标屏显开关，支持两路/三路开关、计量、屏显和配置项；自动同步日期、当前天气和三天天气预报，无需 Home Assistant 自动化，可自动定位或配置经纬度 |

## ZPS-Z1 匹配、设置与升级说明

`zemismart-zps-z1-z2m.js` 仅匹配 `modelID: TS0601` 与 `manufacturerName: _TZE284_ft7qqpx3` 同时满足的设备。其他厂家名称或批次需要单独核实。

**客户只需安装这一个转换器文件。**默认功能页仅显示人体存在、照度、灵敏度、无人延时、指示灯，以及 Z2M 自动添加的信号质量。区域启用/阈值、能量调试、自学习和未确认的距离字段默认不显示。

需要调试时，在该设备的 **设置（特定）→ Advanced controls / Show advanced** 中启用 `show_advanced`，即可恢复全部高级字段；关闭后恢复精简页，无需重启或重新配对。未保存此选项时按关闭处理（设置控件可能显示尚未设置）。这完全使用 Z2M 原生 options/exposes，适用于标准前端与 Windfront，不需要任何自定义前端。

**HA 影响：**Z2M 的 exposes 同时用于 HA 发现。隐藏高级字段会撤回对应高级实体的 discovery，打开后重新发现；基础实体不变。如果现有 HA 自动化使用高级实体，请保持 `show_advanced: true`。已有 flat MQTT 上报和设置接口始终保留，显示开关不写设备参数，也不抹除设备内的区域或阈值。

- 区域启用和阈值修改会先查询完整原始回报，再串行修改目标字节并等待设备确认；没有完整回报时拒绝写入，不使用默认值补齐。未修改的区域保留原始字节，包括区域模式 1/2；同值设置不重写，也不切换灵敏度。
- 设置输入、DP 类型、长度和枚举值严格校验。异常报告不会变成“无人”，无效输入不会变成 0 或关闭操作。
- GET 会发送 Tuya `dataQuery`，连续手动刷新按 3 秒节流；SET 后的回读按至少 3 秒间隔排队发送，不因 GET 节流而丢失；完整原始快照只接受实际查询发出后的报告。页面状态由真实报告更新，不把发送成功当作回读成功。
- 能量流每次开启最多运行 5 分钟，心跳不并发；到期停止心跳并发送关闭请求。关闭、设备停止或转换器热替换会清理本地计时器。关闭请求失败会记录日志，未收到 DP104 回报时保持未知或最后的已知值，不虚报已关闭。
- 启用高级显示后，设置项归入 `config`，只读能量归入 `diagnostic`；能量实体在 Home Assistant 新发现时默认禁用。高级显示关闭时，这些字段不会出现在功能页，也不会继续发布它们的 HA discovery。

**升级兼容性：**区域能量和阈值同名字段现在使用原始整数 **0–255**，无物理单位；旧版显示的 0–100 是归一化值。旧自动化中阈值常量需换算为 `round(旧值 * 255 / 100)`，例如旧 100 对应新 255、旧 50 对应新 128。请加载后刷新并核对真实值，再启用旧阈值自动化；仅更新转换器不会把设备阈值重新写入。历史曲线存在尺度变化。

`detection_range` 保留为只读诊断字段并移除 `cm` 单位：样机 DP2 回报为 0，历史实现的范围定义存在冲突，尚无可靠证据确认单位或 0 的语义。不要将其解释为禁用或自动，也不要用旧距离写入自动化继续下发；该字段的 SET 会明确报错。厂家产品最大检测距离不等同于此 DP 的协议范围。

测试使用 zigbee-herdsman-converters 26.105.0（Zigbee2MQTT 2.14.1 所用版本），运行 `node --test tests/zps-z1.test.cjs tests/zps-z1-safety.test.cjs`，需先在模块搜索路径中提供该依赖。覆盖精确指纹、真实 matcher 反例、异常数据、原始字节保留、并发写、回读超时、GET、延迟应答、停止/热加载及 5 分钟自动关闭。

2026-09-21 公司同指纹样机已验证初版热加载选中 `ZPS-Z1 / external`，以及现场“有人→无人→有人”和照度 42→51→49 lx 的真实上报。安全增强与精简显示版通过 26 项针对性测试及独立复核，并已在同一公司样机热加载验证：GET 获得真实回报，LED 开→关→开、无人延时 15→16→15 的设置回读通过，区域/阈值同值操作只查询不写入。最终恢复 LED 开、无人延时 15 秒、灵敏度 medium，区域与阈值保持原值，最终测试时段无目标转换器错误。5 分钟定时器与并发保护在模拟环境验证，未进行长时间实物能量流测试。已在原生 Windfront 页面验证高级开关：开启为 61 项、关闭为 6 项（含自动信号质量），不发送设备查询/写入命令，最终保持关闭。客户设备、照度绝对精度、自学习、长期耗电及重启后重新加载仍需单独验证。

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
