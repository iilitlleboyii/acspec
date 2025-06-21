import * as vscode from 'vscode';
import { keywordMap } from '../constants/keywords';
import RegisterManager from '../modules/register';
import AlarmManager from '../modules/alarm';
import ActionManager from '../modules/action';

export default class MyCompletionItemProvider implements vscode.CompletionItemProvider {
  private registerManager: RegisterManager;
  private alarmManager: AlarmManager;
  private actionManager: ActionManager;

  constructor(registerManager: RegisterManager, alarmManager: AlarmManager, actionManager: ActionManager) {
    this.registerManager = registerManager;
    this.alarmManager = alarmManager;
    this.actionManager = actionManager;
  }

  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
    context: vscode.CompletionContext
  ): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList<vscode.CompletionItem>> {
    const line = document.lineAt(position);
    const lineText = line.text;
    const lineRange = line.range;
    const wordRange = document.getWordRangeAtPosition(position) || new vscode.Range(position, position);

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
    const registerItems = Object.entries(registerLibrary).flatMap(([label, config]) => {
      if (Array.isArray(config.options) && config.options.length > 0) {
        const items = config.options.map((option: any) => {
          const item = new vscode.CompletionItem(
            `${label} ${option.title}(${option.value})`,
            vscode.CompletionItemKind.Value
          );
          item.insertText = new vscode.SnippetString(`${config.register}, ${option.value}`);
          item.documentation = new vscode.MarkdownString(
            `寄存器:\n\n${label}: ${config.register}, ${option.title}: ${option.value}`
          );
          item.range = new vscode.Range(wordRange.start, lineRange.end);
          return item;
        });
        return items;
      } else {
        const item = new vscode.CompletionItem(label, vscode.CompletionItemKind.Value);
        item.insertText = new vscode.SnippetString(`${config.register}`);
        item.documentation = new vscode.MarkdownString(`寄存器:\n\n${label}: ${config.register}`);
        return item;
      }
    });

    // 提供中文告警码补全
    const alarmLibrary = this.alarmManager.getAlarmLibrary();
    const alarmItems = Object.entries(alarmLibrary).map(([label, code]) => {
      const item = new vscode.CompletionItem(label, vscode.CompletionItemKind.Class);
      item.insertText = new vscode.SnippetString(`check_alarm ${code}`);
      item.documentation = new vscode.MarkdownString(`告警码:\n\n${label}`);
      item.range = lineRange;
      return item;
    });

    // 提供动作状态码补全
    const actionLibrary = this.actionManager.getActionLibrary();
    const actionItems = Object.entries(actionLibrary).map(([label, code]) => {
      const item = new vscode.CompletionItem(label, vscode.CompletionItemKind.Interface);
      item.insertText = new vscode.SnippetString(`check_action ${code}`);
      item.documentation = new vscode.MarkdownString(`动作状态码:\n\n${label}`);
      item.range = lineRange;
      return item;
    });

    return [...keywordItems, ...registerItems, ...alarmItems, ...actionItems];
  }

  resolveCompletionItem?(
    item: vscode.CompletionItem,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.CompletionItem> {
    return item;
  }
}
