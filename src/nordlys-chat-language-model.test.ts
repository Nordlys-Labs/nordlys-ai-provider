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
          text: 'This is reasoning',
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
    expect(result.content[0]).toEqual({ type: 'text', text: 'Hello world' });
    expect(result.content[1]).toEqual({
      type: 'reasoning',
      text: 'This is reasoning',
    });
    expect(result.content[2]).toEqual({
      type: 'tool-call',
      toolCallId: 'call-1',
      toolName: 'test_tool',
      input: '{"param": "value"}',
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
});
