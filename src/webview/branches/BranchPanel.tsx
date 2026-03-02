import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
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

type TreeNode = { type: 'branch'; branch: Branch } | { type: 'group'; key: string; name: string; children: TreeNode[] };

function buildTree(branches: Branch[], keyPrefix: string): TreeNode[] {
    const roots: { type: 'branch'; branch: Branch }[] = [];
    const groupMap = new Map<string, Branch[]>();

    for (const branch of branches) {
        const slash = branch.name.indexOf('/');
        if (slash === -1) {
            roots.push({ type: 'branch', branch });
        } else {
            const prefix = branch.name.slice(0, slash);
            const rest = branch.name.slice(slash + 1);
            if (!groupMap.has(prefix)) groupMap.set(prefix, []);
            groupMap.get(prefix)!.push({ ...branch, name: rest });
        }
    }

    const nodes: TreeNode[] = [...roots];
    for (const [prefix, children] of groupMap) {
        const key = `${keyPrefix}/${prefix}`;
        nodes.push({ type: 'group', key, name: prefix, children: buildTree(children, key) });
    }
    return nodes;
}

function buildRemoteTree(branches: Branch[]): TreeNode[] {
    const remoteMap = new Map<string, Branch[]>();
    for (const b of branches) {
        const remote = b.fullName.split('/')[0];
        if (!remoteMap.has(remote)) remoteMap.set(remote, []);
        remoteMap.get(remote)!.push(b);
    }
    return [...remoteMap.entries()].map(([remote, children]) => ({
        type: 'group' as const,
        key: `remote/${remote}`,
        name: remote,
        children: buildTree(children, `remote/${remote}`),
    }));
}

// ── Icons ────────────────────────────────────────────────────────────────────

function IconChevronRight() {
    return (
        <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <polyline points="9 18 15 12 9 6" />
        </svg>
    );
}

function IconChevronDown() {
    return (
        <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <polyline points="6 9 12 15 18 9" />
        </svg>
    );
}

function IconStar() {
    return (
        <svg
            className="icon-star"
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="currentColor"
            stroke="currentColor"
            strokeWidth="1"
        >
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
    );
}

function IconFolder() {
    return (
        <svg className="icon-folder" width="13" height="13" viewBox="0 0 24 24" fill="currentColor" strokeWidth="0">
            <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
        </svg>
    );
}

function IconTag() {
    return (
        <svg
            className="icon-tag"
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
            <line x1="7" y1="7" x2="7.01" y2="7" strokeWidth="3" />
        </svg>
    );
}

function IconBranch() {
    return (
        <svg
            className="icon-branch"
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <line x1="6" y1="3" x2="6" y2="15" />
            <circle cx="18" cy="6" r="3" />
            <circle cx="6" cy="18" r="3" />
            <path d="M18 9a9 9 0 01-9 9" />
        </svg>
    );
}

function getBranchIcon(branch: Branch) {
    if (branch.isHead) return <IconTag />;
    if (branch.name === 'main' || branch.name === 'master') return <IconStar />;
    return <IconBranch />;
}

// ── Row components ───────────────────────────────────────────────────────────

function BranchRow({
    branch,
    depth,
    isSelected,
    onClick,
    onContextMenu,
}: {
    branch: Branch;
    depth: number;
    isSelected: boolean;
    onClick: () => void;
    onContextMenu: (e: React.MouseEvent) => void;
}) {
    return (
        <div
            className={`branch-row${isSelected ? ' selected' : ''}${branch.isHead ? ' is-head' : ''}`}
            style={{ paddingLeft: 20 + depth * 16 }}
            onClick={onClick}
            onContextMenu={onContextMenu}
        >
            {getBranchIcon(branch)}
            <span className="row-label">{branch.name}</span>
        </div>
    );
}

function GroupRow({
    name,
    depth,
    isCollapsed,
    onToggle,
}: {
    name: string;
    depth: number;
    isCollapsed: boolean;
    onToggle: () => void;
}) {
    return (
        <div className="group-row" style={{ paddingLeft: 20 + depth * 16 }} onClick={onToggle}>
            <span className="row-chevron">{isCollapsed ? <IconChevronRight /> : <IconChevronDown />}</span>
            <IconFolder />
            <span className="row-label">{name}</span>
        </div>
    );
}

