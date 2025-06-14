import * as vscode from 'vscode';
import fs from 'node:fs';
import path from 'node:path';

export default class RegisterManager {
  private context: vscode.ExtensionContext;

  private currentLibrary: string | undefined;
  private libraries: string[];
  private storageDir: string;
  private registerLibrary: Record<string, any>;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;

    // 设置寄存器库存储路径
    this.storageDir = path.join(context.globalStorageUri.fsPath, 'RegisterLibraries');
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }

    // 读取所有寄存器库
    const files = fs.readdirSync(this.storageDir);
    const jsonFiles = files.filter((file) => path.extname(file).toLowerCase() === '.json');
    this.libraries = jsonFiles.map((file) => path.basename(file).replace('.json', ''));

    // 设置当前寄存器库名
    this.setCurrentLibrary();

    this.registerLibrary = {};
  }

  private setCurrentLibrary() {
    const registerLibrary = vscode.workspace.getConfiguration('acspec').get('registerLibrary') as string;
    if (registerLibrary && this.libraries.includes(registerLibrary.trim())) {
      this.currentLibrary = registerLibrary.trim();
    } else {
      this.currentLibrary = this.libraries.at(0);
    }
  }

  getRegisterLibrary() {
    return this.registerLibrary;
  }

  // 加载寄存器库
  async loadRegisterLibrary() {
    if (!this.currentLibrary) {
      vscode.window.showErrorMessage('加载寄存器库失败：找不到可用的寄存器库！');
      return;
    }

    const libraryName = this.currentLibrary;
    const libraryPath = path.join(this.storageDir, `${libraryName}.json`);
    if (!libraryPath || !fs.existsSync(libraryPath)) {
      vscode.window.showErrorMessage('加载寄存器库失败：指定寄存器库不存在！');
      return;
    }

    await vscode.workspace.getConfiguration('acspec').update('registerLibrary', this.currentLibrary, true);

    const content = fs.readFileSync(libraryPath, 'utf8');
    this.registerLibrary = JSON.parse(content);
  }

  // 切换寄存器库
  async switchRegisterLibrary() {
    if (this.libraries.length === 0) {
      vscode.window.showWarningMessage('加载寄存器库失败：请尝试更新寄存器库！');
      return;
    }

    const selected = await vscode.window.showQuickPick(this.libraries, {
      placeHolder: '请选择寄存器库'
    });

    if (selected) {
      this.currentLibrary = selected;

      await this.loadRegisterLibrary();
      vscode.window.showInformationMessage(`加载寄存器库成功：已切换到寄存器库${selected}`);
    }
  }

  // 更新寄存器库
  async updateLibraries() {
    const registerUrl = vscode.workspace.getConfiguration('acspec').get('registerUrl') as string;
    if (!registerUrl) {
      vscode.window.showErrorMessage('更新寄存器库失败：请设置合法的远程下载地址！');
      return;
    }

    const response = await fetch(registerUrl);
    if (!response.ok) {
      vscode.window.showErrorMessage('更新寄存器库失败：请求远程下载地址时出错！');
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
      vscode.window.showWarningMessage('更新寄存器库失败：未找到有效的寄存器库文件！');
      return;
    }

    const successFiles: any[] = [];
    const failedFiles: any[] = [];

    const downloadResults = await Promise.allSettled(
      files.map(async (file) => {
        const fileUrl = `${registerUrl}/${file}`;
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

    const successFileNames: string[] = [];
    successFiles.forEach(({ file, data }) => {
      const fileName = path.basename(file);
      const filePath = path.join(this.storageDir, fileName);

      successFileNames.push(fileName.replace('.json', ''));
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    });

    // 合并云端和本地寄存器库
    this.libraries = [...new Set(this.libraries.concat(successFileNames))];

    // 更新完成后重新加载寄存器库
    this.setCurrentLibrary();
    await this.loadRegisterLibrary();

    if (failedFiles.length === 0) {
      vscode.window.showInformationMessage(
        `更新寄存器库成功：已更新${successFiles.length}个文件，共${this.libraries.length}个文件！`
      );
    } else {
      vscode.window.showWarningMessage(
        `更新寄存器库完成：已更新${successFiles.length}个文件，共${this.libraries.length}个文件！`
      );
    }
  }
}
