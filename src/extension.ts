import * as vscode from 'vscode';
import { GitGraphViewProvider } from './gitGraphView';

export function activate(context: vscode.ExtensionContext) {
    const provider = new GitGraphViewProvider(context.extensionUri);

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(GitGraphViewProvider.viewType, provider)
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('git-plus.showGraph', () => {
            GitGraphViewProvider.createOrShow(context.extensionUri);
        })
    );
}

export function deactivate() {}
