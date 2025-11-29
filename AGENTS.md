# Repository Guidelines

## Project Structure & Modules
- `src/` TypeScript source. CLI entry at `src/cli/index.ts`; library exports at `src/index.ts`; adapters live in `src/adapters/`; sync logic in `src/core/`.
- `dist/` build output (gitignored) created by `npm run build`.
- Config: `tsconfig.json`, scripts in `package.json`; tests live alongside source or under `src/__tests__/` (Vitest-friendly).

## Build, Test, and Dev Commands
- `npm run build` — compile TypeScript to `dist/` using `tsc`.
- `npm run dev` — watch-and-rebuild during local changes.
- `npm start` — run compiled CLI from `dist/cli/index.js`.
- `npm test` — run Vitest suite; add `--runInBand` if debugging.
- `npm run lint` — ESLint over `src/`; auto-fix with `npm run lint -- --fix`.

## Coding Style & Naming
- Language: TypeScript (ESM), Node >= 18. Use 2-space indentation; prefer `const`/`let` over `var`; named exports from modules.
- Types: rely on definitions in `src/core/types.ts` for shared shapes; keep CLI helpers small and pure.
- Naming: CLI commands kebab-case (`beadmaster sync`), internal helpers camelCase, types PascalCase.
- Logging: use `chalk` for CLI output; keep pure logic free of I/O so it is testable.

## Testing Guidelines
- Framework: Vitest. Place tests near code or in `src/__tests__/` mirroring paths.
- Naming: `<file>.test.ts`. Use descriptive `it()` strings that state behavior.
- Coverage: include happy path, missing store cases, conflict handling, and dry-run behavior. Prefer real data fixtures over heavy mocking.

## Commit & Pull Request Guidelines
- Commits: short imperative subjects (e.g., `Add beads-to-tm sync guard`), optional scope prefixes (`cli:`, `core:`). Use body for rationale and edge cases.
- PRs: include summary, testing done (commands), linked issues, and CLI output screenshots when UX changes. Keep diffs focused; split large changes.

## Agent Workflow Tips (Task Master ↔ Beads)
- Before coding: `beadmaster sync --dry-run` to view pending links/updates.
- After completing work: `beadmaster sync` to apply changes.
- Naming for auto-linking: `TM-<id>: <title>` in bead titles; `tm-XX` accepted.
- When adding new tasks, ensure `.taskmaster/tasks/tasks.json` and `.beads/issues.jsonl` stay in sync; use `beadmaster link <tm-id> <bead-id>` for manual pairs.

## Security & Configuration
- Secrets: keep tokens out of git; prefer env vars or local config files under `.beadmaster/` or `.taskmaster/` (gitignored).
- Local state: lives in project root (`.beadmaster/`, `.beads/`, `.taskmaster/`); avoid hand-editing generated JSON except for recovery.
- Safety: avoid `--force` flags on sync unless backups exist; review dry-run output before making destructive changes.
