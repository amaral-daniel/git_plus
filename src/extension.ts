import * as vscode from 'vscode';
import * as cp from 'child_process';
import { GitGraphViewProvider } from './gitGraphView';
import { BranchTreeProvider } from './branchTreeProvider';

export function activate(context: vscode.ExtensionContext) {
    const provider = new GitGraphViewProvider(context.extensionUri);
    const branchTreeProvider = new BranchTreeProvider();

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(GitGraphViewProvider.viewType, provider)
    );

    context.subscriptions.push(
        vscode.window.registerTreeDataProvider('gitPlusBranchView', branchTreeProvider)
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

    context.subscriptions.push(
        vscode.commands.registerCommand('git-plus.checkoutBranch', async (branchName: string) => {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) {
                return;
            }

            const cwd = workspaceFolders[0].uri.fsPath;
            cp.exec(`git checkout ${branchName}`, { cwd }, (error, stdout, stderr) => {
                if (error) {
                    vscode.window.showErrorMessage(`Failed to checkout branch: ${error.message}`);
                    return;
                }
                vscode.window.showInformationMessage(`Switched to branch '${branchName}'`);
                branchTreeProvider.refresh();
            });
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('git-plus.deleteBranch', async (branchTreeItem: any) => {
            const branchName = branchTreeItem.branchName;
            const confirm = await vscode.window.showWarningMessage(
                `Are you sure you want to delete branch '${branchName}'?`,
                'Yes', 'No'
            );

            if (confirm !== 'Yes') {
                return;
            }

            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) {
                return;
            }

            const cwd = workspaceFolders[0].uri.fsPath;
            cp.exec(`git branch -d ${branchName}`, { cwd }, (error, stdout, stderr) => {
                if (error) {
                    vscode.window.showErrorMessage(`Failed to delete branch: ${error.message}\n${stderr}`);
                    return;
                }
                vscode.window.showInformationMessage(`Deleted branch '${branchName}'`);
                branchTreeProvider.refresh();
            });
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('git-plus.refreshBranches', () => {
            branchTreeProvider.refresh();
        })
    );
}

export function deactivate() {}
