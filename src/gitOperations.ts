import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

export interface GitCommit {
    hash: string;
    shortHash: string;
    message: string;
    date: string;
    author: string;
    parents: string[];
    refs: string[];
}

export class GitOperations {
    constructor(private readonly onRefresh: () => void) {}

    private getCwd(): string | null {
        return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null;
    }

    async getGitLog(filterBranch: string | null): Promise<GitCommit[]> {
        return new Promise((resolve) => {
            const cwd = this.getCwd();
            if (!cwd) {
                resolve([]);
                return;
            }

            const branchArg = filterBranch ? ` ${filterBranch}` : '';
            const gitCommand = `git log${branchArg} --pretty=format:"%H|%h|%P|%an|%ai|%D|%s" --date-order`;

            cp.exec(gitCommand, { cwd }, (error, stdout) => {
                if (error) {
                    vscode.window.showErrorMessage(`Git error: ${error.message}`);
                    resolve([]);
                    return;
                }

                const commits: GitCommit[] = stdout
                    .split('\n')
                    .filter((line) => line.trim())
                    .map((line) => {
                        const [fullHash, shortHash, parents, author, date, refs, ...messageParts] = line.split('|');
                        const refList = refs
                            .trim()
                            .split(',')
                            .map((r) => r.trim())
                            .filter((r) => r);
                        return {
                            hash: fullHash.trim(),
                            shortHash: shortHash.trim(),
                            message: messageParts.join('|').trim(),
                            date: new Date(date).toLocaleString(),
                            author: author.trim(),
                            parents: parents
                                .trim()
                                .split(' ')
                                .map((p) => p.trim())
                                .filter((p) => p),
                            refs: refList,
                        };
                    });

                resolve(commits);
            });
        });
    }

    async editCommitMessage(commitHash: string, newMessage?: string) {
        if (!newMessage) {
            return;
        }
        const cwd = this.getCwd();
        if (!cwd) {
            return;
        }

        cp.exec(
            `git commit --amend ${commitHash}~1..${commitHash} -m "${newMessage.replace(/"/g, '\\"')}"`,
            { cwd },
            (error) => {
                if (error) {
                    vscode.window.showErrorMessage(`Failed to edit commit message: ${error.message}`);
                    return;
                }
                vscode.window.showInformationMessage('Commit message updated successfully');
                this.onRefresh();
            },
        );
    }

    async cherryPickCommit(commitHash: string) {
        const cwd = this.getCwd();
        if (!cwd) {
            return;
        }

        cp.exec(`git cherry-pick ${commitHash}`, { cwd }, (error, _stdout, stderr) => {
            if (error) {
                vscode.window.showErrorMessage(`Failed to cherry-pick commit: ${error.message}\n${stderr}`);
                return;
            }
            vscode.window.showInformationMessage('Commit cherry-picked successfully');
            this.onRefresh();
        });
    }

    async copyCommitHash(commitHash: string) {
        await vscode.env.clipboard.writeText(commitHash);
        vscode.window.showInformationMessage('Commit hash copied to clipboard');
    }

    async revertCommit(commitHash: string) {
        const confirm = await vscode.window.showWarningMessage(
            `Are you sure you want to revert commit ${commitHash.substring(0, 7)}?`,
            'Yes',
            'No',
        );
        if (confirm !== 'Yes') {
            return;
        }

        const cwd = this.getCwd();
        if (!cwd) {
            return;
        }

        cp.exec(`git revert ${commitHash} --no-edit`, { cwd }, (error, _stdout, stderr) => {
            if (error) {
                vscode.window.showErrorMessage(`Failed to revert commit: ${error.message}\n${stderr}`);
                return;
            }
            vscode.window.showInformationMessage('Commit reverted successfully');
            this.onRefresh();
        });
    }

    async resetToCommit(commitHash: string) {
        const resetType = await vscode.window.showQuickPick(
            [
                { label: 'Soft', description: 'Keep changes staged', value: '--soft' },
                { label: 'Mixed', description: 'Keep changes unstaged', value: '--mixed' },
                { label: 'Hard', description: 'Discard all changes', value: '--hard' },
            ],
            { placeHolder: 'Select reset type' },
        );
        if (!resetType) {
            return;
        }

        const confirm = await vscode.window.showWarningMessage(
            `Are you sure you want to reset to commit ${commitHash.substring(0, 7)} (${resetType.label})?`,
            'Yes',
            'No',
        );
        if (confirm !== 'Yes') {
            return;
        }

        const cwd = this.getCwd();
        if (!cwd) {
            return;
        }

        cp.exec(`git reset ${resetType.value} ${commitHash}`, { cwd }, (error, _stdout, stderr) => {
            if (error) {
                vscode.window.showErrorMessage(`Failed to reset: ${error.message}\n${stderr}`);
                return;
            }
            vscode.window.showInformationMessage(`Reset to commit ${commitHash.substring(0, 7)} successfully`);
            this.onRefresh();
        });
    }

