// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import path from 'node:path';
import fs from 'node:fs';
import MyCompletionItemProvider from './provider/completionItem';
import MyHoverProvider from './provider/hover';
import RegisterManager from './modules/register';
import AlarmManager from './modules/alarm';
import ActionManager from './modules/action';
import MyDecorator from './features/decorator';
import Validator from './features/validator';
import Formatter from './provider/formatter';

let panel: vscode.WebviewPanel | undefined;

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log('Congratulations, your extension "acspec" is now active!');

  // vscode.window.showInformationMessage('AcSpec扩展已激活！');

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json

  const registerManager = new RegisterManager(context);
  const alarmManager = new AlarmManager(context);
  const actionManager = new ActionManager(context);

  const autoUpdate = vscode.workspace.getConfiguration('acspec').get('autoUpdate');
  if (autoUpdate) {
    await Promise.all([registerManager.updateLibraries(), alarmManager.updateLibraries()]);
  } else {
    await Promise.all([registerManager.loadRegisterLibrary(), alarmManager.loadAlarmLibrary()]);
  }

  const validator = new Validator();

  // 首次激活时校验所有打开的tcs文件
  vscode.workspace.textDocuments.forEach((document) => {
    if (document.languageId === 'tcs') {
      validator.validate(document);
    }
  });

  // 注册文档监听事件
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument((document) => {
      if (document.languageId === 'tcs') {
        validator.validate(document);
      }
    }),
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (event.document.languageId === 'tcs') {
        validator.validate(event.document);
      }
    }),
    vscode.workspace.onDidSaveTextDocument((document) => {
      if (document.languageId === 'tcs') {
        const isValid = validator.isValid();
        if (panel && isValid) {
          const content = document.getText();
          panel.webview.postMessage({
            type: 'document',
            content: content,
            path: document.uri.fsPath,
            timestamp: new Date().toISOString()
          });
        }
      }
    })
  );

  // 注册格式化器
  context.subscriptions.push(vscode.languages.registerDocumentFormattingEditProvider('tcs', new Formatter()));

  const decorator = new MyDecorator(registerManager, alarmManager, actionManager);

  // 首次激活时装饰所有打开的tcs文件
  vscode.window.visibleTextEditors.forEach((editor) => {
    if (editor.document.languageId === 'tcs') {
      decorator.update(editor);
    }
  });

  // 注册装饰器事件
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor?.document.languageId === 'tcs') {
        decorator.update(editor);
      }
    }),
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (event.document === vscode.window.activeTextEditor?.document && event.document.languageId === 'tcs') {
        decorator.update(vscode.window.activeTextEditor);
      }
    })
  );

  // 注册提示补全
  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      'tcs',
      new MyCompletionItemProvider(registerManager, alarmManager, actionManager)
    )
  );

  // 注册悬浮提示
  context.subscriptions.push(vscode.languages.registerHoverProvider('tcs', new MyHoverProvider()));

  // 注册设备通信配置命令
  context.subscriptions.push(
    vscode.commands.registerCommand('acspec.equipmentCommunicationConfig', async () => {
      const terminal = await vscode.window.showInputBox({
        title: '终端名字',
        placeHolder: '请输入终端名字',
        prompt: '终端名字与工具的相同',
        ignoreFocusOut: true
      });

      if (!terminal) return;

      await vscode.workspace
        .getConfiguration('acspec')
        .update('equipmentCommunicationConfig', { host: '192.168.11.10', terminal: terminal }, true);

      vscode.window.showInformationMessage('设备通信配置: 保存成功！');

      if (!panel) {
        vscode.commands.executeCommand('acspec.openDebugPanel');
      } else {
        panel.webview.postMessage({
          type: 'config',
          host: vscode.workspace.getConfiguration('acspec').get('equipmentCommunicationConfig.host') as string,
          terminal: vscode.workspace.getConfiguration('acspec').get('equipmentCommunicationConfig.terminal') as string
        });
      }
    })
  );

  // 注册更新寄存器库命令
  context.subscriptions.push(
    vscode.commands.registerCommand('acspec.updateRegisterLibraries', async () => {
      await registerManager.updateLibraries();
    })
  );

  // 注册切换寄存器库的命令
  context.subscriptions.push(
    vscode.commands.registerCommand('acspec.switchRegisterLibrary', async () => {
      await registerManager.switchRegisterLibrary();
    })
  );

  // 注册更新告警码库命令
  context.subscriptions.push(
    vscode.commands.registerCommand('acspec.updateAlarmLibraries', async () => {
      await alarmManager.updateLibraries();
    })
  );

  // 注册切换告警码库的命令
  context.subscriptions.push(
    vscode.commands.registerCommand('acspec.switchAlarmLibrary', async () => {
      await alarmManager.switchAlarmLibrary();
    })
  );

  // 注册打开调试面板的命令
  context.subscriptions.push(
    vscode.commands.registerCommand('acspec.openDebugPanel', () => {
      if (!panel) {
        panel = vscode.window.createWebviewPanel('acspec-debug', 'AcSpec调试面板', vscode.ViewColumn.Two, {
          enableScripts: true,
          localResourceRoots: [vscode.Uri.file(context.extensionPath)],
          retainContextWhenHidden: true
        });

        panel.onDidDispose(() => (panel = undefined));
      } else {
        panel.reveal();
      }

      const url = vscode.workspace.getConfiguration('acspec').get('debugPanelUrl') as string;

      if (!url) {
        vscode.window.showErrorMessage('加载调试面板失败：远程调试地址请求出错！');
        return;
      }

      panel.webview.html = getWebviewContent(context, url);

      // 监听 Webview 的消息
      panel.webview.onDidReceiveMessage((message) => {
        if (message.type === 'goto-line') {
          moveCursorToLine(message.line, message.path);
        }
        if (message.type === 'webview-loaded') {
          panel!.webview.postMessage({
            type: 'config',
            host: vscode.workspace.getConfiguration('acspec').get('equipmentCommunicationConfig.host') as string,
            terminal: vscode.workspace.getConfiguration('acspec').get('equipmentCommunicationConfig.terminal') as string
          });
        }
      });

      // 生成 Webview HTML（带 CSP 放宽）
      function getWebviewContent(context: vscode.ExtensionContext, url: string): string {
        const templatePath = path.join(context.extensionPath, '/src/templates/debug-panel.html');
        const template = fs.readFileSync(templatePath, 'utf-8');
        return template.replace('{{src}}', url);
      }

      // 移动光标到指定行并选中
      async function moveCursorToLine(lineNumber: number, filePath: string) {
        const editors = vscode.window.visibleTextEditors;

        if (editors.length === 0) return;

        const acspecEditors = editors.find(
          (editor) => editor.document.languageId === 'tcs' && editor.document.uri.fsPath === filePath
        );

        if (!acspecEditors) return;

        const targetEditor = acspecEditors;

        // 激活目标编辑器
        await vscode.window.showTextDocument(targetEditor.document, {
          viewColumn: targetEditor.viewColumn,
          preserveFocus: true
        });

        const line = Math.max(0, lineNumber - 1);
        const lineText = targetEditor.document.lineAt(line).text;

        const startPosition = new vscode.Position(line, 0);
        const endPosition = new vscode.Position(line, lineText.length);

        // 移动光标
        targetEditor.selection = new vscode.Selection(endPosition, endPosition);

        const decorationType = vscode.window.createTextEditorDecorationType({
          backgroundColor: 'transparent',
          border: '1px solid #FF0000',
          borderRadius: '2px',
          overviewRulerColor: 'rgba(255,0,0,0.8)',
          overviewRulerLane: vscode.OverviewRulerLane.Full
        });
        // 装饰范围
        const decoration = {
          range: new vscode.Range(startPosition, endPosition)
        };
        // 应用装饰
        targetEditor.setDecorations(decorationType, [decoration]);

        // 滚动到选中的行
        targetEditor.revealRange(targetEditor.selection, vscode.TextEditorRevealType.InCenter);

        // 1秒后自动清除装饰
        setTimeout(() => {
          decorationType.dispose();
        }, 1000);
      }
    })
  );
}

// This method is called when your extension is deactivated
export function deactivate() {}
