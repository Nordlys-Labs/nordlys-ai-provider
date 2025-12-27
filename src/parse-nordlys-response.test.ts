import { describe, expect, it } from 'vitest';
import type { NordlysResponse } from './nordlys-responses-types';
import { parseNordlysResponse } from './parse-nordlys-response';

describe('parseNordlysResponse', () => {
  it('should parse message with text content', () => {
    const response: NordlysResponse = {
      id: 'test-id',
      model: 'test-model',
      created_at: Date.now() / 1000,
      status: 'completed',
      output: [
        {
          type: 'message',
          id: 'msg-1',
          role: 'assistant',
          status: 'completed',
          content: [
            {
              type: 'output_text',
              text: 'Hello world',
            },
          ],
        },
      ],
    };

    const result = parseNordlysResponse(response);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ type: 'text', text: 'Hello world' });
  });

  it('should parse reasoning item', () => {
    const response: NordlysResponse = {
      id: 'test-id',
      model: 'test-model',
      created_at: Date.now() / 1000,
      status: 'completed',
      output: [
        {
          type: 'reasoning',
          id: 'reasoning-1',
          text: 'This is reasoning',
          status: 'completed',
        },
      ],
    };

    const result = parseNordlysResponse(response);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      type: 'reasoning',
      text: 'This is reasoning',
    });
  });

  it('should parse function call', () => {
    const response: NordlysResponse = {
      id: 'test-id',
      model: 'test-model',
      created_at: Date.now() / 1000,
      status: 'completed',
      output: [
        {
          type: 'function_call',
          id: 'call-1',
          name: 'test_tool',
          arguments: '{"param": "value"}',
          status: 'completed',
        },
      ],
    };

    const result = parseNordlysResponse(response);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      type: 'tool-call',
      toolCallId: 'call-1',
      toolName: 'test_tool',
      input: '{"param": "value"}',
    });
  });

  it('should parse multiple output items', () => {
    const response: NordlysResponse = {
      id: 'test-id',
      model: 'test-model',
      created_at: Date.now() / 1000,
      status: 'completed',
      output: [
        {
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
        {
          type: 'reasoning',
          id: 'reasoning-1',
          text: 'Reasoning',
          status: 'completed',
        },
        {
          type: 'function_call',
          id: 'call-1',
          name: 'tool',
          arguments: '{}',
          status: 'completed',
        },
      ],
    };

    const result = parseNordlysResponse(response);

    expect(result).toHaveLength(3);
    expect(result[0].type).toBe('text');
    expect(result[1].type).toBe('reasoning');
    expect(result[2].type).toBe('tool-call');
  });

  it('should handle refusal content', () => {
    const response: NordlysResponse = {
      id: 'test-id',
      model: 'test-model',
      created_at: Date.now() / 1000,
      status: 'completed',
      output: [
        {
          type: 'message',
          id: 'msg-1',
          role: 'assistant',
          status: 'completed',
          content: [
            {
              type: 'refusal',
              text: 'I cannot do that',
            },
          ],
        },
      ],
    };

    const result = parseNordlysResponse(response);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      type: 'text',
      text: 'I cannot do that',
    });
  });

  it('should handle empty output', () => {
    const response: NordlysResponse = {
      id: 'test-id',
      model: 'test-model',
      created_at: Date.now() / 1000,
      status: 'completed',
      output: [],
    };

    const result = parseNordlysResponse(response);

    expect(result).toHaveLength(0);
  });
});
