import * as mockttp from 'mockttp';
import * as vscode from 'vscode';
import { deleteQuickPickItem, getSlash, registerRules } from './utils';
import { BROWSER_OPTIONS, DEFAULT_BROWSER, RULES_FILE_NAME } from './constants';
import { homedir } from 'os';
import { onEditListener, onEditorCloseListener } from './listeners';

export type Rule = { request: string, filePath: string };

let server: mockttp.Mockttp;

export const StartCapture = (context: vscode.ExtensionContext,
    exec: (command: string, callback: (error: any, stdout: any, stderr: any) => void) => void): () => Promise<void> => {

    return async () => {
        const rules: Array<Rule> = context.globalState.get('rules') || [];
		const browser: string = context.globalState.get('browser') || DEFAULT_BROWSER;
		const port: number = vscode.workspace.getConfiguration().get('coderesponder.proxyPort') || 8000;
        const profileDestination = vscode.workspace.getConfiguration().get('coderesponder.profileDestination') 
            || 'c:\\\\code-responder-profile';

        try {
            const https = await mockttp.generateCACertificate();
            server = mockttp.getLocal({ https });

            registerRules(rules, server);

            await server.start(port);

            const caFingerprint = mockttp.generateSPKIFingerprint(https.cert);
            vscode.window.showInformationMessage(`Server running on port ${server.port}`);
            vscode.window.showInformationMessage(`Opening ${browser} with proxy settings`);            

            exec(`start ${browser === "Edge" ? "msedge" : "chrome"} --proxy-server="localhost:${server.port}" --ignore-certificate-errors-spki-list=${caFingerprint} --user-data-dir="${profileDestination}-${browser}"`,

                function callback(error: any, stdout: any, stderr: any) {
                    vscode.window.showInformationMessage(stdout);
                    vscode.window.showErrorMessage(stderr);
                });
        } catch (e) {
            vscode.window.showErrorMessage((e as any).message);
        }
    };
};

export const ResetCapture = async (rules: Array<Rule>) => {
    if (server) {
        await server.reset();
        registerRules(rules, server);
    }
};

export const StopCapture = (): () => void => {
    return async () => {
        if (server) {
            try {
                await server.stop();
                vscode.window.showInformationMessage('Server stopped');
            } catch (e) {
                vscode.window.showErrorMessage((e as any).message);
            }
        } else {
            vscode.window.showInformationMessage('Server not running');
        }
    };
};

export const ChangeBrowser = (context: vscode.ExtensionContext,
    showQuickPick: (items: string[], options?: vscode.QuickPickOptions) => Thenable<string | undefined>): () => void => {

    return async () => {
        const browser: string = context.globalState.get('browser') || DEFAULT_BROWSER;
        const options: vscode.QuickPickOptions = {
            placeHolder: 'Select a browser',
            canPickMany: false
        };

        showQuickPick(BROWSER_OPTIONS.filter(x => x !== browser), options).then(async (newBrowser: string | undefined) => {
            context.globalState.update('browser', newBrowser);
        });
    };
};

export const AddRule = (rules: Array<Rule>,
    showInputBox: (requestOptions: vscode.InputBoxOptions) => Thenable<string | undefined>): () => Promise<Array<Rule>> => {

    return async () => {
        const requestOptions: vscode.InputBoxOptions = {
            prompt: 'Enter the request you want to match',
            placeHolder: 'e.g. \\/index\\.js$'
        };

        const request = await showInputBox(requestOptions);

        const pathOptions: vscode.InputBoxOptions = {
            prompt: 'Enter the file path',
            placeHolder: 'e.g. c:\\\\Users\\username\\Desktop\\index.js'
        };

        const path = await showInputBox(pathOptions);
        const rule = { request: request || '', filePath: path || '' };

        try {
            if (rule.request && rule.filePath) {
                new RegExp(rule.request);
            } else {
                vscode.window.showErrorMessage('Request and file path are required');
                return rules;
            }
        } catch (e) {
            vscode.window.showErrorMessage('Invalid regular expression');
            return rules;
        }

        if (!rules.find(x => x.request === rule.request && x.filePath === rule.filePath)) {
            rules.push(rule);
            vscode.window.showInformationMessage(`Rule for ${rule.request} added successfully`);
        } else {
            vscode.window.showErrorMessage('Rule already exists');
        }

        return rules;
    };
};

export const EditRules = (context: vscode.ExtensionContext): () => void => {
    return async () => {
        const rules: Array<Rule> = context.globalState.get('rules') || [];
		const wsedit = new vscode.WorkspaceEdit();
		const slash = getSlash();
		const filePath = vscode.Uri.file(`${homedir()}${slash}.vscode${slash}${RULES_FILE_NAME}`);
		wsedit.createFile(filePath, { overwrite: true });
		wsedit.insert(filePath, new vscode.Position(0, 0), rules.map(rule => `${rule.request} ${rule.filePath}`).join('\n'));
		await vscode.workspace.applyEdit(wsedit);

        const disposable = onEditListener(context);
		vscode.workspace.openTextDocument(filePath).then(doc => {
			vscode.window.showTextDocument(doc).then(editor => {                
				onEditorCloseListener(filePath, disposable);
			});
		});
    };
};

export const ViewRules = (context: vscode.ExtensionContext,
    createQuickPick: () => vscode.QuickPick<vscode.QuickPickItem>): () => vscode.QuickPick<vscode.QuickPickItem> => {

    return () => {
        let rules: Array<Rule> = context.globalState.get('rules') || [];
        let options: Array<vscode.QuickPickItem> = rules.map(rule => {
            return {
                label: `Request: ${rule.request} File: ${rule.filePath}`,
                value: rule.filePath,
                buttons: [{ iconPath: new vscode.ThemeIcon('trash'), tooltip: 'Delete rule' }],
                
            };
        });

        const quickPick = createQuickPick();
        quickPick.items = options;

        quickPick.onDidTriggerItemButton(async ({ button, item }) => {
            rules = deleteQuickPickItem(item, rules, options, quickPick);
            await context.globalState.update('rules', rules);
            ResetCapture(rules);
            quickPick.hide();
        });

        quickPick.show();
        return quickPick;
    };
};

export const AddFile = (showInputBox: (requestOptions: vscode.InputBoxOptions) => Thenable<string | undefined>,
    rules: Array<Rule>, fileUri: vscode.Uri): () => Promise<Array<Rule>> => {

    return async () => {
        const requestOptions: vscode.InputBoxOptions = {
            prompt: 'Enter the request you want to match',
            placeHolder: 'e.g. \\/index\\.js$'
        };

        const request = await showInputBox(requestOptions);

        try {
            if (request) {
                new RegExp(request);
            } else {
                vscode.window.showErrorMessage('Request is required');
                return rules;
            }
        } catch (e) {
            vscode.window.showErrorMessage('Invalid regular expression');
            return rules;
        }

        rules.push({ request: request || '', filePath: fileUri.fsPath || '' });

        return rules;
    };
};
