import * as vscode from 'vscode';
import * as cp from 'child_process';
import { GitGraphViewProvider } from './gitGraphView';
import { BranchWebviewProvider } from './branchWebviewProvider';

export function activate(context: vscode.ExtensionContext) {
    const graphProvider = new GitGraphViewProvider(context.extensionUri);
    const branchProvider = new BranchWebviewProvider(context.extensionUri);

    context.subscriptions.push(vscode.window.registerWebviewViewProvider(GitGraphViewProvider.viewType, graphProvider));
    context.subscriptions.push(vscode.window.registerWebviewViewProvider(BranchWebviewProvider.viewType, branchProvider));

    branchProvider.onBranchSelected = (branch) => graphProvider.filterByBranch(branch);

    context.subscriptions.push(
        vscode.commands.registerCommand('git-lean.showGraph', () => {
            GitGraphViewProvider.createOrShow(context.extensionUri);
        }),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('git-lean.editCommitMessage', (commitHash: string) => {
            graphProvider.editCommitMessage(commitHash);
        }),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('git-lean.cherryPick', (commitHash: string) => {
            graphProvider.cherryPickCommit(commitHash);
        }),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('git-lean.copyHash', (commitHash: string) => {
            graphProvider.copyCommitHash(commitHash);
        }),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('git-lean.revertCommit', (commitHash: string) => {
            graphProvider.revertCommit(commitHash);
        }),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('git-lean.resetToCommit', (commitHash: string) => {
            graphProvider.resetToCommit(commitHash);
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
                branchProvider.refresh();
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
            cp.execFile('git', ['branch', '-d', branchName], { cwd }, async (error, _stdout, stderr) => {
                if (error) {
                    if (stderr.includes('not fully merged')) {
                        const forceConfirm = await vscode.window.showWarningMessage(
                            `Branch '${branchName}' is not fully merged. Force delete anyway?`,
                            'Force Delete',
                            'Cancel',
                        );
                        if (forceConfirm !== 'Force Delete') {
                            return;
                        }
                        cp.execFile('git', ['branch', '-D', branchName], { cwd }, (err2, _stdout2, stderr2) => {
                            if (err2) {
                                vscode.window.showErrorMessage(`Failed to delete branch: ${err2.message}\n${stderr2}`);
                                return;
                            }
                            vscode.window.showInformationMessage(`Deleted branch '${branchName}'`);
                            branchProvider.refresh();
                        });
                        return;
                    }
                    vscode.window.showErrorMessage(`Failed to delete branch: ${error.message}\n${stderr}`);
                    return;
                }
                vscode.window.showInformationMessage(`Deleted branch '${branchName}'`);
                branchProvider.refresh();
            });
        }),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('git-lean.refreshBranches', () => {
            branchProvider.refresh();
        }),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('git-lean.pull', () => {
            const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            if (!cwd) {
                return;
            }
            cp.execFile('git', ['pull'], { cwd }, (error, _stdout, stderr) => {
                if (error) {
                    vscode.window.showErrorMessage(`Pull failed: ${stderr || error.message}`);
                    return;
                }
                vscode.window.showInformationMessage('Pull successful');
                branchProvider.refresh();
            });
        }),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('git-lean.push', () => {
            const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            if (!cwd) {
                return;
            }
            cp.execFile('git', ['push'], { cwd }, (error, _stdout, stderr) => {
                if (error) {
                    vscode.window.showErrorMessage(`Push failed: ${stderr || error.message}`);
                    return;
                }
                vscode.window.showInformationMessage('Push successful');
                branchProvider.refresh();
            });
        }),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('git-lean.pushForce', async () => {
            const confirm = await vscode.window.showWarningMessage(
                'Force push will overwrite remote history. Are you sure?',
                'Force Push',
                'Cancel',
            );
            if (confirm !== 'Force Push') {
                return;
            }
            const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            if (!cwd) {
                return;
            }
            cp.execFile('git', ['push', '--force-with-lease'], { cwd }, (error, _stdout, stderr) => {
                if (error) {
                    vscode.window.showErrorMessage(`Force push failed: ${stderr || error.message}`);
                    return;
                }
                vscode.window.showInformationMessage('Force push successful');
                branchProvider.refresh();
            });
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
                branchProvider.refresh();
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
                branchProvider.refresh();
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
                branchProvider.refresh();
            });
        }),
    );
}

export function deactivate() {}
