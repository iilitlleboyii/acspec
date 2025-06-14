import * as vscode from 'vscode';
import { keywordMap } from '../constants/keywords';

export default class MyHoverProvider implements vscode.HoverProvider {
  provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.Hover> {
    const wordRange = document.getWordRangeAtPosition(position);
    const word = document.getText(wordRange);
    if (Object.hasOwn(keywordMap, word)) {
      return new vscode.Hover(keywordMap[word as keyof typeof keywordMap].document);
    }
  }
}
