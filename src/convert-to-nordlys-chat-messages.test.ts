import { describe, expect, it } from 'vitest';
import { convertToNordlysChatMessages } from './convert-to-nordlys-chat-messages';

const base64Image = 'AAECAw==';
const base64Audio = 'AAECAw==';
const base64Pdf = 'AQIDBAU=';

// Helper for URL
const exampleUrl = new URL('https://example.com/document.pdf');

describe('convertToNordlysChatMessages', () => {
  describe('system messages', () => {
    it('should forward system messages', () => {
      const { messages, warnings } = convertToNordlysChatMessages({
        prompt: [{ role: 'system', content: 'You are a helpful assistant.' }],
      });

      expect(messages).toEqual([
        { role: 'system', content: 'You are a helpful assistant.' },
      ]);
      expect(warnings).toEqual([]);
    });

    it('should remove system messages when requested', () => {
      const { messages, warnings } = convertToNordlysChatMessages({
        prompt: [{ role: 'system', content: 'You are a helpful assistant.' }],
        systemMessageMode: 'remove',
      });

      expect(messages).toEqual([]);
      expect(warnings).toEqual([
        {
          type: 'other',
          message: 'system messages are removed for this model',
        },
      ]);
    });
  });

  describe('user messages', () => {
    it('should convert messages with only a text part to a string content', () => {
      const { messages } = convertToNordlysChatMessages({
        prompt: [
          {
            role: 'user',
            content: [{ type: 'text', text: 'Hello' }],
          },
        ],
      });

      expect(messages).toEqual([{ role: 'user', content: 'Hello' }]);
    });

    it('should convert messages with image parts', () => {
      const { messages } = convertToNordlysChatMessages({
        prompt: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Hello' },
              {
                type: 'file',
                mediaType: 'image/png',
                data: base64Image,
              },
            ],
          },
        ],
      });

      expect(messages).toEqual([
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Hello' },
            {
              type: 'image_url',
              image_url: { url: 'data:image/png;base64,AAECAw==' },
            },
          ],
        },
      ]);
    });

    it('should convert messages with image file part as URL', () => {
      const { messages } = convertToNordlysChatMessages({
        prompt: [
          {
            role: 'user',
            content: [
              {
                type: 'file',
                mediaType: 'image/png',
                data: exampleUrl,
              },
            ],
          },
        ],
      });

      expect(messages).toEqual([
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: exampleUrl.toString() },
            },
          ],
        },
      ]);
    });

    it('should handle image/* media type by converting to image/jpeg', () => {
      const { messages } = convertToNordlysChatMessages({
        prompt: [
          {
            role: 'user',
            content: [
              {
                type: 'file',
                mediaType: 'image/*',
                data: base64Image,
              },
            ],
          },
        ],
      });

      expect(messages).toEqual([
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: 'data:image/jpeg;base64,AAECAw==' },
            },
          ],
        },
      ]);
    });

    it('should add audio content for audio/wav file parts', () => {
      const { messages } = convertToNordlysChatMessages({
        prompt: [
          {
            role: 'user',
            content: [
              {
                type: 'file',
                mediaType: 'audio/wav',
                data: base64Audio,
              },
            ],
          },
        ],
      });

      expect(messages).toEqual([
        {
          role: 'user',
          content: [
            {
              type: 'input_audio',
              input_audio: { data: base64Audio, format: 'wav' },
            },
          ],
        },
      ]);
    });

    it('should add audio content for audio/mp3 file parts', () => {
      const { messages } = convertToNordlysChatMessages({
        prompt: [
          {
            role: 'user',
            content: [
              {
                type: 'file',
                mediaType: 'audio/mp3',
                data: base64Audio,
              },
            ],
          },
        ],
      });

      expect(messages).toEqual([
        {
          role: 'user',
          content: [
            {
              type: 'input_audio',
              input_audio: { data: base64Audio, format: 'mp3' },
            },
          ],
        },
      ]);
    });

    it('should add audio content for audio/mpeg file parts', () => {
      const { messages } = convertToNordlysChatMessages({
        prompt: [
          {
            role: 'user',
            content: [
              {
                type: 'file',
                mediaType: 'audio/mpeg',
                data: base64Audio,
              },
            ],
          },
        ],
      });

      expect(messages).toEqual([
        {
          role: 'user',
          content: [
            {
              type: 'input_audio',
              input_audio: { data: base64Audio, format: 'mp3' },
            },
          ],
        },
      ]);
    });

    it('should convert messages with PDF file parts', () => {
      const { messages } = convertToNordlysChatMessages({
        prompt: [
          {
            role: 'user',
            content: [
              {
                type: 'file',
                mediaType: 'application/pdf',
                data: base64Pdf,
                filename: 'document.pdf',
              },
            ],
          },
        ],
      });

      expect(messages).toEqual([
        {
          role: 'user',
          content: [
            {
              type: 'file',
              file: {
                filename: 'document.pdf',
                file_data: 'data:application/pdf;base64,AQIDBAU=',
              },
            },
          ],
        },
      ]);
    });

    it('should use default filename for PDF file parts when not provided', () => {
      const { messages } = convertToNordlysChatMessages({
        prompt: [
          {
            role: 'user',
            content: [
              {
                type: 'file',
                mediaType: 'application/pdf',
                data: base64Pdf,
              },
            ],
          },
        ],
      });

      expect(messages).toEqual([
        {
          role: 'user',
          content: [
            {
              type: 'file',
              file: {
                filename: 'part-0.pdf',
                file_data: 'data:application/pdf;base64,AQIDBAU=',
              },
            },
          ],
        },
      ]);
    });

    it('should throw error for unsupported file types', () => {
      expect(() =>
        convertToNordlysChatMessages({
          prompt: [
            {
              role: 'user',
              content: [
                {
                  type: 'file',
                  mediaType: 'text/plain',
                  data: base64Pdf,
                },
              ],
            },
          ],
        })
      ).toThrow(
        "'file part media type text/plain' functionality not supported."
      );
    });

    it('should throw error for PDF file parts with URLs', () => {
      expect(() =>
        convertToNordlysChatMessages({
          prompt: [
            {
              role: 'user',
              content: [
                {
                  type: 'file',
                  mediaType: 'application/pdf',
                  data: exampleUrl,
                },
              ],
            },
          ],
        })
      ).toThrow("'PDF file parts with URLs' functionality not supported.");
    });

    it('should throw error for audio file parts with URLs', () => {
      expect(() =>
        convertToNordlysChatMessages({
          prompt: [
            {
              role: 'user',
              content: [
                {
                  type: 'file',
                  mediaType: 'audio/wav',
                  data: exampleUrl,
                },
              ],
            },
          ],
        })
      ).toThrow("'audio file parts with URLs' functionality not supported.");
    });
  });

  describe('assistant and tool messages', () => {
    it('should stringify arguments to tool calls', () => {
      const { messages } = convertToNordlysChatMessages({
        prompt: [
          {
            role: 'assistant',
            content: [
              {
                type: 'tool-call',
                input: { foo: 'bar123' },
                toolCallId: 'quux',
                toolName: 'thwomp',
              },
            ],
          },
          {
            role: 'tool',
            content: [
              {
                type: 'tool-result',
                toolCallId: 'quux',
                toolName: 'thwomp',
                output: { type: 'text', value: 'legacy result' },
              },
            ],
          },
        ],
      });

      expect(messages).toEqual([
        {
          role: 'assistant',
          content: '',
          tool_calls: [
            {
              type: 'function',
              id: 'quux',
              function: {
                name: 'thwomp',
                arguments: JSON.stringify({ foo: 'bar123' }),
              },
            },
          ],
        },
        {
          role: 'tool',
          content: 'legacy result',
          tool_call_id: 'quux',
        },
      ]);
    });

    it('should handle assistant text and tool calls together', () => {
      const { messages } = convertToNordlysChatMessages({
        prompt: [
          {
            role: 'assistant',
            content: [
              { type: 'text', text: 'Here is a tool call:' },
              {
                type: 'tool-call',
                input: { foo: 'bar' },
                toolCallId: 'call-1',
                toolName: 'tool-1',
              },
            ],
          },
        ],
      });

      expect(messages).toEqual([
        {
          role: 'assistant',
          content: 'Here is a tool call:',
          tool_calls: [
            {
              type: 'function',
              id: 'call-1',
              function: {
                name: 'tool-1',
                arguments: JSON.stringify({ foo: 'bar' }),
              },
            },
          ],
        },
      ]);
    });

    it('should handle completely empty tool results', () => {
      const { messages } = convertToNordlysChatMessages({
        prompt: [
          {
            role: 'tool',
            content: [
              {
                type: 'tool-result',
                toolCallId: 'truly-empty-tool',
                toolName: 'truly-empty-tool',
                output: { type: 'text', value: '' },
              },
            ],
          },
        ],
      });

      expect(messages).toEqual([]);
    });
  });

  describe('V3 content types', () => {
    it('should handle reasoning content in assistant messages', () => {
      const { messages } = convertToNordlysChatMessages({
        prompt: [
          {
            role: 'assistant',
            content: [
              { type: 'text', text: 'Let me think about this.' },
              {
                type: 'reasoning',
                text: 'First, I need to consider the implications...',
              },
              {
                type: 'text',
                text: 'Based on my reasoning, the answer is 42.',
              },
            ],
          },
        ],
      });

      expect(messages).toEqual([
        {
          role: 'assistant',
          content:
            'Let me think about this.Based on my reasoning, the answer is 42.',
          reasoning_content: 'First, I need to consider the implications...',
          tool_calls: undefined,
          generated_files: undefined,
        },
      ]);
    });

    it('should handle file content in assistant messages', () => {
      const { messages } = convertToNordlysChatMessages({
        prompt: [
          {
            role: 'assistant',
            content: [
              { type: 'text', text: 'I generated this image:' },
              {
                type: 'file',
                mediaType: 'image/png',
                data: 'iVBORw0KGgoAAAANS',
              },
              {
                type: 'file',
                mediaType: 'audio/wav',
                data: new Uint8Array([1, 2, 3, 4]),
              },
            ],
          },
        ],
      });

      expect(messages).toEqual([
        {
          role: 'assistant',
          content: 'I generated this image:',
          generated_files: [
            {
              media_type: 'image/png',
              data: 'iVBORw0KGgoAAAANS',
            },
            {
              media_type: 'audio/wav',
              data: 'AQIDBA==', // base64 of [1,2,3,4]
            },
          ],
          reasoning_content: undefined,
          tool_calls: undefined,
        },
      ]);
    });

    it('should handle all V3 content types together', () => {
      const { messages } = convertToNordlysChatMessages({
        prompt: [
          {
            role: 'assistant',
            content: [
              { type: 'text', text: 'Here is my complete response:' },
              { type: 'reasoning', text: 'I analyzed the data carefully...' },
              {
                type: 'file',
                mediaType: 'image/jpeg',
                data: '/9j/4AAQSkZJRgABA',
              },
              {
                type: 'tool-call',
                toolCallId: 'call-123',
                toolName: 'calculator',
                input: { operation: 'add', a: 1, b: 2 },
              },
            ],
          },
        ],
      });

      expect(messages).toEqual([
        {
          role: 'assistant',
          content: 'Here is my complete response:',
          reasoning_content: 'I analyzed the data carefully...',
          generated_files: [
            {
              media_type: 'image/jpeg',
              data: '/9j/4AAQSkZJRgABA',
            },
          ],
          tool_calls: [
            {
              type: 'function',
              id: 'call-123',
              function: {
                name: 'calculator',
                arguments: '{"operation":"add","a":1,"b":2}',
              },
            },
          ],
        },
      ]);
    });
  });
});
