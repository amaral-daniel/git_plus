import * as vscode from 'vscode';
import { GitCommit } from './gitOperations';

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function formatRefs(refs: string[]): string {
    if (!refs || refs.length === 0) {
        return '';
    }

    return `<div class="refs-container">
        ${refs.map(ref => {
            let refClass = 'ref-badge';
            let refName = ref;

            if (ref.startsWith('HEAD -> ')) {
                refName = ref.substring(8);
                refClass += ' ref-head';
                return `<span class="${refClass}">${escapeHtml(refName)}</span>`;
            }

            if (ref === 'HEAD') {
                refClass += ' ref-head';
                refName = 'HEAD';
            } else if (ref.startsWith('tag: ')) {
                refClass += ' ref-tag';
                refName = ref.substring(5);
            } else if (ref.includes('origin/HEAD') || ref.includes('upstream/HEAD')) {
                return '';
            } else if (ref.includes('origin/') || ref.includes('upstream/')) {
                refClass += ' ref-remote';
                refName = ref.replace('refs/remotes/', '');
            } else {
                refClass += ' ref-branch';
                refName = ref.replace('refs/heads/', '');
            }

            return `<span class="${refClass}">${escapeHtml(refName)}</span>`;
        }).filter(badge => badge).join('')}
    </div>`;
}

