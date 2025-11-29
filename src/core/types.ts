/**
 * Beadmaster - Core Types
 *
 * Unified task representation for syncing between Task Master and Beads
 */

// ============ Unified Task Model ============

export interface UnifiedTask {
  // Identity
  id: string;                    // Canonical ID (format: "tm:85" or "bead:shadow-work-abc")
  title: string;
  description?: string;

  // Status (normalized across systems)
  status: TaskStatus;
  priority: Priority;

  // Relationships
  parentId?: string;
  dependencies?: string[];

  // Metadata
  createdAt?: Date;
  updatedAt?: Date;

  // Source tracking
  sources: TaskSource[];
}

export type TaskStatus =
  | 'pending'
  | 'in_progress'
  | 'done'
  | 'blocked'
  | 'cancelled';

export type Priority = 0 | 1 | 2 | 3 | 4;

export interface TaskSource {
  system: 'taskmaster' | 'beads';
  id: string;                    // Original ID in that system
  rawData?: unknown;             // Original data for debugging
}

// ============ Task Master Types ============

export interface TaskMasterTask {
  id: number | string;  // Can be string in legacy format, normalized to number
  title: string;
  description?: string;
  status: 'pending' | 'in-progress' | 'done' | 'deferred' | 'cancelled' | 'blocked' | 'review';
  priority?: 'low' | 'medium' | 'high';
  dependencies?: number[];
  parentId?: number;
  subtasks?: TaskMasterSubtask[];
  details?: string;
  testStrategy?: string;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface TaskMasterSubtask {
  id: number;
  title: string;
  description?: string;
  status: string;
  dependencies?: number[];
}

export interface TaskMasterFile {
  // Modern format: { tasks: [...] }
  tasks?: TaskMasterTask[];
  // Legacy format: { master: { tasks: [...] } }
  master?: {
    tasks: TaskMasterTask[];
  };
  metadata?: {
    projectName?: string;
    version?: string;
  };
}

// ============ Beads Types ============

export interface BeadIssue {
  id: string;                    // e.g., "shadow-work-abc"
  title: string;
  type: 'bug' | 'feature' | 'task' | 'epic' | 'chore';
  status: 'open' | 'in_progress' | 'closed';
  priority: number;              // 0-4
  created_at: string;
  updated_at?: string;
  closed_at?: string;
  closed_reason?: string;
  parent_id?: string;
  dependencies?: BeadDependency[];
  notes?: string;
  meta?: Record<string, string>;
}

export interface BeadDependency {
  type: 'blocks' | 'blocked_by' | 'related' | 'discovered_from';
  target_id: string;
}

// ============ Sync Types ============

export interface SyncResult {
  created: SyncAction[];
  updated: SyncAction[];
  conflicts: SyncConflict[];
  skipped: SyncAction[];
  stats: {
    taskmasterTasks: number;
    beadIssues: number;
    linked: number;
    unlinked: number;
  };
}

export interface SyncAction {
  task: UnifiedTask;
  direction: 'tm_to_beads' | 'beads_to_tm' | 'both';
  reason: string;
}

export interface SyncConflict {
  task: UnifiedTask;
  tmValue: unknown;
  beadsValue: unknown;
  field: string;
  resolution?: 'use_tm' | 'use_beads' | 'manual';
}

export interface SyncOptions {
  dryRun?: boolean;
  direction?: 'bidirectional' | 'tm_to_beads' | 'beads_to_tm';
  force?: boolean;
  verbose?: boolean;
}

// ============ Link Types ============

export interface TaskLink {
  tmId: number;
  beadId: string;
  linkedAt: Date;
  autoLinked: boolean;           // true if matched by convention, false if manual
}

export interface LinkStore {
  version: number;
  links: TaskLink[];
  lastSync?: Date;
}
