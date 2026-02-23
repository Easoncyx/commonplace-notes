# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Commonplace Notes is an **Obsidian plugin** (TypeScript) that publishes markdown notes with sliding panes and interlinked navigation to AWS S3 or local file systems. Desktop only.

## Build Commands

- **Dev mode** (watch + rebuild): `npm run dev`
- **Production build** (type-check + bundle): `npm run build`
- **Version bump**: `npm run version` (updates manifest.json and versions.json)
- **Lint**: `npx eslint src/` (ESLint with TypeScript plugin)
- **Install to vault**: `./install-local.sh` (copy built artifacts) or `./install-local.sh --build` (build + copy)

The local install script copies `main.js`, `manifest.json`, and `styles.css` to the Obsidian vault at `~/Library/CloudStorage/SynologyDrive-m4/Software/ObsidianYixu/.obsidian/plugins/commonplace-notes/`. After running it, reload the plugin in Obsidian.

There is no test framework configured. No automated tests exist.

## Architecture

### Entry Point and Plugin Lifecycle

`src/main.ts` — `CommonplaceNotesPlugin` extends Obsidian's `Plugin` class. On load, it initializes a set of manager classes and registers commands (publish note, publish all, refresh credentials, etc.) and event handlers (file open, metadata change).

### Manager Pattern

The plugin uses a manager-based architecture where each concern is encapsulated in its own class. All managers are instantiated in `main.ts` and receive references to the plugin and each other as needed:

- **ProfileManager** (`src/utils/profiles.ts`) — Manages multiple publishing profiles (AWS or Local)
- **Publisher** (`src/publish/publisher.ts`) — Orchestrates the publishing pipeline: markdown→HTML conversion using remark/rehype, frontmatter processing, and upload
- **NoteManager** (`src/utils/notes.ts`) — Note processing, connection resolution (backlinks, outgoing links)
- **FrontmatterManager** (`src/utils/frontmatter.ts`) — YAML frontmatter read/write via Obsidian metadata API
- **IndicatorManager** (`src/utils/indicators.ts`) — Visual indicators in the file explorer showing publish status per profile
- **ContentIndexManager** (`src/utils/contentIndex.ts`) — Builds searchable content index (FlexSearch/Fuse.js)
- **MappingManager** (`src/utils/mappings.ts`) — Context mappings for bulk publishing
- **TemplateManager** (`src/utils/templateManager.ts`) — HTML template management for published output

### Publishing Pipeline

`src/publish/` contains the publishing logic:
- `publisher.ts` — Core publish flow: resolve note connections, convert markdown to HTML (remark/rehype pipeline with plugins for Obsidian links, math, code highlighting), generate metadata, upload
- `awsUpload.ts` / `awsCredentials.ts` — S3 upload and credential refresh (launched in an interactive terminal via AppleScript)
- `local.ts` — Local filesystem publishing
- `credentials.ts` / `upload.ts` — Interfaces for credential and upload abstractions

### Custom Remark Plugins

- `src/utils/remarkObsidianLinks.ts` — Transforms Obsidian `[[wikilinks]]` into navigable HTML links
- `src/utils/remarkLineNumbers.ts` — Adds line numbers to code blocks
- `src/utils/interactiveTerminal.ts` — Launches commands in a real macOS terminal (Terminal.app, iTerm2, or Warp) via AppleScript, polls a marker file for completion

### Types

`src/types.ts` — All shared interfaces. Key types: `PublishingProfile` (supports `'AWS CLI' | 'Local'` mechanism), `CommonplaceNotesSettings`, `NoteConnection`.

## Build System

ESBuild (`esbuild.config.mjs`) bundles `src/main.ts` → `main.js` (CJS, ES2018 target). Obsidian APIs and CodeMirror modules are externalized. Dev mode uses watch + inline sourcemaps; production mode minifies.

## Coding Conventions

- **Indentation**: Tabs (width 4), per `.editorconfig`
- **Line endings**: LF
- **TypeScript**: `strictNullChecks` and `noImplicitAny` enabled; unused args allowed (`"args": "none"`)
- Release artifacts: `main.js`, `manifest.json`, `styles.css` (via GitHub Actions on tag push)

## Git Conventions (from .clinerules)

- Commit messages prefixed with `[Cline]` for AI-generated commits
- Commits should be atomic, focused, and include context for why changes were made
- Always verify with `git status --porcelain` before staging