export function getHtmlForWebview(_webview: vscode.Webview, commits: GitCommit[]): string {
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

        tr.row-selected {
            background-color: var(--vscode-list-inactiveSelectionBackground);
        }

        tr.row-selected:hover {
            background-color: var(--vscode-list-activeSelectionBackground);
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
                            <td class="message-cell" title="${escapeHtml(commit.message)}">
                                ${formatRefs(commit.refs)}
                                <span class="message-text">${escapeHtml(commit.message)}</span>
                            </td>
                            <td class="hash-cell">${commit.shortHash}</td>
                            <td class="author-cell">${escapeHtml(commit.author)}</td>
                            <td class="date-cell">${commit.date}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        <div id="context-menu" class="context-menu">
            <div class="context-menu-item" data-action="showCommitDetails">Show more details</div>
            <div class="context-menu-separator"></div>
            <div class="context-menu-item" data-action="copyHash">Copy Hash</div>
            <div class="context-menu-separator"></div>
            <div class="context-menu-item" data-action="cherryPick">Cherry Pick</div>
            <div class="context-menu-item" data-action="revertCommit">Revert Commit</div>
            <div class="context-menu-separator"></div>
            <div class="context-menu-item" data-action="editCommitMessage">Edit Commit Message</div>
            <div class="context-menu-item" data-action="resetToCommit">Reset to Commit</div>
        </div>
        <div id="range-context-menu" class="context-menu">
            <div class="context-menu-item" data-action="squashCommits">Squash Commits</div>
            <div class="context-menu-separator"></div>
            <div class="context-menu-item" data-action="cherryPickRange">Cherry-pick Commits</div>
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

            const contextMenu = document.getElementById('context-menu');
            const rangeContextMenu = document.getElementById('range-context-menu');
            let selectedCommitHash = null;
            let selectedRow = null;
            let rangeStartIndex = null;
            let selectedIndices = new Set();

            function updateRowHighlights() {
                document.querySelectorAll('tr[data-commit-index]').forEach(r => {
                    const idx = parseInt(r.dataset.commitIndex);
                    r.classList.toggle('row-selected', selectedIndices.has(idx));
                });
            }

            function areCommitsConsecutive(sortedIndices) {
                for (let i = 0; i < sortedIndices.length - 1; i++) {
                    const newer = commits[sortedIndices[i]];
                    const older = commits[sortedIndices[i + 1]];
                    if (newer.parents.length !== 1 || !newer.parents.includes(older.hash)) {
                        return false;
                    }
                }
                return true;
            }

            // Shift-click range selection
            document.getElementById('commit-tbody').addEventListener('click', (e) => {
                const row = e.target.closest('tr');
                if (!row) { return; }
                const clickedIndex = parseInt(row.dataset.commitIndex);

                if (e.shiftKey && rangeStartIndex !== null) {
                    const min = Math.min(rangeStartIndex, clickedIndex);
                    const max = Math.max(rangeStartIndex, clickedIndex);
                    selectedIndices = new Set();
                    for (let i = min; i <= max; i++) { selectedIndices.add(i); }
                } else {
                    rangeStartIndex = clickedIndex;
                    selectedIndices = new Set([clickedIndex]);
                }
                updateRowHighlights();
            });

            // Right-click context menu
            document.getElementById('commit-tbody').addEventListener('contextmenu', (e) => {
                e.preventDefault();
                contextMenu.style.display = 'none';
                rangeContextMenu.style.display = 'none';

                const row = e.target.closest('tr');
                if (!row) { return; }

                const clickedIndex = parseInt(row.dataset.commitIndex);

                if (selectedIndices.size > 1 && selectedIndices.has(clickedIndex)) {
                    // Range context menu
                    const sortedIndices = Array.from(selectedIndices).sort((a, b) => a - b);
                    const consecutive = areCommitsConsecutive(sortedIndices);
                    const squashItem = rangeContextMenu.querySelector('[data-action="squashCommits"]');
                    const separator = rangeContextMenu.querySelector('.context-menu-separator');
                    squashItem.style.display = consecutive ? 'flex' : 'none';
                    separator.style.display = consecutive ? 'block' : 'none';
                    rangeContextMenu.style.display = 'block';
                    rangeContextMenu.style.left = e.pageX + 'px';
                    rangeContextMenu.style.top = e.pageY + 'px';
                } else {
                    // Single commit context menu
                    selectedCommitHash = row.dataset.commitHash;
                    selectedRow = row;
                    rangeStartIndex = clickedIndex;
                    selectedIndices = new Set([clickedIndex]);
                    updateRowHighlights();
                    contextMenu.style.display = 'block';
                    contextMenu.style.left = e.pageX + 'px';
                    contextMenu.style.top = e.pageY + 'px';
                }
            });

            // Hide menus on click outside
            document.addEventListener('click', () => {
                contextMenu.style.display = 'none';
                rangeContextMenu.style.display = 'none';
            });

            // Single commit menu actions
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

            // Range menu actions
            rangeContextMenu.addEventListener('click', (e) => {
                const item = e.target.closest('.context-menu-item');
                if (!item) { return; }
                const action = item.dataset.action;
                rangeContextMenu.style.display = 'none';

                // sortedIndices: ascending index order (lower index = newer commit)
                const sortedIndices = Array.from(selectedIndices).sort((a, b) => a - b);
                const hashes = sortedIndices.map(i => commits[i].hash);
                const oldestIndex = sortedIndices[sortedIndices.length - 1];
                const parentHash = commits[oldestIndex].parents[0];
                vscode.postMessage({ command: action, hashes, parentHash });
            });
        }
    </script>
</body>
</html>`;
}

export function getCommitDetailsHtml(info: {
    fullHash: string;
    authorEmail: string;
    authorName: string;
    authorDate: string;
    commitDate: string;
    subject: string;
    body: string;
    patch: string;
}): string {
    const { fullHash, authorEmail, authorName, authorDate, commitDate, subject, body, patch } = info;
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const formattedAuthorDate = authorDate ? new Date(authorDate).toLocaleString() : '';
    const formattedCommitDate = commitDate ? new Date(commitDate).toLocaleString() : '';
    const showCommitDate = formattedCommitDate && formattedCommitDate !== formattedAuthorDate;

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Commit ${esc(fullHash.substring(0, 7))}</title>
<style>
  body {
    font-family: var(--vscode-font-family);
    font-size: 13px;
    color: var(--vscode-foreground);
    background-color: var(--vscode-editor-background);
    margin: 0;
    padding: 20px 24px;
    line-height: 1.5;
  }
  .subject {
    font-size: 16px;
    font-weight: 600;
    margin: 0 0 8px 0;
  }
  .body {
    color: var(--vscode-descriptionForeground);
    margin: 0 0 16px 0;
    white-space: pre-wrap;
  }
  .meta {
    display: grid;
    grid-template-columns: 90px 1fr;
    gap: 4px 8px;
    margin-bottom: 24px;
    font-size: 12px;
  }
  .meta-label {
    color: var(--vscode-descriptionForeground);
    font-weight: 500;
    text-align: right;
    padding-top: 1px;
  }
  .meta-value { word-break: break-all; }
  .meta-value.hash {
    font-family: var(--vscode-editor-font-family);
    font-size: 11px;
    color: var(--vscode-textPreformat-foreground);
  }
  .section-title {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--vscode-descriptionForeground);
    margin-bottom: 10px;
  }
  details {
    border: 1px solid var(--vscode-panel-border);
    border-radius: 6px;
    margin-bottom: 8px;
    overflow: hidden;
  }
  summary {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 7px 12px;
    cursor: pointer;
    font-size: 12px;
    font-family: var(--vscode-editor-font-family);
    list-style: none;
    user-select: none;
    background-color: var(--vscode-sideBar-background);
  }
  summary:hover { background-color: var(--vscode-list-hoverBackground); }
  summary::-webkit-details-marker { display: none; }
  .chevron { font-size: 10px; color: var(--vscode-descriptionForeground); transition: transform 0.15s; }
  details[open] .chevron { transform: rotate(90deg); }
  .file-name { flex: 1; }
  .file-stats { font-size: 11px; white-space: nowrap; }
  .added { color: var(--vscode-gitDecoration-addedResourceForeground); }
  .removed { color: var(--vscode-gitDecoration-deletedResourceForeground); }
  pre.diff-content {
    margin: 0;
    padding: 8px 0;
    font-family: var(--vscode-editor-font-family);
    font-size: 12px;
    overflow-x: auto;
    line-height: 1.6;
    background-color: var(--vscode-editor-background);
  }
  .diff-line { display: block; padding: 0 12px; white-space: pre; }
  .diff-add { background-color: var(--vscode-diffEditor-insertedLineBackground, rgba(70,150,70,0.15)); color: var(--vscode-gitDecoration-addedResourceForeground); }
  .diff-del { background-color: var(--vscode-diffEditor-removedLineBackground, rgba(150,70,70,0.15)); color: var(--vscode-gitDecoration-deletedResourceForeground); }
  .diff-hunk { color: var(--vscode-gitDecoration-untrackedResourceForeground); font-weight: 600; }
  .diff-ctx { color: var(--vscode-foreground); }
  .no-changes { color: var(--vscode-descriptionForeground); font-size: 12px; padding: 8px 0; }
  .copyable { cursor: pointer; border-radius: 3px; padding: 1px 3px; margin: -1px -3px; }
  .copyable:hover { background-color: var(--vscode-list-hoverBackground); }
  #copy-toast {
    position: fixed; bottom: 20px; right: 20px;
    background-color: var(--vscode-editorWidget-background);
    border: 1px solid var(--vscode-panel-border);
    color: var(--vscode-foreground);
    padding: 5px 12px; border-radius: 4px; font-size: 12px;
    opacity: 0; transition: opacity 0.15s; pointer-events: none;
  }
  #copy-toast.show { opacity: 1; }
</style>
</head>
<body>
<p class="subject">${esc(subject)}</p>
${body ? `<p class="body">${esc(body)}</p>` : ''}
<div class="meta">
  <span class="meta-label">Hash</span><code class="meta-value hash copyable" data-copy="${esc(fullHash)}" title="Click to copy">${esc(fullHash)}</code>
  <span class="meta-label">Author</span><span class="meta-value copyable" data-copy="${esc(authorName + ' <' + authorEmail + '>')}" title="Click to copy">${esc(authorName)} &lt;${esc(authorEmail)}&gt;</span>
  <span class="meta-label">Date</span><span class="meta-value copyable" data-copy="${esc(formattedAuthorDate)}" title="Click to copy">${esc(formattedAuthorDate)}</span>
  ${showCommitDate ? `<span class="meta-label">Committed</span><span class="meta-value copyable" data-copy="${esc(formattedCommitDate)}" title="Click to copy">${esc(formattedCommitDate)}</span>` : ''}
</div>
<div class="section-title">Changed Files</div>
<div id="diff-container"><p class="no-changes">No diff available.</p></div>
<script>
  const rawPatch = ${JSON.stringify(patch)};

  function escHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function renderDiff(patch) {
    const container = document.getElementById('diff-container');
    // Find the start of the first diff block
    const diffIdx = patch.indexOf('\\ndiff --git ');
    if (diffIdx < 0) { return; }
    const diffText = patch.slice(diffIdx + 1);

    // Split into per-file sections
    const sections = diffText.split(/(?=^diff --git )/m).filter(s => s.trim());
    if (!sections.length) { return; }

    container.innerHTML = '';

    sections.forEach(section => {
      const lines = section.split('\\n');

      // Extract file path from "diff --git a/... b/..."
      const headerMatch = lines[0].match(/^diff --git a\\/(.*?) b\\/(.*)$/);
      const filePath = headerMatch ? headerMatch[2] : lines[0];

      // Count added/removed lines
      let added = 0, removed = 0;
      lines.forEach(line => {
        if (line.startsWith('+') && !line.startsWith('+++')) { added++; }
        if (line.startsWith('-') && !line.startsWith('---')) { removed++; }
      });

      const details = document.createElement('details');
      details.open = true;

      const summary = document.createElement('summary');
      summary.innerHTML =
        '<span class="chevron">&#9658;</span>' +
        '<span class="file-name">' + escHtml(filePath) + '</span>' +
        '<span class="file-stats">' +
          (added ? '<span class="added">+' + added + '</span> ' : '') +
          (removed ? '<span class="removed">-' + removed + '</span>' : '') +
        '</span>';

      const pre = document.createElement('pre');
      pre.className = 'diff-content';

      let inHunk = false;
      const rendered = lines.map(line => {
        if (line.startsWith('@@')) {
          inHunk = true;
          return '<span class="diff-line diff-hunk">' + escHtml(line) + '</span>';
        }
        if (!inHunk) { return null; }
        if (line.startsWith('+')) { return '<span class="diff-line diff-add">' + escHtml(line) + '</span>'; }
        if (line.startsWith('-')) { return '<span class="diff-line diff-del">' + escHtml(line) + '</span>'; }
        return '<span class="diff-line diff-ctx">' + escHtml(line) + '</span>';
      }).filter(l => l !== null).join('\\n');

      pre.innerHTML = rendered;
      details.appendChild(summary);
      details.appendChild(pre);
      container.appendChild(details);
    });
  }

  renderDiff(rawPatch);

  // Copy-to-clipboard for meta values
  const toast = document.getElementById('copy-toast');
  let toastTimer;
  document.querySelector('.meta').addEventListener('click', e => {
    const el = e.target.closest('.copyable');
    if (!el) { return; }
    navigator.clipboard.writeText(el.dataset.copy).then(() => {
      toast.textContent = 'Copied!';
      toast.classList.add('show');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toast.classList.remove('show'), 1500);
    });
  });
</script>
<div id="copy-toast"></div>
</body>
</html>`;
}
