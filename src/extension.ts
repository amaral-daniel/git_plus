import * as vscode from 'vscode';
import * as cp from 'child_process';
import { GitGraphViewProvider } from './gitGraphView';
import { BranchWebviewProvider } from './branchWebviewProvider';
import { BranchTreeItem } from './branchTreeProvider';
import { RepositoryManager } from './repositoryManager';

export function activate(context: vscode.ExtensionContext) {
    const repoManager = new RepositoryManager();
    const graphProvider = new GitGraphViewProvider(context.extensionUri, repoManager);
    const branchProvider = new BranchWebviewProvider(context.extensionUri, repoManager);

    context.subscriptions.push(repoManager);
    context.subscriptions.push(vscode.window.registerWebviewViewProvider(GitGraphViewProvider.viewType, graphProvider));
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(BranchWebviewProvider.viewType, branchProvider),
    );

    branchProvider.onBranchSelected = (branch) => graphProvider.filterByBranch(branch);

    // Create status bar item for repository selection
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBarItem.command = 'git-lean.selectRepository';

    const updateStatusBar = () => {
        const repos = repoManager.getRepositories();
        const activeRepo = repoManager.getActiveRepository();
        const autoDetect = repoManager.isAutoDetectEnabled();

        if (repos.length === 0) {
            statusBarItem.text = '$(git-branch) No Git Repos';
            statusBarItem.tooltip = 'No git repositories found';
            statusBarItem.hide();
        } else if (repos.length === 1) {
            statusBarItem.text = `$(git-branch) ${activeRepo?.name || 'Unknown'}`;
            statusBarItem.tooltip = `${activeRepo?.name || 'Unknown'} (Git Lean)`;
            statusBarItem.show();
        } else {
            if (autoDetect) {
                statusBarItem.text = `$(git-branch) ${activeRepo?.name || 'Auto'} $(sync)`;
                statusBarItem.tooltip = `${activeRepo?.name || 'Auto'} (Git Lean)`;
            } else {
                statusBarItem.text = `$(git-branch) ${activeRepo?.name || 'Select Repo'}`;
                statusBarItem.tooltip = `${activeRepo?.name || 'Select Repo'} (Git Lean)`;
            }
            statusBarItem.show();
        }
    };

    updateStatusBar();
    repoManager.onDidChangeRepository(() => updateStatusBar());
    context.subscriptions.push(statusBarItem);

    // Command to select repository
    context.subscriptions.push(
        vscode.commands.registerCommand('git-lean.selectRepository', () => {
            repoManager.selectRepository();
        }),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('git-lean.showGraph', () => {
            GitGraphViewProvider.createOrShow(context.extensionUri, repoManager);
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
        vscode.commands.registerCommand('git-lean.checkoutBranch', async (item: string | BranchTreeItem) => {
            const branchName = typeof item === 'string' ? item : item.branchName;
            if (!branchName) {
                return;
            }
            const cwd = repoManager.getActiveRepository()?.path;
            if (!cwd) {
                vscode.window.showWarningMessage('No active repository');
                return;
            }
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
        vscode.commands.registerCommand('git-lean.deleteBranch', async (branchTreeItem: BranchTreeItem) => {
            const branchName = branchTreeItem.branchName;
            if (!branchName) {
                return;
            }
            const confirm = await vscode.window.showWarningMessage(
                `Are you sure you want to delete branch '${branchName}'?`,
                'Yes',
                'No',
            );

            if (confirm !== 'Yes') {
                return;
            }

            const cwd = repoManager.getActiveRepository()?.path;
            if (!cwd) {
                vscode.window.showWarningMessage('No active repository');
                return;
            }
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
            const cwd = repoManager.getActiveRepository()?.path;
            if (!cwd) {
                vscode.window.showWarningMessage('No active repository');
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
            const cwd = repoManager.getActiveRepository()?.path;
            if (!cwd) {
                vscode.window.showWarningMessage('No active repository');
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
            const cwd = repoManager.getActiveRepository()?.path;
            if (!cwd) {
                vscode.window.showWarningMessage('No active repository');
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
        vscode.commands.registerCommand('git-lean.rebaseBranch', async (branchTreeItem: BranchTreeItem) => {
            const targetBranch = branchTreeItem.branchName;
            if (!targetBranch) {
                return;
            }
            const cwd = repoManager.getActiveRepository()?.path;
            if (!cwd) {
                vscode.window.showWarningMessage('No active repository');
                return;
            }

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
        vscode.commands.registerCommand('git-lean.mergeBranch', async (branchTreeItem: BranchTreeItem) => {
            const sourceBranch = branchTreeItem.branchName;
            if (!sourceBranch) {
                return;
            }
            const cwd = repoManager.getActiveRepository()?.path;
            if (!cwd) {
                vscode.window.showWarningMessage('No active repository');
                return;
            }

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
        vscode.commands.registerCommand('git-lean.deleteMultipleBranches', async (branchNames: string[]) => {
            if (!branchNames || branchNames.length === 0) {
                return;
            }
            const cwd = repoManager.getActiveRepository()?.path;
            if (!cwd) {
                vscode.window.showWarningMessage('No active repository');
                return;
            }

            const label = branchNames.length === 1 ? `branch '${branchNames[0]}'` : `${branchNames.length} branches`;
            const confirm = await vscode.window.showWarningMessage(
                `Delete ${label}?`,
                { detail: branchNames.join(', ') },
                'Yes',
                'No',
            );
            if (confirm !== 'Yes') {
                return;
            }

            const tryDelete = (
                name: string,
                force: boolean,
            ): Promise<{ name: string; notMerged: boolean; error?: string }> =>
                new Promise((resolve) => {
                    cp.execFile('git', ['branch', force ? '-D' : '-d', name], { cwd }, (err, _stdout, stderr) => {
                        if (err) {
                            if (!force && stderr.includes('not fully merged')) {
                                resolve({ name, notMerged: true });
                            } else {
                                resolve({ name, notMerged: false, error: stderr || err.message });
                            }
                        } else {
                            resolve({ name, notMerged: false });
                        }
                    });
                });

            const results = await Promise.all(branchNames.map((name) => tryDelete(name, false)));
            const notMerged = results.filter((r) => r.notMerged).map((r) => r.name);
            const failed = results.filter((r) => !r.notMerged && r.error);
            const deletedCount = results.filter((r) => !r.notMerged && !r.error).length;

            if (failed.length > 0) {
                vscode.window.showErrorMessage(`Failed to delete: ${failed.map((r) => r.name).join(', ')}`);
            }

            if (notMerged.length > 0) {
                const notMergedLabel =
                    notMerged.length === 1 ? `Branch '${notMerged[0]}' is` : `${notMerged.length} branches are`;
                const forceConfirm = await vscode.window.showWarningMessage(
                    `${notMergedLabel} not fully merged. Force delete?`,
                    { detail: notMerged.join(', ') },
                    'Force Delete',
                    'Cancel',
                );
                if (forceConfirm === 'Force Delete') {
                    const forceResults = await Promise.all(notMerged.map((name) => tryDelete(name, true)));
                    const forceDeleted = forceResults.filter((r) => !r.error).length;
                    const forceFailed = forceResults.filter((r) => r.error);
                    if (forceFailed.length > 0) {
                        vscode.window.showErrorMessage(
                            `Failed to force delete: ${forceFailed.map((r) => r.name).join(', ')}`,
                        );
                    }
                    const total = deletedCount + forceDeleted;
                    if (total > 0) {
                        vscode.window.showInformationMessage(`Deleted ${total} branch${total > 1 ? 'es' : ''}`);
                    }
                } else if (deletedCount > 0) {
                    vscode.window.showInformationMessage(
                        `Deleted ${deletedCount} branch${deletedCount > 1 ? 'es' : ''}`,
                    );
                }
            } else if (deletedCount > 0) {
                vscode.window.showInformationMessage(`Deleted ${deletedCount} branch${deletedCount > 1 ? 'es' : ''}`);
            }

            branchProvider.refresh();
        }),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('git-lean.createBranch', async (branchTreeItem: BranchTreeItem) => {
            const sourceBranch = branchTreeItem.branchName;
            if (!sourceBranch) {
                return;
            }
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

            const cwd = repoManager.getActiveRepository()?.path;
            if (!cwd) {
                vscode.window.showWarningMessage('No active repository');
                return;
            }
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
