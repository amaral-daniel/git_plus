# Git Lean

A minimalist Git extension for Visual Studio Code.

Built out of frustration with the existing options: bloated UIs, cluttered panels, and features I never use. Git Lean does less, on purpose.

---

## Features

### Branch Panel

A clean sidebar panel listing all local and remote branches.

- The currently checked-out branch is highlighted with a distinct icon and a `✓` marker
- **Click** a branch to filter the commit tree to its history
- **Right-click** a branch to access branch actions:
  - Checkout
  - Delete
  - Create new branch from here
  - Rebase current branch onto this
  - Merge into current branch

### Commit Tree

A canvas-rendered git graph that visualises the commit history of your repository.

- Multi-lane graph with colour-coded branch lines
- Ref badges inline with each commit (HEAD, local branches, remotes, tags)
- The HEAD commit is rendered with a distinct ring marker
- Selecting a branch in the panel filters the tree to that branch's history
- **Click** a commit to select it; **Shift-click** to select a range
- **Right-click** a single commit to:
  - Show full commit details (diff, author, dates)
  - Copy hash
  - Cherry-pick
  - Revert
  - Reset to commit
  - Edit commit message inline
- **Right-click** a range of commits to:
  - Squash (when consecutive)
  - Cherry-pick range

---

## Running locally

**Requirements:** Node.js, pnpm, and VS Code.

```bash
pnpm install
pnpm run compile
```

Then open the project in VS Code and press `F5`. This launches an Extension Development Host: a second VS Code window with the extension loaded. Open any git repository in that window and the **Git Lean** panel will appear in the sidebar.

To watch for changes during development:

```bash
pnpm run watch        # TypeScript
pnpm run watch:webview  # React webview
```

---

## Why

Most Git GUIs for VS Code are either too heavy or too opinionated. I wanted something that stays out of the way — no tabs, no toolbars, no settings pages. Just the branch list and the graph, side by side.

The final straw was multi-commit operations. Squashing a range of commits directly from the graph (without dropping to the terminal) isn't available in Git Graph, isn't in the VS Code built-in, and appears to be locked behind GitLens Pro. That felt like a gap worth filling.

---

## Tech

Built with the [VS Code Extension API](https://code.visualstudio.com/api), TypeScript, React 19, and the Canvas API for graph rendering. No external runtime dependencies.
