// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import MyCompletionItemProvider from './provider/completionItem';
import MyHoverProvider from './provider/hover';
import RegisterManager from './modules/register';
import AlarmManager from './modules/alarm';
import MyDecorator from './features/decorator';
import Validator from './features/validator';
import Formatter from './provider/formatter';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log('Congratulations, your extension "acspec" is now active!');

  vscode.window.showInformationMessage('AcSpec扩展已激活！');

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json

  const registerManager = new RegisterManager(context);
  const alarmManager = new AlarmManager(context);

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

  // 注册校验器事件
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
    })
  );

  // 注册格式化器
  context.subscriptions.push(vscode.languages.registerDocumentFormattingEditProvider('tcs', new Formatter()));

  const decorator = new MyDecorator(registerManager, alarmManager);

  // 首次激活时装饰所有打开的tcs文件
  decorator.update(vscode.window.activeTextEditor);

  // 注册装饰器事件
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      decorator.update(editor);
    }),
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (event.document === vscode.window.activeTextEditor?.document) {
        decorator.update(vscode.window.activeTextEditor);
      }
    })
  );

  // 注册提示补全
  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider('tcs', new MyCompletionItemProvider(registerManager, alarmManager))
  );

  // 注册悬浮提示
  context.subscriptions.push(vscode.languages.registerHoverProvider('tcs', new MyHoverProvider()));

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
}

// This method is called when your extension is deactivated
export function deactivate() {}
