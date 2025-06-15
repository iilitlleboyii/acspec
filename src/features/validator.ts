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

      if (!lineText.trim()) continue;

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
    if (paramTokens.length > keyword.params.length) {
      for (let i = keyword.params.length; i < paramTokens.length; i++) {
        errors.push({
          range: paramTokens[i].range,
          message: '多余的参数',
          severity: vscode.DiagnosticSeverity.Warning
        });
      }
    }

    return errors;
  }
}
