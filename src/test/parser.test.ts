import * as assert from 'assert';
import * as vscode from 'vscode';
import Parser from '../features/parser';

suite('Parser Test Suite', () => {
  // 代码提取
  test('removeLineComment', () => {
    assert.strictEqual(Parser.removeLineComment('write M0100, 1 // 复位开'), 'write M0100, 1');
    assert.strictEqual(Parser.removeLineComment('// write M0100, 1 // 复位开'), '');
  });
});
