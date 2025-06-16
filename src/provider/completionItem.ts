import * as vscode from 'vscode';
import { keywordMap } from '../constants/keywords';
import RegisterManager from '../modules/register';
import AlarmManager from '../modules/alarm';

export default class MyCompletionItemProvider implements vscode.CompletionItemProvider {
  private registerManager: RegisterManager;
  private alarmManager: AlarmManager;

  constructor(registerManager: RegisterManager, alarmManager: AlarmManager) {
    this.registerManager = registerManager;
    this.alarmManager = alarmManager;
  }

  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
    context: vscode.CompletionContext
  ): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList<vscode.CompletionItem>> {
    const lineText = document.lineAt(position).text;

    // 输入注释时不提供代码补全
    const commentIdx = lineText.indexOf('//');
    if (commentIdx >= 0 && position.character > commentIdx) return;

    // 提供关键字补全
    const keywordItems = Object.entries(keywordMap).map(([keyword, option]) => {
      const item = new vscode.CompletionItem(keyword, vscode.CompletionItemKind.Keyword);
      item.insertText = new vscode.SnippetString(option.snippet);
      item.documentation = new vscode.MarkdownString(option.document);
      return item;
    });

    // 提供中文寄存器补全
    const registerLibrary = this.registerManager.getRegisterLibrary();
    const registerItems = Object.entries(registerLibrary).map(([label, address]) => {
      const item = new vscode.CompletionItem(label, vscode.CompletionItemKind.Value);
      item.insertText = new vscode.SnippetString(address);
      item.documentation = new vscode.MarkdownString(`${label}: ${address}`);
      return item;
    });

    // 提供中文告警码补全
    const alarmLibrary = this.alarmManager.getAlarmLibrary();
    console.log('@alarmLibrary 🚀🚀🚀~ ', alarmLibrary)
    const alarmItems = Object.entries(alarmLibrary).map(([label, code]) => {
      const item = new vscode.CompletionItem(label, vscode.CompletionItemKind.Constant);
      item.insertText = new vscode.SnippetString(code);
      item.documentation = new vscode.MarkdownString(`${label}`);
      return item;
    });

    return [...keywordItems, ...registerItems, ...alarmItems];
  }

  resolveCompletionItem?(
    item: vscode.CompletionItem,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.CompletionItem> {
    return item;
  }
}
