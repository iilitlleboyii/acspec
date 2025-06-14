import * as vscode from 'vscode';
import { keywordMap } from '../constants/keywords';

export interface ValidationRule {
  validate: (line: string) => vscode.Diagnostic | null;
}

class AddressFormatRule implements ValidationRule {
  validate(line: string): vscode.Diagnostic | null {
    const addressPattern = /(?:write|check|linear_input|check_range|reg_assign|reg_check|watch|unwatch)\s+([^,\s]+)/;
    const match = line.match(addressPattern);
    if (match && match[1]) {
      const address = match[1];
      if (!/^[A-Z0-9]+$/.test(address)) {
        const startPos = line.indexOf(address);
        return {
          severity: vscode.DiagnosticSeverity.Warning,
          range: new vscode.Range(new vscode.Position(0, startPos), new vscode.Position(0, startPos + address.length)),
          message: '地址应该使用大写字母和数字',
          source: 'acspec-validator'
        };
      }
    }
    return null;
  }
}

class KeywordFormatRule implements ValidationRule {
  validate(line: string): vscode.Diagnostic | null {
    // 使用单词边界和排序后的关键字来确保长关键字先匹配
    const sortedKeywords = Object.keys(keywordMap).sort((a, b) => b.length - a.length); // 按长度降序排序
    const keywordPattern = new RegExp(`^(${sortedKeywords.join('|')})\\b`);
    const match = line.match(keywordPattern);

    if (match) {
      const keyword = match[1];
      if (keyword !== keyword.toLowerCase()) {
        return {
          severity: vscode.DiagnosticSeverity.Warning,
          range: new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, keyword.length)),
          message: '关键字应该使用小写',
          source: 'acspec-validator'
        };
      }
    }
    return null;
  }
}

class SpacingRule implements ValidationRule {
  validate(line: string): vscode.Diagnostic | null {
    const sortedKeywords = Object.keys(keywordMap).sort((a, b) => b.length - a.length);
    const commandPattern = new RegExp(`^(${sortedKeywords.join('|')})\\b(\\s*)`);
    const match = line.match(commandPattern);

    if (match) {
      const [, keyword, space] = match;
      if (space.length !== 1) {
        return {
          severity: vscode.DiagnosticSeverity.Warning,
          range: new vscode.Range(
            new vscode.Position(0, keyword.length),
            new vscode.Position(0, keyword.length + space.length)
          ),
          message: '关键字后应该有且仅有一个空格',
          source: 'acspec-validator'
        };
      }
    }
    return null;
  }
}

class CommaFormatRule implements ValidationRule {
  validate(line: string): vscode.Diagnostic | null {
    const commaPattern = /,\s*/g;
    let match;

    while ((match = commaPattern.exec(line)) !== null) {
      if (match[0] !== ', ') {
        return {
          severity: vscode.DiagnosticSeverity.Warning,
          range: new vscode.Range(
            new vscode.Position(0, match.index),
            new vscode.Position(0, match.index + match[0].length)
          ),
          message: '参数之间应使用英文逗号加一个空格分隔',
          source: 'acspec-validator'
        };
      }
    }
    return null;
  }
}

class NumericValueRule implements ValidationRule {
  private commandPatterns = {
    write: /^write\s+[^,]+,\s*([^,\s]+)/,
    delay: /^delay\s+([^,\s]+)/,
    linear_input: /^linear_input\s+[^,]+,\s*([^,\s]+),\s*([^,\s]+),\s*([^,\s]+)/,
    check_alarm: /^check_alarm\s+([^,\s]+)/,
    check_range: /^check_range\s+[^,]+,\s*([^,\s]+),\s*([^,\s]+)/,
    check: /^check\s+[^,]+,\s*([^,\s]+)/,
    watch: /^watch\s+[^,]+,\s*([^,\s]+)$/
  };

  validate(line: string): vscode.Diagnostic | null {
    for (const [command, pattern] of Object.entries(this.commandPatterns)) {
      const match = line.match(pattern);
      if (match) {
        // 跳过第一个元素（完整匹配），检查所有捕获组
        for (let i = 1; i < match.length; i++) {
          const value = match[i];
          if (!this.isValidNumber(value)) {
            const startPos = line.indexOf(value);
            return {
              severity: vscode.DiagnosticSeverity.Warning,
              range: new vscode.Range(
                new vscode.Position(0, startPos),
                new vscode.Position(0, startPos + value.length)
              ),
              message: this.getErrorMessage(command, i),
              source: 'acspec-validator'
            };
          }
        }
      }
    }
    return null;
  }

  private isValidNumber(value: string): boolean {
    // 只支持整数和小数
    return /^-?\d+(\.\d+)?$/.test(value);
  }

  private getErrorMessage(command: string, paramIndex: number): string {
    const paramNames = {
      write: ['值'],
      delay: ['时间'],
      linear_input: ['起始值', '结束值', '时间'],
      check_alarm: ['告警码'],
      check_range: ['最小值', '最大值'],
      check: ['值'],
      watch: ['值']
    };

    const paramName = paramNames[command as keyof typeof paramNames]?.[paramIndex - 1] || '参数';
    return `${paramName}必须是有效的数值（只支持整数或小数）`;
  }
}

class ParameterCountRule implements ValidationRule {
  validate(line: string): vscode.Diagnostic | null {
    const sortedKeywords = Object.keys(keywordMap)
      .sort((a, b) => b.length - a.length);
    const keywordPattern = new RegExp(`^(${sortedKeywords.join('|')})\\b`);
    const match = line.match(keywordPattern);

    if (match) {
      const keyword = match[1];
      const keywordDef = keywordMap[keyword];
      const expectedCount = keywordDef.paramCount;

      // 提取参数部分
      const paramsText = line.slice(match[0].length).trim();
      const params = paramsText ? paramsText.split(',').map(p => p.trim()).filter(p => p) : [];

      // 检查参数个数
      if (params.length !== expectedCount) {
        return {
          severity: vscode.DiagnosticSeverity.Error,
          range: new vscode.Range(
            new vscode.Position(0, 0),
            new vscode.Position(0, line.length)
          ),
          message: `${keyword} 命令需要 ${expectedCount} 个参数，但提供了 ${params.length} 个`,
          source: 'acspec-validator'
        };
      }

      // 检查参数是否为空
      for (let i = 0; i < params.length; i++) {
        if (!params[i]) {
          const before = params.slice(0, i).join(',').length;
          const start = match[0].length + before + (i > 0 ? 1 : 0);
          return {
            severity: vscode.DiagnosticSeverity.Error,
            range: new vscode.Range(
              new vscode.Position(0, start),
              new vscode.Position(0, start + 1)
            ),
            message: '参数不能为空',
            source: 'acspec-validator'
          };
        }
      }
    }
    return null;
  }
}

export default class CodeValidator {
  private rules: ValidationRule[];

  constructor() {
    this.rules = [
      new AddressFormatRule(),
      new KeywordFormatRule(),
      new SpacingRule(),
      new CommaFormatRule(),
      new NumericValueRule(),
      new ParameterCountRule()
    ];
  }

  validateLine(line: string): vscode.Diagnostic[] {
    const diagnostics: vscode.Diagnostic[] = [];

    this.rules.forEach((rule) => {
      const diagnostic = rule.validate(line);
      if (diagnostic) {
        diagnostics.push(diagnostic);
      }
    });

    return diagnostics;
  }
}
