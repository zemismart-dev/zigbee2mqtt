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
| `zemismart-zps-z1-z2m.js` | `TS0601` | `_TZE284_ft7qqpx3` | ZPS-Z1 24 GHz 毫米波人体存在传感器；精确指纹、精简默认界面、可选高级设置；距离参数按厂家协议，能量命令带显式关闭保护 |
| `zemismart_zmr4.js` | `TS0044` | `_TZ3000_xwuveizv` | ZMR4 四键无线遥控器，支持每键单击、双击、长按动作、电池/电压及 12 个本地动作模拟按钮；精确指纹优先于上游定义 |
| `zm25z.js` | `TS0301` | `_TZE200_cirjrpxe` | ZM25Z 强电窗帘电机，支持开关停、位置、方向和限位设置 |
| `zms1.js` | `TS0601` | `_TZE284_zuq5xxib`, `_TZE200_fu14oapz` | ZMS1-TYZ 窗帘电机，支持开关停、整数百分比及运行指示；284 版本另提供方向和原始速度设置，fu14oapz 版本另提供 DP7/DP12 原始诊断。实测范围与限制见下文 |
| `zmd206_screen_dimmer.js` | `TS0601` | 1 路: `_TZE28C1000000_5aico93l`, `_TZE284_5aico93l`<br>2 路: `_TZE284_pyh4zt7w`<br>3 路: `_TZE28C1000000_k9e7ihec`, `_TZE284_k9e7ihec` | ZMD-206 屏显调光开关，支持每路开关/亮度、亮度上下限、负载类型、倒计时、屏显名称、上电行为、背光、指示灯、童锁和渐变速度 |
| `zm208.js` | `TS0601` | 3 路: `_TZE284_xvywzhmi`, `_TZE28C1000000_xvywzhmi` | ZMS-208US-3 非调光屏显开关，支持每路开关、倒计时、屏显名称和童锁；带重复 DP 去重、MCU 时间同步节流及 `0xE000` 私有状态应答 |
| `zms206.js` | `TS0601` | 1 路: `_TZE204_lnyz4a6v`, `_TZE204_sa2ueffe`, `_TZE204_zuepxzck`, `_TZE28C1000000_lnyz4a6v`, `_TZE284_lnyz4a6v`, `_TZE284_1tnysxwl`, `_TZE284_sa2ueffe`, `_TZE284_rzdkn5rx`<br>2 路: `_TZE204_3ctwoaip`, `_TZE204_dmckrsxg`, `_TZE28C1000000_dmckrsxg`, `_TZE284_3ctwoaip`, `_TZE284_dmckrsxg`, `_TZE284_a2teqi5u`, `_TZE28C1000000_a2teqi5u`<br>3 路: `_TZE204_e4pf6l87`, `_TZE204_k7v0eqke`, `_TZE204_iyki9kjp`, `_TZE284_k7v0eqke`, `_TZE284_e4pf6l87`, `_TZE28C1000000_e4pf6l87`<br>4 路: `_TZE204_y4jqpry8`, `_TZE284_y4jqpry8`, `_TZE28C1000000_y4jqpry8`, `by _TZE28C1000000_y4jqpry8`, `_TZE204_wwaeqnrf`, `_TZE284_wwaeqnrf`, `_TZE204_xibaabmu`, `_TZE284_xibaabmu`, `_TZE28C1000000_xibaabmu`, `_TZE204_08qc13ct` | ZMS206 屏显开关，支持每路开关、屏显名称、倒计时、继电器上电状态、背光、童锁、指示灯颜色和循环计划；带 MCU 时间同步节流及 `0xE000` 私有状态应答 |
| `zmz609.js` | `ZMZ609-2`, `ZMZ609-3` | 2 路: `_TZE284_o409r73p`, `_TZE28C1000000_o409r73p`<br>3 路: `_TZE284_oy1nuaa5` | ZMZ609 美标屏显开关，支持两路/三路开关、计量、屏显和配置项；自动同步日期、当前天气和三天天气预报，无需 Home Assistant 自动化，可自动定位或配置经纬度 |

## ZPS-Z1 匹配、设置与升级说明

`zemismart-zps-z1-z2m.js` 仅匹配 `TS0601 / _TZE284_ft7qqpx3`。协议依据为产品 ID `ft7qqpx3` 的《MCU SDK 快速入门指南》（2025-12-15，文件 `lowpower_protocol_ft7qqpx3_20251215.pdf`）；MCU 串口命令与 Zigbee EF00 封装分开处理，不直接混用命令编号。

