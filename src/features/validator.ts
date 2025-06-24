import * as vscode from 'vscode';
import { keywordMap } from '../constants/keywords';
import Parser from './parser';

interface ValidationError {
  range: vscode.Range;
  message: string;
  severity: vscode.DiagnosticSeverity;
}

export default class Validator {
  private diagnosticCollection: vscode.DiagnosticCollection;

  private valid = true;

  private static readonly COMMAND_PATTERN = /[^a-zA-Z_]/g;
  private static readonly REGISTER_PATTERN = /^[A-Z]+[0-9]+$/;
  private static readonly VALUE_PATTERN = /^-?\d+(\.\d+)?$/;
  private static readonly TYPE_PATTERN = /^\s*(['"])(use init|use unit)\1\s*$/;

  constructor() {
    this.diagnosticCollection = vscode.languages.createDiagnosticCollection('acspec');
  }

  public isValid(): boolean {
    return this.valid;
  }

  public validate(document: vscode.TextDocument): void {
    const errors: ValidationError[] = [];

    for (let i = 0; i < document.lineCount; i++) {
      const line = document.lineAt(i);
      const lineText = line.text;
      const trimmedText = lineText.trim();

      if (!trimmedText || trimmedText.startsWith('//')) {
        continue;
      }

      errors.push(...this.validateLine(lineText, i));
    }

    this.diagnosticCollection.set(
      document.uri,
      errors.map((error) => new vscode.Diagnostic(error.range, error.message, error.severity))
    );

    this.valid = errors.length === 0;
  }

  private validateLine(lineText: string, lineNumber: number): ValidationError[] {
    const errors: ValidationError[] = [];

    if (Validator.TYPE_PATTERN.test(lineText)) return errors;

    const parseResult = Parser.parseLine(lineText, lineNumber);

    if (parseResult.tokens.length === 0) return errors;

    const commandToken = parseResult.tokens[0];
    const paramTokens = parseResult.tokens.slice(1);

    const command = commandToken.text.toLowerCase().replace(Validator.COMMAND_PATTERN, '');

    // 校验命令
    if (!Object.hasOwn(keywordMap, command)) {
      errors.push({
        range: commandToken.range,
        message: '无效的命令',
        severity: vscode.DiagnosticSeverity.Error
      });
      return errors;
    }

    const params = keywordMap[command as keyof typeof keywordMap].params;

    // 检查参数数量
    if (paramTokens.length < params.length) {
      errors.push({
        range: new vscode.Range(
          new vscode.Position(lineNumber, lineText.length),
          new vscode.Position(lineNumber, lineText.length)
        ),
        message: `缺少参数，需要 ${params.length} 个参数`,
        severity: vscode.DiagnosticSeverity.Error
      });
    }

    // 检查参数类型和空值
    paramTokens.forEach((token, index) => {
      // 多余的参数
      if (index >= params.length) {
        errors.push({
          range: token.range,
          message: '多余的参数',
          severity: vscode.DiagnosticSeverity.Warning
        });
        return;
      }

      const param = params[index];
      const value = token.text;

      // 检查空参数
      if (!value.trim()) {
        errors.push({
          range: token.range,
          message: '参数不能为空',
          severity: vscode.DiagnosticSeverity.Error
        });
        return;
      }

      // 根据参数类型进行校验
      switch (param.type) {
        case 'address':
          if (!Validator.REGISTER_PATTERN.test(value)) {
            errors.push({
              range: token.range,
              message: '格式错误，应为大写字母开头加数字',
              severity: vscode.DiagnosticSeverity.Error
            });
          }
          break;
        case 'time':
        case 'value':
        case 'code':
          if (!Validator.VALUE_PATTERN.test(value)) {
            errors.push({
              range: token.range,
              message: '格式错误，应为数值',
              severity: vscode.DiagnosticSeverity.Error
            });
          }
          break;
      }
    });

    return errors;
  }
}
