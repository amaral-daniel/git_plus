# Contributing to Git Lean

## Prerequisites

- Node.js >= 24
- pnpm >= 10 (`npm install -g pnpm`)
- VSCode

## Setup

```sh
pnpm install
```

## Build

```sh
pnpm run compile       # full build (tsc + webview bundle)
pnpm run watch         # watch extension source
pnpm run watch:webview # watch webview source
```

## Run locally

Press **F5** in VSCode to open an Extension Development Host with the extension loaded.

## Test

```sh
pnpm run test   # runs vitest unit tests
pnpm run lint   # eslint
pnpm run format:check  # prettier
```

## Project structure

```
src/
  extension.ts           # entry point, command registration
  gitOperations.ts       # all git commands (exec wrappers)
  gitParser.ts           # pure git log output parser (unit-tested)
  gitGraphView.ts        # graph webview panel provider
  branchWebviewProvider.ts
  branchTreeProvider.ts
  webviewContent.ts
  webview/               # React UI (bundled separately by esbuild)
    graph/
    branches/
    commitDetails/
```

## Releasing

Bump the version in `package.json` and push to `main`. The publish workflow runs automatically after CI passes.