**客户只需安装这一个转换器文件。**默认功能页显示人体存在、照度、灵敏度、无人延时、指示灯，以及 Z2M 自动添加的信号质量。区域/阈值、能量调试、自学习和雷达距离设置默认隐藏。在设备 **设置（特定）→ Advanced controls** 中启用 `show_advanced` 可恢复高级字段；关闭后恢复精简页，无需重启或重新配对。未保存选项时按关闭处理。

**HA 影响：**exposes 同时用于 HA 发现，关闭高级显示会撤回对应高级实体，开启后重新发现；使用高级 HA 实体的自动化应保持 `show_advanced: true`。全部原 flat MQTT 上报/设置接口保留，显示开关本身不写设备参数。

### 协议校正

- **雷达距离 DP2**：协议为可读写整数 `0–1500 cm`、步长 `50`，写入等待实际回报确认。已在公司样机验证 `0→50→0` 并恢复原值；这不证明实际可探测 15 米，也未解释 `0` 的特殊语义。
- **能量命令 DP104**：`energy_streaming` 为只下发的 `ON/OFF` 命令，仍兼容原布尔值和 `ON/OFF` MQTT 输入。它不是可查询开关，GET 会明确拒绝，也不从被动 echo 伪造状态。
- 厂家资料写每 5 秒下发心跳、10 秒未收到则停报；**本样机停止心跳超过 15 秒仍持续上报**，显式 OFF 后才停止。因此转换器不依赖固件超时：本地会话最多 5 分钟，OFF、停止或热替换均清理心跳并按需显式请求关闭；等待在途 ON 完成后才发最终 OFF，新的会话等待旧清理完成。关闭失败会记录警告，不能视作确认停报。
- **区域 DP117**：10 字节，`0=屏蔽、1=有人、2=无人`。区域启用由非零值派生，不再标注未获协议支持的每区厘米边界。修改时查询完整快照并保留其他区域原始字节。
- **能量 DP102**：前 10 字节为运动能量、后 10 字节为存在能量，按原始 `0–255` 显示；未开放语义不明的能量值写入。
- **阈值 DP124**：两组各 10 字节，协议没有说明两组的物理角色。界面标注为 `Threshold group 1/2`，保留 `motion_threshold/presence_threshold` 旧键作兼容，不盲目交换顺序，也不再自动改写灵敏度预设。
- `sensor_close` 只保留协议枚举含义，不解释为已确认的物理遮挡或无人；该值不覆盖最后占用值。DP105 的用途/周期、DP106/107 的功能仍未证实，不擅自启用或映射。自学习保留明确的数值枚举，去掉无依据的预热及学习时长说明。

### 安全行为与升级

设置输入、报告类型、长度和枚举严格校验；异常包不会变成“无人”，无效输入不会变成 0。区域/阈值写前读取完整原始快照，逐设备串行操作，只改目标字节并确认回报；缺失或超时拒绝写入，同值只查询。GET 与需回读的 SET 至少间隔 3 秒发送查询，避免密集请求被固件丢弃；DP104 不发送无意义的状态查询。

区域能量和阈值的旧版 `0–100` 为归一化值，现为原始 `0–255`。旧阈值自动化常量需换算为 `round(旧值 * 255 / 100)`（旧 50 对应 128，旧 100 对应 255），历史曲线有尺度变化。新协议校正版启用高级发现时，距离字段由只读 sensor 转为 number，能量流由状态 switch 转为命令 select；select 表示最后选择的命令，不是设备的实时流状态，相关旧 HA 自动化需要检查。修改阈值不再隐式切换 `custom`。

### 验证范围

公司测试使用 ZHC 26.105.0：`node --test tests/zps-z1.test.cjs tests/zps-z1-safety.test.cjs`（需提供此依赖），当前 33 项通过。覆盖精确匹配、异常数据、原始字节保留、排队快照、并发写、write-only 命令、距离校验/确认、初始/定时 ON 的停止排序、连续热替换、被动旧 echo、清理失败和 5 分钟本地限时。

此前样机已验证人体存在“有人→无人→有人”、照度 42→51→49 lx、LED 开→关→开、无人延时 15→16→15，并恢复 LED 开、15 秒、medium。显示选项开启61项/关闭6项（含信号质量），不触发设备命令。此次原始协议测试确认距离 `0→50→0`，记录了10秒心跳超时与实机不符及显式OFF停报；最终协议校正版的正常设置接口也通过 `0→50→0` 回读；开启能量流后热替换配置，旧会话显式 OFF 后停报，后续观察无迟到能量帧。最终距离恢复 0，能量流已显式停止，日志无目标错误。

客户设备、完整测距覆盖、照度绝对精度、自学习、阈值调整后的检测效果、长期功耗及整机重启恢复未验证。原厂 PDF 仅作为来源引用，不随仓库重新发布。

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
