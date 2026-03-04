import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TaskOrchestrator } from '../../../src/cli/jarvis/orchestrator.js';
import type { SubTask, OrchestrationPlan } from '../../../src/cli/jarvis/types.js';
import { ParallelExecutor } from '../../../src/cli/jarvis/parallel.js';

describe('TaskOrchestrator', () => {
  let orchestrator: TaskOrchestrator;

  beforeEach(() => {
    orchestrator = new TaskOrchestrator();
  });

  // ─── shouldOrchestrate ────────────────────────────────────────────

  describe('shouldOrchestrate', () => {
    it('should return true for multiple action verbs with "and"', () => {
      expect(orchestrator.shouldOrchestrate(
        'Create a new Button component and update the header to use it',
      )).toBe(true);
    });

    it('should return true for numbered steps', () => {
      expect(orchestrator.shouldOrchestrate(
        '1. Add a login page\n2. Create the auth middleware\n3. Update the router',
      )).toBe(true);
    });

    it('should return true for "additionally" keyword with actions', () => {
      expect(orchestrator.shouldOrchestrate(
        'Fix the button styling. Additionally, refactor the form validation.',
      )).toBe(true);
    });

    it('should return true for 3+ file path mentions', () => {
      expect(orchestrator.shouldOrchestrate(
        'Update src/utils/auth.ts, src/middleware/cors.ts, and src/routes/api.ts with the new config',
      )).toBe(true);
    });

    it('should return false for a simple single task', () => {
      expect(orchestrator.shouldOrchestrate(
        'Fix the typo in the readme',
      )).toBe(false);
    });

    it('should return false for a single file change', () => {
      expect(orchestrator.shouldOrchestrate(
        'Add a loading spinner to the dashboard page',
      )).toBe(false);
    });

    it('should return true for "also" keyword with verbs', () => {
      expect(orchestrator.shouldOrchestrate(
        'Rename the class to UserService. Also, update all imports that reference it.',
      )).toBe(true);
    });

    it('should return true for bullet points with actions', () => {
      expect(orchestrator.shouldOrchestrate(
        '- Create the migration file\n- Update the model\n- Add tests for the new fields',
      )).toBe(true);
    });
  });

  // ─── createPlan ───────────────────────────────────────────────────

  describe('createPlan', () => {
    it('should parse a valid LLM JSON response into a plan', async () => {
      const mockResponse = JSON.stringify({
        shouldOrchestrate: true,
        reason: 'Two independent tasks',
        subTasks: [
          { id: 1, title: 'Create component', description: 'Create Button.tsx', affectedFiles: ['src/Button.tsx'], dependencies: [], priority: 'high' },
          { id: 2, title: 'Add tests', description: 'Add Button.test.tsx', affectedFiles: ['tests/Button.test.tsx'], dependencies: [1], priority: 'medium' },
        ],
        parallelGroups: [[1], [2]],
      });

      const sendMessage = vi.fn().mockResolvedValue(mockResponse);
      const plan = await orchestrator.createPlan('Create a Button component and add tests', sendMessage);

      expect(plan.shouldOrchestrate).toBe(true);
      expect(plan.subTasks).toHaveLength(2);
      expect(plan.subTasks[0].title).toBe('Create component');
      expect(plan.subTasks[1].dependencies).toEqual([1]);
      expect(plan.parallelGroups).toEqual([[1], [2]]);
      expect(sendMessage).toHaveBeenCalledOnce();
    });

    it('should handle LLM response wrapped in markdown code block', async () => {
      const mockResponse = '```json\n{"shouldOrchestrate": true, "reason": "test", "subTasks": [{"id": 1, "title": "T1", "description": "D1", "affectedFiles": [], "dependencies": [], "priority": "low"}], "parallelGroups": [[1]]}\n```';

      const sendMessage = vi.fn().mockResolvedValue(mockResponse);
      const plan = await orchestrator.createPlan('do stuff', sendMessage);

      expect(plan.shouldOrchestrate).toBe(true);
      expect(plan.subTasks).toHaveLength(1);
      expect(plan.subTasks[0].priority).toBe('low');
    });

    it('should handle invalid JSON gracefully', async () => {
      const sendMessage = vi.fn().mockResolvedValue('This is not JSON at all');
      const plan = await orchestrator.createPlan('do stuff', sendMessage);

      expect(plan.shouldOrchestrate).toBe(false);
      expect(plan.subTasks).toHaveLength(0);
    });

    it('should build parallel groups from dependencies if not provided', async () => {
      const mockResponse = JSON.stringify({
        shouldOrchestrate: true,
        reason: 'deps test',
        subTasks: [
          { id: 1, title: 'A', description: '', affectedFiles: [], dependencies: [], priority: 'high' },
          { id: 2, title: 'B', description: '', affectedFiles: [], dependencies: [], priority: 'medium' },
          { id: 3, title: 'C', description: '', affectedFiles: [], dependencies: [1, 2], priority: 'low' },
        ],
        parallelGroups: [],
      });

      const sendMessage = vi.fn().mockResolvedValue(mockResponse);
      const plan = await orchestrator.createPlan('multi task', sendMessage);

      // Should auto-build: [[1,2], [3]]
      expect(plan.parallelGroups).toEqual([[1, 2], [3]]);
    });

    it('should set currentPlan after creating', async () => {
      const mockResponse = JSON.stringify({
        shouldOrchestrate: false, reason: 'simple', subTasks: [], parallelGroups: [],
      });
      const sendMessage = vi.fn().mockResolvedValue(mockResponse);

      expect(orchestrator.getCurrentPlan()).toBeNull();
      await orchestrator.createPlan('simple task', sendMessage);
      expect(orchestrator.getCurrentPlan()).not.toBeNull();
    });
  });

  // ─── execute ──────────────────────────────────────────────────────

  describe('execute', () => {
    function makePlan(overrides?: Partial<OrchestrationPlan>): OrchestrationPlan {
      return {
        originalRequest: 'test',
        subTasks: [
          { id: 1, title: 'T1', description: 'D1', affectedFiles: [], dependencies: [], priority: 'high', status: 'pending' },
          { id: 2, title: 'T2', description: 'D2', affectedFiles: [], dependencies: [], priority: 'medium', status: 'pending' },
          { id: 3, title: 'T3', description: 'D3', affectedFiles: [], dependencies: [1, 2], priority: 'low', status: 'pending' },
        ],
        parallelGroups: [[1, 2], [3]],
        shouldOrchestrate: true,
        reason: 'test',
        ...overrides,
      };
    }

    it('should execute all tasks and return results', async () => {
      const plan = makePlan();
      const startWorker = vi.fn().mockResolvedValue({ success: true, result: 'done' });
      const executor = new ParallelExecutor();

      const result = await orchestrator.execute(plan, startWorker, executor);

      expect(result.completed).toBe(3);
      expect(result.failed).toBe(0);
      expect(result.results.size).toBe(3);
      expect(startWorker).toHaveBeenCalledTimes(3);
    });

    it('should run groups sequentially (group 1 before group 2)', async () => {
      const plan = makePlan();
      const callOrder: number[] = [];

      const startWorker = vi.fn().mockImplementation(async (task: SubTask) => {
        callOrder.push(task.id);
        return { success: true, result: `done-${task.id}` };
      });
      const executor = new ParallelExecutor();

      await orchestrator.execute(plan, startWorker, executor);

      // Tasks 1 and 2 should be called before task 3
      const idx1 = callOrder.indexOf(1);
      const idx2 = callOrder.indexOf(2);
      const idx3 = callOrder.indexOf(3);
      expect(idx1).toBeLessThan(idx3);
      expect(idx2).toBeLessThan(idx3);
    });

    it('should handle worker failures', async () => {
      const plan = makePlan();
      const startWorker = vi.fn().mockImplementation(async (task: SubTask) => {
        if (task.id === 2) return { success: false, result: 'error' };
        return { success: true, result: 'ok' };
      });
      const executor = new ParallelExecutor();

      const result = await orchestrator.execute(plan, startWorker, executor);

      expect(result.completed).toBe(2);
      expect(result.failed).toBe(1);
      expect(plan.subTasks[1].status).toBe('failed');
    });

    it('should handle worker exceptions', async () => {
      const plan = makePlan();
      const startWorker = vi.fn().mockImplementation(async (task: SubTask) => {
        if (task.id === 1) throw new Error('boom');
        return { success: true, result: 'ok' };
      });
      const executor = new ParallelExecutor();

      const result = await orchestrator.execute(plan, startWorker, executor);

      expect(result.failed).toBeGreaterThanOrEqual(1);
      expect(plan.subTasks[0].status).toBe('failed');
      expect(plan.subTasks[0].result).toBe('boom');
    });

    it('should update task status during execution', async () => {
      const plan = makePlan({ parallelGroups: [[1], [2], [3]] });
      const events: string[] = [];
      orchestrator.setOnChange((event) => events.push(event));

      const startWorker = vi.fn().mockResolvedValue({ success: true, result: 'done' });
      const executor = new ParallelExecutor();

      await orchestrator.execute(plan, startWorker, executor);

      expect(events).toContain('group_started');
      expect(events).toContain('group_completed');
      expect(events).toContain('execution_done');
    });
  });

  // ─── getStatus ────────────────────────────────────────────────────

  describe('getStatus', () => {
    it('should return null when no plan exists', () => {
      expect(orchestrator.getStatus()).toBeNull();
    });

    it('should return correct counts after execution', async () => {
      const mockResponse = JSON.stringify({
        shouldOrchestrate: true,
        reason: 'test',
        subTasks: [
          { id: 1, title: 'T1', description: '', affectedFiles: [], dependencies: [], priority: 'high' },
          { id: 2, title: 'T2', description: '', affectedFiles: [], dependencies: [], priority: 'medium' },
        ],
        parallelGroups: [[1, 2]],
      });

      const sendMessage = vi.fn().mockResolvedValue(mockResponse);
      const plan = await orchestrator.createPlan('multi', sendMessage);

      const startWorker = vi.fn()
        .mockResolvedValueOnce({ success: true, result: 'ok' })
        .mockResolvedValueOnce({ success: false, result: 'err' });
      const executor = new ParallelExecutor();

      await orchestrator.execute(plan, startWorker, executor);

      const status = orchestrator.getStatus();
      expect(status).not.toBeNull();
      expect(status!.completed).toBe(1);
      expect(status!.failed).toBe(1);
      expect(status!.total).toBe(2);
      expect(status!.active).toBe(0);
    });
  });

  // ─── abortAll ─────────────────────────────────────────────────────

  describe('abortAll', () => {
    it('should mark pending tasks as failed with "Aborted"', async () => {
      const mockResponse = JSON.stringify({
        shouldOrchestrate: true,
        reason: 'test',
        subTasks: [
          { id: 1, title: 'T1', description: '', affectedFiles: [], dependencies: [], priority: 'high' },
          { id: 2, title: 'T2', description: '', affectedFiles: [], dependencies: [1], priority: 'medium' },
        ],
        parallelGroups: [[1], [2]],
      });

      const sendMessage = vi.fn().mockResolvedValue(mockResponse);
      const plan = await orchestrator.createPlan('multi', sendMessage);

      // Abort before execution
      orchestrator.abortAll();

      expect(plan.subTasks[0].status).toBe('failed');
      expect(plan.subTasks[0].result).toBe('Aborted');
      expect(plan.subTasks[1].status).toBe('failed');
    });

    it('should stop execution mid-flight', async () => {
      const plan: OrchestrationPlan = {
        originalRequest: 'test',
        subTasks: [
          { id: 1, title: 'T1', description: '', affectedFiles: [], dependencies: [], priority: 'high', status: 'pending' },
          { id: 2, title: 'T2', description: '', affectedFiles: [], dependencies: [], priority: 'medium', status: 'pending' },
        ],
        parallelGroups: [[1], [2]],
        shouldOrchestrate: true,
        reason: 'test',
      };

      const startWorker = vi.fn().mockImplementation(async (task: SubTask) => {
        if (task.id === 1) {
          // After first task completes, abort
          orchestrator.abortAll();
          return { success: true, result: 'done' };
        }
        return { success: true, result: 'should not reach' };
      });
      const executor = new ParallelExecutor();

      const result = await orchestrator.execute(plan, startWorker, executor);

      // Task 2 should not have been started normally (aborted flag set)
      expect(result.completed).toBe(1);
    });
  });

  // ─── onChange ──────────────────────────────────────────────────────

  describe('setOnChange', () => {
    it('should fire events during plan creation', async () => {
      const events: string[] = [];
      orchestrator.setOnChange((event) => events.push(event));

      const mockResponse = JSON.stringify({
        shouldOrchestrate: true, reason: 'test',
        subTasks: [{ id: 1, title: 'T1', description: '', affectedFiles: [], dependencies: [], priority: 'high' }],
        parallelGroups: [[1]],
      });
      const sendMessage = vi.fn().mockResolvedValue(mockResponse);

      await orchestrator.createPlan('task', sendMessage);
      expect(events).toContain('plan_created');
    });
  });
});
