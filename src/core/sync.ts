/**
 * Beadmaster Sync Engine
 *
 * Bidirectional sync between Task Master and Beads
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { TaskMasterAdapter } from '../adapters/taskmaster.js';
import { BeadsAdapter } from '../adapters/beads.js';
import type {
  UnifiedTask,
  SyncResult,
  SyncAction,
  SyncConflict,
  SyncOptions,
  TaskLink,
  LinkStore,
} from './types.js';

const LINK_STORE_PATH = '.beadmaster/links.json';

export class SyncEngine {
  private projectRoot: string;
  private tm: TaskMasterAdapter;
  private beads: BeadsAdapter;
  private linkStorePath: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.tm = new TaskMasterAdapter(projectRoot);
    this.beads = new BeadsAdapter(projectRoot);
    this.linkStorePath = join(projectRoot, LINK_STORE_PATH);
  }

  /** Check what systems are available */
  getStatus(): { taskmaster: boolean; beads: boolean; linkStore: boolean } {
    return {
      taskmaster: this.tm.exists(),
      beads: this.beads.exists(),
      linkStore: existsSync(this.linkStorePath),
    };
  }

  /** Load existing links between systems */
  loadLinks(): LinkStore {
    if (!existsSync(this.linkStorePath)) {
      return { version: 1, links: [] };
    }

    try {
      const content = readFileSync(this.linkStorePath, 'utf-8');
      return JSON.parse(content) as LinkStore;
    } catch {
      return { version: 1, links: [] };
    }
  }

  /** Save links to disk */
  saveLinks(store: LinkStore): void {
    const dir = join(this.projectRoot, '.beadmaster');
    if (!existsSync(dir)) {
      const { mkdirSync } = require('node:fs');
      mkdirSync(dir, { recursive: true });
    }

    store.lastSync = new Date();
    writeFileSync(this.linkStorePath, JSON.stringify(store, null, 2));
  }

  /** Perform sync between Task Master and Beads */
  sync(options: SyncOptions = {}): SyncResult {
    const result: SyncResult = {
      created: [],
      updated: [],
      conflicts: [],
      skipped: [],
      stats: {
        taskmasterTasks: 0,
        beadIssues: 0,
        linked: 0,
        unlinked: 0,
      },
    };

    // Load data from both systems
    const tmTasks = this.tm.getUnifiedTasks();
    const beadTasks = this.beads.getUnifiedTasks();
    const linkStore = this.loadLinks();

    result.stats.taskmasterTasks = tmTasks.length;
    result.stats.beadIssues = beadTasks.length;

    // Build lookup maps
    const tmById = new Map(tmTasks.map((t) => [t.id, t]));
    const beadById = new Map(beadTasks.map((t) => [t.id, t]));
    const linkByTmId = new Map(linkStore.links.map((l) => [l.tmId, l]));
    const linkByBeadId = new Map(linkStore.links.map((l) => [l.beadId, l]));

    // Try to auto-link by convention (TM-XX in bead title)
    for (const beadTask of beadTasks) {
      const beadSource = beadTask.sources.find((s) => s.system === 'beads');
      if (!beadSource) continue;

      const tmId = this.beads.extractTmId(beadTask.title);
      if (tmId && !linkByTmId.has(tmId) && !linkByBeadId.has(beadSource.id)) {
        // Found a convention-based link
        const link: TaskLink = {
          tmId,
          beadId: beadSource.id,
          linkedAt: new Date(),
          autoLinked: true,
        };
        linkStore.links.push(link);
        linkByTmId.set(tmId, link);
        linkByBeadId.set(beadSource.id, link);
      }
    }

    // Process TM tasks that need beads
    if (options.direction !== 'beads_to_tm') {
      for (const tmTask of tmTasks) {
        const tmSource = tmTask.sources.find((s) => s.system === 'taskmaster');
        if (!tmSource) continue;

        const tmId = parseInt(tmSource.id, 10);
        const link = linkByTmId.get(tmId);

        if (!link) {
          // TM task without a bead - create one
          const action: SyncAction = {
            task: tmTask,
            direction: 'tm_to_beads',
            reason: 'No linked bead found',
          };

          if (!options.dryRun) {
            const beadId = this.beads.createIssue(`TM-${tmId}: ${tmTask.title}`, {
              type: 'task',
              priority: tmTask.priority,
              meta: { tm_id: String(tmId) },
            });

            if (beadId) {
              linkStore.links.push({
                tmId,
                beadId,
                linkedAt: new Date(),
                autoLinked: false,
              });
            }
          }

          result.created.push(action);
        } else {
          // Has a link - check for status sync
          const beadId = `bead:${link.beadId}`;
          const beadTask = beadById.get(beadId);

          if (beadTask && tmTask.status !== beadTask.status) {
            // Status mismatch - determine which is newer
            const tmUpdated = tmTask.updatedAt?.getTime() || 0;
            const beadUpdated = beadTask.updatedAt?.getTime() || 0;

            if (tmUpdated > beadUpdated) {
              // TM is newer, update bead
              const action: SyncAction = {
                task: tmTask,
                direction: 'tm_to_beads',
                reason: `Status: ${beadTask.status} → ${tmTask.status}`,
              };

              if (!options.dryRun) {
                this.beads.updateStatus(link.beadId, tmTask.status);
              }

              result.updated.push(action);
            } else if (beadUpdated > tmUpdated) {
              // Bead is newer, update TM
              const action: SyncAction = {
                task: beadTask,
                direction: 'beads_to_tm',
                reason: `Status: ${tmTask.status} → ${beadTask.status}`,
              };

              if (!options.dryRun) {
                this.tm.updateStatus(tmId, beadTask.status);
              }

              result.updated.push(action);
            } else {
              // Same time, conflict
              result.conflicts.push({
                task: tmTask,
                tmValue: tmTask.status,
                beadsValue: beadTask.status,
                field: 'status',
              });
            }
          }
        }
      }
    }

    // Count linked/unlinked
    result.stats.linked = linkStore.links.length;
    result.stats.unlinked =
      result.stats.taskmasterTasks - linkStore.links.length;

    // Save updated links
    if (!options.dryRun) {
      this.saveLinks(linkStore);
    }

    return result;
  }

  /** Import all TM tasks to Beads (one-time setup) */
  import(options: SyncOptions = {}): SyncResult {
    return this.sync({ ...options, direction: 'tm_to_beads' });
  }

  /** Manually link a TM task to a bead */
  link(tmId: number, beadId: string): boolean {
    const linkStore = this.loadLinks();

    // Check for existing links
    const existingTm = linkStore.links.find((l) => l.tmId === tmId);
    const existingBead = linkStore.links.find((l) => l.beadId === beadId);

    if (existingTm) {
      console.error(`TM-${tmId} is already linked to ${existingTm.beadId}`);
      return false;
    }

    if (existingBead) {
      console.error(`${beadId} is already linked to TM-${existingBead.tmId}`);
      return false;
    }

    linkStore.links.push({
      tmId,
      beadId,
      linkedAt: new Date(),
      autoLinked: false,
    });

    this.saveLinks(linkStore);
    return true;
  }

  /** Remove a link */
  unlink(identifier: string): boolean {
    const linkStore = this.loadLinks();
    const initialLength = linkStore.links.length;

    // Try to match by TM ID or bead ID
    const tmMatch = identifier.match(/^(?:tm[:\-])?(\d+)$/i);
    if (tmMatch) {
      const tmId = parseInt(tmMatch[1], 10);
      linkStore.links = linkStore.links.filter((l) => l.tmId !== tmId);
    } else {
      linkStore.links = linkStore.links.filter((l) => l.beadId !== identifier);
    }

    if (linkStore.links.length < initialLength) {
      this.saveLinks(linkStore);
      return true;
    }

    return false;
  }

  /** List all current links */
  listLinks(): TaskLink[] {
    return this.loadLinks().links;
  }
}
