import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';

interface GitCommit {
    hash: string;
    shortHash: string;
    message: string;
    date: string;
    author: string;
    parents: string[];
    refs: string[];
}

export class GitGraphViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'gitPlusGraphView';
    private static currentPanel: vscode.WebviewPanel | undefined;
    private _view?: vscode.WebviewView;
    private _watcher?: vscode.FileSystemWatcher;
    private _filterBranch: string | null = null;

    public filterByBranch(branch: string | null) {
        this._filterBranch = branch;
        this.refresh();
    }

    constructor(private readonly _extensionUri: vscode.Uri) {
        this.setupGitWatcher();
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
            message => {
                switch (message.command) {
                    case 'refresh':
                        provider.updateWebview(panel.webview);
                        break;
                    case 'editCommitMessage':
                        provider.editCommitMessage(message.commitHash, message.newMessage);
                        break;
                    case 'cherryPick':
                        provider.cherryPickCommit(message.commitHash);
                        break;
                    case 'copyHash':
                        provider.copyCommitHash(message.commitHash);
                        break;
                    case 'revertCommit':
                        provider.revertCommit(message.commitHash);
                        break;
                    case 'resetToCommit':
                        provider.resetToCommit(message.commitHash);
                        break;
                }
            }
        );
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'refresh':
                        this.updateWebview(webviewView.webview);
                        break;
                    case 'editCommitMessage':
                        this.editCommitMessage(message.commitHash, message.newMessage);
                        break;
                    case 'cherryPick':
                        this.cherryPickCommit(message.commitHash);
                        break;
                    case 'copyHash':
                        this.copyCommitHash(message.commitHash);
                        break;
                    case 'revertCommit':
                        this.revertCommit(message.commitHash);
                        break;
                    case 'resetToCommit':
                        this.resetToCommit(message.commitHash);
                        break;
                }
            }
        );

        this.updateWebview(webviewView.webview);
    }

    private setupGitWatcher() {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            return;
        }

        // Watch for changes in .git directory
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

    public async editCommitMessage(commitHash: string, newMessage?: string) {
        if (!newMessage) {
            return;
        }

        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            return;
        }

        const cwd = workspaceFolders[0].uri.fsPath;

        cp.exec(`git commit --amend ${commitHash}~1..${commitHash} -m "${newMessage.replace(/"/g, '\\"')}"`, { cwd }, (error, stdout, stderr) => {
            if (error) {
                vscode.window.showErrorMessage(`Failed to edit commit message: ${error.message}`);
                return;
            }
            vscode.window.showInformationMessage('Commit message updated successfully');
            this.refresh();
        });
    }

    public async cherryPickCommit(commitHash: string) {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            return;
        }

        const cwd = workspaceFolders[0].uri.fsPath;

        cp.exec(`git cherry-pick ${commitHash}`, { cwd }, (error, stdout, stderr) => {
            if (error) {
                vscode.window.showErrorMessage(`Failed to cherry-pick commit: ${error.message}\n${stderr}`);
                return;
            }
            vscode.window.showInformationMessage('Commit cherry-picked successfully');
            this.refresh();
        });
    }

    public async copyCommitHash(commitHash: string) {
        await vscode.env.clipboard.writeText(commitHash);
        vscode.window.showInformationMessage('Commit hash copied to clipboard');
    }

    public async revertCommit(commitHash: string) {
        const confirm = await vscode.window.showWarningMessage(
            `Are you sure you want to revert commit ${commitHash.substring(0, 7)}?`,
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

        cp.exec(`git revert ${commitHash} --no-edit`, { cwd }, (error, stdout, stderr) => {
            if (error) {
                vscode.window.showErrorMessage(`Failed to revert commit: ${error.message}\n${stderr}`);
                return;
            }
            vscode.window.showInformationMessage('Commit reverted successfully');
            this.refresh();
        });
    }

    public async resetToCommit(commitHash: string) {
        const resetType = await vscode.window.showQuickPick(
            [
                { label: 'Soft', description: 'Keep changes staged', value: '--soft' },
                { label: 'Mixed', description: 'Keep changes unstaged', value: '--mixed' },
                { label: 'Hard', description: 'Discard all changes', value: '--hard' }
            ],
            { placeHolder: 'Select reset type' }
        );

        if (!resetType) {
            return;
        }

        const confirm = await vscode.window.showWarningMessage(
            `Are you sure you want to reset to commit ${commitHash.substring(0, 7)} (${resetType.label})?`,
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

        cp.exec(`git reset ${resetType.value} ${commitHash}`, { cwd }, (error, stdout, stderr) => {
            if (error) {
                vscode.window.showErrorMessage(`Failed to reset: ${error.message}\n${stderr}`);
                return;
            }
            vscode.window.showInformationMessage(`Reset to commit ${commitHash.substring(0, 7)} successfully`);
            this.refresh();
        });
    }

    private async updateWebview(webview: vscode.Webview) {
        const commits = await this.getGitLog();
        webview.html = this.getHtmlForWebview(webview, commits);
    }

    private async getGitLog(): Promise<GitCommit[]> {
        return new Promise((resolve, reject) => {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) {
                resolve([]);
                return;
            }

            const cwd = workspaceFolders[0].uri.fsPath;

            // Git log format: fullHash|shortHash|parents|author|date|refs|message
            const branchArg = this._filterBranch ? ` ${this._filterBranch}` : '';
            const gitCommand = `git log${branchArg} --pretty=format:"%H|%h|%P|%an|%ai|%D|%s" --date-order`;

            cp.exec(gitCommand, { cwd }, (error, stdout, stderr) => {
                if (error) {
                    vscode.window.showErrorMessage(`Git error: ${error.message}`);
                    resolve([]);
                    return;
                }

                const commits: GitCommit[] = stdout
                    .split('\n')
                    .filter(line => line.trim())
                    .map(line => {
                        const [fullHash, shortHash, parents, author, date, refs, ...messageParts] = line.split('|');

                        // Parse refs (branches, tags, HEAD)
                        const refList = refs.trim()
                            .split(',')
                            .map(r => r.trim())
                            .filter(r => r);

                        return {
                            hash: fullHash.trim(),
                            shortHash: shortHash.trim(),
                            message: messageParts.join('|').trim(),
                            date: new Date(date).toLocaleString(),
                            author: author.trim(),
                            parents: parents.trim().split(' ').map(p => p.trim()).filter(p => p),
                            refs: refList
                        };
                    });

                resolve(commits);
            });
        });
    }

    private getHtmlForWebview(webview: vscode.Webview, commits: GitCommit[]): string {
        const commitsJson = JSON.stringify(commits);

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Tree</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 10px;
            margin: 0;
        }

        .table-container {
            overflow-x: auto;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
        }


        td {
            padding: 4px 8px;
        }

        tbody tr:hover {
            background-color: var(--vscode-list-hoverBackground);
        }

        .graph-cell {
            padding: 0;
            width: 1px;
        }

        .graph-canvas {
            display: block;
        }

        .hash-cell {
            font-family: var(--vscode-editor-font-family);
            color: var(--vscode-descriptionForeground);
            font-weight: 500;
            white-space: nowrap;
            font-size: 11px;
            width: 80px;
        }

        .message-cell {
            font-size: 12px;
            display: flex;
            align-items: center;
            gap: 6px;
            overflow: hidden;
        }

        .message-text {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .refs-container {
            display: flex;
            gap: 4px;
            flex-shrink: 0;
            align-items: center;
        }

        .ref-badge {
            display: inline-block;
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 10px;
            font-weight: 500;
            white-space: nowrap;
            border: 1px solid;
        }

        .ref-head {
            background-color: var(--vscode-gitDecoration-modifiedResourceForeground);
            border-color: var(--vscode-gitDecoration-modifiedResourceForeground);
            color: var(--vscode-editor-background);
            font-weight: 600;
        }

        .ref-branch {
            background-color: transparent;
            border-color: var(--vscode-gitDecoration-addedResourceForeground);
            color: var(--vscode-gitDecoration-addedResourceForeground);
        }

        .ref-remote {
            background-color: transparent;
            border-color: var(--vscode-gitDecoration-untrackedResourceForeground);
            color: var(--vscode-gitDecoration-untrackedResourceForeground);
        }

        .ref-tag {
            background-color: transparent;
            border-color: var(--vscode-gitDecoration-submoduleResourceForeground);
            color: var(--vscode-gitDecoration-submoduleResourceForeground);
        }

        .author-cell {
            white-space: nowrap;
            color: var(--vscode-descriptionForeground);
            font-size: 11px;
            width: 150px;
            max-width: 150px;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .date-cell {
            white-space: nowrap;
            color: var(--vscode-descriptionForeground);
            font-size: 11px;
            width: 140px;
        }

        .no-commits {
            text-align: center;
            padding: 40px;
            color: var(--vscode-descriptionForeground);
        }

        .context-menu {
            position: fixed;
            background-color: var(--vscode-menu-background);
            border: 1px solid var(--vscode-menu-border);
            border-radius: 8px;
            box-shadow: 0 2px 8px var(--vscode-widget-shadow);
            z-index: 1000;
            min-width: 200px;
            display: none;
            padding: 4px 0;
            overflow: hidden;
        }

        .context-menu-item {
            padding: 6px 20px;
            cursor: pointer;
            color: var(--vscode-menu-foreground);
            font-size: 13px;
            display: flex;
            align-items: center;
            gap: 8px;
            user-select: none;
            transition: background-color 0.1s ease;
        }

        .context-menu-item:hover {
            background-color: var(--vscode-list-hoverBackground);
            color: var(--vscode-list-hoverForeground);
        }

        .context-menu-item:first-child {
            margin-top: 0;
        }

        .context-menu-separator {
            height: 1px;
            background-color: var(--vscode-menu-separatorBackground);
            margin: 4px 8px;
        }

        tbody tr {
            cursor: pointer;
        }

        .message-edit-input {
            background: transparent;
            border: none;
            border-bottom: 1px solid var(--vscode-focusBorder);
            color: inherit;
            font: inherit;
            font-size: 12px;
            outline: none;
            padding: 0;
            width: 100%;
        }
    </style>
</head>
<body>
    ${commits.length > 0 ? `
        <div class="table-container">
            <table>
                <tbody id="commit-tbody">
                    ${commits.map((commit, index) => `
                        <tr data-commit-hash="${commit.hash}" data-commit-index="${index}">
                            <td class="graph-cell">
                                <canvas class="graph-canvas" data-index="${index}"></canvas>
                            </td>
                            <td class="message-cell" title="${this.escapeHtml(commit.message)}">
                                ${this.formatRefs(commit.refs)}
                                <span class="message-text">${this.escapeHtml(commit.message)}</span>
                            </td>
                            <td class="hash-cell">${commit.shortHash}</td>
                            <td class="author-cell">${this.escapeHtml(commit.author)}</td>
                            <td class="date-cell">${commit.date}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        <div id="context-menu" class="context-menu">
            <div class="context-menu-item" data-action="copyHash">Copy Hash</div>
            <div class="context-menu-separator"></div>
            <div class="context-menu-item" data-action="cherryPick">Cherry Pick</div>
            <div class="context-menu-item" data-action="revertCommit">Revert Commit</div>
            <div class="context-menu-separator"></div>
            <div class="context-menu-item" data-action="editCommitMessage">Edit Commit Message</div>
            <div class="context-menu-item" data-action="resetToCommit">Reset to Commit</div>
        </div>
    ` : `
        <div class="no-commits">
            <p>No commits found in this repository</p>
        </div>
    `}

    <script>
        const vscode = acquireVsCodeApi();
        const commits = ${commitsJson};

        // Graph drawing logic
        const COLORS = [
            '#e8832a', '#3d9fd4', '#4faa5e', '#c75dd3', '#e05c5c',
            '#1abc9c', '#9b59b6', '#e8b84b', '#16a085', '#d35400'
        ];

        const LANE_WIDTH = 18;
        const ROW_HEIGHT = 28;
        const COMMIT_RADIUS = 5;
        const LINE_WIDTH = 2;

        // Snap to half-pixel so 1-2px lines land exactly on pixel boundaries
        const px = v => Math.round(v) + 0.5;

        // Identify the HEAD commit hash
        const headCommitHash = (commits.find(c =>
            c.refs.some(r => r.startsWith('HEAD -> ') || r === 'HEAD')
        ) || commits[0])?.hash;

        class GraphRenderer {
            constructor() {
                this.commitLanes = new Map();
            }

            calculateLanes() {
                const reservedLanes = new Map();
                let nextLane = 0;

                for (let i = 0; i < commits.length; i++) {
                    const commit = commits[i];
                    let assignedLane;

                    if (reservedLanes.has(commit.hash)) {
                        assignedLane = reservedLanes.get(commit.hash);
                        reservedLanes.delete(commit.hash);
                    } else {
                        assignedLane = nextLane++;
                    }

                    this.commitLanes.set(commit.hash, assignedLane);

                    if (commit.parents.length > 0) {
                        const firstParent = commit.parents[0];
                        if (!reservedLanes.has(firstParent)) {
                            reservedLanes.set(firstParent, assignedLane);
                        }
                        for (let j = 1; j < commit.parents.length; j++) {
                            const parent = commit.parents[j];
                            if (!reservedLanes.has(parent)) {
                                const usedLanes = new Set(reservedLanes.values());
                                let newLane = 0;
                                while (usedLanes.has(newLane)) { newLane++; }
                                reservedLanes.set(parent, newLane);
                                nextLane = Math.max(nextLane, newLane + 1);
                            }
                        }
                    }
                }
            }

            drawGraph() {
                this.calculateLanes();

                const canvases = document.querySelectorAll('.graph-canvas');
                const maxLane = Math.max(...Array.from(this.commitLanes.values())) + 1;
                const canvasWidth = maxLane * LANE_WIDTH + 12;

                const dpr = window.devicePixelRatio || 1;

                canvases.forEach(canvas => {
                    const index = parseInt(canvas.dataset.index);
                    const commit = commits[index];

                    canvas.width = canvasWidth * dpr;
                    canvas.height = ROW_HEIGHT * dpr;
                    canvas.style.width = canvasWidth + 'px';
                    canvas.style.height = ROW_HEIGHT + 'px';

                    const ctx = canvas.getContext('2d');
                    ctx.scale(dpr, dpr);
                    ctx.imageSmoothingEnabled = false;
                    const lane = this.commitLanes.get(commit.hash);
                    const color = COLORS[lane % COLORS.length];
                    const x = px(lane * LANE_WIDTH + 10);
                    const y = ROW_HEIGHT / 2;

                    // 1. Draw passthrough lines for lanes active at this row
                    for (let i = 0; i < index; i++) {
                        commits[i].parents.forEach(parent => {
                            const parentIndex = commits.findIndex(c => c.hash === parent);
                            if (parentIndex > index) {
                                const pl = this.commitLanes.get(parent);
                                if (pl !== undefined && pl !== lane) {
                                    const plx = px(pl * LANE_WIDTH + 10);
                                    ctx.strokeStyle = COLORS[pl % COLORS.length];
                                    ctx.lineWidth = LINE_WIDTH;
                                    ctx.beginPath();
                                    ctx.moveTo(plx, 0);
                                    ctx.lineTo(plx, ROW_HEIGHT);
                                    ctx.stroke();
                                }
                            }
                        });
                    }

                    // 2. Draw this commit's lane line
                    const hasIncoming = index > 0 && commits.slice(0, index).some(c => c.parents.includes(commit.hash));
                    const hasOutgoing = commit.parents.some(p => commits.findIndex(c => c.hash === p) > index);

                    ctx.strokeStyle = color;
                    ctx.lineWidth = LINE_WIDTH;
                    if (hasIncoming) {
                        ctx.beginPath();
                        ctx.moveTo(x, 0);
                        ctx.lineTo(x, y);
                        ctx.stroke();
                    }
                    if (hasOutgoing) {
                        ctx.beginPath();
                        ctx.moveTo(x, y);
                        ctx.lineTo(x, ROW_HEIGHT);
                        ctx.stroke();
                    }

                    // 3. Draw merge/branch connection lines to other lanes
                    for (let i = 0; i < index; i++) {
                        const childCommit = commits[i];
                        if (childCommit.parents.includes(commit.hash)) {
                            const childLane = this.commitLanes.get(childCommit.hash);
                            if (childLane !== lane) {
                                const childX = px(childLane * LANE_WIDTH + 10);
                                ctx.strokeStyle = color;
                                ctx.lineWidth = LINE_WIDTH;
                                ctx.beginPath();
                                ctx.moveTo(childX, 0);
                                ctx.bezierCurveTo(childX, y, x, 0, x, y);
                                ctx.stroke();
                            }
                        }
                    }
                    commit.parents.forEach(parent => {
                        const parentIndex = commits.findIndex(c => c.hash === parent);
                        if (parentIndex > index) {
                            const parentLane = this.commitLanes.get(parent);
                            if (parentLane !== undefined && parentLane !== lane) {
                                const parentX = px(parentLane * LANE_WIDTH + 10);
                                ctx.strokeStyle = color;
                                ctx.lineWidth = LINE_WIDTH;
                                ctx.beginPath();
                                ctx.moveTo(x, y);
                                ctx.bezierCurveTo(x, ROW_HEIGHT, parentX, y, parentX, ROW_HEIGHT);
                                ctx.stroke();
                            }
                        }
                    });

                    // 4. Draw commit dot on top of all lines
                    const dotX = Math.round(lane * LANE_WIDTH + 10);
                    const dotY = Math.round(y);
                    const isHead = commit.hash === headCommitHash;
                    if (isHead) {
                        // Hollow ring for HEAD — fill with transparent then stroke
                        ctx.clearRect(dotX - COMMIT_RADIUS - 1, dotY - COMMIT_RADIUS - 1, (COMMIT_RADIUS + 1) * 2, (COMMIT_RADIUS + 1) * 2);
                        ctx.strokeStyle = color;
                        ctx.lineWidth = 2;
                        ctx.beginPath();
                        ctx.arc(dotX, dotY, COMMIT_RADIUS, 0, 2 * Math.PI);
                        ctx.stroke();
                        ctx.fillStyle = color;
                        ctx.beginPath();
                        ctx.arc(dotX, dotY, 2, 0, 2 * Math.PI);
                        ctx.fill();
                    } else {
                        // Solid filled dot
                        ctx.fillStyle = color;
                        ctx.beginPath();
                        ctx.arc(dotX, dotY, COMMIT_RADIUS, 0, 2 * Math.PI);
                        ctx.fill();
                    }
                });
            }
        }

        if (commits.length > 0) {
            const renderer = new GraphRenderer();
            renderer.drawGraph();

            // Context menu functionality
            const contextMenu = document.getElementById('context-menu');
            let selectedCommitHash = null;
            let selectedRow = null;

            // Show context menu on right-click
            document.getElementById('commit-tbody').addEventListener('contextmenu', (e) => {
                e.preventDefault();

                const row = e.target.closest('tr');
                if (!row) {
                    return;
                }

                selectedCommitHash = row.dataset.commitHash;
                selectedRow = row;

                contextMenu.style.display = 'block';
                contextMenu.style.left = e.pageX + 'px';
                contextMenu.style.top = e.pageY + 'px';
            });

            // Hide context menu on click outside
            document.addEventListener('click', () => {
                contextMenu.style.display = 'none';
            });

            // Handle context menu item clicks
            contextMenu.addEventListener('click', (e) => {
                const item = e.target.closest('.context-menu-item');
                if (!item || !selectedCommitHash) { return; }
                const action = item.dataset.action;
                contextMenu.style.display = 'none';

                if (action === 'editCommitMessage') {
                    const messageText = selectedRow.querySelector('.message-text');
                    const original = messageText.textContent;

                    const input = document.createElement('input');
                    input.type = 'text';
                    input.value = original;
                    input.className = 'message-edit-input';
                    messageText.replaceWith(input);
                    input.focus();
                    input.select();

                    const confirmEdit = () => {
                        const newMessage = input.value.trim();
                        messageText.textContent = newMessage || original;
                        input.replaceWith(messageText);
                        if (newMessage && newMessage !== original) {
                            vscode.postMessage({ command: 'editCommitMessage', commitHash: selectedCommitHash, newMessage });
                        }
                    };
                    const cancelEdit = () => {
                        messageText.textContent = original;
                        input.replaceWith(messageText);
                    };

                    input.addEventListener('keydown', ev => {
                        if (ev.key === 'Enter') { ev.preventDefault(); confirmEdit(); }
                        if (ev.key === 'Escape') { ev.preventDefault(); cancelEdit(); }
                    });
                    input.addEventListener('blur', cancelEdit);
                    return;
                }

                vscode.postMessage({ command: action, commitHash: selectedCommitHash });
            });
        }
    </script>
</body>
</html>`;
    }

    private escapeHtml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    private formatRefs(refs: string[]): string {
        if (!refs || refs.length === 0) {
            return '';
        }

        return `<div class="refs-container">
            ${refs.map(ref => {
                let refClass = 'ref-badge';
                let refName = ref;

                // Extract branch name from HEAD -> branch pointers
                if (ref.startsWith('HEAD -> ')) {
                    refName = ref.substring(8); // Remove "HEAD -> " prefix
                    refClass += ' ref-head';
                    return `<span class="${refClass}">${this.escapeHtml(refName)}</span>`;
                }

                // Determine ref type and format name
                if (ref === 'HEAD') {
                    // Detached HEAD state
                    refClass += ' ref-head';
                    refName = 'HEAD';
                } else if (ref.startsWith('tag: ')) {
                    refClass += ' ref-tag';
                    refName = ref.substring(5);
                } else if (ref.includes('origin/HEAD') || ref.includes('upstream/HEAD')) {
                    // Skip remote HEAD pointers
                    return '';
                } else if (ref.includes('origin/') || ref.includes('upstream/')) {
                    refClass += ' ref-remote';
                    // Clean up remote refs
                    refName = ref.replace('refs/remotes/', '');
                } else {
                    refClass += ' ref-branch';
                    // Clean up local branch refs
                    refName = ref.replace('refs/heads/', '');
                }

                return `<span class="${refClass}">${this.escapeHtml(refName)}</span>`;
            }).filter(badge => badge).join('')}
        </div>`;
    }
}
