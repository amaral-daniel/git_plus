import React, { useState } from 'react';

interface FileDiff {
    filePath: string;
    added: number;
    removed: number;
    lines: string[];
}

function parsePatch(patch: string): FileDiff[] {
    const diffIdx = patch.indexOf('\ndiff --git ');
    if (diffIdx < 0) { return []; }

    return patch.slice(diffIdx + 1)
        .split(/(?=^diff --git )/m)
        .filter(s => s.trim())
        .map(section => {
            const lines = section.split('\n');
            const match = lines[0].match(/^diff --git a\/(.*?) b\/(.*)$/);
            const filePath = match ? match[2] : lines[0];
            let added = 0, removed = 0;
            lines.forEach(line => {
                if (line.startsWith('+') && !line.startsWith('+++')) { added++; }
                if (line.startsWith('-') && !line.startsWith('---')) { removed++; }
            });
            return { filePath, added, removed, lines };
        });
}

function DiffLine({ line }: { line: string }) {
    if (line.startsWith('@@')) { return <span className="diff-line diff-hunk">{line}</span>; }
    if (line.startsWith('+')) { return <span className="diff-line diff-add">{line}</span>; }
    if (line.startsWith('-')) { return <span className="diff-line diff-del">{line}</span>; }
    return <span className="diff-line diff-ctx">{line}</span>;
}

function FileDiffBlock({ diff }: { diff: FileDiff }) {
    let inHunk = false;
    const hunkLines = diff.lines.filter(line => {
        if (line.startsWith('@@')) { inHunk = true; }
        return inHunk;
    });

    return (
        <details open>
            <summary>
                <span className="chevron">&#9658;</span>
                <span className="file-name">{diff.filePath}</span>
                <span className="file-stats">
                    {diff.added > 0 && <span className="added">+{diff.added} </span>}
                    {diff.removed > 0 && <span className="removed">-{diff.removed}</span>}
                </span>
            </summary>
            <pre className="diff-content">
                {hunkLines.map((line, i) => <DiffLine key={i} line={line} />)}
            </pre>
        </details>
    );
}

interface CopyableProps {
    value: string;
    onCopy: (text: string) => void;
    children: React.ReactNode;
}

function Copyable({ value, onCopy, children }: CopyableProps) {
    return (
        <span className="copyable" title="Click to copy" onClick={() => onCopy(value)}>
            {children}
        </span>
    );
}

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

export function CommitDetailsView({ data }: { data: CommitDetailsData }) {
    const { fullHash, authorEmail, authorName, authorDate, commitDate, subject, body, patch } = data;
    const [toastVisible, setToastVisible] = useState(false);

    const formattedAuthorDate = authorDate ? new Date(authorDate).toLocaleString() : '';
    const formattedCommitDate = commitDate ? new Date(commitDate).toLocaleString() : '';
    const showCommitDate = formattedCommitDate && formattedCommitDate !== formattedAuthorDate;

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text).then(() => {
            setToastVisible(true);
            setTimeout(() => setToastVisible(false), 1500);
        });
    };

    const diffs = parsePatch(patch);

    return (
        <>
            <p className="subject">{subject}</p>
            {body && <p className="body">{body}</p>}

            <div className="meta">
                <span className="meta-label">Hash</span>
                <Copyable value={fullHash} onCopy={copyToClipboard}>
                    <code className="meta-value hash">{fullHash}</code>
                </Copyable>

                <span className="meta-label">Author</span>
                <Copyable value={`${authorName} <${authorEmail}>`} onCopy={copyToClipboard}>
                    <span className="meta-value">{authorName} &lt;{authorEmail}&gt;</span>
                </Copyable>

                <span className="meta-label">Date</span>
                <Copyable value={formattedAuthorDate} onCopy={copyToClipboard}>
                    <span className="meta-value">{formattedAuthorDate}</span>
                </Copyable>

                {showCommitDate && (
                    <>
                        <span className="meta-label">Committed</span>
                        <Copyable value={formattedCommitDate} onCopy={copyToClipboard}>
                            <span className="meta-value">{formattedCommitDate}</span>
                        </Copyable>
                    </>
                )}
            </div>

            <div className="section-title">Changed Files</div>

            {diffs.length === 0
                ? <p className="no-changes">No diff available.</p>
                : diffs.map((diff, i) => <FileDiffBlock key={i} diff={diff} />)
            }

            <div id="copy-toast" className={toastVisible ? 'show' : ''}>Copied!</div>
        </>
    );
}
