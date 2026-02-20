import * as vscode from 'vscode';
import * as cp from 'child_process';
import { GitGraphViewProvider } from './gitGraphView';
import { BranchTreeProvider, BranchTreeItem } from './branchTreeProvider';

export function activate(context: vscode.ExtensionContext) {
    const provider = new GitGraphViewProvider(context.extensionUri);
    const branchTreeProvider = new BranchTreeProvider();

    context.subscriptions.push(vscode.window.registerWebviewViewProvider(GitGraphViewProvider.viewType, provider));

    const branchTreeView = vscode.window.createTreeView('gitLeanBranchView', {
        treeDataProvider: branchTreeProvider,
    });

    branchTreeView.onDidChangeSelection((e) => {
        const selected = e.selection[0] as BranchTreeItem | undefined;
        if (selected && (selected.contextValue === 'local-branch' || selected.contextValue === 'remote-branch')) {
            provider.filterByBranch(selected.branchName || null);
        } else {
            provider.filterByBranch(null);
        }
    });

    context.subscriptions.push(branchTreeView);

    context.subscriptions.push(
        vscode.commands.registerCommand('git-lean.showGraph', () => {
            GitGraphViewProvider.createOrShow(context.extensionUri);
        }),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('git-lean.editCommitMessage', (commitHash: string) => {
            provider.editCommitMessage(commitHash);
        }),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('git-lean.cherryPick', (commitHash: string) => {
            provider.cherryPickCommit(commitHash);
        }),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('git-lean.copyHash', (commitHash: string) => {
            provider.copyCommitHash(commitHash);
        }),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('git-lean.revertCommit', (commitHash: string) => {
            provider.revertCommit(commitHash);
        }),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('git-lean.resetToCommit', (commitHash: string) => {
            provider.resetToCommit(commitHash);
        }),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('git-lean.checkoutBranch', async (item: any) => {
            const branchName = typeof item === 'string' ? item : item.branchName;
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) {
                return;
            }

            const cwd = workspaceFolders[0].uri.fsPath;
            cp.execFile('git', ['checkout', branchName], { cwd }, (error, _stdout, _stderr) => {
                if (error) {
                    vscode.window.showErrorMessage(`Failed to checkout branch: ${error.message}`);
                    return;
                }
                vscode.window.showInformationMessage(`Switched to branch '${branchName}'`);
                branchTreeProvider.refresh();
            });
        }),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('git-lean.deleteBranch', async (branchTreeItem: any) => {
            const branchName = branchTreeItem.branchName;
            const confirm = await vscode.window.showWarningMessage(
                `Are you sure you want to delete branch '${branchName}'?`,
                'Yes',
                'No',
            );

            if (confirm !== 'Yes') {
                return;
            }

            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) {
                return;
            }

            const cwd = workspaceFolders[0].uri.fsPath;
            cp.execFile('git', ['branch', '-d', branchName], { cwd }, (error, _stdout, stderr) => {
                if (error) {
                    vscode.window.showErrorMessage(`Failed to delete branch: ${error.message}\n${stderr}`);
                    return;
                }
                vscode.window.showInformationMessage(`Deleted branch '${branchName}'`);
                branchTreeProvider.refresh();
            });
        }),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('git-lean.refreshBranches', () => {
            branchTreeProvider.refresh();
        }),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('git-lean.rebaseBranch', async (branchTreeItem: any) => {
            const targetBranch = branchTreeItem.branchName;

            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) {
                return;
            }
            const cwd = workspaceFolders[0].uri.fsPath;

            cp.execFile('git', ['rebase', targetBranch], { cwd }, (error, _stdout, stderr) => {
                if (error) {
                    cp.execFile('git', ['rebase', '--abort'], { cwd }, () => {});
                    vscode.window.showErrorMessage(`Rebase failed: ${stderr || error.message}`);
                    return;
                }
                vscode.window.showInformationMessage(`Rebased onto '${targetBranch}' successfully`);
                branchTreeProvider.refresh();
            });
        }),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('git-lean.mergeBranch', async (branchTreeItem: any) => {
            const sourceBranch = branchTreeItem.branchName;

            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) {
                return;
            }
            const cwd = workspaceFolders[0].uri.fsPath;

            cp.execFile('git', ['merge', sourceBranch], { cwd }, (error, _stdout, stderr) => {
                if (error) {
                    vscode.window.showErrorMessage(`Merge failed: ${stderr || error.message}`);
                    return;
                }
                vscode.window.showInformationMessage(`Merged '${sourceBranch}' successfully`);
                branchTreeProvider.refresh();
            });
        }),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('git-lean.createBranch', async (branchTreeItem: any) => {
            const sourceBranch = branchTreeItem.branchName;

            const newBranchName = await vscode.window.showInputBox({
                prompt: `Create new branch from '${sourceBranch}'`,
                placeHolder: 'New branch name',
                validateInput: (value) => {
                    if (!value || !value.trim()) {
                        return 'Branch name cannot be empty';
                    }
                    if (/[\s~^:?*\[\\]|\.\./.test(value)) {
                        return 'Invalid branch name';
                    }
                    return null;
                },
            });

            if (!newBranchName) {
                return;
            }

            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) {
                return;
            }

            const cwd = workspaceFolders[0].uri.fsPath;
            cp.execFile('git', ['checkout', '-b', newBranchName, sourceBranch], { cwd }, (error, _stdout, stderr) => {
                if (error) {
                    vscode.window.showErrorMessage(`Failed to create branch: ${stderr || error.message}`);
                    return;
                }
                vscode.window.showInformationMessage(`Created and switched to branch '${newBranchName}'`);
                branchTreeProvider.refresh();
            });
        }),
    );
}

export function deactivate() {}
