import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';

interface GitCommit {
    hash: string;
    message: string;
    date: string;
    author: string;
    parents: string[];
}

export class GitGraphViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'gitPlusGraphView';
    private static currentPanel: vscode.WebviewPanel | undefined;

    constructor(private readonly _extensionUri: vscode.Uri) {}

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
                if (message.command === 'refresh') {
                    provider.updateWebview(panel.webview);
                }
            }
        );
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        this.updateWebview(webviewView.webview);
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

            // Git log format: hash|parents|author|date|message
            const gitCommand = 'git log --all --pretty=format:"%h|%p|%an|%ai|%s" --date-order';

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
                        const [hash, parents, author, date, ...messageParts] = line.split('|');
                        return {
                            hash: hash.trim(),
                            message: messageParts.join('|').trim(),
                            date: new Date(date).toLocaleString(),
                            author: author.trim(),
                            parents: parents.trim().split(' ').filter(p => p)
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

        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 6px 8px;
            border-bottom: 1px solid var(--vscode-panel-border);
            margin-bottom: 8px;
            background-color: var(--vscode-editor-background);
        }

        h1 {
            margin: 0;
            font-size: 13px;
            font-weight: 600;
            color: var(--vscode-foreground);
        }

        .refresh-btn {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 4px 10px;
            cursor: pointer;
            border-radius: 2px;
            font-size: 11px;
        }

        .refresh-btn:hover {
            background-color: var(--vscode-button-hoverBackground);
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
            font-weight: 600;
            font-size: 11px;
            border-bottom: 1px solid var(--vscode-panel-border);
            white-space: nowrap;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: var(--vscode-descriptionForeground);
        }

        td {
            padding: 4px 8px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }

        tbody tr:hover {
            background-color: var(--vscode-list-hoverBackground);
        }

        .graph-cell {
            padding: 0;
            width: 80px;
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
        }

        .message-cell {
            max-width: 500px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            font-size: 12px;
        }

        .author-cell {
            white-space: nowrap;
            color: var(--vscode-descriptionForeground);
            font-size: 11px;
        }

        .date-cell {
            white-space: nowrap;
            color: var(--vscode-descriptionForeground);
            font-size: 11px;
        }

        .no-commits {
            text-align: center;
            padding: 40px;
            color: var(--vscode-descriptionForeground);
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Git Graph</h1>
        <button class="refresh-btn" onclick="refresh()">Refresh</button>
    </div>

    ${commits.length > 0 ? `
        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th>Graph</th>
                        <th>Hash</th>
                        <th>Message</th>
                        <th>Author</th>
                        <th>Date</th>
                    </tr>
                </thead>
                <tbody id="commit-tbody">
                    ${commits.map((commit, index) => `
                        <tr>
                            <td class="graph-cell">
                                <canvas class="graph-canvas" data-index="${index}"></canvas>
                            </td>
                            <td class="hash-cell">${commit.hash}</td>
                            <td class="message-cell" title="${this.escapeHtml(commit.message)}">${this.escapeHtml(commit.message)}</td>
                            <td class="author-cell">${this.escapeHtml(commit.author)}</td>
                            <td class="date-cell">${commit.date}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    ` : `
        <div class="no-commits">
            <p>No commits found in this repository</p>
        </div>
    `}

    <script>
        const vscode = acquireVsCodeApi();
        const commits = ${commitsJson};

        function refresh() {
            vscode.postMessage({ command: 'refresh' });
        }

        // Graph drawing logic
        const COLORS = [
            '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6',
            '#1abc9c', '#e67e22', '#34495e', '#16a085', '#c0392b'
        ];

        const LANE_WIDTH = 16;
        const ROW_HEIGHT = 28;
        const COMMIT_RADIUS = 3;

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
                const hashToIndex = new Map();
                commits.forEach((commit, index) => {
                    hashToIndex.set(commit.hash, index);
                });

                const activeLanes = new Map();

                for (let i = 0; i < commits.length; i++) {
                    const commit = commits[i];
                    let lane = null;

                    // Check if this commit was already reserved by a child commit
                    if (activeLanes.has(commit.hash)) {
                        lane = activeLanes.get(commit.hash);
                        activeLanes.delete(commit.hash);
                    } else {
                        // Find a new available lane
                        const usedLanes = new Set(activeLanes.values());
                        lane = this.findAvailableLane(usedLanes);
                    }

                    this.commitLanes.set(commit.hash, lane);

                    // Reserve lanes for parent commits
                    commit.parents.forEach((parent, idx) => {
                        if (idx === 0) {
                            // First parent continues on same lane
                            activeLanes.set(parent, lane);
                        } else {
                            // Additional parents (merge) get new lanes
                            const usedLanes = new Set(activeLanes.values());
                            activeLanes.set(parent, this.findAvailableLane(usedLanes));
                        }
                    });
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

                    // Draw line coming from above (from parent)
                    if (index > 0) {
                        // Check if any previous commit has this commit as a child
                        for (let i = 0; i < index; i++) {
                            const prevCommit = commits[i];
                            if (prevCommit.parents.includes(commit.hash)) {
                                const prevLane = this.commitLanes.get(prevCommit.hash);
                                const prevX = prevLane * LANE_WIDTH + 10;

                                ctx.strokeStyle = COLORS[lane % COLORS.length];
                                ctx.lineWidth = 2;
                                ctx.beginPath();

                                if (lane === prevLane) {
                                    // Straight line from top
                                    ctx.moveTo(x, 0);
                                    ctx.lineTo(x, y - COMMIT_RADIUS);
                                } else {
                                    // Curved line from different lane
                                    ctx.moveTo(prevX, 0);
                                    ctx.bezierCurveTo(
                                        prevX, 10,
                                        x, y - COMMIT_RADIUS - 10,
                                        x, y - COMMIT_RADIUS
                                    );
                                }
                                ctx.stroke();
                                break;
                            }
                        }
                    }

                    // Draw lines going down to children (parents in git terminology)
                    commit.parents.forEach(parent => {
                        const parentIndex = commits.findIndex(c => c.hash === parent);
                        if (parentIndex !== -1 && parentIndex > index) {
                            const parentLane = this.commitLanes.get(parent);
                            const parentX = parentLane * LANE_WIDTH + 10;

                            ctx.strokeStyle = COLORS[lane % COLORS.length];
                            ctx.lineWidth = 2;
                            ctx.beginPath();
                            ctx.moveTo(x, y + COMMIT_RADIUS);

                            if (lane === parentLane) {
                                // Straight line down
                                ctx.lineTo(x, ROW_HEIGHT);
                            } else {
                                // Curved line to different lane
                                ctx.bezierCurveTo(
                                    x, y + COMMIT_RADIUS + 10,
                                    parentX, ROW_HEIGHT - 10,
                                    parentX, ROW_HEIGHT
                                );
                            }
                            ctx.stroke();
                        }
                    });

                    // Draw commit dot
                    ctx.fillStyle = COLORS[lane % COLORS.length];
                    ctx.beginPath();
                    ctx.arc(x, y, COMMIT_RADIUS, 0, 2 * Math.PI);
                    ctx.fill();
                    ctx.strokeStyle = '#2d2d2d';
                    ctx.lineWidth = 2;
                    ctx.stroke();
                });
            }
        }

        if (commits.length > 0) {
            const renderer = new GraphRenderer();
            renderer.drawGraph();
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
}
