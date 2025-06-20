import * as vscode from 'vscode';
import RegisterManager from '../modules/register';
import AlarmManager from '../modules/alarm';
import ActionManager from '../modules/action';
import { keywordMap } from '../constants/keywords';
import Parser from './parser';

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

export default class MyDecorator {
  private decorationType: vscode.TextEditorDecorationType;

  private registerManager: RegisterManager;
  private registerLibrary: Record<string, any>;

  private alarmManager: AlarmManager;
  private alarmLibrary: Record<string, any>;

  private actionManager: ActionManager;
  private actionLibrary: Record<string, any>;

  constructor(registerManager: RegisterManager, alarmManager: AlarmManager, actionManager: ActionManager) {
    this.decorationType = vscode.window.createTextEditorDecorationType({
      after: {
        color: '#999999'
      }
    });

    this.registerManager = registerManager;
    this.registerLibrary = Object.fromEntries(
      Object.entries(this.registerManager.getRegisterLibrary()).map(([key, config]) => [
        config.register,
        { ...config, label: key }
      ])
    );

    this.alarmManager = alarmManager;
    this.alarmLibrary = Object.fromEntries(
      Object.entries(this.alarmManager.getAlarmLibrary()).map(([key, value]) => [value, key])
    );

    this.actionManager = actionManager;
    this.actionLibrary = Object.fromEntries(
      Object.entries(this.actionManager.getActionLibrary()).map(([key, value]) => [value, key])
    );
  }

  private createDecoration(range: vscode.Range, description: string): vscode.DecorationOptions {
    return {
      range,
      renderOptions: {
        after: {
          contentText: `:${description}`
        }
      }
    };
  }

  update(editor: vscode.TextEditor | undefined) {
    if (!editor) return;

    const decorations: vscode.DecorationOptions[] = [];
    const document = editor.document;
    const keywords = keywordMap as KeywordMap;

    for (let i = 0; i < document.lineCount; i++) {
      const lineText = document.lineAt(i).text;
      const trimmedText = lineText.trim();

      // 跳过空行和注释行
      if (!trimmedText || trimmedText.startsWith('//') || trimmedText.startsWith('/*')) {
        continue;
      }

      const parseResult = Parser.parseLine(lineText, i);
      if (!parseResult.tokens.length) continue;

      const commandToken = parseResult.tokens[0];
      const paramTokens = parseResult.tokens.slice(1);

      const command = commandToken.text.toLowerCase().replace(/[^a-zA-Z_]/g, '');

      // 检查命令是否有效
      if (!Object.hasOwn(keywords, command)) continue;

      const keyword = keywords[command];

      // 为每个参数添加装饰
      paramTokens.forEach((token, index) => {
        if (index >= keyword.params.length) return;

        const param = keyword.params[index];
        const value = token.text;

        // 跳过空参数
        if (!value || !value.trim()) {
          return;
        }

        let description = '';

        // 根据参数类型和completer添加描述
        switch (param.type.toLowerCase()) {
          case 'address':
            if (param.completer === 'register') {
              const config = this.registerLibrary[value];
              description = config?.label?.replace(/\(.*$/, '') || '未知寄存器';
            }
            break;
          case 'value':
            if (command === 'write' && paramTokens.length === 2) {
              const config = this.registerLibrary[paramTokens[0].text];
              description = config?.options?.find((option: any) => option.value === String(value))?.title || '';
            }
            break;
          case 'code':
            if (param.completer === 'alarm') {
              description = '告警【' + (this.alarmLibrary[value]?.replace(/\(.*$/, '') || '未知告警码') + '】';
            } else if (param.completer === 'action') {
              description = '动作状态【' + (this.actionLibrary[value]?.replace(/\(.*$/, '') || '未知动作状态') + '】';
            }
            break;
          case 'time':
            description = '秒';
            break;
        }

        if (description) {
          decorations.push(this.createDecoration(token.range, description));
        }
      });
    }

    editor.setDecorations(this.decorationType, decorations);
  }

  dispose() {
    this.decorationType.dispose();
  }
}
