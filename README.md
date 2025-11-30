# Beadmaster

**Sync task management systems for AI coding agents**

Beadmaster bridges [Task Master](https://github.com/eyaltoledano/claude-task-master) and [Beads](https://github.com/steveyegge/beads), letting you use Task Master for AI-powered planning and Beads for execution tracking.

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ Task Master │ ←──→│ Beadmaster  │←──→ │   Beads     │
│  (planning) │     │   (sync)    │     │ (execution) │
└─────────────┘     └─────────────┘     └─────────────┘
```

## Why?

| Tool | Strength | Weakness |
|------|----------|----------|
| **Task Master** | AI PRD parsing, complexity analysis | No dependency graphs |
| **Beads** | Dependencies, discovered-from links | No AI task generation |

**Beadmaster** gives you both: use Task Master's AI to break down PRDs, then track execution in Beads with full dependency awareness.

## Installation

```bash
npm install -g beadmaster
# or
npx beadmaster
```

## Quick Start

```bash
# Initialize in your project (creates .beadmaster/, optionally updates docs)
beadmaster init              # Basic setup
beadmaster init --docs       # Also append instructions to AGENTS.md

# Check what's available
beadmaster status

# One-time import from Task Master → Beads
beadmaster import --dry-run  # Preview
beadmaster import            # Execute

# Ongoing bidirectional sync
beadmaster sync --dry-run    # Preview
beadmaster sync              # Execute

# Manual linking
beadmaster link 85 shadow-work-abc
beadmaster unlink 85

# List all links
beadmaster links
```

## Commands

### `beadmaster init`

Initialize Beadmaster in your project. Creates `.beadmaster/` directory and optionally appends usage instructions to your documentation.

```bash
beadmaster init              # Basic setup
beadmaster init --docs       # Also append to AGENTS.md
beadmaster init --claude     # Append to CLAUDE.md instead
beadmaster init --docs -f    # Force overwrite existing section
```

**Output:**
```
Initializing Beadmaster
────────────────────────────────────────
✓ Created .beadmaster/
✓ Task Master detected
✓ Beads detected
✓ Appended Beadmaster docs to AGENTS.md

Next steps:
  beadmaster sync --dry-run  # Preview sync
  beadmaster sync            # Execute sync
```

### `beadmaster status`

Show sync status and system availability.

```
Beadmaster Status
────────────────────────────────
  ✓ Task Master (.taskmaster/tasks/tasks.json)
  ✓ Beads (.beads/issues.jsonl)
  ○ Link Store (.beadmaster/links.json)

  12 active links
```

### `beadmaster sync`

Bidirectional sync between Task Master and Beads.

```bash
beadmaster sync              # Full sync
beadmaster sync --dry-run    # Preview changes
beadmaster sync --tm-to-beads    # One direction only
beadmaster sync --beads-to-tm    # Other direction
```

**What it does:**
1. Finds TM tasks without beads → creates beads
2. Finds status mismatches → updates the older one
3. Auto-links by convention (`TM-85:` in bead title)
4. Reports conflicts for manual resolution

### `beadmaster import`

One-time import from Task Master to Beads. Use this for initial setup.

```bash
beadmaster import --dry-run  # See what would be created
beadmaster import            # Create beads for all TM tasks
```

### `beadmaster link <tm-id> <bead-id>`

Manually link a Task Master task to a Bead.

```bash
beadmaster link 85 shadow-work-abc
beadmaster link TM-85 shadow-work-abc  # Also accepts TM- prefix
```

### `beadmaster unlink <identifier>`

Remove a link by Task Master ID or Bead ID.

```bash
beadmaster unlink 85
beadmaster unlink shadow-work-abc
```

### `beadmaster links`

List all current links.

```bash
beadmaster links          # Human-readable
beadmaster links --json   # JSON output
```

## Linking Convention

Beadmaster auto-detects links from bead titles:

| Pattern | Example |
|---------|---------|
| `TM-XX:` | `TM-85: Core architecture setup` |
| `[TM-XX]` | `[TM-85] Core architecture setup` |
| `(TM-XX)` | `Core architecture (TM-85)` |

When you create beads with these patterns, Beadmaster automatically links them.

## How Sync Works

```
Task Master                    Beads
    │                            │
    │   ┌─────────────────┐      │
    ├──→│ Link Store      │←─────┤
    │   │ (.beadmaster/)  │      │
    │   └─────────────────┘      │
    │                            │
    ▼                            ▼
┌───────┐                  ┌───────┐
│TM-85  │  ←──── link ────→│sw-abc │
│pending│                  │open   │
└───────┘                  └───────┘
    │                            │
    └──── status sync ──────────→│
         (newer wins)            │
```

**Conflict Resolution:**
- If timestamps differ → newer wins
- If timestamps equal → reported as conflict
- Manual override: `--force` flag

## File Locations

| File | Purpose |
|------|---------|
| `.taskmaster/tasks/tasks.json` | Task Master tasks |
| `.beads/issues.jsonl` | Beads issues |
| `.beadmaster/links.json` | Link mappings |

## Programmatic API

```typescript
import { SyncEngine } from 'beadmaster';

const engine = new SyncEngine('/path/to/project');

// Check status
const status = engine.getStatus();
console.log(status); // { taskmaster: true, beads: true, linkStore: false }

// Sync
const result = engine.sync({ dryRun: true });
console.log(result.created, result.updated, result.conflicts);

// Manual linking
engine.link(85, 'shadow-work-abc');
engine.unlink('85');
```

## Recommended Workflow

1. **Planning Phase**: Use Task Master to parse PRDs and generate tasks
   ```bash
   task-master parse-prd docs/prd.txt
   ```

2. **Initial Import**: Create beads for all tasks
   ```bash
   beadmaster import
   ```

3. **Execution Phase**: Work entirely in Beads
   ```bash
   bd ready                    # Find work
   bd update sw-abc --status in_progress
   # ... do work ...
   bd close sw-abc --reason "Done"
   ```

4. **Periodic Sync**: Keep Task Master updated
   ```bash
   beadmaster sync
   ```

## Integration with AI Agents

Beadmaster is designed for AI coding agents like Claude Code and Codex. Add to your `AGENTS.md`:

```markdown
### Task Sync Workflow

Use Beadmaster to sync Task Master (planning) with Beads (execution):

\`\`\`bash
# Before starting work
beadmaster sync --dry-run

# After completing tasks
beadmaster sync
\`\`\`

Convention: Name beads as `TM-<id>: <title>` for auto-linking.
```

## Contributing

Contributions welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) first.

## License

MIT
