import { describe, expect, it, vi } from 'vitest';
import { NordlysChatLanguageModel } from './nordlys-chat-language-model';

describe('nordlysChatLanguageModel', () => {
  it('should construct with modelId and config', () => {
    const model = new NordlysChatLanguageModel('test-model', {
      provider: 'nordlys.chat',
      baseURL: 'https://example.com',
      headers: () => ({}),
    });
    expect(model.modelId).toBe('test-model');
    expect(model.provider).toBe('nordlys.chat');
  });

  it('should have doGenerate and doStream methods', () => {
    const model = new NordlysChatLanguageModel('test-model', {
      provider: 'nordlys.chat',
      baseURL: 'https://example.com',
      headers: () => ({}),
    });
    expect(typeof model.doGenerate).toBe('function');
    expect(typeof model.doStream).toBe('function');
  });

  it('should have correct specification version', () => {
    const model = new NordlysChatLanguageModel('test-model', {
      provider: 'nordlys.chat',
      baseURL: 'https://example.com',
      headers: () => ({}),
    });
    expect(model.specificationVersion).toBe('v3');
  });

  it('should support V3 content types in responses', async () => {
    const mockResponse = {
      id: 'test-id',
      choices: [
        {
          index: 0,
          message: {
            content: 'Hello world',
            reasoning_content: 'This is reasoning',
            generated_files: [
              {
                media_type: 'image/png',
                data: 'base64data',
              },
            ],
            tool_calls: [
              {
                id: 'call-1',
                type: 'function',
                function: {
                  name: 'test_tool',
                  arguments: '{"param": "value"}',
                },
              },
            ],
          },
          finish_reason: 'stop',
        },
      ],
      created: Date.now() / 1000,
      model: 'test-model',
      object: 'chat.completion',
      usage: {
        prompt_tokens: 10,
        completion_tokens: 20,
        total_tokens: 30,
        reasoning_tokens: 5,
        cached_input_tokens: 2,
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

    const model = new NordlysChatLanguageModel('test-model', {
      provider: 'nordlys.chat',
      baseURL: 'https://example.com',
      headers: () => ({}),
      fetch: mockFetch,
    });

    const result = await model.doGenerate({
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
    });

    expect(result.content).toHaveLength(4);
    expect(result.content[0]).toEqual({ type: 'text', text: 'Hello world' });
    expect(result.content[1]).toEqual({
      type: 'reasoning',
      text: 'This is reasoning',
    });
    expect(result.content[2]).toEqual({
      type: 'file',
      mediaType: 'image/png',
      data: 'base64data',
    });
    expect(result.content[3]).toEqual({
      type: 'tool-call',
      toolCallId: 'call-1',
      toolName: 'test_tool',
      input: '{"param": "value"}',
    });

    expect(result.usage).toEqual({
      inputTokens: 10,
      outputTokens: 20,
      totalTokens: 30,
      reasoningTokens: 5,
      cachedInputTokens: 2,
    });
  });

  it('should handle supportedUrls correctly', () => {
    const model = new NordlysChatLanguageModel('test-model', {
      provider: 'nordlys.chat',
      baseURL: 'https://example.com',
      headers: () => ({}),
    });

    expect(model.supportedUrls).toEqual({
      'application/pdf': [/^https:\/\/.*$/],
    });
  });
});
