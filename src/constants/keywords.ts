const keywordMap: Record<string, any> = {
  write: {
    title: '输入',
    document: '写入寄存器值\n\n格式: write <地址>, <值>',
    snippet: 'write ${1:地址}, ${2:值}',
    paramCount: 2
  },
  check: {
    title: '检测',
    document: '检测寄存器值\n\n格式: check <地址>, <值>',
    snippet: 'check ${1:地址}, ${2:值}',
    paramCount: 2
  },
  delay: {
    title: '延时',
    document: '等待一定时间\n\n格式: delay <时间(s)>',
    snippet: 'delay ${1:时间}',
    paramCount: 1
  },
  linear_input: {
    title: '线性输入',
    document: '给定值范围和时间写入寄存器值\n\n格式: linear_input <地址>, <起始值>, <结束值>, [时间]',
    snippet: 'linear_input ${1:地址}, ${2:起始值}, ${3:结束值}, ${4:时间}',
    paramCount: 4
  },
  check_alarm: {
    title: '告警检测',
    document: '检测告警码\n\n格式: check_alarm <告警码>',
    snippet: 'check_alarm ${1:告警码}',
    paramCount: 1
  },
  check_range: {
    title: '范围检测',
    document: '检测寄存器值是否满足值区间\n\n格式: check_range <地址>, <最小值>, <最大值>',
    snippet: 'check_range ${1:地址}, ${2:最小值}, ${3:最大值}',
    paramCount: 3
  },
  reg_assign: {
    title: '寄存器赋值',
    document: '向寄存器写入某个寄存器的值\n\n格式: reg_assign <地址>, <地址2>',
    snippet: 'reg_assign ${1:地址}, ${2:地址2}',
    paramCount: 2
  },
  reg_check: {
    title: '寄存器检测',
    document: '检测寄存器值和某个寄存器值是否相等\n\n格式: reg_check <地址>, <地址2>',
    snippet: 'reg_check ${1:地址}, ${2:地址2}',
    paramCount: 2
  },
  watch: {
    title: '监视',
    document: '监视寄存器值\n\n格式: watch <地址>, <值>',
    snippet: 'watch ${1:地址}, ${2:值}',
    paramCount: 2
  },
  unwatch: {
    title: '取消监视',
    document: '取消监视寄存器值\n\n格式: unwatch <地址>',
    snippet: 'unwatch ${1:地址}',
    paramCount: 1
  }
};

export { keywordMap };
