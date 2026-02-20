import * as vscode from 'vscode';
import * as cp from 'child_process';
import { GitOperations } from './gitOperations';
import { getHtmlForWebview, getCommitDetailsHtml } from './webviewContent';

export class GitGraphViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'gitPlusGraphView';
    private static currentPanel: vscode.WebviewPanel | undefined;
    private _view?: vscode.WebviewView;
    private _watcher?: vscode.FileSystemWatcher;
    private _filterBranch: string | null = null;
    private readonly _gitOps: GitOperations;

    constructor(private readonly _extensionUri: vscode.Uri) {
        this._gitOps = new GitOperations(() => this.refresh());
        this.setupGitWatcher();
    }

    public filterByBranch(branch: string | null) {
        this._filterBranch = branch;
        this.refresh();
    }

    public static createOrShow(extensionUri: vscode.Uri) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (GitGraphViewProvider.currentPanel) {
            GitGraphViewProvider.currentPanel.reveal(column);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            GitGraphViewProvider.viewType,
            'Tree',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [extensionUri]
            }
        );

        GitGraphViewProvider.currentPanel = panel;

        const provider = new GitGraphViewProvider(extensionUri);
        provider.updateWebview(panel.webview);

        panel.onDidDispose(() => {
            GitGraphViewProvider.currentPanel = undefined;
        });

        panel.webview.onDidReceiveMessage(
            message => provider.handleMessage(message, () => provider.updateWebview(panel.webview))
        );
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.onDidReceiveMessage(
            message => this.handleMessage(message, () => this.updateWebview(webviewView.webview))
        );

        this.updateWebview(webviewView.webview);
    }

    private handleMessage(message: any, refresh: () => void) {
        switch (message.command) {
            case 'refresh':
                refresh();
                break;
            case 'editCommitMessage':
                this._gitOps.editCommitMessage(message.commitHash, message.newMessage);
                break;
            case 'cherryPick':
                this._gitOps.cherryPickCommit(message.commitHash);
                break;
            case 'copyHash':
                this._gitOps.copyCommitHash(message.commitHash);
                break;
            case 'revertCommit':
                this._gitOps.revertCommit(message.commitHash);
                break;
            case 'resetToCommit':
                this._gitOps.resetToCommit(message.commitHash);
                break;
            case 'squashCommits':
                this._gitOps.squashCommits(message.hashes, message.parentHash);
                break;
            case 'cherryPickRange':
                this._gitOps.cherryPickRange(message.hashes);
                break;
            case 'showCommitDetails':
                this.showCommitDetails(message.commitHash);
                break;
        }
    }

    private setupGitWatcher() {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            return;
        }

        this._watcher = vscode.workspace.createFileSystemWatcher(
            new vscode.RelativePattern(workspaceFolders[0], '.git/**')
        );

        this._watcher.onDidChange(() => this.refresh());
        this._watcher.onDidCreate(() => this.refresh());
        this._watcher.onDidDelete(() => this.refresh());
    }

    private refresh() {
        if (this._view) {
            this.updateWebview(this._view.webview);
        }
        if (GitGraphViewProvider.currentPanel) {
            this.updateWebview(GitGraphViewProvider.currentPanel.webview);
        }
    }

    public dispose() {
        this._watcher?.dispose();
    }

    // Delegated public methods so extension.ts commands can still call them on the provider
    public async editCommitMessage(commitHash: string, newMessage?: string) {
        return this._gitOps.editCommitMessage(commitHash, newMessage);
    }

    public async cherryPickCommit(commitHash: string) {
        return this._gitOps.cherryPickCommit(commitHash);
    }

    public async copyCommitHash(commitHash: string) {
        return this._gitOps.copyCommitHash(commitHash);
    }

    public async revertCommit(commitHash: string) {
        return this._gitOps.revertCommit(commitHash);
    }

    public async resetToCommit(commitHash: string) {
        return this._gitOps.resetToCommit(commitHash);
    }

    public async showCommitDetails(commitHash: string) {
        const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!cwd) { return; }

        const exec = (cmd: string, opts?: cp.ExecOptions) => new Promise<string>((resolve) => {
            cp.exec(cmd, { cwd, ...opts }, (err: Error | null, stdout: string) => resolve(err ? '' : stdout));
        });

        const metaLines = (await exec(`git log -1 --format="%H%n%ae%n%an%n%aI%n%cI%n%s" ${commitHash}`)).split('\n');
        const body = (await exec(`git log -1 --format="%b" ${commitHash}`)).trim();
        const patch = await exec(`git show ${commitHash}`, { maxBuffer: 10 * 1024 * 1024 });

        const [fullHash = commitHash, authorEmail = '', authorName = '', authorDate = '', commitDate = '', subject = ''] = metaLines;

        const panel = vscode.window.createWebviewPanel(
            'gitPlusCommitDetails',
            `Commit ${commitHash.substring(0, 7)}`,
            vscode.ViewColumn.One,
            { enableScripts: true }
        );

        panel.webview.html = getCommitDetailsHtml({ fullHash, authorEmail, authorName, authorDate, commitDate, subject, body, patch });
    }

    private async updateWebview(webview: vscode.Webview) {
        const commits = await this._gitOps.getGitLog(this._filterBranch);
        webview.html = getHtmlForWebview(webview, commits);
    }
}
