#!/usr/bin/env node
/**
 * Beadmaster CLI
 *
 * Sync task management systems for AI coding agents
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { existsSync, mkdirSync, readFileSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { SyncEngine } from '../core/sync.js';
import type { SyncResult, TaskLink } from '../core/types.js';

const DOCS_SNIPPET = `
### Task Sync (Beadmaster)

Use [Beadmaster](https://github.com/mistakeknot/beadmaster) to sync Task Master (planning) with Beads (execution):

\`\`\`bash
beadmaster status         # Check availability
beadmaster sync --dry-run # Preview changes
beadmaster sync           # Execute sync
\`\`\`

**Auto-linking convention:** Name beads as \`TM-<id>: <title>\` for automatic linking.

**Workflow:**
1. Use Task Master for AI-powered PRD parsing and task generation
2. Run \`beadmaster import\` to create beads for all tasks
3. Work in Beads for execution tracking with dependencies
4. Run \`beadmaster sync\` periodically to keep systems aligned
`;

const DOCS_MARKER = '### Task Sync (Beadmaster)';

const program = new Command();

program
  .name('beadmaster')
  .description('Sync Task Master and Beads for AI coding agents')
  .version('0.2.0');

// Helper to get project root
function getProjectRoot(): string {
  return process.cwd();
}

// Helper to format sync results
function formatSyncResult(result: SyncResult, dryRun: boolean): void {
  const prefix = dryRun ? chalk.yellow('[DRY RUN] ') : '';

  console.log('\n' + prefix + chalk.bold('Sync Results'));
  console.log('─'.repeat(50));

  // Stats
  console.log(chalk.dim('Sources:'));
  console.log(`  Task Master: ${result.stats.taskmasterTasks} tasks`);
  console.log(`  Beads: ${result.stats.beadIssues} issues`);
  console.log(`  Linked: ${result.stats.linked}`);
  console.log(`  Unlinked: ${result.stats.unlinked}`);

  // Created
  if (result.created.length > 0) {
    console.log('\n' + chalk.green(`✓ Created (${result.created.length}):`));
    for (const action of result.created) {
      console.log(`  ${action.direction}: ${action.task.title}`);
      console.log(chalk.dim(`    → ${action.reason}`));
    }
  }

  // Updated
  if (result.updated.length > 0) {
    console.log('\n' + chalk.blue(`↻ Updated (${result.updated.length}):`));
    for (const action of result.updated) {
      console.log(`  ${action.task.title}`);
      console.log(chalk.dim(`    → ${action.reason}`));
    }
  }

  // Conflicts
  if (result.conflicts.length > 0) {
    console.log('\n' + chalk.red(`⚠ Conflicts (${result.conflicts.length}):`));
    for (const conflict of result.conflicts) {
      console.log(`  ${conflict.task.title}`);
      console.log(
        chalk.dim(
          `    ${conflict.field}: TM="${conflict.tmValue}" vs Beads="${conflict.beadsValue}"`
        )
      );
    }
  }

  // Skipped
  if (result.skipped.length > 0) {
    console.log('\n' + chalk.gray(`⊘ Skipped (${result.skipped.length})`));
  }

  console.log();
}

// Helper to format links
function formatLinks(links: TaskLink[]): void {
  if (links.length === 0) {
    console.log(chalk.dim('No links found.'));
    return;
  }

  console.log(chalk.bold(`\nLinks (${links.length}):`));
  console.log('─'.repeat(60));

  for (const link of links) {
    const auto = link.autoLinked ? chalk.dim(' (auto)') : '';
    console.log(`  TM-${link.tmId} ↔ ${link.beadId}${auto}`);
  }
  console.log();
}

// ============ Commands ============

program
  .command('status')
  .description('Show sync status and system availability')
  .action(() => {
    const engine = new SyncEngine(getProjectRoot());
    const status = engine.getStatus();

    console.log('\n' + chalk.bold('Beadmaster Status'));
    console.log('─'.repeat(40));

    const tmIcon = status.taskmaster ? chalk.green('✓') : chalk.red('✗');
    const beadsIcon = status.beads ? chalk.green('✓') : chalk.red('✗');
    const linksIcon = status.linkStore ? chalk.green('✓') : chalk.dim('○');

    console.log(`  ${tmIcon} Task Master (.taskmaster/tasks/tasks.json)`);
    console.log(`  ${beadsIcon} Beads (.beads/issues.jsonl)`);
    console.log(`  ${linksIcon} Link Store (.beadmaster/links.json)`);

    if (!status.taskmaster && !status.beads) {
      console.log(
        '\n' +
          chalk.yellow(
            'Neither system initialized. Run in a project with Task Master or Beads.'
          )
      );
    }

    const links = engine.listLinks();
    if (links.length > 0) {
      console.log(`\n  ${chalk.cyan(links.length)} active links`);
    }

    console.log();
  });

program
  .command('sync')
  .description('Bidirectional sync between Task Master and Beads')
  .option('-n, --dry-run', 'Show what would be done without making changes')
  .option('--tm-to-beads', 'Only sync from Task Master to Beads')
  .option('--beads-to-tm', 'Only sync from Beads to Task Master')
  .option('-v, --verbose', 'Show detailed output')
  .action((opts) => {
    const engine = new SyncEngine(getProjectRoot());
    const status = engine.getStatus();

    if (!status.taskmaster && !status.beads) {
      console.error(chalk.red('Error: Neither Task Master nor Beads found.'));
      process.exit(1);
    }

    const direction = opts.tmToBeads
      ? 'tm_to_beads'
      : opts.beadsToTm
        ? 'beads_to_tm'
        : 'bidirectional';

    const result = engine.sync({
      dryRun: opts.dryRun,
      direction: direction as 'bidirectional' | 'tm_to_beads' | 'beads_to_tm',
      verbose: opts.verbose,
    });

    formatSyncResult(result, opts.dryRun);
  });

program
  .command('import')
  .description('One-time import from Task Master to Beads')
  .option('-n, --dry-run', 'Show what would be done without making changes')
  .action((opts) => {
    const engine = new SyncEngine(getProjectRoot());

    if (!engine.getStatus().taskmaster) {
      console.error(chalk.red('Error: Task Master not found.'));
      process.exit(1);
    }

    console.log(
      chalk.cyan('Importing Task Master tasks to Beads...')
    );

    const result = engine.import({ dryRun: opts.dryRun });
    formatSyncResult(result, opts.dryRun);
  });

program
  .command('link <tm-id> <bead-id>')
  .description('Manually link a Task Master task to a Bead')
  .action((tmIdStr, beadId) => {
    const engine = new SyncEngine(getProjectRoot());
    const tmId = parseInt(tmIdStr.replace(/^tm[-:]?/i, ''), 10);

    if (isNaN(tmId)) {
      console.error(chalk.red(`Invalid Task Master ID: ${tmIdStr}`));
      process.exit(1);
    }

    const success = engine.link(tmId, beadId);
    if (success) {
      console.log(chalk.green(`✓ Linked TM-${tmId} ↔ ${beadId}`));
    } else {
      process.exit(1);
    }
  });

program
  .command('unlink <identifier>')
  .description('Remove a link (by TM ID or Bead ID)')
  .action((identifier) => {
    const engine = new SyncEngine(getProjectRoot());
    const success = engine.unlink(identifier);

    if (success) {
      console.log(chalk.green(`✓ Unlinked ${identifier}`));
    } else {
      console.error(chalk.red(`No link found for: ${identifier}`));
      process.exit(1);
    }
  });

program
  .command('links')
  .alias('list')
  .description('List all current links')
  .option('--json', 'Output as JSON')
  .action((opts) => {
    const engine = new SyncEngine(getProjectRoot());
    const links = engine.listLinks();

    if (opts.json) {
      console.log(JSON.stringify(links, null, 2));
    } else {
      formatLinks(links);
    }
  });

program
  .command('init')
  .description('Initialize Beadmaster in the current project')
  .option('--docs', 'Append usage instructions to AGENTS.md')
  .option('--claude', 'Append usage instructions to CLAUDE.md instead')
  .option('-f, --force', 'Overwrite existing documentation snippet')
  .action((opts) => {
    const root = getProjectRoot();
    const beadmasterDir = join(root, '.beadmaster');

    console.log('\n' + chalk.bold('Initializing Beadmaster'));
    console.log('─'.repeat(40));

    // Create .beadmaster directory
    if (!existsSync(beadmasterDir)) {
      mkdirSync(beadmasterDir, { recursive: true });
      console.log(chalk.green('✓ Created .beadmaster/'));
    } else {
      console.log(chalk.dim('○ .beadmaster/ already exists'));
    }

    // Check system availability
    const engine = new SyncEngine(root);
    const status = engine.getStatus();

    if (status.taskmaster) {
      console.log(chalk.green('✓ Task Master detected'));
    } else {
      console.log(chalk.yellow('○ Task Master not found (optional)'));
    }

    if (status.beads) {
      console.log(chalk.green('✓ Beads detected'));
    } else {
      console.log(chalk.yellow('○ Beads not found (optional)'));
    }

    // Handle docs flag
    if (opts.docs || opts.claude) {
      const docFile = opts.claude ? 'CLAUDE.md' : 'AGENTS.md';
      const docPath = join(root, docFile);

      if (!existsSync(docPath)) {
        console.log(chalk.yellow(`○ ${docFile} not found, skipping docs`));
      } else {
        const content = readFileSync(docPath, 'utf-8');

        if (content.includes(DOCS_MARKER) && !opts.force) {
          console.log(chalk.dim(`○ ${docFile} already contains Beadmaster section`));
        } else {
          appendFileSync(docPath, DOCS_SNIPPET);
          console.log(chalk.green(`✓ Appended Beadmaster docs to ${docFile}`));
        }
      }
    }

    console.log('\n' + chalk.cyan('Next steps:'));
    if (!status.taskmaster && !status.beads) {
      console.log('  1. Initialize Task Master: npx task-master init');
      console.log('  2. Initialize Beads: bd init');
      console.log('  3. Run: beadmaster sync');
    } else {
      console.log('  beadmaster sync --dry-run  # Preview sync');
      console.log('  beadmaster sync            # Execute sync');
    }

    if (!opts.docs && !opts.claude) {
      console.log(
        '\n' + chalk.dim('Tip: Run with --docs to add instructions to AGENTS.md')
      );
    }

    console.log();
  });

program.parse();
