import * as vscode from 'vscode';
import { AddFile, AddRule, ChangeBrowser, EditRules, ResetCapture, Rule, StartCapture, StopCapture, ViewRules } from './commands';
import { homedir } from 'os';
import { RULES_FILE_NAME } from './constants';
import { getSlash, isValidRule } from './utils';
const exec = require('child_process').exec;

export function activate(context: vscode.ExtensionContext) {
	const startCapture = vscode.commands.registerCommand('code-responder.startCapture', async () => {		
		await StartCapture(context, exec)();
	});

	const stopCapture = vscode.commands.registerCommand('code-responder.stopCapture', StopCapture());

	const changeBrowser = vscode.commands.registerCommand('code-responder.changeBrowser',
		ChangeBrowser(context, vscode.window.showQuickPick));

	const addRule = vscode.commands.registerCommand('code-responder.addRule', async () => {
		let rules: Array<Rule> = context.globalState.get('rules') || [];
		rules = await AddRule(rules, vscode.window.showInputBox)();
		await context.globalState.update('rules', rules);

		await ResetCapture(rules);
	});

	const editRules = vscode.commands.registerCommand('code-responder.editRules', EditRules(context));

	const viewRules = vscode.commands.registerCommand('code-responder.viewRules', async () => {
		await ViewRules(context, vscode.window.createQuickPick)();
	});

	const addFile = vscode.commands.registerCommand('code-responder.addFile', async (fileUri: vscode.Uri) => {
		let rules: Array<Rule> = context.globalState.get('rules') || [];
		rules = await AddFile(vscode.window.showInputBox, rules, fileUri)();
		await context.globalState.update('rules', rules);

		await ResetCapture(rules);

		vscode.window.showInformationMessage(`Rule for file ${fileUri.fsPath} added successfully`);
	});

	context.subscriptions.push(startCapture, changeBrowser, stopCapture, addRule, editRules, viewRules, addFile);

	return context;
}

export function deactivate() {
	StopCapture()();
}
