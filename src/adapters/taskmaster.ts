/**
 * Task Master Adapter
 *
 * Reads and writes Task Master tasks from .taskmaster/tasks/tasks.json
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type {
  TaskMasterFile,
  TaskMasterTask,
  UnifiedTask,
  TaskStatus,
  Priority,
} from '../core/types.js';

const TASKMASTER_PATH = '.taskmaster/tasks/tasks.json';

export class TaskMasterAdapter {
  private projectRoot: string;
  private filePath: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.filePath = join(projectRoot, TASKMASTER_PATH);
  }

  /** Check if Task Master is initialized in this project */
  exists(): boolean {
    return existsSync(this.filePath);
  }

  /** Read all tasks from Task Master */
  readTasks(): TaskMasterTask[] {
    if (!this.exists()) {
      return [];
    }

    try {
      const content = readFileSync(this.filePath, 'utf-8');
      const data: TaskMasterFile = JSON.parse(content);
      // Handle both modern { tasks: [...] } and legacy { master: { tasks: [...] } } formats
      const tasks = data.tasks || data.master?.tasks || [];
      // Normalize string IDs to numbers
      return tasks.map((t) => ({
        ...t,
        id: typeof t.id === 'string' ? parseInt(t.id, 10) : t.id,
      }));
    } catch (error) {
      throw new Error(`Failed to read Task Master tasks: ${error}`);
    }
  }

  /** Convert Task Master task to unified format */
  toUnified(task: TaskMasterTask): UnifiedTask {
    return {
      id: `tm:${task.id}`,
      title: task.title,
      description: task.description,
      status: this.normalizeStatus(task.status),
      priority: this.normalizePriority(task.priority),
      parentId: task.parentId ? `tm:${task.parentId}` : undefined,
      dependencies: task.dependencies?.map((d) => `tm:${d}`),
      createdAt: task.createdAt ? new Date(task.createdAt) : undefined,
      updatedAt: task.updatedAt ? new Date(task.updatedAt) : undefined,
      sources: [
        {
          system: 'taskmaster',
          id: String(task.id),
          rawData: task,
        },
      ],
    };
  }

  /** Get all tasks as unified format */
  getUnifiedTasks(): UnifiedTask[] {
    return this.readTasks().map((t) => this.toUnified(t));
  }

  /** Update a task's status */
  updateStatus(taskId: number, status: TaskStatus): void {
    const tasks = this.readTasks();
    const task = tasks.find((t) => t.id === taskId);

    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    task.status = this.denormalizeStatus(status);
    task.updatedAt = new Date().toISOString();

    this.writeTasks(tasks);
  }

  /** Write tasks back to file */
  private writeTasks(tasks: TaskMasterTask[]): void {
    const content = readFileSync(this.filePath, 'utf-8');
    const data: TaskMasterFile = JSON.parse(content);
    data.tasks = tasks;
    writeFileSync(this.filePath, JSON.stringify(data, null, 2));
  }

  /** Normalize Task Master status to unified status */
  private normalizeStatus(status: string): TaskStatus {
    const map: Record<string, TaskStatus> = {
      pending: 'pending',
      'in-progress': 'in_progress',
      done: 'done',
      deferred: 'pending',
      cancelled: 'cancelled',
      blocked: 'blocked',
      review: 'in_progress',
    };
    return map[status] || 'pending';
  }

  /** Denormalize unified status to Task Master status */
  private denormalizeStatus(
    status: TaskStatus
  ): TaskMasterTask['status'] {
    const map: Record<TaskStatus, TaskMasterTask['status']> = {
      pending: 'pending',
      in_progress: 'in-progress',
      done: 'done',
      blocked: 'blocked',
      cancelled: 'cancelled',
    };
    return map[status];
  }

  /** Normalize priority to 0-4 scale */
  private normalizePriority(priority?: string): Priority {
    const map: Record<string, Priority> = {
      high: 1,
      medium: 2,
      low: 3,
    };
    return priority ? (map[priority] ?? 2) : 2;
  }
}
