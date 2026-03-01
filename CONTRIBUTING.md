# Contributing to Git Lean

Thanks for your interest in contributing. This document covers how to set up a local development environment, the project architecture, and the process for submitting changes.

---

## Prerequisites

- [Node.js](https://nodejs.org/) >= 24
- [pnpm](https://pnpm.io/) >= 10
- [Visual Studio Code](https://code.visualstudio.com/)
- Git

---

## Development Setup

1. **Fork and clone** the repository
2. **Install dependencies:**
   ```bash
   pnpm install
   ```
3. **Compile the extension:**
   ```bash
   pnpm run compile
   ```
4. **Launch the Extension Development Host:**
   - Open the project in VS Code
   - Press `F5` (or run **Debug: Start Debugging**)
   - A second VS Code window opens with Git Lean loaded
   - Open any Git repository in that window to use the extension

### Watch Mode

When actively developing, run both watchers in separate terminals:

```bash
pnpm run watch           # TypeScript (extension host)
pnpm run watch:webview   # React webview (esbuild)
```

After changing webview code, reload the Extension Development Host window with `Ctrl+R` / `Cmd+R`.

---

## Project Structure

```
src/
├── extension.ts              # Entry point — registers providers and commands
├── gitOperations.ts          # All git command execution (log, rebase, cherry-pick, etc.)
├── gitGraphView.ts           # Commit graph webview provider
├── branchWebviewProvider.ts  # Branch panel webview provider
├── branchTreeProvider.ts     # Tree data provider for branches
├── webviewContent.ts         # HTML shell for webview panels
└── webview/
    ├── graph/                # Commit graph React app
    │   ├── GraphView.tsx     # Root component, selection, context menus
    │   ├── GraphCanvas.tsx   # Canvas rendering
    │   ├── CommitRow.tsx     # Individual commit row
    │   └── graphRenderer.ts  # Lane layout algorithm
    ├── branches/             # Branch panel React app
    │   └── BranchPanel.tsx
    ├── commitDetails/        # Commit details modal React app
    │   └── CommitDetailsView.tsx
    ├── types.ts              # Shared TypeScript types
    └── vscodeApi.ts          # VS Code webview API wrapper
```

**Two build targets:**
- **Extension host** — compiled by `tsc` to `out/` (CommonJS, runs in Node.js)
- **Webviews** — bundled by `esbuild` to `out/webview/` (IIFE, runs in the browser sandbox)

---

## Code Style

The project uses ESLint and Prettier. Before committing, ensure your code passes both:

```bash
pnpm run lint
pnpm run format:check
```

To auto-fix issues:

```bash
pnpm run lint:fix
pnpm run format
```

Key style rules (from `.prettierrc`):
- Single quotes
- 4-space indentation
- Trailing commas
- 120-character print width

---

## Submitting Issues

Before opening an issue:

- Check that you are on the latest version
- Search existing issues to avoid duplicates

When reporting a bug, include:
- VS Code version
- Git Lean version
- Operating system
- Steps to reproduce
- What you expected vs. what happened

---

## Submitting Pull Requests

1. Create a feature branch from `main`:
   ```bash
   git checkout -b feat/your-feature-name
   ```
2. Make your changes and commit with a clear message
3. Run lint and format checks before pushing
4. Open a pull request against `main` with a description of what changed and why

Keep pull requests focused — one feature or fix per PR makes review easier.

---

## Building a VSIX

To produce a local `.vsix` package for testing:

```bash
pnpm run compile
npx @vscode/vsce package --no-dependencies
```

Install it in VS Code via **Extensions: Install from VSIX…**

---

## License

By contributing, you agree that your contributions will be licensed under the same terms as the project. See [LICENSE](LICENSE) for details.
