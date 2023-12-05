import * as vscode from 'vscode';
import { Rule } from './commands';

export const deleteQuickPickItem = (item: vscode.QuickPickItem, rules: Array<Rule>, options: Array<vscode.QuickPickItem>, quickPick: vscode.QuickPick<vscode.QuickPickItem>): Array<Rule> => {
    options = options.filter(option => option !== item);
    rules = rules.filter(rule => `${rule.request}: ${rule.filePath}` !== item.label);
    quickPick.items = options;
    return rules;
};

export const registerRules = (rules: Array<Rule>, server: any): void => {
    server.forAnyRequest()
        .thenPassThrough();

    rules.forEach((rule: Rule) => {
        if (rule.request && rule.filePath) {
            server.forGet(new RegExp(rule.request)).thenFromFile(200, rule.filePath);
        }
    });
};