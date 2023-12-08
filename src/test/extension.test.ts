import * as assert from 'assert';
import * as vscode from 'vscode';
import { AddFile, AddRule, ChangeBrowser, Rule, ViewRules } from '../commands';
import { deleteQuickPickItem } from '../utils';

let context: vscode.ExtensionContext;

const stub = {
	showInputBox: (requestOptions: vscode.InputBoxOptions) => {
		return new Promise<string | undefined>((resolve, reject) => {
			resolve('\\/index\\.js$');
		});
	},
	showInputBoxFail: (requestOptions: vscode.InputBoxOptions) => {
		return new Promise<string | undefined>((resolve, reject) => {
			resolve('*/index.js');
		});
	},	
	updateBrowser: (key: string, value: string | undefined) => {
		return new Promise<void>((resolve, reject) => {
			
			resolve();
		});
	},
	createQuickPick: () => {
		const quickPick = vscode.window.createQuickPick();
		quickPick.show = () => { };
		return quickPick;
	},
	showQuickPick: (options: Array<string>) => {
		return new Promise<string | undefined>((resolve, reject) => {
			resolve('Chrome');
		});
	}	
};

suite('Extension Test Suite', () => {
	suiteSetup(async () => {
		const ext = vscode.extensions.getExtension('kevinamick.code-responder');
		context = await ext?.activate();
	});

	test('Change browser should update the browser in global context', async () => {
		await ChangeBrowser(context, stub.showQuickPick)();
		assert.equal(context.globalState.get('browser'), 'Chrome');
	});

	test('Add rule should add the rule to global context', async () => {
		let rules: Array<Rule> = [];
		rules = await AddRule(rules, stub.showInputBox)();
		assert.equal(rules.length, 1);
		assert.equal(`${rules[0].request}:${rules[0].filePath}`, '\\/index\\.js$:\\/index\\.js$');
	});

	test('Add rule should not create rule with invalid regular expression', async () => {
		let rules: Array<Rule> = [];
		rules = await AddRule(rules, stub.showInputBoxFail)();
		assert.equal(rules.length, 0);		
	});

	test('View rules should show a quick pick with all rules', async () => {	
		context.globalState.update('rules', [{ request: '*/index.js', filePath: 'test' }]);	
		const quickPick = ViewRules(context, stub.createQuickPick)();
		assert.equal(quickPick.items.length, 1);
		assert.equal(quickPick.items[0].label, '*/index.js: test');
	});

	test('View rules should remove a rule when the delete button is clicked', async () => {
		let rules = [{ request: '*/index.js', filePath: 'test' }];
		context.globalState.update('rules', rules);

		let options: Array<vscode.QuickPickItem> = rules.map(rule => {
			return {
				label: `${rule.request}: ${rule.filePath}`,
				value: rule.filePath,
				buttons: [{ iconPath: new vscode.ThemeIcon('trash'), tooltip: 'Delete rule' }],
			};
		});

		const quickPick = ViewRules(context, stub.createQuickPick)();
		rules = deleteQuickPickItem(quickPick.items[0], rules, options, quickPick);
		assert.equal(rules.length, 0);
	});

	test('Add file should add a rule for selected file', async () => {
		const rules = await AddFile(stub.showInputBox, [], vscode.Uri.file('test'))();
		assert.equal(rules.length, 1);

		if(process.platform === 'linux' || process.platform === 'darwin') {
			assert.equal(`${rules[0].request}:${rules[0].filePath}`, '\\/index\\.js$:/test');
		} else {
			assert.equal(`${rules[0].request}:${rules[0].filePath}`, '\\/index\\.js$:\\test');
		}		
	});
});