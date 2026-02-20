import React, { useRef, useEffect } from 'react';
import { GitCommit } from '../types';
import { GraphCanvas } from './GraphCanvas';

interface Props {
    commit: GitCommit;
    index: number;
    commits: GitCommit[];
    commitLanes: Map<string, number>;
    canvasWidth: number;
    headCommitHash: string | undefined;
    isSelected: boolean;
    isEditing: boolean;
    onClick: (shiftKey: boolean) => void;
    onContextMenu: (e: React.MouseEvent) => void;
    onEditConfirm: (newMessage: string) => void;
    onEditCancel: () => void;
}

function RefBadges({ refs }: { refs: string[] }) {
    if (!refs.length) { return null; }

    const badges = refs.flatMap((ref, i) => {
        if (ref.startsWith('HEAD -> ')) {
            return [<span key={i} className="ref-badge ref-head">{ref.substring(8)}</span>];
        }
        if (ref === 'HEAD') {
            return [<span key={i} className="ref-badge ref-head">HEAD</span>];
        }
        if (ref.startsWith('tag: ')) {
            return [<span key={i} className="ref-badge ref-tag">{ref.substring(5)}</span>];
        }
        if (ref.includes('origin/HEAD') || ref.includes('upstream/HEAD')) {
            return [];
        }
        if (ref.includes('origin/') || ref.includes('upstream/')) {
            return [<span key={i} className="ref-badge ref-remote">{ref.replace('refs/remotes/', '')}</span>];
        }
        return [<span key={i} className="ref-badge ref-branch">{ref.replace('refs/heads/', '')}</span>];
    });

    if (!badges.length) { return null; }
    return <div className="refs-container">{badges}</div>;
}

export const CommitRow = React.memo(function CommitRow({
    commit, index, commits, commitLanes, canvasWidth, headCommitHash,
    isSelected, isEditing, onClick, onContextMenu, onEditConfirm, onEditCancel,
}: Props) {
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isEditing) { inputRef.current?.focus(); inputRef.current?.select(); }
    }, [isEditing]);

    return (
        <tr
            className={isSelected ? 'row-selected' : undefined}
            data-commit-hash={commit.hash}
            onClick={e => onClick(e.shiftKey)}
            onContextMenu={onContextMenu}
        >
            <td className="graph-cell">
                <GraphCanvas
                    commit={commit}
                    index={index}
                    commits={commits}
                    commitLanes={commitLanes}
                    canvasWidth={canvasWidth}
                    headCommitHash={headCommitHash}
                />
            </td>
            <td className="message-cell" title={commit.message}>
                <RefBadges refs={commit.refs} />
                {isEditing ? (
                    <input
                        ref={inputRef}
                        className="message-edit-input"
                        defaultValue={commit.message}
                        onKeyDown={e => {
                            if (e.key === 'Enter') { e.preventDefault(); onEditConfirm(e.currentTarget.value.trim()); }
                            if (e.key === 'Escape') { e.preventDefault(); onEditCancel(); }
                        }}
                        onBlur={onEditCancel}
                        onClick={e => e.stopPropagation()}
                    />
                ) : (
                    <span className="message-text">{commit.message}</span>
                )}
            </td>
            <td className="hash-cell">{commit.shortHash}</td>
            <td className="author-cell">{commit.author}</td>
            <td className="date-cell">{commit.date}</td>
        </tr>
    );
});
