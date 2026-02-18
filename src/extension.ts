import * as vscode from 'vscode';
import * as cp from 'child_process';
import { GitGraphViewProvider } from './gitGraphView';
import { BranchTreeProvider, BranchTreeItem } from './branchTreeProvider';

export function activate(context: vscode.ExtensionContext) {
    const provider = new GitGraphViewProvider(context.extensionUri);
    const branchTreeProvider = new BranchTreeProvider();

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(GitGraphViewProvider.viewType, provider)
    );

    const branchTreeView = vscode.window.createTreeView('gitPlusBranchView', {
        treeDataProvider: branchTreeProvider
    });

    branchTreeView.onDidChangeSelection(e => {
        const selected = e.selection[0] as BranchTreeItem | undefined;
        if (selected && (selected.contextValue === 'local-branch' || selected.contextValue === 'remote-branch')) {
            provider.filterByBranch(selected.branchName || null);
        } else {
            provider.filterByBranch(null);
        }
    });

    context.subscriptions.push(branchTreeView);

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
        vscode.commands.registerCommand('git-plus.checkoutBranch', async (item: any) => {
            const branchName = typeof item === 'string' ? item : item.branchName;
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

    context.subscriptions.push(
        vscode.commands.registerCommand('git-plus.createBranch', async (branchTreeItem: any) => {
            const sourceBranch = branchTreeItem.branchName;

            const newBranchName = await vscode.window.showInputBox({
                prompt: `Create new branch from '${sourceBranch}'`,
                placeHolder: 'New branch name',
                validateInput: value => {
                    if (!value || !value.trim()) { return 'Branch name cannot be empty'; }
                    if (/[\s~^:?*\[\\]|\.\./.test(value)) { return 'Invalid branch name'; }
                    return null;
                }
            });

            if (!newBranchName) { return; }

            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) { return; }

            const cwd = workspaceFolders[0].uri.fsPath;
            cp.exec(`git checkout -b ${newBranchName} ${sourceBranch}`, { cwd }, (error, stdout, stderr) => {
                if (error) {
                    vscode.window.showErrorMessage(`Failed to create branch: ${stderr || error.message}`);
                    return;
                }
                vscode.window.showInformationMessage(`Created and switched to branch '${newBranchName}'`);
                branchTreeProvider.refresh();
            });
        })
    );
}

export function deactivate() {}
