import * as vscode from 'vscode';

export interface CodeToken {
  type: 'command' | 'parameter';
  text: string;
  range: vscode.Range;
}

export interface ParseResult {
  tokens: CodeToken[];
}

export class Parser {
  /**
   * 解析单行代码
   * @param line 行文本
   * @param lineNumber 行号
   * @returns 解析结果，包含命令和参数的标记
   */
  public static parseLine(line: string, lineNumber: number): ParseResult {
    const code = Parser.removeLineComment(line);
    if (!code) {
      return { tokens: [] };
    }

    const tokens: CodeToken[] = [];
    const parts = code.split(/\s+/);
    if (parts.length === 0) {
      return { tokens: [] };
    }

    // 解析命令
    const command = parts[0];
    let currentPosition = line.indexOf(command);
    tokens.push({
      type: 'command',
      text: command,
      range: new vscode.Range(
        new vscode.Position(lineNumber, currentPosition),
        new vscode.Position(lineNumber, currentPosition + command.length)
      )
    });

    // 解析参数部分
    const paramsText = code.substring(command.length).trim();
    if (paramsText) {
      const params = Parser.parseParams(paramsText);
      let paramStart = currentPosition + command.length;
      for (const param of params) {
        // 找到参数在原始文本中的位置
        paramStart = line.indexOf(param, paramStart);
        if (paramStart !== -1) {
          tokens.push({
            type: 'parameter',
            text: param,
            range: new vscode.Range(
              new vscode.Position(lineNumber, paramStart),
              new vscode.Position(lineNumber, paramStart + param.length)
            )
          });
          paramStart += param.length;
        }
      }
    }

    return { tokens };
  }

  /**
   * 移除行尾注释
   */
  private static removeLineComment(line: string): string {
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

    return commentStart >= 0 ? line.substring(0, commentStart).trim() : line.trim();
  }
  /**
   * 解析参数列表
   * 使用逗号分隔参数
   */
  private static parseParams(paramsText: string): string[] {
    return paramsText.split(',').map(p => p.trim());
  }
}
