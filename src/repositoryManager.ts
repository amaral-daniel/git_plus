import * as vscode from 'vscode';
import * as path from 'path';

export interface GitRepository {
    name: string;
    path: string;
    workspaceFolder: vscode.WorkspaceFolder;
}

export class RepositoryManager {
    private _repositories: GitRepository[] = [];
    private _sortedRepositories: GitRepository[] = []; // Cache sorted repos for performance
    private _activeRepository: GitRepository | null = null;
    private _autoDetectEnabled = true; // Start with auto-detect enabled
    private _onDidChangeRepository = new vscode.EventEmitter<GitRepository | null>();
    public readonly onDidChangeRepository = this._onDidChangeRepository.event;
    private _onDidChangeRepositories = new vscode.EventEmitter<GitRepository[]>();
    public readonly onDidChangeRepositories = this._onDidChangeRepositories.event;
    private _disposables: vscode.Disposable[] = [];

    constructor() {
        this.discoverRepositories();

        // Watch for workspace folder changes
        this._disposables.push(
            vscode.workspace.onDidChangeWorkspaceFolders(() => {
                this.discoverRepositories();
            }),
        );

        // Watch for active editor changes to auto-select repository
        this._disposables.push(
            vscode.window.onDidChangeActiveTextEditor((editor) => {
                this.onActiveEditorChanged(editor);
            }),
        );

        // Set initial repository based on active editor
        if (vscode.window.activeTextEditor) {
            this.onActiveEditorChanged(vscode.window.activeTextEditor);
        }
    }

    private onActiveEditorChanged(editor: vscode.TextEditor | undefined): void {
        if (!this._autoDetectEnabled || !editor?.document) {
            return;
        }

        const repo = this.findRepositoryForPath(editor.document.uri.fsPath);
        if (repo && repo !== this._activeRepository) {
            this._activeRepository = repo;
            this._onDidChangeRepository.fire(repo);
        }
    }

    private findRepositoryForPath(filePath: string): GitRepository | null {
        // Use cached sorted repositories for performance
        for (const repo of this._sortedRepositories) {
            if (filePath.startsWith(repo.path + path.sep) || filePath === repo.path) {
                return repo;
            }
        }

        return null;
    }

    private async discoverRepositories(): Promise<void> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            this._repositories = [];
            this._activeRepository = null;
            this._onDidChangeRepository.fire(null);
            return;
        }

        const repos: GitRepository[] = [];

        for (const folder of workspaceFolders) {
            const gitRepos = await this.findGitReposInFolder(folder);
            repos.push(...gitRepos);
        }

        this._repositories = repos;
        // Cache sorted repositories by path length (longest first) for efficient path matching
        this._sortedRepositories = [...repos].sort((a, b) => b.path.length - a.path.length);
        
        // Notify listeners that repositories have changed
        this._onDidChangeRepositories.fire(repos);

        // Set active repository if not set or if current one is no longer valid
        if (!this._activeRepository || !repos.find((r) => r.path === this._activeRepository?.path)) {
            // Try to set based on active editor first
            if (vscode.window.activeTextEditor) {
                const repo = this.findRepositoryForPath(vscode.window.activeTextEditor.document.uri.fsPath);
                if (repo) {
                    this._activeRepository = repo;
                    this._onDidChangeRepository.fire(this._activeRepository);
                    return;
                }
            }

            // Otherwise, just pick the first one
            this._activeRepository = repos.length > 0 ? repos[0] : null;
            this._onDidChangeRepository.fire(this._activeRepository);
        }
    }

    private async findGitReposInFolder(folder: vscode.WorkspaceFolder): Promise<GitRepository[]> {
        const folderPath = folder.uri.fsPath;

        // Check if the workspace folder itself is a git repo
        if (await this.isGitRepository(folderPath)) {
            return [
                {
                    name: folder.name,
                    path: folderPath,
                    workspaceFolder: folder,
                },
            ];
        }

        // Only check immediate subdirectories if the folder itself is NOT a git repo
        const repos: GitRepository[] = [];
        try {
            const entries = await vscode.workspace.fs.readDirectory(folder.uri);
            for (const [name, type] of entries) {
                if (type === vscode.FileType.Directory && !name.startsWith('.')) {
                    const subPath = path.join(folderPath, name);
                    if (await this.isGitRepository(subPath)) {
                        repos.push({
                            name: `${folder.name}/${name}`,
                            path: subPath,
                            workspaceFolder: folder,
                        });
                    }
                }
            }
        } catch {
            // Ignore errors reading directory
        }

        return repos;
    }

    private async isGitRepository(dirPath: string): Promise<boolean> {
        try {
            // Use VS Code's file system API for cross-platform compatibility
            const gitPath = vscode.Uri.file(path.join(dirPath, '.git'));
            const stat = await vscode.workspace.fs.stat(gitPath);
            return stat.type === vscode.FileType.Directory;
        } catch {
            return false;
        }
    }

    public getRepositories(): GitRepository[] {
        return this._repositories;
    }

    public getActiveRepository(): GitRepository | null {
        return this._activeRepository;
    }

    public isAutoDetectEnabled(): boolean {
        return this._autoDetectEnabled;
    }

    public setActiveRepository(repo: GitRepository | null): void {
        // When manually selecting a repository, disable auto-detect
        this._autoDetectEnabled = false;
        this._activeRepository = repo;
        this._onDidChangeRepository.fire(repo);
    }

    public enableAutoDetect(): void {
        this._autoDetectEnabled = true;
        // Immediately switch to the repository of the active file
        if (vscode.window.activeTextEditor) {
            this.onActiveEditorChanged(vscode.window.activeTextEditor);
        }
    }

    public async selectRepository(): Promise<void> {
        if (this._repositories.length === 0) {
            vscode.window.showInformationMessage('No git repositories found in workspace');
            return;
        }

        if (this._repositories.length === 1) {
            vscode.window.showInformationMessage(`Only one repository: ${this._repositories[0].name}`);
            return;
        }

        interface RepoQuickPickItem extends vscode.QuickPickItem {
            repo?: GitRepository;
            isAuto?: boolean;
        }

        const items: RepoQuickPickItem[] = [
            {
                label: '$(sync) Auto',
                description: 'The active repository is updated based on active editor',
                isAuto: true,
            },
            ...this._repositories.map((repo) => ({
                label: `$(repo) ${repo.name}`,
                description: repo.path,
                repo,
            })),
        ];

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select the active repository, type to filter all repositories',
        });

        if (selected) {
            if (selected.isAuto) {
                this.enableAutoDetect();
                vscode.window.showInformationMessage('Auto-detect enabled: repository switches with active file');
            } else if (selected.repo) {
                this.setActiveRepository(selected.repo);
                vscode.window.showInformationMessage(`Switched to repository: ${selected.repo.name}`);
            }
        }
    }

    public dispose(): void {
        this._onDidChangeRepository.dispose();
        this._onDidChangeRepositories.dispose();
        this._disposables.forEach((d) => d.dispose());
        this._disposables = [];
    }
}
