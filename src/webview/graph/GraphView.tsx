import React, { useCallback, useMemo, useState } from 'react';
import { GitCommit } from '../types';
import { vscode } from '../vscodeApi';
import { areCommitsConsecutive, calculateLanes } from './graphRenderer';
import { CommitRow } from './CommitRow';

const LANE_WIDTH = 18;

interface SingleMenu { x: number; y: number; hash: string; index: number }
interface RangeMenu { x: number; y: number; sortedIndices: number[]; consecutive: boolean }

interface Props {
    commits: GitCommit[];
}

export function GraphView({ commits }: Props) {
    const [selectedIndices, setSelectedIndices] = useState(new Set<number>());
    const [rangeStartIndex, setRangeStartIndex] = useState<number | null>(null);
    const [singleMenu, setSingleMenu] = useState<SingleMenu | null>(null);
    const [rangeMenu, setRangeMenu] = useState<RangeMenu | null>(null);
    const [editingHash, setEditingHash] = useState<string | null>(null);

    const commitLanes = useMemo(() => calculateLanes(commits), [commits]);
    const maxLane = useMemo(
        () => commits.length > 0 ? Math.max(...Array.from(commitLanes.values())) + 1 : 1,
        [commitLanes, commits]
    );
    const canvasWidth = maxLane * LANE_WIDTH + 12;

    const headCommitHash = useMemo(
        () => (commits.find(c => c.refs.some(r => r.startsWith('HEAD -> ') || r === 'HEAD')) ?? commits[0])?.hash,
        [commits]
    );

    const closeMenus = useCallback(() => {
        setSingleMenu(null);
        setRangeMenu(null);
    }, []);

    const handleRowClick = useCallback((index: number, shiftKey: boolean) => {
        if (shiftKey && rangeStartIndex !== null) {
            const min = Math.min(rangeStartIndex, index);
            const max = Math.max(rangeStartIndex, index);
            const next = new Set<number>();
            for (let i = min; i <= max; i++) { next.add(i); }
            setSelectedIndices(next);
        } else {
            setRangeStartIndex(index);
            setSelectedIndices(new Set([index]));
        }
        closeMenus();
    }, [rangeStartIndex, closeMenus]);

    const handleContextMenu = useCallback((e: React.MouseEvent, index: number) => {
        e.preventDefault();
        e.stopPropagation();

        if (selectedIndices.size > 1 && selectedIndices.has(index)) {
            const sortedIndices = Array.from(selectedIndices).sort((a, b) => a - b);
            setRangeMenu({ x: e.pageX, y: e.pageY, sortedIndices, consecutive: areCommitsConsecutive(commits, sortedIndices) });
            setSingleMenu(null);
        } else {
            setRangeStartIndex(index);
            setSelectedIndices(new Set([index]));
            setSingleMenu({ x: e.pageX, y: e.pageY, hash: commits[index].hash, index });
            setRangeMenu(null);
        }
    }, [selectedIndices, commits]);

    const handleSingleAction = useCallback((action: string) => {
        if (!singleMenu) { return; }
        closeMenus();

        if (action === 'editCommitMessage') {
            setEditingHash(singleMenu.hash);
            return;
        }
        vscode.postMessage({ command: action, commitHash: singleMenu.hash });
    }, [singleMenu, closeMenus]);

    const handleRangeAction = useCallback((action: string) => {
        if (!rangeMenu) { return; }
        const { sortedIndices } = rangeMenu;
        const hashes = sortedIndices.map(i => commits[i].hash);
        const parentHash = commits[sortedIndices[sortedIndices.length - 1]].parents[0];
        closeMenus();
        vscode.postMessage({ command: action, hashes, parentHash });
    }, [rangeMenu, commits, closeMenus]);

    const handleEditConfirm = useCallback((hash: string, newMessage: string) => {
        setEditingHash(null);
        if (newMessage && newMessage !== commits.find(c => c.hash === hash)?.message) {
            vscode.postMessage({ command: 'editCommitMessage', commitHash: hash, newMessage });
        }
    }, [commits]);

    if (commits.length === 0) {
        return <div className="no-commits"><p>No commits found in this repository</p></div>;
    }

    return (
        <div onClick={closeMenus}>
            <div className="table-container">
                <table>
                    <tbody>
                        {commits.map((commit, index) => (
                            <CommitRow
                                key={commit.hash}
                                commit={commit}
                                index={index}
                                commits={commits}
                                commitLanes={commitLanes}
                                canvasWidth={canvasWidth}
                                headCommitHash={headCommitHash}
                                isSelected={selectedIndices.has(index)}
                                isEditing={editingHash === commit.hash}
                                onClick={(shiftKey) => handleRowClick(index, shiftKey)}
                                onContextMenu={(e) => handleContextMenu(e, index)}
                                onEditConfirm={(msg) => handleEditConfirm(commit.hash, msg)}
                                onEditCancel={() => setEditingHash(null)}
                            />
                        ))}
                    </tbody>
                </table>
            </div>

            {singleMenu && (
                <div
                    className="context-menu"
                    style={{ display: 'block', left: singleMenu.x, top: singleMenu.y }}
                    onClick={e => e.stopPropagation()}
                >
                    <div className="context-menu-item" onClick={() => handleSingleAction('showCommitDetails')}>Show more details</div>
                    <div className="context-menu-separator" />
                    <div className="context-menu-item" onClick={() => handleSingleAction('copyHash')}>Copy Hash</div>
                    <div className="context-menu-separator" />
                    <div className="context-menu-item" onClick={() => handleSingleAction('cherryPick')}>Cherry Pick</div>
                    <div className="context-menu-item" onClick={() => handleSingleAction('revertCommit')}>Revert Commit</div>
                    <div className="context-menu-separator" />
                    <div className="context-menu-item" onClick={() => handleSingleAction('editCommitMessage')}>Edit Commit Message</div>
                    <div className="context-menu-item" onClick={() => handleSingleAction('resetToCommit')}>Reset to Commit</div>
                </div>
            )}

            {rangeMenu && (
                <div
                    className="context-menu"
                    style={{ display: 'block', left: rangeMenu.x, top: rangeMenu.y }}
                    onClick={e => e.stopPropagation()}
                >
                    {rangeMenu.consecutive && (
                        <>
                            <div className="context-menu-item" onClick={() => handleRangeAction('squashCommits')}>Squash Commits</div>
                            <div className="context-menu-separator" />
                        </>
                    )}
                    <div className="context-menu-item" onClick={() => handleRangeAction('cherryPickRange')}>Cherry-pick Commits</div>
                </div>
            )}
        </div>
    );
}
