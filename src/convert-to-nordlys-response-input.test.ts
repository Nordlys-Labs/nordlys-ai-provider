import { describe, expect, it } from 'vitest';
import { convertToNordlysResponseInput } from './convert-to-nordlys-response-input';

describe('convertToNordlysResponseInput', () => {
  it('should convert simple text prompt to string input', () => {
    const result = convertToNordlysResponseInput({
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
    });

    expect(result.input).toBe('Hello');
    expect(result.instructions).toBeUndefined();
    expect(result.warnings).toEqual([]);
  });

  it('should convert messages with system to instructions', () => {
    const result = convertToNordlysResponseInput({
      prompt: [
        { role: 'system', content: 'You are helpful' },
        { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
      ],
    });

    expect(result.instructions).toBe('You are helpful');
    expect(Array.isArray(result.input)).toBe(true);
    if (Array.isArray(result.input)) {
      expect(result.input[0]).toMatchObject({
        role: 'user',
      });
    }
  });

  it('should convert multiple system messages to array', () => {
    const result = convertToNordlysResponseInput({
      prompt: [
        { role: 'system', content: 'First instruction' },
        { role: 'system', content: 'Second instruction' },
        { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
      ],
    });

    expect(Array.isArray(result.instructions)).toBe(true);
    if (Array.isArray(result.instructions)) {
      expect(result.instructions.length).toBe(2);
    }
  });

  it('should convert multimodal input with images', () => {
    const result = convertToNordlysResponseInput({
      prompt: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Analyze' },
            {
              type: 'file',
              data: 'data:image/jpeg;base64,test',
              mediaType: 'image/jpeg',
            },
          ],
        },
      ],
    });

    expect(Array.isArray(result.input)).toBe(true);
    if (Array.isArray(result.input)) {
      const message = result.input[0];
      expect(message).toMatchObject({
        role: 'user',
      });
      if ('role' in message && message.role === 'user') {
        expect(message.content.length).toBe(2);
        expect(message.content[0]).toMatchObject({ type: 'input_text' });
        expect(message.content[1]).toMatchObject({ type: 'input_image' });
      }
    }
  });

  it('should convert tool messages to function call outputs', () => {
    const result = convertToNordlysResponseInput({
      prompt: [
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: 'call-1',
              toolName: 'test_tool',
              output: { type: 'text', value: 'Result' },
            },
          ],
        },
      ],
    });

    expect(Array.isArray(result.input)).toBe(true);
    if (Array.isArray(result.input)) {
      expect(result.input[0]).toMatchObject({
        type: 'function_call_output',
        call_id: 'call-1',
      });
    }
  });

  it('should handle assistant messages with warning', () => {
    const result = convertToNordlysResponseInput({
      prompt: [
        {
          role: 'assistant',
          content: [{ type: 'text', text: 'Previous response' }],
        },
        { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
      ],
    });

    expect(result.warnings.length).toBeGreaterThan(0);
    expect(Array.isArray(result.input)).toBe(true);
  });

  it('should handle empty input gracefully', () => {
    const result = convertToNordlysResponseInput({
      prompt: [{ role: 'system', content: 'System message' }],
    });

    expect(result.input).toBe('');
    expect(result.instructions).toBe('System message');
  });
});
