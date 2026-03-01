import { describe, it, expect } from 'vitest';
import {
  createToolResult,
  isRemoteToolCall,
} from '../../../src/cli/jarvis-proxy/executor.js';

describe('JarvisProxyExecutor', () => {
  describe('isRemoteToolCall', () => {
    it('should identify remote_tool_call messages', () => {
      expect(isRemoteToolCall({ type: 'remote_tool_call', callId: '1', toolName: 'read_file', toolInput: {}, jarvisSessionId: 's1' })).toBe(true);
    });

    it('should reject non-remote_tool_call messages', () => {
      expect(isRemoteToolCall({ type: 'brain_list' })).toBe(false);
      expect(isRemoteToolCall({ type: 'full_sync' })).toBe(false);
    });

    it('should reject null/undefined', () => {
      expect(isRemoteToolCall(null)).toBe(false);
      expect(isRemoteToolCall(undefined)).toBe(false);
    });
  });

  describe('createToolResult', () => {
    it('should create a success result', () => {
      const result = createToolResult('call-1', 'session-1', true, 'file content here');
      expect(result.type).toBe('remote_tool_result');
      expect(result.callId).toBe('call-1');
      expect(result.jarvisSessionId).toBe('session-1');
      expect(result.success).toBe(true);
      expect(result.result).toBe('file content here');
      expect(result.error).toBeUndefined();
    });

    it('should create an error result', () => {
      const result = createToolResult('call-2', 'session-1', false, undefined, 'File not found');
      expect(result.type).toBe('remote_tool_result');
      expect(result.callId).toBe('call-2');
      expect(result.success).toBe(false);
      expect(result.result).toBeUndefined();
      expect(result.error).toBe('File not found');
    });

    it('should include timestamp', () => {
      const result = createToolResult('call-3', 'session-1', true, 'ok');
      expect(result.timestamp).toBeGreaterThan(0);
    });
  });
});
