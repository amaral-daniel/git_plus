# Multi-Repository Support

## Summary

Extended Git Lean to support multiple git repositories with automatic switching based on active file, matching VS Code's built-in SCM behavior.

## Implementation

### New Component: RepositoryManager (`src/repositoryManager.ts`)

Manages multiple git repositories with:
- Auto-discovery of repos in workspace folders and immediate subdirectories
- Auto mode: switches repository based on active file (default)
- Manual mode: locks to selected repository
- Cross-platform `.git` detection using VS Code's file system API
- Event notifications on repository changes

### Updated Components

All providers now accept `RepositoryManager` and use the active repository:
- `gitOperations.ts` - Uses active repo path instead of first workspace folder
- `gitGraphView.ts` - Watches all repos, refreshes on repo change
- `branchWebviewProvider.ts` - Monitors all repos for git changes
- `branchTreeProvider.ts` - Uses active repo for branch operations
- `extension.ts` - Creates manager, adds status bar, wires commands

### UI Changes

**Status Bar**
- Format: `$(git-branch) RepoName $(sync)` (auto mode) or `$(git-branch) RepoName` (manual)
- Tooltip: `RepoName (Git Lean)`
- Click to open repository selector

**Repository Selector**
- First item: `$(sync) Auto` - enables automatic switching
- Remaining items: Individual repositories with full paths
- Matches VS Code's SCM picker UX

## Usage

### Auto Mode (Default)
Extension automatically switches to the repository containing the active file. Status bar shows sync icon.

### Manual Mode
Select a specific repository to lock to it. Auto-switching disabled until you select "Auto" again.

### Commands
- `Git Lean: Select Repository` - Open repository picker
- Click status bar item - Same as above

## Technical Details

**Repository Discovery**
1. Check if workspace folder has `.git` directory
2. If yes, add as repository and skip subdirectories (avoids nested repos)
3. If no, scan immediate subdirectories for `.git` directories
4. Updates automatically on workspace folder changes

**Auto-Switching Logic**
- Listens to `onDidChangeActiveTextEditor`
- Finds repository containing file path (longest path match)
- Switches if different from current repository
- Only active when in auto mode

**Cross-Platform Compatibility**
Uses `vscode.workspace.fs.stat()` instead of shell commands for `.git` detection.

## Developer API

```typescript
const repoManager = new RepositoryManager();

// Query
repoManager.getRepositories();           // All discovered repos
repoManager.getActiveRepository();       // Current active repo
repoManager.isAutoDetectEnabled();       // Check mode

// Control
repoManager.enableAutoDetect();          // Enable auto mode
repoManager.setActiveRepository(repo);   // Set specific repo (disables auto)
repoManager.selectRepository();          // Show picker UI

// Events
repoManager.onDidChangeRepository((repo) => { /* ... */ });
```

## Testing

All checks pass:
- ✅ Build & bundle
- ✅ Unit tests (9/9)
- ✅ Linting
- ✅ Formatting
