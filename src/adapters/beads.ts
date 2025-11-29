/**
 * Beads Adapter
 *
 * Reads and writes Beads issues from .beads/issues.jsonl
 * Also supports direct SQLite access if available
 */

import { readFileSync, writeFileSync, existsSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import type {
  BeadIssue,
  UnifiedTask,
  TaskStatus,
  Priority,
} from '../core/types.js';

const BEADS_JSONL_PATH = '.beads/issues.jsonl';

export class BeadsAdapter {
  private projectRoot: string;
  private jsonlPath: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.jsonlPath = join(projectRoot, BEADS_JSONL_PATH);
  }

  /** Check if Beads is initialized in this project */
  exists(): boolean {
    return existsSync(this.jsonlPath);
  }

  /** Check if bd CLI is available */
  hasCli(): boolean {
    try {
      execSync('bd --version', { stdio: 'pipe' });
      return true;
    } catch {
      return false;
    }
  }

  /** Read all issues from JSONL file */
  readIssues(): BeadIssue[] {
    if (!this.exists()) {
      return [];
    }

    try {
      const content = readFileSync(this.jsonlPath, 'utf-8');
      const lines = content.trim().split('\n').filter(Boolean);
      return lines.map((line) => JSON.parse(line) as BeadIssue);
    } catch (error) {
      throw new Error(`Failed to read Beads issues: ${error}`);
    }
  }

  /** Read issues via bd CLI (preferred, more up-to-date) */
  readIssuesCli(): BeadIssue[] {
    if (!this.hasCli()) {
      return this.readIssues();
    }

    try {
      const output = execSync('bd list --json', {
        cwd: this.projectRoot,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      return JSON.parse(output) as BeadIssue[];
    } catch {
      // Fall back to JSONL
      return this.readIssues();
    }
  }

  /** Convert Beads issue to unified format */
  toUnified(issue: BeadIssue): UnifiedTask {
    return {
      id: `bead:${issue.id}`,
      title: issue.title,
      description: issue.notes,
      status: this.normalizeStatus(issue.status),
      priority: issue.priority as Priority,
      parentId: issue.parent_id ? `bead:${issue.parent_id}` : undefined,
      dependencies: issue.dependencies?.map((d) => `bead:${d.target_id}`),
      createdAt: new Date(issue.created_at),
      updatedAt: issue.updated_at ? new Date(issue.updated_at) : undefined,
      sources: [
        {
          system: 'beads',
          id: issue.id,
          rawData: issue,
        },
      ],
    };
  }

  /** Get all issues as unified format */
  getUnifiedTasks(): UnifiedTask[] {
    return this.readIssuesCli().map((i) => this.toUnified(i));
  }

  /** Create a new bead via CLI */
  createIssue(
    title: string,
    options: {
      type?: BeadIssue['type'];
      priority?: Priority;
      parentId?: string;
      meta?: Record<string, string>;
    } = {}
  ): string | null {
    if (!this.hasCli()) {
      console.error('bd CLI not available, cannot create issue');
      return null;
    }

    const args = ['bd', 'create', `"${title}"`];

    if (options.type) {
      args.push('-t', options.type);
    }
    if (options.priority !== undefined) {
      args.push('-p', String(options.priority));
    }
    if (options.parentId) {
      args.push('--parent', options.parentId);
    }
    if (options.meta) {
      for (const [key, value] of Object.entries(options.meta)) {
        args.push('--meta', `${key}:${value}`);
      }
    }
    args.push('--json');

    try {
      const output = execSync(args.join(' '), {
        cwd: this.projectRoot,
        encoding: 'utf-8' as const,
        shell: '/bin/sh',
      });
      const result = JSON.parse(output);
      return result.id || null;
    } catch (error) {
      console.error(`Failed to create bead: ${error}`);
      return null;
    }
  }

  /** Update a bead's status via CLI */
  updateStatus(beadId: string, status: TaskStatus): boolean {
    if (!this.hasCli()) {
      console.error('bd CLI not available, cannot update status');
      return false;
    }

    const beadStatus = this.denormalizeStatus(status);

    try {
      if (beadStatus === 'closed') {
        execSync(`bd close ${beadId} --reason "Synced from Task Master" --json`, {
          cwd: this.projectRoot,
          encoding: 'utf-8' as const,
          shell: '/bin/sh',
        });
      } else {
        execSync(`bd update ${beadId} --status ${beadStatus} --json`, {
          cwd: this.projectRoot,
          encoding: 'utf-8' as const,
          shell: '/bin/sh',
        });
      }
      return true;
    } catch (error) {
      console.error(`Failed to update bead ${beadId}: ${error}`);
      return false;
    }
  }

  /** Normalize Beads status to unified status */
  private normalizeStatus(status: string): TaskStatus {
    const map: Record<string, TaskStatus> = {
      open: 'pending',
      in_progress: 'in_progress',
      closed: 'done',
    };
    return map[status] || 'pending';
  }

  /** Denormalize unified status to Beads status */
  private denormalizeStatus(status: TaskStatus): 'open' | 'in_progress' | 'closed' {
    const map: Record<TaskStatus, 'open' | 'in_progress' | 'closed'> = {
      pending: 'open',
      in_progress: 'in_progress',
      done: 'closed',
      blocked: 'open',      // Beads doesn't have blocked, keep open
      cancelled: 'closed',
    };
    return map[status];
  }

  /** Extract Task Master ID from bead title (convention: "TM-85: ..." or "[TM-85]") */
  extractTmId(title: string): number | null {
    const patterns = [
      /^TM-(\d+):/,           // TM-85: Title
      /^\[TM-(\d+)\]/,        // [TM-85] Title
      /^tm:(\d+)/i,           // tm:85 Title
      /\(TM-(\d+)\)/,         // Title (TM-85)
    ];

    for (const pattern of patterns) {
      const match = title.match(pattern);
      if (match) {
        return parseInt(match[1], 10);
      }
    }

    return null;
  }
}
