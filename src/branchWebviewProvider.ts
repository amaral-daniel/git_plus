import * as vscode from 'vscode';
import * as cp from 'child_process';

interface Branch {
    name: string;
    fullName: string;
    isRemote: boolean;
    isHead: boolean;
}

function getNonce(): string {
    let text = '';
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return text;
}

export class BranchWebviewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'gitLeanBranchView';
    private _view?: vscode.WebviewView;
    private _onBranchSelected: ((branch: string | null) => void) | null = null;

    constructor(private readonly _extensionUri: vscode.Uri) {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders) {
            const watcher = vscode.workspace.createFileSystemWatcher(
                new vscode.RelativePattern(workspaceFolders[0], '.git/**'),
            );
            watcher.onDidChange(() => this.refresh());
            watcher.onDidCreate(() => this.refresh());
            watcher.onDidDelete(() => this.refresh());
        }
    }

    set onBranchSelected(handler: (branch: string | null) => void) {
        this._onBranchSelected = handler;
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri],
        };
        webviewView.webview.onDidReceiveMessage((msg) => this.handleMessage(msg));
        this.refresh();
    }

    public refresh(): void {
        if (this._view) {
            this.updateWebview();
        }
    }

    private async updateWebview(): Promise<void> {
        if (!this._view) {
            return;
        }
        const branches = await this.getBranches();
        this._view.webview.html = this.getHtml(this._view.webview, branches);
    }

    private handleMessage(message: any) {
        if (message.command === 'selectBranch') {
            this._onBranchSelected?.(message.branchName);
            return;
        }
        vscode.commands.executeCommand(`git-lean.${message.command}`, { branchName: message.branchName });
    }

    private getHtml(webview: vscode.Webview, branches: Branch[]): string {
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'out', 'webview', 'branches', 'index.js'),
        );
        const nonce = getNonce();

        return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline';">
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
    font-family: var(--vscode-font-family);
    font-size: var(--vscode-font-size);
    color: var(--vscode-foreground);
    background: transparent;
    overflow-x: hidden;
}
.search-wrap {
    padding: 6px 8px;
    position: sticky;
    top: 0;
    background: var(--vscode-sideBar-background);
    z-index: 10;
    border-bottom: 1px solid var(--vscode-panel-border);
}
.search-input {
    width: 100%;
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border, transparent);
    padding: 3px 6px;
    font-size: var(--vscode-font-size);
    font-family: var(--vscode-font-family);
    outline: none;
    border-radius: 2px;
    box-sizing: border-box;
}
.search-input:focus { border-color: var(--vscode-focusBorder); }
.section-header {
    padding: 6px 12px 3px;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    opacity: 0.65;
    font-weight: 600;
}
.branch-row {
    display: flex;
    align-items: center;
    padding: 2px 8px 2px 20px;
    gap: 5px;
    cursor: pointer;
    user-select: none;
    min-height: 22px;
}
.branch-row:hover { background: var(--vscode-list-hoverBackground); }
.branch-row.selected {
    background: var(--vscode-list-activeSelectionBackground);
    color: var(--vscode-list-activeSelectionForeground);
}
.branch-row.is-head .branch-label { color: var(--vscode-gitDecoration-modifiedResourceForeground); }
.branch-row.selected .branch-label { color: inherit; }
.branch-icon { font-size: 12px; flex-shrink: 0; opacity: 0.75; }
.branch-label { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.head-mark { font-size: 10px; flex-shrink: 0; opacity: 0.7; }
.empty { padding: 10px 12px; opacity: 0.5; font-style: italic; }
.ctx-menu {
    position: fixed;
    background: var(--vscode-menu-background);
    border: 1px solid var(--vscode-menu-border, var(--vscode-panel-border));
    box-shadow: 0 4px 14px rgba(0,0,0,0.35);
    z-index: 50;
    min-width: 190px;
    padding: 3px 0;
}
.ctx-item {
    padding: 5px 14px;
    cursor: pointer;
    color: var(--vscode-menu-foreground);
    white-space: nowrap;
}
.ctx-item:hover {
    background: var(--vscode-menu-selectionBackground);
    color: var(--vscode-menu-selectionForeground);
}
.ctx-sep { height: 1px; background: var(--vscode-panel-border); margin: 3px 0; }
</style>
</head>
<body>
<div id="root"></div>
<script nonce="${nonce}">window.__BRANCHES__ = ${JSON.stringify(branches)};</script>
<script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
    }

    private getCwd(): string | undefined {
        return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    }

    private async getBranches(): Promise<Branch[]> {
        return new Promise((resolve) => {
            const cwd = this.getCwd();
            if (!cwd) {
                resolve([]);
                return;
            }
            cp.exec('git branch -a --format="%(refname:short)|%(HEAD)"', { cwd }, (err, stdout) => {
                if (err) {
                    resolve([]);
                    return;
                }
                const branches: Branch[] = stdout
                    .split('\n')
                    .filter((line) => line.trim())
                    .map((line) => {
                        const [fullName, head] = line.split('|');
                        if (fullName.includes('origin/HEAD') || fullName.includes('upstream/HEAD')) {
                            return null;
                        }
                        const isRemote = fullName.startsWith('origin/') || fullName.startsWith('upstream/');
                        const name = isRemote ? fullName.replace(/^(origin|upstream)\//, '') : fullName;
                        return { name, fullName, isRemote, isHead: head === '*' };
                    })
                    .filter((b): b is Branch => b !== null);
                resolve(branches);
            });
        });
    }
}
