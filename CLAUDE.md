# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Important:** Always read [AGENTS.md](./AGENTS.md) first - it contains all repository guidelines, architecture documentation, and development instructions.

## Claude Code Specific Notes

- Use `npm run build` before testing CLI changes
- The codebase uses ESM with `.js` extensions in imports (TypeScript ESM requirement)
- When exploring sync logic, start with `src/core/types.ts` for the unified data model
- Both Task Master and Beads have their own status vocabularies; the sync engine normalizes them via `UnifiedTask`
