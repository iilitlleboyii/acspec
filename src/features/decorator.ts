import * as vscode from 'vscode';
import RegisterManager from '../modules/register';
import AlarmManager from '../modules/alarm';
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

export default class MyDecorator {
  private decorationType: vscode.TextEditorDecorationType;
  private registerManager: RegisterManager;
  private alarmManager: AlarmManager;
  private registerLibrary: Record<string, any>;
  private alarmLibrary: Record<string, any>;

  constructor(registerManager: RegisterManager, alarmManager: AlarmManager) {
    this.decorationType = vscode.window.createTextEditorDecorationType({
      after: {
        color: '#999999'
      }
    });

    this.registerManager = registerManager;
    this.alarmManager = alarmManager;
    this.registerLibrary = Object.fromEntries(
      Object.entries(this.registerManager.getRegisterLibrary()).map(([key, value]) => [value, key])
    );
    this.alarmLibrary = Object.fromEntries(
      Object.entries(this.alarmManager.getAlarmLibrary()).map(([key, value]) => [value, key])
    );
  }

  private parseCommandAndParams(lineText: string): { command: string, params: string[], paramPositions: number[] } | null {
    const commandMatch = lineText.match(/^\s*(\w+)\s*(.*)/);
    if (!commandMatch) return null;

    const command = commandMatch[1];
    const paramsText = commandMatch[2];
    
    const params: string[] = [];
    const paramPositions: number[] = [];
    
    // 记录每个参数的起始位置
    let currentPos = lineText.indexOf(command) + command.length;
    const paramsList = paramsText.split(',');
    
    for (const param of paramsList) {
      const trimmedParam = param.trim();
      if (trimmedParam) {
        const paramPos = lineText.indexOf(trimmedParam, currentPos);
        if (paramPos !== -1) {
          params.push(trimmedParam);
          paramPositions.push(paramPos);
          currentPos = paramPos + trimmedParam.length;
        }
      }
    }
    
    return { command, params, paramPositions };
  }

  private createDecoration(range: vscode.Range, description: string): vscode.DecorationOptions {
    return {
      range,
      renderOptions: {
        after: {
          contentText: `: ${description}`
        }
      }
    };
  }

  update(editor: vscode.TextEditor | void) {
    if (!editor) return;

    const decorations: vscode.DecorationOptions[] = [];
    const document = editor.document;
    const keywords = keywordMap as KeywordMap;

    for (let i = 0; i < document.lineCount; i++) {
      const lineText = document.lineAt(i).text;
      const parsed = this.parseCommandAndParams(lineText);
      
      if (!parsed || !keywords[parsed.command]) continue;

      const { command, params, paramPositions } = parsed;
      const keyword = keywords[command];

      // 处理每个参数
      keyword.params.forEach((paramDef: ParamDefinition, index: number) => {
        if (index >= params.length) return;

        const param = params[index];
        let description: string | undefined;

        // 根据参数类型添加装饰
        if (paramDef.type === 'address' && paramDef.completer === 'register') {
          description = this.registerLibrary[param];
        } else if (paramDef.type === 'code') {
          description = this.alarmLibrary[param];
        } else if (paramDef.type === 'time') {
          description = '秒';
        }

        if (description) {
          const paramStart = paramPositions[index];
          if (paramStart !== -1) {
            // 检查这个位置是否已经有装饰器
            const existingDecoration = decorations.find(d => 
              d.range.start.line === i && 
              d.range.start.character === paramStart
            );

            if (!existingDecoration) {
              const range = new vscode.Range(
                new vscode.Position(i, paramStart),
                new vscode.Position(i, paramStart + param.length)
              );
              decorations.push(this.createDecoration(range, description));
            }
          }
        }
      });
    }

    editor.setDecorations(this.decorationType, decorations);
  }

  dispose() {
    this.decorationType.dispose();
  }
}
