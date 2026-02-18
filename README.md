# Git Plus

A minimalist Git extension for Visual Studio Code.

Built out of frustration with the existing options: bloated UIs, cluttered panels, and features I never use. Git Plus does less, on purpose.

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

### Commit Tree

A canvas-rendered git graph that visualises the commit history of your repository.

- Multi-lane graph with colour-coded branch lines
- Ref badges inline with each commit (HEAD, local branches, remotes, tags)
- The HEAD commit is rendered with a distinct ring marker
- Selecting a branch in the panel filters the tree to that branch's history
- **Right-click** any commit to:
  - Copy hash
  - Cherry-pick
  - Revert
  - Reset (soft / mixed / hard)
  - Edit commit message

---

## Running locally

**Requirements:** Node.js, pnpm, and VS Code.

```bash
pnpm install
pnpm run compile
```

Then open the project in VS Code and press `F5`. This launches an Extension Development Host: a second VS Code window with the extension loaded. Open any git repository in that window and the **Git Plus** panel will appear in the sidebar.

To watch for changes during development:

```bash
pnpm run watch
```

---

## Why

Most Git GUIs for VS Code are either too heavy or too opinionated. I wanted something that stays out of the way — no tabs, no toolbars, no settings pages. Just the branch list and the graph, side by side.

---

## Tech

Built with the [VS Code Extension API](https://code.visualstudio.com/api), TypeScript, and the Canvas API for graph rendering. No external runtime dependencies.
