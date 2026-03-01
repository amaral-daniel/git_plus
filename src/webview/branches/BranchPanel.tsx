import React, { useCallback, useState } from 'react';
import { vscode } from '../vscodeApi';

export interface Branch {
    name: string;
    fullName: string;
    isRemote: boolean;
    isHead: boolean;
}

interface ContextMenu {
    x: number;
    y: number;
    branch: Branch;
}

interface Props {
    branches: Branch[];
}

export function BranchPanel({ branches }: Props) {
    const [query, setQuery] = useState('');
    const [selected, setSelected] = useState<string | null>(null);
    const [ctxMenu, setCtxMenu] = useState<ContextMenu | null>(null);

    const q = query.toLowerCase();
    const localBranches = branches.filter((b) => !b.isRemote && (!q || b.name.toLowerCase().includes(q)));
    const remoteBranches = branches.filter((b) => b.isRemote && (!q || b.name.toLowerCase().includes(q)));

    const handleSelect = useCallback(
        (branch: Branch) => {
            setCtxMenu(null);
            if (selected === branch.fullName) {
                setSelected(null);
                vscode.postMessage({ command: 'selectBranch', branchName: null });
            } else {
                setSelected(branch.fullName);
                vscode.postMessage({ command: 'selectBranch', branchName: branch.name });
            }
        },
        [selected],
    );

    const handleContextMenu = useCallback((e: React.MouseEvent, branch: Branch) => {
        e.preventDefault();
        setCtxMenu({ x: e.pageX, y: e.pageY, branch });
    }, []);

    const handleAction = useCallback((command: string, branchName: string) => {
        setCtxMenu(null);
        vscode.postMessage({ command, branchName });
    }, []);

    return (
        <div onClick={() => setCtxMenu(null)}>
            <div className="search-wrap">
                <input
                    className="search-input"
                    type="text"
                    placeholder="Search branches…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    autoComplete="off"
                    spellCheck={false}
                />
            </div>

            {localBranches.length > 0 && (
                <div className="section">
                    <div className="section-header">Local</div>
                    {localBranches.map((b) => (
                        <BranchRow
                            key={b.fullName}
                            branch={b}
                            isSelected={selected === b.fullName}
                            onClick={() => handleSelect(b)}
                            onContextMenu={(e) => handleContextMenu(e, b)}
                        />
                    ))}
                </div>
            )}

            {remoteBranches.length > 0 && (
                <div className="section">
                    <div className="section-header">Remote</div>
                    {remoteBranches.map((b) => (
                        <BranchRow
                            key={b.fullName}
                            branch={b}
                            isSelected={selected === b.fullName}
                            onClick={() => handleSelect(b)}
                            onContextMenu={(e) => handleContextMenu(e, b)}
                        />
                    ))}
                </div>
            )}

            {localBranches.length === 0 && remoteBranches.length === 0 && (
                <div className="empty">No branches match</div>
            )}

            {ctxMenu && (
                <div
                    className="ctx-menu"
                    style={{ left: ctxMenu.x, top: ctxMenu.y }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {!ctxMenu.branch.isRemote && (
                        <>
                            <div
                                className="ctx-item"
                                onClick={() => handleAction('checkoutBranch', ctxMenu.branch.fullName)}
                            >
                                Checkout
                            </div>
                            <div
                                className="ctx-item"
                                onClick={() => handleAction('deleteBranch', ctxMenu.branch.fullName)}
                            >
                                Delete
                            </div>
                            <div className="ctx-sep" />
                            <div
                                className="ctx-item"
                                onClick={() => handleAction('createBranch', ctxMenu.branch.fullName)}
                            >
                                Create New Branch Here
                            </div>
                            <div className="ctx-sep" />
                        </>
                    )}
                    <div className="ctx-item" onClick={() => handleAction('rebaseBranch', ctxMenu.branch.fullName)}>
                        Rebase Current onto This
                    </div>
                    <div className="ctx-item" onClick={() => handleAction('mergeBranch', ctxMenu.branch.fullName)}>
                        Merge into Current
                    </div>
                </div>
            )}
        </div>
    );
}

function BranchRow({
    branch,
    isSelected,
    onClick,
    onContextMenu,
}: {
    branch: Branch;
    isSelected: boolean;
    onClick: () => void;
    onContextMenu: (e: React.MouseEvent) => void;
}) {
    const classes = ['branch-row', isSelected && 'selected', branch.isHead && 'is-head'].filter(Boolean).join(' ');
    return (
        <div className={classes} onClick={onClick} onContextMenu={onContextMenu}>
            <span className="branch-icon">{branch.isRemote ? '☁' : '⎇'}</span>
            <span className="branch-label">{branch.name}</span>
            {branch.isHead && <span className="head-mark">✓</span>}
        </div>
    );
}
