import * as vscode from 'vscode';
import { keywordMap } from '../constants/keywords';

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
      const lineText = line.text.trim();

      if (!lineText || lineText.startsWith('//')) continue;

      const lineErrors = this.validateLine(lineText, i);
      errors.push(...lineErrors);
    }

    // 更新诊断信息
    this.diagnosticCollection.set(document.uri, errors.map(error => new vscode.Diagnostic(
      error.range,
      error.message,
      error.severity
    )));
  }

  /**
   * 格式化文档
   */
  public format(document: vscode.TextDocument): vscode.TextEdit[] {
    const edits: vscode.TextEdit[] = [];

    for (let i = 0; i < document.lineCount; i++) {
      const line = document.lineAt(i);
      const lineText = line.text.trim();

      if (!lineText || lineText.startsWith('//')) continue;

      const formattedLine = this.formatLine(lineText);
      if (formattedLine !== lineText) {
        edits.push(vscode.TextEdit.replace(line.range, formattedLine));
      }
    }

    return edits;
  }

  /**
   * 校验单行代码
   */
  private validateLine(lineText: string, lineNumber: number): ValidationError[] {
    const errors: ValidationError[] = [];
    const parts = lineText.split(/\s+/);
    const command = parts[0];

    // 校验关键字
    if (!this.keywords[command.toLowerCase()]) {
      errors.push({
        range: new vscode.Range(
          new vscode.Position(lineNumber, 0),
          new vscode.Position(lineNumber, command.length)
        ),
        message: '无效的命令',
        severity: vscode.DiagnosticSeverity.Error
      });
      return errors;
    }

    // 校验关键字大小写
    if (command !== command.toLowerCase()) {
      errors.push({
        range: new vscode.Range(
          new vscode.Position(lineNumber, 0),
          new vscode.Position(lineNumber, command.length)
        ),
        message: '命令必须使用小写',
        severity: vscode.DiagnosticSeverity.Error
      });
    }

    // 获取参数
    const params = this.parseParams(lineText.substring(command.length).trim());
    const keyword = this.keywords[command.toLowerCase()];

    // 校验参数数量
    if (params.length < keyword.params.length) {
      errors.push({
        range: new vscode.Range(
          new vscode.Position(lineNumber, 0),
          new vscode.Position(lineNumber, lineText.length)
        ),
        message: `缺少参数，需要 ${keyword.params.length} 个参数`,
        severity: vscode.DiagnosticSeverity.Error
      });
      return errors;
    }

    // 校验每个参数
    let currentPos = command.length;
    params.forEach((param, index) => {
      if (index >= keyword.params.length) return;

      const paramDef = keyword.params[index];
      const paramStartPos = lineText.indexOf(param, currentPos);
      currentPos = paramStartPos + param.length;

      const paramRange = new vscode.Range(
        new vscode.Position(lineNumber, paramStartPos),
        new vscode.Position(lineNumber, paramStartPos + param.length)
      );

      // 校验地址格式
      if (paramDef.type === 'address') {
        if (!this.validateAddress(param)) {
          errors.push({
            range: paramRange,
            message: '地址格式错误，应为大写字母加数字（如M0100）',
            severity: vscode.DiagnosticSeverity.Error
          });
        } else if (param !== param.toUpperCase()) {
          errors.push({
            range: paramRange,
            message: '地址必须使用大写字母',
            severity: vscode.DiagnosticSeverity.Error
          });
        }
      }

      // 校验数值类型
      if (['time', 'value', 'code'].includes(paramDef.type)) {
        if (!this.validateNumber(param)) {
          errors.push({
            range: paramRange,
            message: '必须是有效的数值',
            severity: vscode.DiagnosticSeverity.Error
          });
        }
      }
    });

    return errors;
  }

  /**
   * 格式化单行代码
   */
  private formatLine(lineText: string): string {
    const parts = lineText.split(/\s+/);
    const command = parts[0].toLowerCase();
    
    if (!this.keywords[command]) return lineText;

    const params = this.parseParams(lineText.substring(parts[0].length).trim());
    const keyword = this.keywords[command];

    // 格式化参数
    const formattedParams = params.map((param, index) => {
      if (index >= keyword.params.length) return param;

      const paramDef = keyword.params[index];
      if (paramDef.type === 'address') {
        return param.toUpperCase();
      }
      return param;
    });

    // 组合成格式化后的行
    return `${command} ${formattedParams.join(', ')}`;
  }

  /**
   * 解析参数
   */
  private parseParams(paramsText: string): string[] {
    return paramsText.split(',')
      .map(p => p.trim())
      .filter(p => p.length > 0);
  }

  /**
   * 验证地址格式
   */
  private validateAddress(address: string): boolean {
    return /^[A-Z]\d+$/.test(address);
  }

  /**
   * 验证数值
   */
  private validateNumber(value: string): boolean {
    return /^-?\d*\.?\d+$/.test(value);
  }

  /**
   * 清除诊断信息
   */
  public clear(): void {
    this.diagnosticCollection.clear();
  }

  /**
   * 释放资源
   */
  public dispose(): void {
    this.diagnosticCollection.dispose();
  }
}