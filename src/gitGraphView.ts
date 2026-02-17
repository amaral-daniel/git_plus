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
            'Git Graph',
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
                        provider.editCommitMessage(message.commitHash);
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
                        this.editCommitMessage(message.commitHash);
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

    public async editCommitMessage(commitHash: string) {
        const newMessage = await vscode.window.showInputBox({
            prompt: 'Enter new commit message',
            placeHolder: 'New commit message'
        });

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
            const gitCommand = 'git log --all --pretty=format:"%H|%h|%P|%an|%ai|%D|%s" --date-order';

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
    <title>Git Graph</title>
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

        thead {
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            position: sticky;
            top: 0;
            z-index: 10;
        }

        th {
            text-align: left;
            padding: 6px 8px;
            font-weight: 500;
            font-size: 11px;
            border-bottom: 1px solid var(--vscode-panel-border);
            white-space: nowrap;
            color: var(--vscode-foreground);
            opacity: 0.8;
        }

        td {
            padding: 4px 8px;
        }

        tbody tr:hover {
            background-color: var(--vscode-list-hoverBackground);
        }

        .graph-cell {
            padding: 0;
            width: 120px;
            min-width: 120px;
        }

        .graph-canvas {
            display: block;
            height: 28px;
        }

        .hash-cell {
            font-family: var(--vscode-editor-font-family);
            color: var(--vscode-textLink-foreground);
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
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
            z-index: 1000;
            min-width: 200px;
            display: none;
        }

        .context-menu-item {
            padding: 8px 12px;
            cursor: pointer;
            color: var(--vscode-menu-foreground);
            font-size: 12px;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .context-menu-item:hover {
            background-color: var(--vscode-menu-selectionBackground);
            color: var(--vscode-menu-selectionForeground);
        }

        .context-menu-separator {
            height: 1px;
            background-color: var(--vscode-menu-separatorBackground);
            margin: 4px 0;
        }

        tbody tr {
            cursor: pointer;
        }
    </style>
</head>
<body>
    ${commits.length > 0 ? `
        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th>Graph</th>
                        <th>Message</th>
                        <th>Hash</th>
                        <th>Author</th>
                        <th>Date</th>
                    </tr>
                </thead>
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
            '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6',
            '#1abc9c', '#e67e22', '#34495e', '#16a085', '#c0392b'
        ];

        const LANE_WIDTH = 20;
        const ROW_HEIGHT = 28;
        const COMMIT_RADIUS = 4;

        class GraphRenderer {
            constructor() {
                this.lanes = [];
                this.commitLanes = new Map();
            }

            findAvailableLane(usedLanes) {
                for (let i = 0; i < 10; i++) {
                    if (!usedLanes.has(i)) {
                        return i;
                    }
                }
                return usedLanes.size;
            }

            calculateLanes() {
                // Build a map of commits that have multiple children (branch points)
                const childrenCount = new Map();
                commits.forEach(commit => {
                    commit.parents.forEach(parent => {
                        childrenCount.set(parent, (childrenCount.get(parent) || 0) + 1);
                    });
                });

                // Track which lanes are reserved for which commits
                const reservedLanes = new Map(); // commit hash -> lane number
                let nextLane = 0;

                for (let i = 0; i < commits.length; i++) {
                    const commit = commits[i];
                    let assignedLane;

                    // Check if this commit already has a reserved lane
                    if (reservedLanes.has(commit.hash)) {
                        assignedLane = reservedLanes.get(commit.hash);
                        reservedLanes.delete(commit.hash);
                    } else {
                        // Assign a new lane
                        assignedLane = nextLane++;
                    }

                    this.commitLanes.set(commit.hash, assignedLane);

                    // Reserve lanes for parent commits
                    if (commit.parents.length > 0) {
                        // First parent continues on the same lane
                        const firstParent = commit.parents[0];
                        if (!reservedLanes.has(firstParent)) {
                            reservedLanes.set(firstParent, assignedLane);
                        }

                        // Additional parents (merge commits) get new lanes
                        for (let j = 1; j < commit.parents.length; j++) {
                            const parent = commit.parents[j];
                            if (!reservedLanes.has(parent)) {
                                // Find an available lane
                                const usedLanes = new Set(reservedLanes.values());
                                let newLane = 0;
                                while (usedLanes.has(newLane)) {
                                    newLane++;
                                }
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
                const canvasWidth = maxLane * LANE_WIDTH + 20;

                canvases.forEach(canvas => {
                    const index = parseInt(canvas.dataset.index);
                    const commit = commits[index];

                    canvas.width = canvasWidth;
                    canvas.height = ROW_HEIGHT;

                    const ctx = canvas.getContext('2d');
                    const lane = this.commitLanes.get(commit.hash);
                    const x = lane * LANE_WIDTH + 10;
                    const y = ROW_HEIGHT / 2;

                    // Draw passthrough lines for other lanes
                    if (index > 0) {
                        const activeLanes = new Set();
                        // Collect all active lanes from commits above that have parents below
                        for (let i = 0; i < index; i++) {
                            const prevCommit = commits[i];
                            prevCommit.parents.forEach(parent => {
                                const parentIndex = commits.findIndex(c => c.hash === parent);
                                if (parentIndex > index) {
                                    const parentLane = this.commitLanes.get(parent);
                                    if (parentLane !== undefined && parentLane !== lane) {
                                        activeLanes.add(parentLane);
                                    }
                                }
                            });
                        }

                        // Draw passthrough lines
                        activeLanes.forEach(passthroughLane => {
                            const passthroughX = passthroughLane * LANE_WIDTH + 10;
                            ctx.strokeStyle = COLORS[passthroughLane % COLORS.length];
                            ctx.lineWidth = 2.5;
                            ctx.beginPath();
                            ctx.moveTo(passthroughX, 0);
                            ctx.lineTo(passthroughX, ROW_HEIGHT);
                            ctx.stroke();
                        });
                    }

                    // Draw incoming line from child commit above
                    if (index > 0) {
                        for (let i = 0; i < index; i++) {
                            const childCommit = commits[i];
                            if (childCommit.parents.includes(commit.hash)) {
                                const childLane = this.commitLanes.get(childCommit.hash);
                                const childX = childLane * LANE_WIDTH + 10;

                                ctx.strokeStyle = COLORS[lane % COLORS.length];
                                ctx.lineWidth = 2.5;
                                ctx.beginPath();

                                if (lane === childLane) {
                                    // Straight line from top to commit
                                    ctx.moveTo(x, 0);
                                    ctx.lineTo(x, y - COMMIT_RADIUS);
                                } else {
                                    // Curved line from different lane
                                    const midY = ROW_HEIGHT / 2;
                                    ctx.moveTo(childX, 0);
                                    ctx.bezierCurveTo(
                                        childX, midY,
                                        x, midY,
                                        x, y - COMMIT_RADIUS
                                    );
                                }
                                ctx.stroke();
                            }
                        }
                    }

                    // Draw outgoing lines to parent commits below
                    commit.parents.forEach((parent, parentIdx) => {
                        const parentIndex = commits.findIndex(c => c.hash === parent);
                        if (parentIndex !== -1 && parentIndex > index) {
                            const parentLane = this.commitLanes.get(parent);

                            // For same lane, draw straight line down
                            // For different lanes, just draw straight down in current lane
                            // The curve will be drawn by the parent's incoming line
                            const lineColor = COLORS[lane % COLORS.length];

                            ctx.strokeStyle = lineColor;
                            ctx.lineWidth = 2.5;
                            ctx.beginPath();
                            ctx.moveTo(x, y + COMMIT_RADIUS);
                            ctx.lineTo(x, ROW_HEIGHT);
                            ctx.stroke();
                        }
                    });

                    // Draw commit dot (on top of lines)
                    ctx.fillStyle = COLORS[lane % COLORS.length];
                    ctx.beginPath();
                    ctx.arc(x, y, COMMIT_RADIUS, 0, 2 * Math.PI);
                    ctx.fill();

                    // Outline the commit dot
                    ctx.strokeStyle = 'var(--vscode-editor-background)';
                    ctx.lineWidth = 2.5;
                    ctx.stroke();
                });
            }
        }

        if (commits.length > 0) {
            const renderer = new GraphRenderer();
            renderer.drawGraph();

            // Context menu functionality
            const contextMenu = document.getElementById('context-menu');
            let selectedCommitHash = null;

            // Show context menu on right-click
            document.getElementById('commit-tbody').addEventListener('contextmenu', (e) => {
                e.preventDefault();

                const row = e.target.closest('tr');
                if (!row) {
                    return;
                }

                selectedCommitHash = row.dataset.commitHash;

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
                if (!item || !selectedCommitHash) {
                    return;
                }

                const action = item.dataset.action;

                vscode.postMessage({
                    command: action,
                    commitHash: selectedCommitHash
                });

                contextMenu.style.display = 'none';
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

                // Skip HEAD -> branch pointers, just show the branch
                if (ref.startsWith('HEAD -> ')) {
                    return '';
                }

                // Determine ref type and format name
                if (ref === 'HEAD') {
                    // Local HEAD pointer
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
