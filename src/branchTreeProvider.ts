import * as vscode from 'vscode';
import * as cp from 'child_process';
import { RepositoryManager } from './repositoryManager';

interface Branch {
    name: string;
    fullName: string;
    isRemote: boolean;
    isHead: boolean;
}

export class BranchTreeProvider implements vscode.TreeDataProvider<BranchTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<BranchTreeItem | undefined | null | void> =
        new vscode.EventEmitter<BranchTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<BranchTreeItem | undefined | null | void> =
        this._onDidChangeTreeData.event;

    private _filter: string = '';
    private _watchers: vscode.FileSystemWatcher[] = [];

    setFilter(filter: string): void {
        this._filter = filter.toLowerCase();
        this._onDidChangeTreeData.fire();
    }

    getFilter(): string {
        return this._filter;
    }

    constructor(private readonly _repoManager: RepositoryManager) {
        this.setupGitWatchers();

        // Refresh when active repository changes
        _repoManager.onDidChangeRepository(() => {
            this.refresh();
        });
        
        // Refresh watchers when repositories are discovered/changed
        _repoManager.onDidChangeRepositories(() => {
            this.setupGitWatchers();
        });
    }

    private setupGitWatchers() {
        this._watchers.forEach((w) => w.dispose());
        this._watchers = [];

        const repos = this._repoManager.getRepositories();
        for (const repo of repos) {
            const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(repo.path, '.git/**'));
            watcher.onDidChange(() => this.refresh());
            watcher.onDidCreate(() => this.refresh());
            watcher.onDidDelete(() => this.refresh());
            this._watchers.push(watcher);
        }
    }

    public dispose() {
        this._watchers.forEach((w) => w.dispose());
        this._watchers = [];
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: BranchTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: BranchTreeItem): Promise<BranchTreeItem[]> {
        if (!element) {
            // Root level - show HEAD, Local, and Remote sections
            const currentBranch = await this.getCurrentBranch();
            const items: BranchTreeItem[] = [];

            if (currentBranch) {
                items.push(
                    new BranchTreeItem(
                        `HEAD (${currentBranch})`,
                        vscode.TreeItemCollapsibleState.None,
                        'head',
                        currentBranch,
                    ),
                );
            }

            items.push(
                new BranchTreeItem('Local', vscode.TreeItemCollapsibleState.Expanded, 'folder'),
                new BranchTreeItem('Remote', vscode.TreeItemCollapsibleState.Expanded, 'folder'),
            );

            return items;
        } else if (element.contextValue === 'folder') {
            // Show branches under Local or Remote
            const branches = await this.getBranches();
            const isLocal = element.label === 'Local';

            return branches
                .filter((branch) => (isLocal ? !branch.isRemote : branch.isRemote))
                .filter((branch) => !this._filter || branch.name.toLowerCase().includes(this._filter))
                .map(
                    (branch) =>
                        new BranchTreeItem(
                            branch.name,
                            vscode.TreeItemCollapsibleState.None,
                            isLocal ? (branch.isHead ? 'local-branch-head' : 'local-branch') : 'remote-branch',
                            branch.fullName,
                            branch.isHead,
                        ),
                );
        }

        return [];
    }

    private async getCurrentBranch(): Promise<string | null> {
        return new Promise((resolve) => {
            const cwd = this._repoManager.getActiveRepository()?.path;
            if (!cwd) {
                resolve(null);
                return;
            }

            cp.exec('git rev-parse --abbrev-ref HEAD', { cwd }, (error, stdout, _stderr) => {
                if (error) {
                    resolve(null);
                    return;
                }
                resolve(stdout.trim());
            });
        });
    }

    private async getBranches(): Promise<Branch[]> {
        return new Promise((resolve) => {
            const cwd = this._repoManager.getActiveRepository()?.path;
            if (!cwd) {
                resolve([]);
                return;
            }
            cp.exec('git branch -a --format="%(refname:short)|%(HEAD)"', { cwd }, (error, stdout, _stderr) => {
                if (error) {
                    resolve([]);
                    return;
                }

                const branches: Branch[] = stdout
                    .split('\n')
                    .filter((line) => line.trim())
                    .map((line) => {
                        const [fullName, head] = line.split('|');
                        const isRemote = fullName.startsWith('origin/') || fullName.startsWith('upstream/');
                        const name = isRemote ? fullName.replace(/^(origin|upstream)\//, '') : fullName;

                        // Filter out remote HEAD pointers
                        if (fullName.includes('origin/HEAD') || fullName.includes('upstream/HEAD')) {
                            return null;
                        }

                        return {
                            name,
                            fullName,
                            isRemote,
                            isHead: head === '*',
                        };
                    })
                    .filter((branch): branch is Branch => branch !== null);

                resolve(branches);
            });
        });
    }
}

export class BranchTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly contextValue: string,
        public readonly branchName?: string,
        public readonly isHead?: boolean,
    ) {
        super(label, collapsibleState);

        if (contextValue === 'head') {
            this.iconPath = new vscode.ThemeIcon(
                'git-branch',
                new vscode.ThemeColor('gitDecoration.modifiedResourceForeground'),
            );
            this.description = 'Current Branch';
        } else if (contextValue === 'local-branch-head') {
            this.iconPath = new vscode.ThemeIcon(
                'git-branch',
                new vscode.ThemeColor('gitDecoration.modifiedResourceForeground'),
            );
            this.description = '✓';
        } else if (contextValue === 'local-branch') {
            this.iconPath = new vscode.ThemeIcon('git-branch');
        } else if (contextValue === 'remote-branch') {
            this.iconPath = new vscode.ThemeIcon('cloud');
        } else if (contextValue === 'folder') {
            this.iconPath = new vscode.ThemeIcon('folder');
        }
    }
}
