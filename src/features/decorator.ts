import * as vscode from 'vscode';
import RegisterManager from '../modules/register';
import AlarmManager from '../modules/alarm';

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

  update(editor: vscode.TextEditor | void) {
    if (!editor) return;

    const decorations: vscode.DecorationOptions[] = [];
    const document = editor.document;

    for (let i = 0; i < document.lineCount; i++) {
      const lineText = document.lineAt(i).text;

      // 匹配寄存器地址的装饰
      const regMatches = lineText.match(
        /\b(write|check|linear_input|reg_assign|reg_check|watch|unwatch)\s+([A-Z]\d+)/i
      );

      if (regMatches) {
        const reg = regMatches[2];
        const desc = this.registerLibrary[reg];

        if (desc) {
          const startPos = lineText.indexOf(reg);
          const range = new vscode.Range(
            new vscode.Position(i, startPos),
            new vscode.Position(i, startPos + reg.length)
          );

          decorations.push({
            range,
            renderOptions: {
              after: {
                contentText: `: ${desc}`
              }
            }
          });
        }
      }

      // 匹配告警码的装饰
      const alarmMatches = lineText.match(/\b(check_alarm)\s+(\d+)/i);
      if (alarmMatches) {
        const alarmCode = alarmMatches[2];
        const desc = this.alarmLibrary[alarmCode];

        if (desc) {
          const startPos = lineText.indexOf(alarmCode);
          const range = new vscode.Range(
            new vscode.Position(i, startPos),
            new vscode.Position(i, startPos + alarmCode.length)
          );

          decorations.push({
            range,
            renderOptions: {
              after: {
                contentText: `: ${desc}`
              }
            }
          });
        }
      }

      // 匹配时间值的装饰
      const timeMatches = [
        ...lineText.matchAll(/\b(delay)\s+(\d+(\.\d+)?)\b/g),
        ...lineText.matchAll(/\b(linear_input)\s+[^,]+,\s*[^,]+,\s*[^,]+,\s*(\d+(\.\d+)?)\b/g)
      ];

      for (const match of timeMatches) {
        const [, command, time] = match;
        const startPos = lineText.indexOf(time, lineText.indexOf(command));
        if (startPos !== -1) {
          const range = new vscode.Range(
            new vscode.Position(i, startPos),
            new vscode.Position(i, startPos + time.length)
          );

          decorations.push({
            range,
            renderOptions: {
              after: {
                contentText: ' 秒'
              }
            }
          });
        }
      }
    }

    editor.setDecorations(this.decorationType, decorations);
  }

  dispose() {
    this.decorationType.dispose();
  }
}
