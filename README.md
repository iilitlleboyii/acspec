# AcSpec

用于自动化测试脚本编辑

### features

支持代码提示补全、代码片段、代码格式校验、文档格式化、远程调试

### commands

| 类型         | 命令         | 格式                                            |
| ------------ | ------------ | ----------------------------------------------- |
| 输入         | write        | write <地址>, <值>                              |
| 检测         | check        | check <地址>, <值>                              |
| 延时         | delay        | delay <时间(s)>                                 |
| 线性输入     | linear_input | linear_input <地址>, <起始值>, <结束值>, <时间> |
| 告警检测     | check_alarm  | check_alarm <告警码>                            |
| 动作状态检测 | check_action | check_action <动作状态码>                       |
| 范围检测     | check_range  | check_range <地址>, <最小值>, <最大值>          |
| 寄存器赋值   | reg_assign   | reg_assign <地址>, <地址 2>                     |
| 寄存器检测   | reg_check    | reg_check <地址>, <地址 2>                      |
| 开启持续检测 | watch        | watch <地址>, <值>                              |
| 关闭持续检测 | unwatch      | unwatch <地址>                                  |

### grammars

command! 标记重点

# examples

// Name: 全自动模式检测马达未开告警
// Author: 作者
// Date: 2025-06-24 13:52:38

"use unit"

// 测试步骤
write M0100, 1 // 复位开
write M0100, 0 // 复位关

write M0101, 0
write M0102, 0

write M0108, 1

delay 1

check M0106, 1
check_alarm 1078
check_alarm 1079

/----------------------------------------------------/

// Name: 初始化模板
// Author: 作者
// Date: 2025-06-24 13:56:40

"use init"

// 测试步骤
write M0100, 1 // 复位开
write M0100, 0 // 复位关

write M0101, 1
write M0102, 1
