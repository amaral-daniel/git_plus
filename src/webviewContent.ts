import * as vscode from 'vscode';
import { GitCommit } from './gitOperations';

export interface CommitDetailsData {
    fullHash: string;
    authorEmail: string;
    authorName: string;
    authorDate: string;
    commitDate: string;
    subject: string;
    body: string;
    patch: string;
}

function getNonce(): string {
    let text = '';
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return text;
}

export function getHtmlForWebview(webview: vscode.Webview, commits: GitCommit[], extensionUri: vscode.Uri): string {
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'out', 'webview', 'graph', 'index.js'));
    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline';">
    <title>Tree</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 10px;
            margin: 0;
        }
        .table-container { overflow-x: auto; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        td { padding: 4px 8px; }
        tbody tr:hover { background-color: var(--vscode-list-hoverBackground); }
        tbody tr { cursor: pointer; }
        .graph-cell { padding: 0; width: 1px; }
        .graph-canvas { display: block; }
        .hash-cell {
            font-family: var(--vscode-editor-font-family);
            color: var(--vscode-descriptionForeground);
            font-weight: 500;
            white-space: nowrap;
            font-size: 11px;
            width: 80px;
        }
        .message-cell { font-size: 12px; display: flex; align-items: center; gap: 6px; overflow: hidden; }
        .message-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .refs-container { display: flex; gap: 4px; flex-shrink: 0; align-items: center; }
        .ref-badge {
            display: inline-block; padding: 2px 6px; border-radius: 3px;
            font-size: 10px; font-weight: 500; white-space: nowrap; border: 1px solid;
        }
        .ref-head {
            background-color: var(--vscode-gitDecoration-modifiedResourceForeground);
            border-color: var(--vscode-gitDecoration-modifiedResourceForeground);
            color: var(--vscode-editor-background); font-weight: 600;
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
            white-space: nowrap; color: var(--vscode-descriptionForeground);
            font-size: 11px; width: 150px; max-width: 150px;
            overflow: hidden; text-overflow: ellipsis;
        }
        .date-cell { white-space: nowrap; color: var(--vscode-descriptionForeground); font-size: 11px; width: 140px; }
        .no-commits { text-align: center; padding: 40px; color: var(--vscode-descriptionForeground); }
        .context-menu {
            position: fixed;
            background-color: var(--vscode-menu-background);
            border: 1px solid var(--vscode-menu-border);
            border-radius: 8px;
            box-shadow: 0 2px 8px var(--vscode-widget-shadow);
            z-index: 1000; min-width: 200px; display: none; padding: 4px 0; overflow: hidden;
        }
        .context-menu-item {
            padding: 6px 20px; cursor: pointer; color: var(--vscode-menu-foreground);
            font-size: 13px; display: flex; align-items: center; gap: 8px;
            user-select: none; transition: background-color 0.1s ease;
        }
        .context-menu-item:hover {
            background-color: var(--vscode-list-hoverBackground);
            color: var(--vscode-list-hoverForeground);
        }
        .context-menu-separator { height: 1px; background-color: var(--vscode-menu-separatorBackground); margin: 4px 8px; }
        .message-edit-input {
            background: transparent; border: none;
            border-bottom: 1px solid var(--vscode-focusBorder);
            color: inherit; font: inherit; font-size: 12px;
            outline: none; padding: 0; width: 100%;
        }
        tr.row-selected { background-color: var(--vscode-list-inactiveSelectionBackground); }
        tr.row-selected:hover { background-color: var(--vscode-list-activeSelectionBackground); }
    </style>
</head>
<body>
    <div id="root"></div>
    <script nonce="${nonce}">window.__COMMITS__ = ${JSON.stringify(commits)};</script>
    <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}

export function getCommitDetailsHtml(webview: vscode.Webview, data: CommitDetailsData, extensionUri: vscode.Uri): string {
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'out', 'webview', 'commitDetails', 'index.js'));
    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline';">
<title>Commit ${data.fullHash.substring(0, 7)}</title>
<style>
  body {
    font-family: var(--vscode-font-family); font-size: 13px;
    color: var(--vscode-foreground); background-color: var(--vscode-editor-background);
    margin: 0; padding: 20px 24px; line-height: 1.5;
  }
  .subject { font-size: 16px; font-weight: 600; margin: 0 0 8px 0; }
  .body { color: var(--vscode-descriptionForeground); margin: 0 0 16px 0; white-space: pre-wrap; }
  .meta { display: grid; grid-template-columns: 90px 1fr; gap: 4px 8px; margin-bottom: 24px; font-size: 12px; }
  .meta-label { color: var(--vscode-descriptionForeground); font-weight: 500; text-align: right; padding-top: 1px; }
  .meta-value { word-break: break-all; }
  .meta-value.hash { font-family: var(--vscode-editor-font-family); font-size: 11px; color: var(--vscode-textPreformat-foreground); }
  .section-title {
    font-size: 11px; font-weight: 600; text-transform: uppercase;
    letter-spacing: 0.06em; color: var(--vscode-descriptionForeground); margin-bottom: 10px;
  }
  details { border: 1px solid var(--vscode-panel-border); border-radius: 6px; margin-bottom: 8px; overflow: hidden; }
  summary {
    display: flex; align-items: center; gap: 10px; padding: 7px 12px; cursor: pointer;
    font-size: 12px; font-family: var(--vscode-editor-font-family);
    list-style: none; user-select: none; background-color: var(--vscode-sideBar-background);
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
    margin: 0; padding: 8px 0; font-family: var(--vscode-editor-font-family);
    font-size: 12px; overflow-x: auto; line-height: 1.6; background-color: var(--vscode-editor-background);
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
    color: var(--vscode-foreground); padding: 5px 12px; border-radius: 4px; font-size: 12px;
    opacity: 0; transition: opacity 0.15s; pointer-events: none;
  }
  #copy-toast.show { opacity: 1; }
</style>
</head>
<body>
    <div id="root"></div>
    <script nonce="${nonce}">window.__COMMIT_DETAILS__ = ${JSON.stringify(data)};</script>
    <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}
