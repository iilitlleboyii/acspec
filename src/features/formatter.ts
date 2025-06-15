import * as vscode from 'vscode';
import { keywordMap } from '../constants/keywords';

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

export default class Formatter implements vscode.DocumentFormattingEditProvider {
  private keywords: KeywordMap;

  constructor() {
    this.keywords = keywordMap as KeywordMap;
  }

  provideDocumentFormattingEdits(
    document: vscode.TextDocument,
    options: vscode.FormattingOptions
  ): vscode.TextEdit[] {
    const edits: vscode.TextEdit[] = [];

    for (let i = 0; i < document.lineCount; i++) {
      const line = document.lineAt(i);
      const lineText = line.text.trim();

      if (!lineText || lineText.startsWith('//')) {
        // 处理空行和注释行的缩进
        if (line.text !== lineText) {
          edits.push(vscode.TextEdit.replace(line.range, lineText));
        }
        continue;
      }

      const formattedLine = this.formatLine(lineText);
      if (formattedLine !== line.text) {
        edits.push(vscode.TextEdit.replace(line.range, formattedLine));
      }
    }

    return edits;
  }

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
    return formattedParams.length > 0 
      ? `${command} ${formattedParams.join(', ')}`
      : command;
  }

  private parseParams(paramsText: string): string[] {
    return paramsText.split(',')
      .map(p => p.trim())
      .filter(p => p.length > 0);
  }
}
