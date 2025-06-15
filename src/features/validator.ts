import * as vscode from 'vscode';
import { keywordMap } from '../constants/keywords';
import { Parser } from './parser';

interface ValidationError {
  range: vscode.Range;
  message: string;
  severity: vscode.DiagnosticSeverity;
}

interface ParamDefinition {
  type: string;
  placeholder: string;
  completer?: string;
}

interface KeywordDefinition {
  title: string;
  document: string;
  snippet: string;
  params: ParamDefinition[];
}

type KeywordMap = {
  [key: string]: KeywordDefinition;
};

export default class Validator {
  private diagnosticCollection: vscode.DiagnosticCollection;
  private keywords: KeywordMap;

  constructor() {
    this.diagnosticCollection = vscode.languages.createDiagnosticCollection('acspec');
    this.keywords = keywordMap as KeywordMap;
  }

  /**
   * 校验整个文档
   */
  public validate(document: vscode.TextDocument): void {
    const errors: ValidationError[] = [];

    for (let i = 0; i < document.lineCount; i++) {
      const line = document.lineAt(i);
      const lineText = line.text;
      const trimmedText = lineText.trim();

      // 跳过空行和注释行
      if (!trimmedText || trimmedText.startsWith('//') || trimmedText.startsWith('/*')) {
        continue;
      }

      const lineErrors = this.validateLine(lineText, i);
      errors.push(...lineErrors);
    }

    // 更新诊断信息
    this.diagnosticCollection.set(
      document.uri,
      errors.map((error) => new vscode.Diagnostic(error.range, error.message, error.severity))
    );
  }

  /**
   * 校验单行代码
   */
  private validateLine(lineText: string, lineNumber: number): ValidationError[] {
    const errors: ValidationError[] = [];
    const parseResult = Parser.parseLine(lineText, lineNumber);

    if (!parseResult.tokens.length) return errors;

    const commandToken = parseResult.tokens[0];
    const paramTokens = parseResult.tokens.slice(1);

    // 校验命令
    if (!Object.hasOwn(this.keywords, commandToken.text.toLowerCase())) {
      errors.push({
        range: commandToken.range,
        message: '无效的命令',
        severity: vscode.DiagnosticSeverity.Error
      });
      return errors;
    }

    // 校验参数
    const keyword = this.keywords[commandToken.text.toLowerCase()];
    const params = keyword.params;

    // 检查逗号和参数的匹配
    const commaCount = lineText.slice(commandToken.range.end.character).split(',').length - 1;
    if (commaCount > 0) {
      if (paramTokens.length < commaCount + 1) {
        errors.push({
          range: new vscode.Range(
            new vscode.Position(lineNumber, lineText.length),
            new vscode.Position(lineNumber, lineText.length)
          ),
          message: `逗号数量与参数不匹配，缺少参数`,
          severity: vscode.DiagnosticSeverity.Error
        });
      } else if (paramTokens.length > commaCount + 1) {
        const extraParamToken = paramTokens[commaCount + 1];
        errors.push({
          range: extraParamToken.range,
          message: `逗号数量与参数不匹配，参数过多`,
          severity: vscode.DiagnosticSeverity.Error
        });
      }
    }

    // 检查参数数量和类型
    paramTokens.forEach((token, index) => {
      if (index >= params.length) {
        errors.push({
          range: token.range,
          message: '多余的参数',
          severity: vscode.DiagnosticSeverity.Warning
        });
        return;
      }      const param = params[index];
      const value = token.text;      // 检查空参数
      if (!value) {
        errors.push({
          range: new vscode.Range(
            new vscode.Position(lineNumber, lineText.indexOf(',', commandToken.range.end.character) + 1),
            new vscode.Position(lineNumber, lineText.indexOf(',', commandToken.range.end.character) + 1)
          ),
          message: '参数不能为空',
          severity: vscode.DiagnosticSeverity.Error
        });
        return;
      }

      // 根据参数类型进行校验
      switch (param.type.toLowerCase()) {
        case 'address':
          if (!/^[A-Z][0-9]+$/.test(value)) {
            errors.push({
              range: token.range,
              message: '地址格式错误，应为大写字母开头加数字',
              severity: vscode.DiagnosticSeverity.Error
            });
          }
          break;
        case 'time':
        case 'value':
        case 'code':
          if (!/^-?\d+$/.test(value)) {
            errors.push({
              range: token.range,
              message: '需要是数值',
              severity: vscode.DiagnosticSeverity.Error
            });
          }
          break;
      }
    });

    // 检查必需参数是否缺失
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

    return errors;
  }
}
