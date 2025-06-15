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

  /**
   * 从一行文本中分离代码和注释
   */
  private separateCodeAndComment(line: string): { code: string; comment: string } {
    const singleLineComment = line.indexOf('//');
    const multiLineComment = line.indexOf('/*');
    
    let commentStart = -1;
    if (singleLineComment >= 0 && multiLineComment >= 0) {
      commentStart = Math.min(singleLineComment, multiLineComment);
    } else if (singleLineComment >= 0) {
      commentStart = singleLineComment;
    } else if (multiLineComment >= 0) {
      commentStart = multiLineComment;
    }

    if (commentStart >= 0) {
      return {
        code: line.substring(0, commentStart).trim(),
        comment: line.substring(commentStart)
      };
    }

    return {
      code: line.trim(),
      comment: ''
    };
  }

  provideDocumentFormattingEdits(
    document: vscode.TextDocument,
    options: vscode.FormattingOptions
  ): vscode.TextEdit[] {
    const edits: vscode.TextEdit[] = [];

    for (let i = 0; i < document.lineCount; i++) {
      const line = document.lineAt(i);
      const lineText = line.text;

      if (!lineText.trim() || lineText.trim().startsWith('//')) {
        // 处理空行和注释行
        if (line.text !== lineText.trim()) {
          edits.push(vscode.TextEdit.replace(line.range, lineText.trim()));
        }
        continue;
      }

      const { code, comment } = this.separateCodeAndComment(lineText);
      const formattedCode = this.formatCode(code);
      const formattedLine = comment ? `${formattedCode} ${comment}` : formattedCode;

      if (formattedLine !== line.text) {
        edits.push(vscode.TextEdit.replace(line.range, formattedLine));
      }
    }

    return edits;
  }

  private formatCode(codeText: string): string {
    const parts = codeText.split(/\s+/);
    const command = parts[0].toLowerCase();
    
    if (!this.keywords[command]) return codeText;

    const params = this.parseParams(codeText.substring(parts[0].length).trim());
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
    const { code } = this.separateCodeAndComment(paramsText);
    return code
      .split(',')
      .map(p => p.trim())
      .filter(p => p.length > 0);
  }
}