    async squashCommits(hashes: string[], parentHash: string) {
        if (!parentHash) {
            vscode.window.showErrorMessage('Cannot squash: oldest selected commit has no parent.');
            return;
        }

        const cwd = this.getCwd();
        if (!cwd) {
            return;
        }

        const newMessage = await vscode.window.showInputBox({
            prompt: `Squash ${hashes.length} commits into one`,
            placeHolder: 'New commit message',
            validateInput: (v) => (!v || !v.trim() ? 'Message cannot be empty' : null),
        });
        if (!newMessage) {
            return;
        }

        const headHash = await new Promise<string>((resolve) => {
            cp.exec('git rev-parse HEAD', { cwd }, (err, stdout) => resolve(err ? '' : stdout.trim()));
        });

        if (hashes[0] === headHash) {
            // Selection ends at HEAD — simple reset + commit
            const escaped = newMessage.replace(/"/g, '\\"');
            cp.exec(`git reset --soft ${parentHash}`, { cwd }, (error) => {
                if (error) {
                    vscode.window.showErrorMessage(`Failed to squash: ${error.message}`);
                    return;
                }
                cp.exec(`git commit -m "${escaped}"`, { cwd }, (err2) => {
                    if (err2) {
                        vscode.window.showErrorMessage(`Failed to commit squash: ${err2.message}`);
                        return;
                    }
                    vscode.window.showInformationMessage(`Squashed ${hashes.length} commits successfully`);
                    this.onRefresh();
                });
            });
        } else {
            // Selection is in the middle — use interactive rebase with scripted editors.
            // hashes[hashes.length-1] is the oldest selected (stays 'pick');
            // all others become 'squash'.
            const squashableHashes = hashes.slice(0, -1);

            const seqEditorScript = `
const fs = require('fs');
const file = process.argv[2];
const squashHashes = ${JSON.stringify(squashableHashes)};
const lines = fs.readFileSync(file, 'utf8').split('\\n');
const result = lines.map(line => {
    const parts = line.trim().split(/\\s+/);
    if ((parts[0] === 'pick' || parts[0] === 'p') && parts[1]) {
        if (squashHashes.some(h => h.startsWith(parts[1]))) {
            return 'squash ' + parts.slice(1).join(' ');
        }
    }
    return line;
});
fs.writeFileSync(file, result.join('\\n'));
`;
            const msgEditorScript = `
const fs = require('fs');
fs.writeFileSync(process.argv[2], ${JSON.stringify(newMessage + '\n')});
`;

            const tmpDir = os.tmpdir();
            const seqEditorPath = path.join(tmpDir, 'git-lean-seq-editor.js');
            const msgEditorPath = path.join(tmpDir, 'git-lean-msg-editor.js');
            fs.writeFileSync(seqEditorPath, seqEditorScript);
            fs.writeFileSync(msgEditorPath, msgEditorScript);

            const env = {
                ...process.env,
                GIT_SEQUENCE_EDITOR: `node "${seqEditorPath}"`,
                GIT_EDITOR: `node "${msgEditorPath}"`,
            };

            cp.exec(`git rebase -i ${parentHash}`, { cwd, env }, (error, _stdout, stderr) => {
                try {
                    fs.unlinkSync(seqEditorPath);
                } catch {}
                try {
                    fs.unlinkSync(msgEditorPath);
                } catch {}
                if (error) {
                    cp.exec('git rebase --abort', { cwd }, () => {});
                    vscode.window.showErrorMessage(`Failed to squash: ${error.message}\n${stderr}`);
                    return;
                }
                vscode.window.showInformationMessage(`Squashed ${hashes.length} commits successfully`);
                this.onRefresh();
            });
        }
    }

    async cherryPickRange(hashes: string[]) {
        const cwd = this.getCwd();
        if (!cwd) {
            return;
        }

        // hashes are newest-first; cherry-pick oldest to newest
        const ordered = [...hashes].reverse().join(' ');
        cp.exec(`git cherry-pick ${ordered}`, { cwd }, (error, _stdout, stderr) => {
            if (error) {
                vscode.window.showErrorMessage(`Failed to cherry-pick: ${error.message}\n${stderr}`);
                return;
            }
            vscode.window.showInformationMessage(`Cherry-picked ${hashes.length} commits successfully`);
            this.onRefresh();
        });
    }
}
