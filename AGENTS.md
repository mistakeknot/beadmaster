# Repository Guidelines

## Project Overview

Beadmaster is a TypeScript CLI tool that syncs task management systems for AI coding agents. It bridges [Task Master](https://github.com/eyaltoledano/claude-task-master) (AI-powered planning) and [Beads](https://github.com/steveyegge/beads) (execution tracking with dependency graphs).

**Core Value:** Task Master excels at AI PRD parsing but lacks dependency graphs; Beads has excellent dependency tracking but no AI task generation. Beadmaster provides bidirectional sync between them.

## Build, Test, and Dev Commands
- `npm run build` — compile TypeScript to `dist/` using `tsc`.
- `npm run dev` — watch-and-rebuild during local changes.
- `npm start` — run compiled CLI from `dist/cli/index.js`.
- `npm test` — run Vitest suite; add `--runInBand` if debugging.
- `npm run lint` — ESLint over `src/`; auto-fix with `npm run lint -- --fix`.

## Architecture

### Three-Layer Design

1. **Core Layer** (`src/core/`)
   - `types.ts`: Unified task model that normalizes Task Master and Beads formats
   - `sync.ts`: SyncEngine orchestrates bidirectional sync logic

2. **Adapter Layer** (`src/adapters/`)
   - `taskmaster.ts`: Reads/writes `.taskmaster/tasks/tasks.json`
   - `beads.ts`: Reads/writes `.beads/issues.jsonl` or uses `bd` CLI

3. **CLI Layer** (`src/cli/index.ts`)
   - Commander-based CLI with formatted output using Chalk

### Unified Task Model

The core abstraction is `UnifiedTask` (src/core/types.ts:9-29), which normalizes differences between systems:

- **Status mapping**: Task Master's `in-progress`/`review` → unified `in_progress`; Beads' `open` → unified `pending`
- **Priority normalization**: Task Master's `low/medium/high` → unified 0-4 scale matching Beads
- **ID namespacing**: Tasks get canonical IDs like `tm:85` or `bead:shadow-work-abc`
- **Source tracking**: Every unified task tracks its origins via `sources` array

### Sync Strategy

The SyncEngine (src/core/sync.ts:72-216) performs bidirectional sync in phases:

1. **Auto-linking by convention**: Scans bead titles for patterns like `TM-85:`, `[TM-85]`, `(TM-85)` and auto-links to Task Master task #85
2. **Creation**: TM tasks without beads → create bead with title `TM-{id}: {title}`
3. **Status sync**: For linked pairs with status mismatches → newer timestamp wins
4. **Conflict reporting**: Same timestamp → reported as conflict for manual resolution

Links are persisted to `.beadmaster/links.json` as the source of truth.

### Adapter Responsibilities

**TaskMasterAdapter** (src/adapters/taskmaster.ts):
- Reads from `.taskmaster/tasks/tasks.json` (JSON file)
- Normalizes status: `pending`/`in-progress`/`done`/`deferred`/`cancelled`/`blocked`/`review`
- Updates write back to same file with timestamp

**BeadsAdapter** (src/adapters/beads.ts):
- Prefers `bd` CLI when available (more up-to-date than JSONL)
- Falls back to reading `.beads/issues.jsonl` directly
- Creates/updates via CLI: `bd create`, `bd update`, `bd close`
- Normalizes status: `open`/`in_progress`/`closed` (no native `blocked` support)
- Implements `extractTmId()` for convention-based auto-linking

## Coding Style & Naming
- Language: TypeScript (ESM), Node >= 18. Use 2-space indentation; prefer `const`/`let` over `var`; named exports from modules.
- Types: rely on definitions in `src/core/types.ts` for shared shapes; keep CLI helpers small and pure.
- Naming: CLI commands kebab-case (`beadmaster sync`), internal helpers camelCase, types PascalCase.
- Logging: use `chalk` for CLI output; keep pure logic free of I/O so it is testable.

## Key File Locations

| Path | Purpose |
|------|---------|
| `.taskmaster/tasks/tasks.json` | Task Master tasks storage |
| `.beads/issues.jsonl` | Beads issues JSONL export |
| `.beadmaster/links.json` | Link mappings (TM ↔ Beads) |
| `dist/` | Compiled JavaScript output |

## TypeScript Configuration

- **Module system**: ES modules (`type: "module"` in package.json)
- **Node resolution**: `NodeNext` for ESM compatibility
- **Imports**: Must use `.js` extensions in imports (TypeScript ESM requirement)
- **Target**: ES2022

## Testing Guidelines
- Framework: Vitest. Place tests near code or in `src/__tests__/` mirroring paths.
- Naming: `<file>.test.ts`. Use descriptive `it()` strings that state behavior.
- Coverage: include happy path, missing store cases, conflict handling, and dry-run behavior. Prefer real data fixtures over heavy mocking.
- Mock both adapters' file system access when testing sync logic
- Test the unified task conversion in both directions
- Verify auto-linking pattern matching (src/adapters/beads.ts:205-221)
- Test timestamp-based conflict resolution
- Consider CLI availability (bd CLI may not be installed in test environments)

## Commit & Pull Request Guidelines
- Commits: short imperative subjects (e.g., `Add beads-to-tm sync guard`), optional scope prefixes (`cli:`, `core:`). Use body for rationale and edge cases.
- PRs: include summary, testing done (commands), linked issues, and CLI output screenshots when UX changes. Keep diffs focused; split large changes.

## Agent Workflow Tips (Task Master ↔ Beads)
- Before coding: `beadmaster sync --dry-run` to view pending links/updates.
- After completing work: `beadmaster sync` to apply changes.
- Naming for auto-linking: `TM-<id>: <title>` in bead titles; `tm-XX` accepted.
- When adding new tasks, ensure `.taskmaster/tasks/tasks.json` and `.beads/issues.jsonl` stay in sync; use `beadmaster link <tm-id> <bead-id>` for manual pairs.

## Common Patterns

**Adding new sync logic:**
1. Update `UnifiedTask` type if needed (src/core/types.ts)
2. Modify conversion in adapters (`toUnified`, `normalizeStatus`)
3. Update sync algorithm in `SyncEngine.sync()` (src/core/sync.ts)
4. Add CLI flag/option if user-facing (src/cli/index.ts)

**Status mapping changes:**
- Update both `normalizeStatus` and `denormalizeStatus` in respective adapters
- Ensure round-trip conversion preserves intent
- Document any semantic loss (e.g., Beads has no `blocked` state)

## Security & Configuration
- Secrets: keep tokens out of git; prefer env vars or local config files under `.beadmaster/` or `.taskmaster/` (gitignored).
- Local state: lives in project root (`.beadmaster/`, `.beads/`, `.taskmaster/`); avoid hand-editing generated JSON except for recovery.
- Safety: avoid `--force` flags on sync unless backups exist; review dry-run output before making destructive changes.
