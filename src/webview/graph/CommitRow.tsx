import React, { useRef, useEffect } from 'react';
import { GitCommit } from '../types';

interface Props {
    commit: GitCommit;
    headCommitHash: string | undefined;
    isSelected: boolean;
    isEditing: boolean;
    onClick: (shiftKey: boolean) => void;
    onContextMenu: (e: React.MouseEvent) => void;
    onEditConfirm: (newMessage: string) => void;
    onEditCancel: () => void;
}

function RefBadges({ refs }: { refs: string[] }) {
    if (!refs.length) {
        return null;
    }

    const badges = refs.flatMap((ref, i) => {
        if (ref.startsWith('HEAD -> ')) {
            return [
                <span key={i} className="ref-badge ref-head">
                    {ref.substring(8)}
                </span>,
            ];
        }
        if (ref === 'HEAD') {
            return [
                <span key={i} className="ref-badge ref-head">
                    HEAD
                </span>,
            ];
        }
        if (ref.startsWith('tag: ')) {
            return [
                <span key={i} className="ref-badge ref-tag">
                    {ref.substring(5)}
                </span>,
            ];
        }
        if (ref.includes('origin/HEAD') || ref.includes('upstream/HEAD')) {
            return [];
        }
        if (ref.includes('origin/') || ref.includes('upstream/')) {
            return [
                <span key={i} className="ref-badge ref-remote">
                    {ref.replace('refs/remotes/', '')}
                </span>,
            ];
        }
        return [
            <span key={i} className="ref-badge ref-branch">
                {ref.replace('refs/heads/', '')}
            </span>,
        ];
    });

    if (!badges.length) {
        return null;
    }

    const MAX_VISIBLE = 4;
    const visible = badges.slice(0, MAX_VISIBLE);
    const overflow = badges.length - MAX_VISIBLE;

    return (
        <div className="refs-container">
            {visible}
            {overflow > 0 && (
                <span className="ref-badge ref-overflow" title={`+${overflow} more ref${overflow > 1 ? 's' : ''}`}>
                    +{overflow}
                </span>
            )}
        </div>
    );
}

export const CommitRow = React.memo(function CommitRow({
    commit,
    headCommitHash,
    isSelected,
    isEditing,
    onClick,
    onContextMenu,
    onEditConfirm,
    onEditCancel,
}: Props) {
    const inputRef = useRef<HTMLInputElement>(null);
    const isHead = commit.hash === headCommitHash;

    useEffect(() => {
        if (isEditing) {
            inputRef.current?.focus();
            inputRef.current?.select();
        }
    }, [isEditing]);

    return (
        <tr
            className={isSelected ? 'row-selected' : undefined}
            data-commit-hash={commit.hash}
            onClick={(e) => onClick(e.shiftKey)}
            onContextMenu={onContextMenu}
        >
            <td className="graph-cell">
                <svg width="20" height="28" style={{ display: 'block' }}>
                    <line x1="10" y1="0" x2="10" y2="28" stroke="#3d9fd4" strokeWidth="2" />
                    {isHead ? (
                        <>
                            <circle cx="10" cy="14" r="5" fill="none" stroke="#3d9fd4" strokeWidth="2" />
                            <circle cx="10" cy="14" r="2" fill="#3d9fd4" />
                        </>
                    ) : (
                        <circle cx="10" cy="14" r="5" fill="#3d9fd4" />
                    )}
                </svg>
            </td>
            <td className="message-cell" title={commit.message}>
                <RefBadges refs={commit.refs} />
                {isEditing ? (
                    <input
                        ref={inputRef}
                        className="message-edit-input"
                        defaultValue={commit.message}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                onEditConfirm(e.currentTarget.value.trim());
                            }
                            if (e.key === 'Escape') {
                                e.preventDefault();
                                onEditCancel();
                            }
                        }}
                        onBlur={onEditCancel}
                        onClick={(e) => e.stopPropagation()}
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