function TreeNodes({
    nodes,
    depth,
    selected,
    collapsed,
    onSelect,
    onContextMenu,
    onToggle,
}: {
    nodes: TreeNode[];
    depth: number;
    selected: string | null;
    collapsed: Set<string>;
    onSelect: (branch: Branch) => void;
    onContextMenu: (e: React.MouseEvent, branch: Branch) => void;
    onToggle: (key: string) => void;
}) {
    return (
        <>
            {nodes.map((node) => {
                if (node.type === 'branch') {
                    return (
                        <BranchRow
                            key={node.branch.fullName}
                            branch={node.branch}
                            depth={depth}
                            isSelected={selected === node.branch.fullName}
                            onClick={() => onSelect(node.branch)}
                            onContextMenu={(e) => onContextMenu(e, node.branch)}
                        />
                    );
                }
                const isCollapsed = collapsed.has(node.key);
                return (
                    <React.Fragment key={node.key}>
                        <GroupRow
                            name={node.name}
                            depth={depth}
                            isCollapsed={isCollapsed}
                            onToggle={() => onToggle(node.key)}
                        />
                        {!isCollapsed && (
                            <TreeNodes
                                nodes={node.children}
                                depth={depth + 1}
                                selected={selected}
                                collapsed={collapsed}
                                onSelect={onSelect}
                                onContextMenu={onContextMenu}
                                onToggle={onToggle}
                            />
                        )}
                    </React.Fragment>
                );
            })}
        </>
    );
}

// ── Main panel ───────────────────────────────────────────────────────────────

export function BranchPanel({ branches }: Props) {
    const [query, setQuery] = useState('');
    const [selected, setSelected] = useState<string | null>(null);
    const [ctxMenu, setCtxMenu] = useState<ContextMenu | null>(null);
    const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
    const [sectionsCollapsed, setSectionsCollapsed] = useState<Set<string>>(new Set());

    const q = query.toLowerCase();
    const localBranches = branches.filter((b) => !b.isRemote && (!q || b.name.toLowerCase().includes(q)));
    const remoteBranches = branches.filter((b) => b.isRemote && (!q || b.name.toLowerCase().includes(q)));

    const localTree = buildTree(localBranches, 'local');
    const remoteTree = buildRemoteTree(remoteBranches);

    const handleSelect = useCallback(
        (branch: Branch) => {
            setCtxMenu(null);
            if (selected === branch.fullName) {
                setSelected(null);
                vscode.postMessage({ command: 'selectBranch', branchName: null });
            } else {
                setSelected(branch.fullName);
                vscode.postMessage({ command: 'selectBranch', branchName: branch.fullName });
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

    const toggleGroup = useCallback((key: string) => {
        setCollapsed((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    }, []);

    const toggleSection = useCallback((key: string) => {
        setSectionsCollapsed((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    }, []);

    const ctxMenuRef = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        if (!ctxMenu || !ctxMenuRef.current) return;
        const el = ctxMenuRef.current;
        const rect = el.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
            el.style.left = `${window.innerWidth - rect.width - 4}px`;
        }
        if (rect.bottom > window.innerHeight) {
            el.style.top = `${window.innerHeight - rect.height - 4}px`;
        }
    }, [ctxMenu]);

    const localCollapsed = sectionsCollapsed.has('local');
    const remoteCollapsed = sectionsCollapsed.has('remote');
    const isEmpty = localBranches.length === 0 && remoteBranches.length === 0;

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
                    <div className="section-header" onClick={() => toggleSection('local')}>
                        <span className="section-chevron">
                            {localCollapsed ? <IconChevronRight /> : <IconChevronDown />}
                        </span>
                        <span className="section-label">Local</span>
                    </div>
                    {!localCollapsed && (
                        <TreeNodes
                            nodes={localTree}
                            depth={0}
                            selected={selected}
                            collapsed={collapsed}
                            onSelect={handleSelect}
                            onContextMenu={handleContextMenu}
                            onToggle={toggleGroup}
                        />
                    )}
                </div>
            )}

            {remoteBranches.length > 0 && (
                <div className="section">
                    <div className="section-header" onClick={() => toggleSection('remote')}>
                        <span className="section-chevron">
                            {remoteCollapsed ? <IconChevronRight /> : <IconChevronDown />}
                        </span>
                        <span className="section-label">Remote</span>
                    </div>
                    {!remoteCollapsed && (
                        <TreeNodes
                            nodes={remoteTree}
                            depth={0}
                            selected={selected}
                            collapsed={collapsed}
                            onSelect={handleSelect}
                            onContextMenu={handleContextMenu}
                            onToggle={toggleGroup}
                        />
                    )}
                </div>
            )}

            {isEmpty && <div className="empty">No branches match</div>}

            {ctxMenu && (
                <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setCtxMenu(null)} />
                <div
                    ref={ctxMenuRef}
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
                </>
            )}
        </div>
    );
}
