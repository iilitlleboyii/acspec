import * as vscode from 'vscode';
import fs from 'node:fs';
import path from 'node:path';

export default class ActionManager {
  private context: vscode.ExtensionContext;

  private storageDir: string;
  private actionLibrary: Record<string, any>;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;

    // 设置动作库存储路径
    this.storageDir = path.join(context.globalStorageUri.fsPath, 'ActionLibraries');
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }

    this.actionLibrary = {};

    this.loadActionLibrary();
  }

  getActionLibrary() {
    return this.actionLibrary;
  }

  async loadActionLibrary() {
    // 先更新动作库
    await this.updateLibraries();

    const files = fs.readdirSync(this.storageDir);
    const jsonFiles = files.filter((file) => path.extname(file).toLowerCase() === '.json');
    this.actionLibrary = jsonFiles.reduce((acc, file) => {
      const filePath = path.join(this.storageDir, file);
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      for (const [key, value] of Object.entries(data)) {
        acc[key] = value;
      }
      return acc;
    }, {} as Record<string, any>);
  }

  // 更新动作库，实际只有1个文件
  async updateLibraries() {
    const actionUrl = vscode.workspace.getConfiguration('acspec').get('actionUrl') as string;
    if (!actionUrl) {
      vscode.window.showErrorMessage('更新动作库失败：请设置合法的远程下载地址！');
      return;
    }

    const response = await fetch(actionUrl);
    if (!response.ok) {
      vscode.window.showErrorMessage('更新动作库失败：请求远程下载地址时出错！');
      return;
    }

    const text = await response.text();

    const files: string[] = [];
    const fileRegex = /<a href="([^"]+)">/g;

    let match;
    while ((match = fileRegex.exec(text)) !== null) {
      // 只收集JSON文件且排除父目录链接
      if (!match[1].startsWith('../') && match[1].endsWith('.json')) {
        files.push(match[1]);
      }
    }

    if (files.length === 0) {
      vscode.window.showWarningMessage('更新动作库失败：未找到有效的动作库文件！');
      return;
    }

    const successFiles: any[] = [];
    const failedFiles: any[] = [];

    const downloadResults = await Promise.allSettled(
      files.map(async (file) => {
        const fileUrl = `${actionUrl}/${file}`;
        const fileResponse = await fetch(fileUrl);

        if (!fileResponse.ok) {
          return { file, success: false, error: `HTTP ${fileResponse.status}` };
        }

        const fileData = await fileResponse.json();
        return { file, data: fileData, success: true };
      })
    );

    downloadResults.forEach((result) => {
      if (result.status === 'fulfilled') {
        const { success, file, data, error } = result.value;
        if (success) {
          successFiles.push({ file, data });
        } else {
          failedFiles.push({ file, error });
        }
      } else {
        // 如果 Promise 本身 reject（比如网络错误），则记录错误
        failedFiles.push({ file: result.reason.file, error: result.reason.error });
      }
    });

    successFiles.forEach(({ file, data }) => {
      const fileName = path.basename(file);
      const filePath = path.join(this.storageDir, fileName);

      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    });

    if (failedFiles.length === 0) {
      vscode.window.showInformationMessage(`更新动作库成功：已更新${successFiles.length}个文件`);
    } else {
      vscode.window.showWarningMessage(`更新动作库完成：已更新${successFiles.length}个文件`);
    }
  }
}
