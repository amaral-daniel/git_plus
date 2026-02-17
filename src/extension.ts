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

    context.subscriptions.push(
        vscode.commands.registerCommand('git-plus.editCommitMessage', (commitHash: string) => {
            provider.editCommitMessage(commitHash);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('git-plus.cherryPick', (commitHash: string) => {
            provider.cherryPickCommit(commitHash);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('git-plus.copyHash', (commitHash: string) => {
            provider.copyCommitHash(commitHash);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('git-plus.revertCommit', (commitHash: string) => {
            provider.revertCommit(commitHash);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('git-plus.resetToCommit', (commitHash: string) => {
            provider.resetToCommit(commitHash);
        })
    );
}

export function deactivate() {}
