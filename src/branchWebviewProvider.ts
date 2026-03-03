import * as vscode from 'vscode';
import * as cp from 'child_process';

interface WebviewMessage {
    command: string;
    branchName: string;
    branchNames?: string[];
}

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

    private handleMessage(message: WebviewMessage) {
        if (message.command === 'selectBranch') {
            this._onBranchSelected?.(message.branchName);
            return;
        }
        if (message.command === 'deleteMultipleBranches') {
            vscode.commands.executeCommand('git-lean.deleteMultipleBranches', message.branchNames);
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
    -webkit-font-smoothing: antialiased;
}
.search-wrap {
    padding: 6px 8px 8px;
    position: sticky;
    top: 0;
    background: var(--vscode-sideBar-background);
    z-index: 10;
}
.search-input {
    width: 100%;
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border, rgba(128,128,128,0.25));
    padding: 5px 8px;
    font-size: var(--vscode-font-size);
    font-family: var(--vscode-font-family);
    outline: none;
    border-radius: 3px;
    transition: border-color 0.15s ease;
}
.search-input:focus { border-color: var(--vscode-focusBorder); }
.search-input::placeholder { color: var(--vscode-input-placeholderForeground, rgba(128,128,128,0.45)); }
.section { margin-bottom: 2px; }
.section-header {
    display: flex;
    align-items: center;
    gap: 3px;
    padding: 4px 8px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--vscode-sideBarSectionHeader-foreground, var(--vscode-foreground));
    cursor: pointer;
    user-select: none;
}
.section-header:hover { background: var(--vscode-list-hoverBackground); }
.section-chevron {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    opacity: 0.55;
}
.group-row {
    display: flex;
    align-items: center;
    gap: 4px;
    padding-top: 2px;
    padding-bottom: 2px;
    padding-right: 8px;
    min-height: 22px;
    cursor: pointer;
    user-select: none;
}
.group-row:hover { background: var(--vscode-list-hoverBackground); }
.row-chevron {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    opacity: 0.45;
    margin-right: 1px;
}
.branch-row {
    display: flex;
    align-items: center;
    gap: 5px;
    padding-top: 2px;
    padding-bottom: 2px;
    padding-right: 8px;
    min-height: 22px;
    cursor: pointer;
    user-select: none;
    transition: background 0.07s ease;
}
.branch-row:hover { background: var(--vscode-list-hoverBackground); }
.branch-row.selected {
    background: var(--vscode-list-activeSelectionBackground);
    color: var(--vscode-list-activeSelectionForeground);
}
.branch-row.is-head {
    border-left: 2px solid var(--vscode-gitDecoration-modifiedResourceForeground);
}
.branch-row.is-head .row-label {
    color: var(--vscode-gitDecoration-modifiedResourceForeground);
    font-weight: 500;
}
.branch-row.is-head.selected .row-label { color: inherit; }
.row-label {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 12px;
}
.icon-star { flex-shrink: 0; }
.icon-tag { flex-shrink: 0; }
.icon-folder { flex-shrink: 0; opacity: 0.65; }
.icon-branch { flex-shrink: 0; opacity: 0.6; }
.branch-row.selected svg { opacity: 1; }
.empty { padding: 10px 12px; opacity: 0.5; font-style: italic; font-size: 12px; }
.ctx-menu {
    position: fixed;
    background: var(--vscode-menu-background);
    border: 1px solid var(--vscode-menu-border, var(--vscode-panel-border));
    border-radius: 6px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.3), 0 1px 4px rgba(0,0,0,0.15);
    z-index: 1000;
    min-width: 190px;
    padding: 4px 0;
    overflow: hidden;
}
.ctx-item {
    padding: 6px 16px;
    cursor: pointer;
    color: var(--vscode-menu-foreground);
    font-size: 12px;
    white-space: nowrap;
    transition: background 0.08s ease;
}
.ctx-item:hover {
    background: var(--vscode-list-hoverBackground);
    color: var(--vscode-list-hoverForeground);
}
.ctx-sep { height: 1px; background: var(--vscode-panel-border); margin: 3px 6px; }
.ctx-item-danger { color: var(--vscode-errorForeground, #f14c4c); }
.ctx-item-danger:hover { color: var(--vscode-errorForeground, #f14c4c); }
.branch-row.multi-selected {
    background: var(--vscode-list-inactiveSelectionBackground);
    outline: 1px solid var(--vscode-focusBorder);
    outline-offset: -1px;
}
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
