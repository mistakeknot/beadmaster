# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Beadmaster is a TypeScript CLI tool that syncs task management systems for AI coding agents. It bridges [Task Master](https://github.com/eyaltoledano/claude-task-master) (AI-powered planning) and [Beads](https://github.com/steveyegge/beads) (execution tracking with dependency graphs).

**Core Value:** Task Master excels at AI PRD parsing but lacks dependency graphs; Beads has excellent dependency tracking but no AI task generation. Beadmaster provides bidirectional sync between them.

## Development Commands

```bash
# Build
npm run build                 # Compile TypeScript to dist/

# Development
npm run dev                   # Watch mode (tsc --watch)

# Testing
npm test                      # Run Vitest tests

# Linting
npm run lint                  # ESLint

# CLI (after build)
npm start -- <command>        # Run CLI commands
node dist/cli/index.js <cmd>  # Direct execution
```

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

## Testing Considerations

When writing tests:
- Mock both adapters' file system access
- Test the unified task conversion in both directions
- Verify auto-linking pattern matching (src/adapters/beads.ts:205-221)
- Test timestamp-based conflict resolution
- Consider CLI availability (bd CLI may not be installed)

## Common Patterns

**Adding new sync logic:**
1. Update `UnifiedTask` type if needed
2. Modify conversion in adapters (`toUnified`, `normalizeStatus`)
3. Update sync algorithm in `SyncEngine.sync()`
4. Add CLI flag/option if user-facing

**Status mapping changes:**
- Update both `normalizeStatus` and `denormalizeStatus` in respective adapters
- Ensure round-trip conversion preserves intent
- Document any semantic loss (e.g., Beads has no `blocked` state)

## Deployment

Published as npm package with binary aliases:
- `beadmaster` (primary)
- `bm` (shorthand)

Build is required before publishing (`prepublishOnly` script runs `npm run build`).
