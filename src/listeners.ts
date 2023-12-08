import * as vscode from 'vscode';
import { Rule } from './commands';
import { isValidRule } from './utils';
import { RULES_FILE_NAME } from './constants';

export const onEditListener = (context: vscode.ExtensionContext): () => void => {
    return () => {
        vscode.workspace.onDidChangeTextDocument(e => {
            e.document.save();
            const rules: Array<Rule> = e.document.getText().split(/\r?\n/).filter(isValidRule).map(rule => {
                const line = rule.split(' ');
                const request = line[0];
                const filePath = line[1].replace(/\r?\n/, '');
    
                return { request, filePath };
            });
    
            context.globalState.update('rules', rules);
        });
    };    
};

export const onEditorCloseListener = (uri: vscode.Uri, onDispose: () => void) => {
    const changeVisabilityDisposable = vscode.window.onDidChangeVisibleTextEditors(event => {
        const hasRulesFileOpen = event.some(editor =>
            editor.document.fileName.includes(RULES_FILE_NAME)
        );
        if (hasRulesFileOpen) {
            return;
        }
        deleteRulesFile();
    });

    const closedDocumentDisposable = vscode.workspace.onDidCloseTextDocument(doc => {
        if (!doc.fileName.includes(RULES_FILE_NAME)) {
            return;
        }
        deleteRulesFile();
    });

    function deleteRulesFile() {
        vscode.workspace.fs.delete(uri);
        closedDocumentDisposable.dispose();
        changeVisabilityDisposable.dispose();
        onDispose();        
    }
};
