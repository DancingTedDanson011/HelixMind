import { describe, it, expect } from 'vitest';
import {
  createStartJarvisMessage,
  createStopJarvisMessage,
  createAddTaskMessage,
  createListTasksMessage,
  createGetStatusMessage,
  type JarvisProxyMessage,
} from '../../../src/cli/jarvis-proxy/client.js';

describe('JarvisProxyClient messages', () => {
  it('should create a start_jarvis message', () => {
    const msg = createStartJarvisMessage();
    expect(msg.type).toBe('start_jarvis');
    expect(msg.timestamp).toBeGreaterThan(0);
  });

  it('should create a stop_jarvis message', () => {
    const msg = createStopJarvisMessage();
    expect(msg.type).toBe('stop_jarvis');
  });

  it('should create an add_jarvis_task message', () => {
    const msg = createAddTaskMessage('Fix bug', 'Fix the login bug', {
      priority: 'high',
      tags: ['bugfix'],
    });
    expect(msg.type).toBe('add_jarvis_task');
    expect((msg as any).title).toBe('Fix bug');
    expect((msg as any).description).toBe('Fix the login bug');
    expect((msg as any).priority).toBe('high');
    expect((msg as any).tags).toEqual(['bugfix']);
  });

  it('should create a list_jarvis_tasks message', () => {
    const msg = createListTasksMessage();
    expect(msg.type).toBe('list_jarvis_tasks');
  });

  it('should create a get_jarvis_status message', () => {
    const msg = createGetStatusMessage();
    expect(msg.type).toBe('get_jarvis_status');
  });

  it('should include requestId in all messages', () => {
    const msgs = [
      createStartJarvisMessage(),
      createStopJarvisMessage(),
      createAddTaskMessage('Test', 'Desc'),
      createListTasksMessage(),
      createGetStatusMessage(),
    ];
    for (const msg of msgs) {
      expect(msg.requestId).toBeDefined();
      expect(typeof msg.requestId).toBe('string');
      expect(msg.requestId!.length).toBeGreaterThan(0);
    }
  });
});
