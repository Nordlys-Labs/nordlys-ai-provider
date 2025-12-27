import { describe, expect, it } from 'vitest';
import type {
  NordlysResponseCompletedEvent,
  NordlysResponseCreatedEvent,
  NordlysResponseFunctionCallArgumentsDeltaEvent,
  NordlysResponseOutputItemAddedEvent,
  NordlysResponseReasoningTextDeltaEvent,
  NordlysResponseTextDeltaEvent,
} from './nordlys-responses-types';
import {
  createStreamState,
  extractResponseMetadata,
  extractUsageFromCompleted,
  getCompletedToolCall,
  handleFunctionCallArgumentsDelta,
  handleOutputItemAdded,
  handleReasoningDelta,
  handleTextDelta,
  isToolCallComplete,
} from './parse-nordlys-stream-event';

describe('parseNordlysStreamEvent', () => {
  describe('createStreamState', () => {
    it('should create initial stream state', () => {
      const state = createStreamState();

      expect(state.textBuffers).toBeInstanceOf(Map);
      expect(state.reasoningBuffers).toBeInstanceOf(Map);
      expect(state.toolCallBuffers).toBeInstanceOf(Map);
      expect(state.activeTextItems).toBeInstanceOf(Set);
      expect(state.activeReasoningItems).toBeInstanceOf(Set);
      expect(state.activeToolCalls).toBeInstanceOf(Set);
    });
  });

  describe('extractResponseMetadata', () => {
    it('should extract metadata from created event', () => {
      const event: NordlysResponseCreatedEvent = {
        type: 'response.created',
        response: {
          id: 'test-id',
          model: 'test-model',
          created_at: 1234567890,
          status: 'completed',
          output: [],
        },
      };

      const result = extractResponseMetadata(event);

      expect(result).toEqual({
        id: 'test-id',
        model: 'test-model',
        created: 1234567890,
      });
    });
  });

  describe('handleOutputItemAdded', () => {
    it('should handle message output item', () => {
      const state = createStreamState();
      const event: NordlysResponseOutputItemAddedEvent = {
        type: 'response.output_item.added',
        item: {
          type: 'message',
          id: 'msg-1',
          role: 'assistant',
          status: 'completed',
          content: [
            {
              type: 'output_text',
              text: 'Hello',
            },
          ],
        },
        output_index: 0,
      };

      const result = handleOutputItemAdded(event, state);

      expect(result.shouldEmitTextStart).toBe(true);
      expect(result.textItemId).toBe('msg-1');
      expect(state.activeTextItems.has('msg-1')).toBe(true);
    });

    it('should handle reasoning output item', () => {
      const state = createStreamState();
      const event: NordlysResponseOutputItemAddedEvent = {
        type: 'response.output_item.added',
        item: {
          type: 'reasoning',
          id: 'reasoning-1',
          text: 'Reasoning',
          status: 'completed',
        },
        output_index: 0,
      };

      const result = handleOutputItemAdded(event, state);

      expect(result.shouldEmitReasoningStart).toBe(true);
      expect(result.reasoningItemId).toBe('reasoning-1');
      expect(state.activeReasoningItems.has('reasoning-1')).toBe(true);
    });

    it('should handle function call output item', () => {
      const state = createStreamState();
      const event: NordlysResponseOutputItemAddedEvent = {
        type: 'response.output_item.added',
        item: {
          type: 'function_call',
          id: 'call-1',
          name: 'test_tool',
          arguments: '',
          status: 'in_progress',
        },
        output_index: 0,
      };

      const result = handleOutputItemAdded(event, state);

      expect(result.shouldEmitToolInputStart).toBe(true);
      expect(result.toolCallId).toBe('call-1');
      expect(result.toolName).toBe('test_tool');
      expect(state.activeToolCalls.has('call-1')).toBe(true);
    });
  });

  describe('handleTextDelta', () => {
    it('should accumulate text deltas', () => {
      const state = createStreamState();
      state.textBuffers.set('msg-1', 'Hello');

      const event: NordlysResponseTextDeltaEvent = {
        type: 'response.output_text.delta',
        delta: ' world',
        item_id: 'msg-1',
        output_index: 0,
        content_index: 0,
      };

      const result = handleTextDelta(event, state);

      expect(result.delta).toBe(' world');
      expect(result.itemId).toBe('msg-1');
      expect(state.textBuffers.get('msg-1')).toBe('Hello world');
    });
  });

  describe('handleReasoningDelta', () => {
    it('should accumulate reasoning deltas', () => {
      const state = createStreamState();
      state.reasoningBuffers.set('reasoning-1', 'Step 1');

      const event: NordlysResponseReasoningTextDeltaEvent = {
        type: 'response.reasoning_text.delta',
        delta: ' Step 2',
        item_id: 'reasoning-1',
        output_index: 0,
      };

      const result = handleReasoningDelta(event, state);

      expect(result.delta).toBe(' Step 2');
      expect(result.itemId).toBe('reasoning-1');
      expect(state.reasoningBuffers.get('reasoning-1')).toBe('Step 1 Step 2');
    });
  });

  describe('handleFunctionCallArgumentsDelta', () => {
    it('should accumulate function call arguments', () => {
      const state = createStreamState();
      state.toolCallBuffers.set('call-1', {
        id: 'call-1',
        name: 'test_tool',
        arguments: '{"param":',
      });

      const event: NordlysResponseFunctionCallArgumentsDeltaEvent = {
        type: 'response.function_call_arguments.delta',
        delta: ' "value"}',
        item_id: 'call-1',
        output_index: 0,
      };

      const result = handleFunctionCallArgumentsDelta(event, state);

      expect(result.delta).toBe(' "value"}');
      expect(result.toolCallId).toBe('call-1');
      expect(result.currentArguments).toBe('{"param": "value"}');
      expect(state.toolCallBuffers.get('call-1')?.arguments).toBe(
        '{"param": "value"}'
      );
    });
  });

  describe('isToolCallComplete', () => {
    it('should return true for valid JSON', () => {
      const state = createStreamState();
      state.toolCallBuffers.set('call-1', {
        id: 'call-1',
        name: 'test_tool',
        arguments: '{"param": "value"}',
      });

      expect(isToolCallComplete('call-1', state)).toBe(true);
    });

    it('should return false for incomplete JSON', () => {
      const state = createStreamState();
      state.toolCallBuffers.set('call-1', {
        id: 'call-1',
        name: 'test_tool',
        arguments: '{"param":',
      });

      expect(isToolCallComplete('call-1', state)).toBe(false);
    });

    it('should return false for non-existent tool call', () => {
      const state = createStreamState();

      expect(isToolCallComplete('call-1', state)).toBe(false);
    });
  });

  describe('getCompletedToolCall', () => {
    it('should return tool call info', () => {
      const state = createStreamState();
      state.toolCallBuffers.set('call-1', {
        id: 'call-1',
        name: 'test_tool',
        arguments: '{"param": "value"}',
      });

      const result = getCompletedToolCall('call-1', state);

      expect(result).toEqual({
        toolCallId: 'call-1',
        toolName: 'test_tool',
        input: '{"param": "value"}',
      });
    });

    it('should return null for non-existent tool call', () => {
      const state = createStreamState();

      expect(getCompletedToolCall('call-1', state)).toBeNull();
    });
  });

  describe('extractUsageFromCompleted', () => {
    it('should extract usage information', () => {
      const event: NordlysResponseCompletedEvent = {
        type: 'response.completed',
        response: {
          id: 'test-id',
          model: 'test-model',
          created_at: Date.now() / 1000,
          status: 'completed',
          output: [],
          usage: {
            input_tokens: 10,
            output_tokens: 20,
            total_tokens: 30,
            input_tokens_details: {
              cached_tokens: 2,
            },
            output_tokens_details: {
              reasoning_tokens: 5,
            },
          },
        },
      };

      const result = extractUsageFromCompleted(event);

      expect(result).toEqual({
        inputTokens: {
          total: 10,
          cacheRead: 2,
          noCache: 8,
        },
        outputTokens: {
          total: 20,
          reasoning: 5,
          text: 15,
        },
      });
    });

    it('should handle missing usage', () => {
      const event: NordlysResponseCompletedEvent = {
        type: 'response.completed',
        response: {
          id: 'test-id',
          model: 'test-model',
          created_at: Date.now() / 1000,
          status: 'completed',
          output: [],
        },
      };

      const result = extractUsageFromCompleted(event);

      expect(result).toEqual({
        inputTokens: { total: 0 },
        outputTokens: { total: 0 },
      });
    });
  });
});
