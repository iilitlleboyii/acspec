import * as vscode from 'vscode';
import { keywordMap } from '../constants/keywords';
import Parser, { type ParseResult } from '../features/parser';

export default class Formatter implements vscode.DocumentFormattingEditProvider {
  provideDocumentFormattingEdits(document: vscode.TextDocument, options: vscode.FormattingOptions): vscode.TextEdit[] {
    const edits: vscode.TextEdit[] = [];

    for (let i = 0; i < document.lineCount; i++) {
      const line = document.lineAt(i);
      const lineText = line.text;
      const trimmedText = lineText.trim();

      if (!trimmedText) {
        // 处理空行
        if (line.text !== '') {
          edits.push(vscode.TextEdit.replace(line.range, ''));
        }
        continue;
      }

      // 如果是纯注释行，保持原样
      if (trimmedText.startsWith('//')) {
        if (line.text !== trimmedText) {
          edits.push(vscode.TextEdit.replace(line.range, trimmedText));
        }
        continue;
      }

      const parseResult = Parser.parseLine(lineText, i);
      if (parseResult.tokens.length === 0) {
        // 空行或纯注释行，不做处理
        continue;
      }

      // 提取注释部分
      const commentMatch = lineText.match(/\/[/*].*$/);
      const comment = commentMatch ? commentMatch[0] : '';

      // 格式化代码部分
      const formattedCode = this.formatTokens(parseResult);

      // 组合最终格式化结果
      const formattedLine = comment ? `${formattedCode} ${comment}` : formattedCode;

      if (formattedLine !== line.text) {
        edits.push(vscode.TextEdit.replace(line.range, formattedLine));
      }
    }

    return edits;
  }

  private formatTokens(parseResult: ParseResult): string {
    if (parseResult.tokens.length === 0) return '';

    const commandToken = parseResult.tokens[0];
    const paramTokens = parseResult.tokens.slice(1);

    // 如果是无效命令，保持原始格式
    if (!Object.hasOwn(keywordMap, commandToken.text.toLowerCase())) {
      return (
        commandToken.text + (paramTokens.length > 0 ? ' ' + paramTokens.map((token) => token.text).join(', ') : '')
      );
    }

    const params = keywordMap[commandToken.text.toLowerCase() as keyof typeof keywordMap].params;
    let formatted = commandToken.text;

    if (paramTokens.length > 0) {
      formatted +=
        ' ' +
        paramTokens
          .map((token, index) => {
            // 如果是地址类型参数，转为大写
            if (index < params.length && params[index].type === 'address') {
              return token.text.toUpperCase();
            }
            return token.text;
          })
          .join(', ');
    }

    return formatted;
  }
}
