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
        * { box-sizing: border-box; }
        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 0;
            margin: 0;
            -webkit-font-smoothing: antialiased;
        }
        .table-container { overflow-x: auto; padding: 0 10px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        td { padding: 3px 6px; vertical-align: middle; }
        tbody tr:hover { background-color: var(--vscode-list-hoverBackground); }
        tbody tr { cursor: pointer; }
        .graph-cell { padding: 0; width: 1px; vertical-align: middle; }
        .graph-canvas { display: block; }
        .hash-cell {
            font-family: var(--vscode-editor-font-family);
            color: var(--vscode-descriptionForeground);
            font-size: 10.5px;
            white-space: nowrap;
            width: 72px;
            font-variant-numeric: tabular-nums;
            letter-spacing: 0.03em;
            opacity: 0.65;
            padding-left: 8px;
        }
        .message-cell { font-size: 12px; display: flex; align-items: center; gap: 5px; overflow: hidden; padding: 0 8px 0 2px; }
        .message-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .refs-container { display: flex; gap: 3px; flex-shrink: 0; align-items: center; }
        .ref-badge {
            display: inline-flex;
            align-items: center;
            height: 16px;
            padding: 0 6px;
            border-radius: 3px;
            font-size: 10px;
            font-weight: 600;
            white-space: nowrap;
            border: 1px solid;
            letter-spacing: 0.01em;
        }
        .ref-head {
            background-color: var(--vscode-gitDecoration-modifiedResourceForeground);
            border-color: var(--vscode-gitDecoration-modifiedResourceForeground);
            color: var(--vscode-editor-background);
            font-weight: 700;
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
            opacity: 0.8;
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
            width: 140px;
            max-width: 140px;
            overflow: hidden;
            text-overflow: ellipsis;
            opacity: 0.85;
        }
        .date-cell {
            white-space: nowrap;
            color: var(--vscode-descriptionForeground);
            font-size: 11px;
            width: 130px;
            font-variant-numeric: tabular-nums;
            opacity: 0.85;
            padding-right: 10px;
        }
        .no-commits { text-align: center; padding: 48px 20px; color: var(--vscode-descriptionForeground); font-size: 13px; }
        .search-wrap {
            padding: 8px 10px;
            position: sticky;
            top: 0;
            background: var(--vscode-editor-background);
            z-index: 10;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        .search-input {
            width: 100%;
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border, rgba(128,128,128,0.25));
            padding: 5px 10px;
            font-size: var(--vscode-font-size);
            font-family: var(--vscode-font-family);
            outline: none;
            border-radius: 4px;
            box-sizing: border-box;
            transition: border-color 0.15s ease;
        }
        .search-input:focus { border-color: var(--vscode-focusBorder); }
        .search-input::placeholder { color: var(--vscode-input-placeholderForeground, rgba(128,128,128,0.45)); }
        .context-menu {
            position: fixed;
            background-color: var(--vscode-menu-background);
            border: 1px solid var(--vscode-menu-border, var(--vscode-panel-border));
            border-radius: 6px;
            box-shadow: 0 4px 16px rgba(0,0,0,0.3), 0 1px 4px rgba(0,0,0,0.15);
            z-index: 1000;
            min-width: 200px;
            display: none;
            padding: 4px 0;
            overflow: hidden;
        }
        .context-menu-item {
            padding: 6px 18px;
            cursor: pointer;
            color: var(--vscode-menu-foreground);
            font-size: 12.5px;
            display: flex;
            align-items: center;
            gap: 8px;
            user-select: none;
            transition: background-color 0.08s ease;
        }
        .context-menu-item:hover {
            background-color: var(--vscode-list-hoverBackground);
            color: var(--vscode-list-hoverForeground);
        }
        .context-menu-separator { height: 1px; background-color: var(--vscode-panel-border); margin: 3px 6px; }
        .message-edit-input {
            background: transparent;
            border: none;
            border-bottom: 1.5px solid var(--vscode-focusBorder);
            color: inherit;
            font: inherit;
            font-size: 12px;
            outline: none;
            padding: 0;
            width: 100%;
        }
        tr.row-selected {
            background-color: var(--vscode-list-inactiveSelectionBackground);
            box-shadow: inset 3px 0 0 var(--vscode-focusBorder);
        }
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

export function getCommitDetailsHtml(
    webview: vscode.Webview,
    data: CommitDetailsData,
    extensionUri: vscode.Uri,
): string {
    const scriptUri = webview.asWebviewUri(
        vscode.Uri.joinPath(extensionUri, 'out', 'webview', 'commitDetails', 'index.js'),
    );
    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline';">
<title>Commit ${data.fullHash.substring(0, 7)}</title>
<style>
  * { box-sizing: border-box; }
  body {
    font-family: var(--vscode-font-family);
    font-size: 12.5px;
    color: var(--vscode-foreground);
    background-color: var(--vscode-editor-background);
    margin: 0;
    padding: 20px 24px;
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
  }
  .subject {
    font-size: 15px;
    font-weight: 600;
    margin: 0 0 6px;
    line-height: 1.4;
  }
  .body {
    color: var(--vscode-descriptionForeground);
    font-size: 12.5px;
    margin: 0 0 16px;
    white-space: pre-wrap;
    line-height: 1.6;
  }
  .meta {
    display: grid;
    grid-template-columns: 82px 1fr;
    gap: 3px 10px;
    margin-bottom: 22px;
    font-size: 12px;
  }
  .meta-label {
    color: var(--vscode-descriptionForeground);
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    text-align: right;
    padding-top: 2px;
    opacity: 0.7;
  }
  .meta-value { word-break: break-all; }
  .meta-value.hash {
    font-family: var(--vscode-editor-font-family);
    font-size: 11px;
    color: var(--vscode-textPreformat-foreground);
    letter-spacing: 0.03em;
    font-variant-numeric: tabular-nums;
  }
  .section-title {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--vscode-descriptionForeground);
    margin-bottom: 10px;
    opacity: 0.7;
  }
  details {
    border: 1px solid var(--vscode-panel-border);
    border-radius: 5px;
    margin-bottom: 7px;
    overflow: hidden;
  }
  summary {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    cursor: pointer;
    font-size: 11.5px;
    font-family: var(--vscode-editor-font-family);
    list-style: none;
    user-select: none;
    background-color: var(--vscode-sideBar-background, var(--vscode-editor-background));
    transition: background-color 0.1s ease;
  }
  summary:hover { background-color: var(--vscode-list-hoverBackground); }
  summary::-webkit-details-marker { display: none; }
  .chevron {
    font-size: 9px;
    color: var(--vscode-descriptionForeground);
    transition: transform 0.15s ease;
    opacity: 0.6;
    flex-shrink: 0;
  }
  details[open] .chevron { transform: rotate(90deg); }
  .file-name { flex: 1; }
  .file-stats { font-size: 11px; white-space: nowrap; font-family: var(--vscode-font-family); }
  .added { color: var(--vscode-gitDecoration-addedResourceForeground); font-weight: 600; }
  .removed { color: var(--vscode-gitDecoration-deletedResourceForeground); font-weight: 600; }
  pre.diff-content {
    margin: 0;
    padding: 5px 0;
    font-family: var(--vscode-editor-font-family);
    font-size: 11.5px;
    overflow-x: auto;
    line-height: 1.65;
    background-color: var(--vscode-editor-background);
  }
  .diff-line { display: block; padding: 0 14px; white-space: pre; }
  .diff-add {
    background-color: var(--vscode-diffEditor-insertedLineBackground, rgba(70,150,70,0.12));
    color: var(--vscode-gitDecoration-addedResourceForeground);
  }
  .diff-del {
    background-color: var(--vscode-diffEditor-removedLineBackground, rgba(150,70,70,0.12));
    color: var(--vscode-gitDecoration-deletedResourceForeground);
  }
  .diff-hunk {
    color: var(--vscode-gitDecoration-untrackedResourceForeground);
    font-weight: 600;
    background-color: var(--vscode-editor-hoverHighlightBackground, rgba(128,128,128,0.06));
  }
  .diff-ctx { color: var(--vscode-foreground); opacity: 0.85; }
  .no-changes { color: var(--vscode-descriptionForeground); font-size: 12px; padding: 10px 0; }
  .copyable {
    cursor: pointer;
    border-radius: 3px;
    padding: 1px 3px;
    margin: -1px -3px;
    transition: background-color 0.1s ease;
  }
  .copyable:hover { background-color: var(--vscode-list-hoverBackground); }
  #copy-toast {
    position: fixed;
    bottom: 20px;
    right: 20px;
    background-color: var(--vscode-editorWidget-background);
    border: 1px solid var(--vscode-panel-border);
    color: var(--vscode-foreground);
    padding: 5px 14px;
    border-radius: 4px;
    font-size: 12px;
    opacity: 0;
    transition: opacity 0.15s ease;
    pointer-events: none;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
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
