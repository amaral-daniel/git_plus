import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { GitCommit } from '../types';
import { vscode } from '../vscodeApi';
import { CommitRow } from './CommitRow';

function areCommitsConsecutive(commits: GitCommit[], sortedIndices: number[]): boolean {
    for (let i = 0; i < sortedIndices.length - 1; i++) {
        const newer = commits[sortedIndices[i]];
        const older = commits[sortedIndices[i + 1]];
        if (newer.parents.length !== 1 || !newer.parents.includes(older.hash)) {
            return false;
        }
    }
    return true;
}

interface SingleMenu {
    x: number;
    y: number;
    hash: string;
    index: number;
}
interface RangeMenu {
    x: number;
    y: number;
    sortedIndices: number[];
    consecutive: boolean;
}

interface Props {
    commits: GitCommit[];
    hasMore: boolean;
}

export function GraphView({ commits: initialCommits, hasMore: initialHasMore }: Props) {
    const [commits, setCommits] = useState(initialCommits);
    const [hasMore, setHasMore] = useState(initialHasMore);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedIndices, setSelectedIndices] = useState(new Set<number>());
    const [rangeStartIndex, setRangeStartIndex] = useState<number | null>(null);
    const [singleMenu, setSingleMenu] = useState<SingleMenu | null>(null);
    const [rangeMenu, setRangeMenu] = useState<RangeMenu | null>(null);
    const [editingHash, setEditingHash] = useState<string | null>(null);
    const sentinelRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (event: MessageEvent) => {
            const msg = event.data;
            if (msg.command === 'appendCommits') {
                setCommits((prev) => [...prev, ...msg.commits]);
                setHasMore(msg.hasMore);
                setIsLoadingMore(false);
            } else if (msg.command === 'replaceCommits') {
                setCommits(msg.commits);
                setHasMore(msg.hasMore);
                setSelectedIndices(new Set());
                setRangeStartIndex(null);
                setSingleMenu(null);
                setRangeMenu(null);
            }
        };
        window.addEventListener('message', handler);
        return () => window.removeEventListener('message', handler);
    }, []);

    useEffect(() => {
        if (!hasMore || isLoadingMore) return;
        const sentinel = sentinelRef.current;
        if (!sentinel) return;
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    setIsLoadingMore(true);
                    vscode.postMessage({ command: 'loadMoreCommits' });
                }
            },
            { threshold: 0.1 },
        );
        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [hasMore, isLoadingMore]);

    const filteredCommits = useMemo(() => {
        if (!searchQuery) {
            return commits;
        }
        const q = searchQuery.toLowerCase();
        return commits.filter(
            (c) => c.message.toLowerCase().includes(q) || c.shortHash.includes(q) || c.author.toLowerCase().includes(q),
        );
    }, [commits, searchQuery]);

    useEffect(() => {
        setSelectedIndices(new Set());
        setRangeStartIndex(null);
        setSingleMenu(null);
        setRangeMenu(null);
    }, [searchQuery]);

    const headCommitHash = useMemo(
        () => (commits.find((c) => c.refs.some((r) => r.startsWith('HEAD -> ') || r === 'HEAD')) ?? commits[0])?.hash,
        [commits],
    );

    const isOnHeadBranch = useMemo(
        () => commits.some((c) => c.refs.some((r) => r.startsWith('HEAD -> ') || r === 'HEAD')),
        [commits],
    );

    const closeMenus = useCallback(() => {
        setSingleMenu(null);
        setRangeMenu(null);
    }, []);

    const ctxMenuRef = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        const el = ctxMenuRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
            el.style.left = `${window.innerWidth - rect.width - 4}px`;
        }
        if (rect.bottom > window.innerHeight) {
            el.style.top = `${window.innerHeight - rect.height - 4}px`;
        }
    }, [singleMenu, rangeMenu]);

    const handleRowClick = useCallback(
        (index: number, shiftKey: boolean) => {
            if (shiftKey && rangeStartIndex !== null) {
                const min = Math.min(rangeStartIndex, index);
                const max = Math.max(rangeStartIndex, index);
                const next = new Set<number>();
                for (let i = min; i <= max; i++) {
                    next.add(i);
                }
                setSelectedIndices(next);
            } else {
                setRangeStartIndex(index);
                setSelectedIndices(new Set([index]));
            }
            closeMenus();
        },
        [rangeStartIndex, closeMenus],
    );

    const handleContextMenu = useCallback(
        (e: React.MouseEvent, index: number) => {
            e.preventDefault();
            e.stopPropagation();

            if (selectedIndices.size > 1 && selectedIndices.has(index)) {
                const sortedIndices = Array.from(selectedIndices).sort((a, b) => a - b);
                setRangeMenu({
                    x: e.pageX,
                    y: e.pageY,
                    sortedIndices,
                    consecutive: areCommitsConsecutive(filteredCommits, sortedIndices),
                });
                setSingleMenu(null);
            } else {
                setRangeStartIndex(index);
                setSelectedIndices(new Set([index]));
                setSingleMenu({ x: e.pageX, y: e.pageY, hash: filteredCommits[index].hash, index });
                setRangeMenu(null);
            }
        },
        [selectedIndices, filteredCommits],
    );

    const handleSingleAction = useCallback(
        (action: string) => {
            if (!singleMenu) {
                return;
            }
            closeMenus();

            if (action === 'editCommitMessage') {
                setEditingHash(singleMenu.hash);
                return;
            }
            vscode.postMessage({ command: action, commitHash: singleMenu.hash });
        },
        [singleMenu, closeMenus],
    );

    const handleRangeAction = useCallback(
        (action: string) => {
            if (!rangeMenu) {
                return;
            }
            const { sortedIndices } = rangeMenu;
            const hashes = sortedIndices.map((i) => filteredCommits[i].hash);
            const parentHash = filteredCommits[sortedIndices[sortedIndices.length - 1]].parents[0];
            closeMenus();
            vscode.postMessage({ command: action, hashes, parentHash });
        },
        [rangeMenu, filteredCommits, closeMenus],
    );

    const handleEditConfirm = useCallback(
        (hash: string, newMessage: string) => {
            setEditingHash(null);
            if (newMessage && newMessage !== commits.find((c) => c.hash === hash)?.message) {
                vscode.postMessage({ command: 'editCommitMessage', commitHash: hash, newMessage });
            }
        },
        [commits],
    );

    if (commits.length === 0) {
        return (
            <div className="no-commits">
                <p>No commits found in this repository</p>
            </div>
        );
    }

    return (
        <div onClick={closeMenus}>
            <div className="search-wrap">
                <input
                    className="search-input"
                    type="text"
                    placeholder="Search commits…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    autoComplete="off"
                    spellCheck={false}
                    onClick={(e) => e.stopPropagation()}
                />
            </div>

            {filteredCommits.length === 0 ? (
                <div className="no-commits">
                    <p>No commits match &ldquo;{searchQuery}&rdquo;</p>
                </div>
            ) : (
                <div className="table-container">
                    <table>
                        <tbody>
                            {filteredCommits.map((commit, index) => (
                                <CommitRow
                                    key={commit.hash}
                                    commit={commit}
                                    headCommitHash={headCommitHash}
                                    isSelected={selectedIndices.has(index)}
                                    isEditing={editingHash === commit.hash}
                                    isFirst={index === 0}
                                    isLast={index === filteredCommits.length - 1}
                                    onClick={(shiftKey) => handleRowClick(index, shiftKey)}
                                    onContextMenu={(e) => handleContextMenu(e, index)}
                                    onEditConfirm={(msg) => handleEditConfirm(commit.hash, msg)}
                                    onEditCancel={() => setEditingHash(null)}
                                />
                            ))}
                        </tbody>
                    </table>
                    {!searchQuery && (hasMore || isLoadingMore) && (
                        <div
                            ref={sentinelRef}
                            style={{
                                padding: '8px 10px',
                                color: 'var(--vscode-descriptionForeground)',
                                fontSize: '11px',
                                opacity: 0.6,
                                textAlign: 'center',
                            }}
                        >
                            Loading more commits…
                        </div>
                    )}
                </div>
            )}

            {singleMenu && (
                <>
                    <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={closeMenus} />
                    <div
                        ref={ctxMenuRef}
                        className="context-menu"
                        style={{ display: 'block', left: singleMenu.x, top: singleMenu.y }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {isOnHeadBranch && singleMenu.hash === headCommitHash && (
                            <div className="context-menu-item" onClick={() => handleSingleAction('amendCommit')}>
                                Amend Commit
                            </div>
                        )}
                        {isOnHeadBranch && (
                            <div className="context-menu-item" onClick={() => handleSingleAction('editCommitMessage')}>
                                Edit Commit Message
                            </div>
                        )}
                        {!isOnHeadBranch && (
                            <div className="context-menu-item" onClick={() => handleSingleAction('cherryPick')}>
                                Cherry Pick
                            </div>
                        )}
                        <div className="context-menu-separator" />
                        <div className="context-menu-item" onClick={() => handleSingleAction('copyHash')}>
                            Copy Hash
                        </div>
                        {isOnHeadBranch && (
                            <div className="context-menu-item" onClick={() => handleSingleAction('revertCommit')}>
                                Revert Commit
                            </div>
                        )}
                        <div className="context-menu-item" onClick={() => handleSingleAction('resetToCommit')}>
                            Reset to Commit
                        </div>
                        {isOnHeadBranch && (
                            <div
                                className="context-menu-item context-menu-item--danger"
                                onClick={() => handleSingleAction('dropCommit')}
                            >
                                Drop Commit
                            </div>
                        )}
                        <div className="context-menu-separator" />
                        <div className="context-menu-item" onClick={() => handleSingleAction('showCommitDetails')}>
                            Show more details
                        </div>
                    </div>
                </>
            )}

            {rangeMenu && (
                <>
                    <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={closeMenus} />
                    <div
                        ref={ctxMenuRef}
                        className="context-menu"
                        style={{ display: 'block', left: rangeMenu.x, top: rangeMenu.y }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {isOnHeadBranch && rangeMenu.consecutive && (
                            <>
                                <div className="context-menu-item" onClick={() => handleRangeAction('squashCommits')}>
                                    Squash Commits
                                </div>
                                <div className="context-menu-separator" />
                            </>
                        )}
                        {!isOnHeadBranch && (
                            <div className="context-menu-item" onClick={() => handleRangeAction('cherryPickRange')}>
                                Cherry-pick Commits
                            </div>
                        )}
                        {isOnHeadBranch && (
                            <div className="context-menu-item" onClick={() => handleRangeAction('revertCommits')}>
                                Revert Commits
                            </div>
                        )}
                        {isOnHeadBranch && rangeMenu.consecutive && (
                            <>
                                <div className="context-menu-separator" />
                                <div
                                    className="context-menu-item context-menu-item--danger"
                                    onClick={() => handleRangeAction('dropCommits')}
                                >
                                    Drop Commits
                                </div>
                            </>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
