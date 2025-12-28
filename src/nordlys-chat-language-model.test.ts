import { describe, expect, it, vi } from 'vitest';
import { NordlysChatLanguageModel } from './nordlys-chat-language-model';

describe('nordlysChatLanguageModel', () => {
  it('should construct with modelId and config', () => {
    const model = new NordlysChatLanguageModel('test-model', undefined, {
      provider: 'nordlys.chat',
      baseURL: 'https://example.com',
      headers: () => ({}),
    });
    expect(model.modelId).toBe('test-model');
    expect(model.provider).toBe('nordlys.chat');
  });

  it('should have doGenerate and doStream methods', () => {
    const model = new NordlysChatLanguageModel('test-model', undefined, {
      provider: 'nordlys.chat',
      baseURL: 'https://example.com',
      headers: () => ({}),
    });
    expect(typeof model.doGenerate).toBe('function');
    expect(typeof model.doStream).toBe('function');
  });

  it('should have correct specification version', () => {
    const model = new NordlysChatLanguageModel('test-model', undefined, {
      provider: 'nordlys.chat',
      baseURL: 'https://example.com',
      headers: () => ({}),
    });
    expect(model.specificationVersion).toBe('v3');
  });

  it('should support V3 content types in responses', async () => {
    const mockResponse = {
      id: 'test-id',
      model: 'test-model',
      created_at: Date.now() / 1000,
      status: 'completed' as const,
      output: [
        {
          type: 'message' as const,
          id: 'msg-1',
          role: 'assistant' as const,
          status: 'completed' as const,
          content: [
            {
              type: 'output_text' as const,
              text: 'Hello world',
            },
          ],
        },
        {
          type: 'reasoning' as const,
          id: 'reasoning-1',
          summary: [
            {
              text: 'This is reasoning',
              type: 'summary_text',
            },
          ],
          encrypted_content: null,
          status: 'completed' as const,
        },
        {
          type: 'function_call' as const,
          id: 'call-1',
          name: 'test_tool',
          arguments: '{"param": "value"}',
          status: 'completed' as const,
        },
      ],
      usage: {
        input_tokens: 10,
        output_tokens: 20,
        total_tokens: 30,
        output_tokens_details: {
          reasoning_tokens: 5,
        },
        input_tokens_details: {
          cached_tokens: 2,
        },
      },
      provider: 'test-provider',
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Headers(),
      json: () => Promise.resolve(mockResponse),
      text: () => Promise.resolve(JSON.stringify(mockResponse)),
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
      blob: () => Promise.resolve(new Blob()),
      formData: () => Promise.resolve(new FormData()),
      body: null,
      bodyUsed: false,
      url: 'https://example.com',
      redirected: false,
      type: 'basic' as ResponseType,
      clone: () => ({}) as Response,
    });

    const model = new NordlysChatLanguageModel('test-model', undefined, {
      provider: 'nordlys.chat',
      baseURL: 'https://example.com',
      headers: () => ({}),
      fetch: mockFetch,
    });

    const result = await model.doGenerate({
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
    });

    expect(result.content).toHaveLength(3);
    expect(result.content[0]).toEqual({
      type: 'text',
      text: 'Hello world',
      providerMetadata: {
        nordlys: {
          itemId: 'msg-1',
        },
      },
    });
    expect(result.content[1]).toEqual({
      type: 'reasoning',
      text: 'This is reasoning',
      providerMetadata: {
        nordlys: {
          itemId: 'reasoning-1',
          reasoningEncryptedContent: null,
        },
      },
    });
    expect(result.content[2]).toEqual({
      type: 'tool-call',
      toolCallId: 'call-1',
      toolName: 'test_tool',
      input: '{"param": "value"}',
      providerMetadata: {
        nordlys: {
          itemId: 'call-1',
        },
      },
    });

    expect(result.usage).toEqual({
      inputTokens: {
        total: 10,
        noCache: 8,
        cacheRead: 2,
        cacheWrite: undefined,
      },
      outputTokens: {
        total: 20,
        text: 15,
        reasoning: 5,
      },
      raw: {
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
    });

    // Verify endpoint is /responses
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const callArgs = mockFetch.mock.calls[0];
    expect(callArgs[0]).toContain('/responses');
  });

  it('should handle supportedUrls correctly', () => {
    const model = new NordlysChatLanguageModel('test-model', undefined, {
      provider: 'nordlys.chat',
      baseURL: 'https://example.com',
      headers: () => ({}),
    });

    expect(model.supportedUrls).toEqual({
      'application/pdf': [/^https:\/\/.*$/],
    });
  });

  describe('reasoning configuration', () => {
    const mockResponse = {
      id: 'test-id',
      model: 'test-model',
      created_at: Date.now() / 1000,
      status: 'completed' as const,
      output: [
        {
          type: 'message' as const,
          id: 'msg-1',
          role: 'assistant' as const,
          status: 'completed' as const,
          content: [
            {
              type: 'output_text' as const,
              text: 'Hello world',
            },
          ],
        },
      ],
      usage: {
        input_tokens: 10,
        output_tokens: 20,
        total_tokens: 30,
      },
      provider: 'test-provider',
    };

    const createMockFetch = () =>
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        json: () => Promise.resolve(mockResponse),
        text: () => Promise.resolve(JSON.stringify(mockResponse)),
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
        blob: () => Promise.resolve(new Blob()),
        formData: () => Promise.resolve(new FormData()),
        body: null,
        bodyUsed: false,
        url: 'https://example.com',
        redirected: false,
        type: 'basic' as ResponseType,
        clone: () => ({}) as Response,
      });

    it('should include reasoning.effort when set at model creation time', async () => {
      const mockFetch = createMockFetch();

      const model = new NordlysChatLanguageModel(
        'test-model',
        {
          providerOptions: {
            reasoning: {
              effort: 'low',
            },
          },
        },
        {
          provider: 'nordlys.chat',
          baseURL: 'https://example.com',
          headers: () => ({}),
          fetch: mockFetch,
        }
      );

      await model.doGenerate({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const callArgs = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(callArgs[1]?.body as string);

      expect(requestBody.reasoning).toEqual({ effort: 'low' });
      expect(requestBody.input).toBeDefined();
      expect(callArgs[0]).toContain('/responses');
    });

    it('should include reasoning.summary when set', async () => {
      const mockFetch = createMockFetch();

      const model = new NordlysChatLanguageModel(
        'test-model',
        {
          providerOptions: {
            reasoning: {
              summary: 'detailed',
            },
          },
        },
        {
          provider: 'nordlys.chat',
          baseURL: 'https://example.com',
          headers: () => ({}),
          fetch: mockFetch,
        }
      );

      await model.doGenerate({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const callArgs = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(callArgs[1]?.body as string);

      expect(requestBody.reasoning).toEqual({ summary: 'detailed' });
    });

    it('should include both reasoning.effort and reasoning.summary when set', async () => {
      const mockFetch = createMockFetch();

      const model = new NordlysChatLanguageModel(
        'test-model',
        {
          providerOptions: {
            reasoning: {
              effort: 'high',
              summary: 'auto',
            },
          },
        },
        {
          provider: 'nordlys.chat',
          baseURL: 'https://example.com',
          headers: () => ({}),
          fetch: mockFetch,
        }
      );

      await model.doGenerate({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const callArgs = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(callArgs[1]?.body as string);

      expect(requestBody.reasoning).toEqual({
        effort: 'high',
        summary: 'auto',
      });
    });

    it('should not include reasoning when not provided', async () => {
      const mockFetch = createMockFetch();

      const model = new NordlysChatLanguageModel('test-model', undefined, {
        provider: 'nordlys.chat',
        baseURL: 'https://example.com',
        headers: () => ({}),
        fetch: mockFetch,
      });

      await model.doGenerate({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const callArgs = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(callArgs[1]?.body as string);

      expect(requestBody.reasoning).toBeUndefined();
      expect(requestBody.input).toBeDefined();
    });

    it('should convert system messages to instructions', async () => {
      const mockFetch = createMockFetch();

      const model = new NordlysChatLanguageModel('test-model', undefined, {
        provider: 'nordlys.chat',
        baseURL: 'https://example.com',
        headers: () => ({}),
        fetch: mockFetch,
      });

      await model.doGenerate({
        prompt: [
          { role: 'system', content: 'You are helpful' },
          { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
        ],
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const callArgs = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(callArgs[1]?.body as string);

      expect(requestBody.instructions).toBe('You are helpful');
      expect(requestBody.input).toBeDefined();
      expect(Array.isArray(requestBody.input)).toBe(true);
    });
  });

  describe('streaming with reasoning + tool calls + text', () => {
    it('should properly handle reasoning ? tool calls ? text streaming sequence', async () => {
      // Create a mock ReadableStream that emits events in sequence:
      // 1. response.created
      // 2. reasoning item added
      // 3. reasoning deltas
      // 4. function_call item added (should conclude reasoning)
      // 5. function_call arguments delta
      // 6. function_call arguments done
      // 7. message item added (should emit text-start)
      // 8. text deltas
      // 9. message done
      // 10. response.completed

      const events = [
        {
          type: 'response.created',
          response: {
            id: 'resp-1',
            model: 'test-model',
            created_at: Date.now() / 1000,
            status: 'in_progress',
          },
        },
        {
          type: 'response.output_item.added',
          item: {
            type: 'reasoning',
            id: 'reasoning-1',
            encrypted_content: null,
          },
          output_index: 0,
        },
        {
          type: 'response.reasoning_text.delta',
          item_id: 'reasoning-1',
          delta: 'Thinking about the problem...',
          output_index: 0,
        },
        {
          type: 'response.reasoning_summary_part.done',
          item_id: 'reasoning-1',
          summary_index: 0,
          output_index: 0,
        },
        {
          type: 'response.output_item.added',
          item: {
            type: 'function_call',
            id: 'item-1',
            call_id: 'call-1',
            name: 'test_tool',
            arguments: '',
          },
          output_index: 1,
        },
        {
          type: 'response.function_call_arguments.delta',
          item_id: 'item-1',
          delta: '{"param": "value"}',
          output_index: 1,
        },
        {
          type: 'response.output_item.done',
          item: {
            type: 'function_call',
            id: 'item-1',
            call_id: 'call-1',
            name: 'test_tool',
            arguments: '{"param": "value"}',
          },
          output_index: 1,
        },
        {
          type: 'response.output_item.added',
          item: {
            type: 'message',
            id: 'msg-1',
            role: 'assistant',
            content: [],
          },
          output_index: 2,
        },
        {
          type: 'response.output_text.delta',
          item_id: 'msg-1',
          delta: 'Hello',
          output_index: 2,
          content_index: 0,
        },
        {
          type: 'response.output_text.delta',
          item_id: 'msg-1',
          delta: ' world',
          output_index: 2,
          content_index: 0,
        },
        {
          type: 'response.output_item.done',
          item: {
            type: 'message',
            id: 'msg-1',
            role: 'assistant',
            status: 'completed',
          },
          output_index: 2,
        },
        {
          type: 'response.output_item.done',
          item: {
            type: 'reasoning',
            id: 'reasoning-1',
            status: 'completed',
          },
          output_index: 0,
        },
        {
          type: 'response.completed',
          response: {
            id: 'resp-1',
            model: 'test-model',
            created_at: Date.now() / 1000,
            status: 'completed',
            usage: {
              input_tokens: 10,
              output_tokens: 20,
              total_tokens: 30,
            },
          },
        },
      ];

      // Create a ReadableStream that emits SSE-formatted events
      const stream = new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder();
          for (const event of events) {
            const line = `data: ${JSON.stringify(event)}\n\n`;
            controller.enqueue(encoder.encode(line));
          }
          controller.close();
        },
      });

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({
          'content-type': 'text/event-stream',
        }),
        body: stream,
        bodyUsed: false,
        url: 'https://example.com',
        redirected: false,
        type: 'basic' as ResponseType,
        clone: () => ({}) as Response,
      });

      const model = new NordlysChatLanguageModel('test-model', undefined, {
        provider: 'nordlys.chat',
        baseURL: 'https://example.com',
        headers: () => ({}),
        fetch: mockFetch,
      });

      const result = await model.doStream({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
      });

      // Collect all stream parts
      const streamParts: Array<{ type: string }> = [];
      const reader = result.stream.getReader();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          streamParts.push(value);
        }
      } finally {
        reader.releaseLock();
      }

      // Verify the sequence of events
      // Should have: stream-start, reasoning-start, reasoning-delta, reasoning-end (before tool),
      // tool-input-start, tool-input-delta, tool-input-end, tool-call, text-start, text-delta, text-end, finish

      const eventTypes = streamParts.map((p) => p.type);

      // Verify reasoning was concluded before tool calls
      const reasoningEndIndex = eventTypes.indexOf('reasoning-end');
      const toolInputStartIndex = eventTypes.indexOf('tool-input-start');
      expect(reasoningEndIndex).toBeGreaterThanOrEqual(0);
      expect(toolInputStartIndex).toBeGreaterThanOrEqual(0);
      expect(reasoningEndIndex).toBeLessThan(toolInputStartIndex);

      // Verify text-start was emitted after tool calls
      const toolCallIndex = eventTypes.indexOf('tool-call');
      const textStartIndex = eventTypes.indexOf('text-start');
      expect(toolCallIndex).toBeGreaterThanOrEqual(0);
      expect(textStartIndex).toBeGreaterThanOrEqual(0);
      expect(textStartIndex).toBeGreaterThan(toolCallIndex);

      // Verify text deltas continue after text-start
      const textDeltaIndices = eventTypes
        .map((type, idx) => (type === 'text-delta' ? idx : -1))
        .filter((idx) => idx >= 0);
      expect(textDeltaIndices.length).toBeGreaterThan(0);
      expect(textDeltaIndices[0]).toBeGreaterThan(textStartIndex);

      // Verify text-end was emitted
      expect(eventTypes).toContain('text-end');

      // Verify finish event was emitted
      expect(eventTypes).toContain('finish');
    });
  });
});
