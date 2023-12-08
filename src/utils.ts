import * as vscode from 'vscode';
import { Rule } from './commands';

export const deleteQuickPickItem = (item: vscode.QuickPickItem, rules: Array<Rule>, options: Array<vscode.QuickPickItem>, quickPick: vscode.QuickPick<vscode.QuickPickItem>): Array<Rule> => {
    options = options.filter(option => option !== item);
    rules = rules.filter(rule => `Request: ${rule.request} File: ${rule.filePath}` !== item.label);
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

export const isValidRule = (rule: string): boolean => {
    const line = rule.split(':');
    const request = line[0];
    const filePath = line[1];

    try {
        if (request && filePath) {
            new RegExp(request);
            return true;
        }
    } catch (e) {
        return false;
    }

    return false;
};

export const getSlash = (): string => {
    return process.platform === 'win32' ? '\\' : '/';
};