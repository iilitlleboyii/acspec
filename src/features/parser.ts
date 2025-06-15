import * as vscode from 'vscode';

export interface CodeToken {
  type: TokenType;
  text: string;
  range: vscode.Range;
}

export type TokenType = 'command' | 'parameter';

export interface ParseResult {
  tokens: CodeToken[];
}

export default class Parser {
  private static readonly COMMENT_DELIMITER = '//';
  private static readonly PARAM_SEPARATORS = /[,，]/;
  private static readonly WHITESPACE = /\s+/;

  public static removeLineComment(line: string): string {
    const commentStart = line.indexOf(this.COMMENT_DELIMITER);
    return commentStart === -1 ? line.trim() : line.slice(0, commentStart).trim();
  }

  public static parseParams(paramsText: string): string[] {
    return paramsText.split(this.PARAM_SEPARATORS).map((p) => p.trim());
  }

  private static createToken(type: TokenType, text: string, lineNumber: number, startIndex: number): CodeToken {
    return {
      type,
      text,
      range: new vscode.Range(
        new vscode.Position(lineNumber, startIndex),
        new vscode.Position(lineNumber, startIndex + text.length)
      )
    };
  }

  public static parseLine(line: string, lineNumber: number): ParseResult {
    const code = this.removeLineComment(line);
    if (!code) return { tokens: [] };

    const parts = code.split(this.WHITESPACE);
    const command = parts[0];
    if (!command) return { tokens: [] };

    const tokens: CodeToken[] = [];
    const commandStart = line.indexOf(command);

    tokens.push(this.createToken('command', command, lineNumber, commandStart));

    const paramsText = code.slice(command.length).trim();
    if (paramsText) {
      const params = this.parseParams(paramsText);

      let paramStart = commandStart + command.length;
      for (const param of params) {
        paramStart = line.indexOf(param, paramStart);
        if (paramStart !== -1) {
          tokens.push(this.createToken('parameter', param, lineNumber, paramStart));
          paramStart += param.length;
        }
      }
    }

    return { tokens };
  }
}
