import * as vscode from 'vscode';
import { keywordMap } from '../constants/keywords';

export default class CodeFormatter {
  // 按长度降序排序关键字，确保长关键字优先匹配
  private static readonly keywords = Object.keys(keywordMap)
    .sort((a, b) => b.length - a.length)
    .join('|');

  format(text: string): string {
    // 添加单词边界并使用精确匹配
    const pattern = new RegExp(`^(${CodeFormatter.keywords})\\b\\s*(.*)$`, 'i');
    const match = text.trim().match(pattern);

    if (!match) return text;

    const [, keyword, rest] = match;
    const lowercaseKeyword = keyword.toLowerCase();

    // 处理参数部分
    const params = rest
      .split(',')
      .map((param) => param.trim())
      .filter(param => param.length > 0); // 移除空参数

    // 检查参数个数是否正确
    const expectedCount = keywordMap[lowercaseKeyword].paramCount;
    if (params.length !== expectedCount) {
      return text; // 如果参数个数不正确，保持原样以便验证器显示错误
    }

    // 格式化参数
    const formattedParams = params.map((param, index) => {
      // 处理地址参数（第一个参数通常是地址，除了 delay 和 check_alarm）
      if (this.isAddressParameter(lowercaseKeyword, index)) {
        return param.toUpperCase();
      }
      return param;
    });

    // 返回格式化后的命令
    return `${lowercaseKeyword} ${formattedParams.join(', ')}`;
  }

  private isAddressParameter(keyword: string, index: number): boolean {
    // delay 和 check_alarm 命令没有地址参数
    if (keyword === 'delay' || keyword === 'check_alarm') {
      return false;
    }
    // 对于其他命令，第一个参数通常是地址
    return index === 0;
  }

  static createTextEdit(range: vscode.Range, newText: string): vscode.TextEdit {
    return vscode.TextEdit.replace(range, newText);
  }
}
