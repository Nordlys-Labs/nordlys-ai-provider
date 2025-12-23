import { describe, expect, it } from 'vitest';
import { createNordlys, nordlys } from './nordlys-provider';

describe('nordlysProvider', () => {
  it('should create a provider instance', () => {
    const provider = createNordlys({
      apiKey: 'test-key',
      baseURL: 'https://example.com',
    });
    expect(typeof provider).toBe('function');
    expect(provider.languageModel).toBeInstanceOf(Function);
    expect(provider.chat).toBeInstanceOf(Function);
    expect(() => provider()).not.toThrow();
  });

  it('should create a chat model', () => {
    const provider = createNordlys({
      apiKey: 'test-key',
      baseURL: 'https://example.com',
    });
    const model = provider.chat();
    expect(model).toBeDefined();
    expect(model.modelId).toBe('');
    expect(model.provider).toBe('nordlys.chat');
  });

  it('should create a language model', () => {
    const provider = createNordlys({
      apiKey: 'test-key',
      baseURL: 'https://example.com',
    });
    const model = provider.languageModel();
    expect(model).toBeDefined();
    expect(model.modelId).toBe('');
    expect(model.provider).toBe('nordlys.chat');
  });

  it('should throw for embeddingModel', () => {
    const provider = createNordlys({
      apiKey: 'test-key',
      baseURL: 'https://example.com',
    });
    expect(() => provider.embeddingModel('embed-model')).toThrow();
  });

  it('should throw for imageModel', () => {
    const provider = createNordlys({
      apiKey: 'test-key',
      baseURL: 'https://example.com',
    });
    expect(() => provider.imageModel('image-model')).toThrow();
  });

  it('should provide a default instance', () => {
    expect(typeof nordlys).toBe('function');
    expect(nordlys.languageModel).toBeInstanceOf(Function);
    expect(nordlys.chat).toBeInstanceOf(Function);
  });
});
