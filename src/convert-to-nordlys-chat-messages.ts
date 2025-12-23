// Converts generic chat messages to Nordlys API format
import type {
  LanguageModelV3CallWarning,
  LanguageModelV3Prompt,
  LanguageModelV3ToolResultPart,
} from '@ai-sdk/provider';
import { UnsupportedFunctionalityError } from '@ai-sdk/provider';
import { convertToBase64 } from '@ai-sdk/provider-utils';
import type { NordlysChatCompletionMessage } from './nordlys-types';

function convertToolOutput(output: LanguageModelV3ToolResultPart): string {
  switch (output.type) {
    case 'text':
    case 'error-text':
      return output.value;
    case 'content':
    case 'json':
    case 'error-json':
      return JSON.stringify(output.value);
    default:
      return '';
  }
}

export function convertToNordlysChatMessages({
  prompt,
  systemMessageMode = 'system',
}: {
  prompt: LanguageModelV3Prompt;
  systemMessageMode?: 'system' | 'developer' | 'remove';
}): {
  messages: NordlysChatCompletionMessage[];
  warnings: Array<LanguageModelV3CallWarning>;
} {
  const messages: NordlysChatCompletionMessage[] = [];
  const warnings: Array<LanguageModelV3CallWarning> = [];

  for (const { role, content } of prompt) {
    switch (role) {
      case 'system': {
        switch (systemMessageMode) {
          case 'system': {
            messages.push({ role: 'system', content });
            break;
          }
          case 'developer': {
            messages.push({ role: 'developer', content });
            break;
          }
          case 'remove': {
            warnings.push({
              type: 'other',
              message: 'system messages are removed for this model',
            });
            break;
          }
          default: {
            const _exhaustiveCheck: never = systemMessageMode;
            throw new Error(
              `Unsupported system message mode: ${_exhaustiveCheck}`
            );
          }
        }
        break;
      }
      case 'user': {
        if (content.length === 1 && content[0].type === 'text') {
          messages.push({ role: 'user', content: content[0].text });
          break;
        }
        messages.push({
          role: 'user',
          content: content.map((part, index) => {
            switch (part.type) {
              case 'text': {
                return { type: 'text', text: part.text };
              }
              case 'file': {
                if (part.mediaType?.startsWith('image/')) {
                  const mediaType =
                    part.mediaType === 'image/*'
                      ? 'image/jpeg'
                      : part.mediaType;
                  return {
                    type: 'image_url',
                    image_url: {
                      url:
                        part.data instanceof URL
                          ? part.data.toString()
                          : `data:${mediaType};base64,${convertToBase64(part.data)}`,
                    },
                  };
                }
                if (
                  part.mediaType &&
                  (part.mediaType === 'audio/wav' ||
                    part.mediaType === 'audio/mp3' ||
                    part.mediaType === 'audio/mpeg')
                ) {
                  if (part.data instanceof URL) {
                    throw new UnsupportedFunctionalityError({
                      functionality: 'audio file parts with URLs',
                    });
                  }
                  return {
                    type: 'input_audio',
                    input_audio: {
                      data: convertToBase64(part.data),
                      format: part.mediaType === 'audio/wav' ? 'wav' : 'mp3',
                    },
                  };
                }
                if (part.mediaType && part.mediaType === 'application/pdf') {
                  if (part.data instanceof URL) {
                    throw new UnsupportedFunctionalityError({
                      functionality: 'PDF file parts with URLs',
                    });
                  }
                  return {
                    type: 'file',
                    file: {
                      filename: part.filename ?? `part-${index}.pdf`,
                      file_data: `data:application/pdf;base64,${convertToBase64(part.data)}`,
                    },
                  };
                }
                throw new UnsupportedFunctionalityError({
                  functionality: `file part media type ${part.mediaType}`,
                });
              }
              default: {
                throw new Error(`Unsupported content part type`);
              }
            }
          }),
        });
        break;
      }
      case 'assistant': {
        const textParts: string[] = [];
        const reasoningParts: string[] = [];
        const generatedFiles: Array<{ media_type: string; data: string }> = [];
        const toolCalls: Array<{
          id: string;
          type: 'function';
          function: { name: string; arguments: string };
        }> = [];

        for (const part of content) {
          switch (part.type) {
            case 'text': {
              textParts.push(part.text);
              break;
            }
            case 'reasoning': {
              reasoningParts.push(part.text);
              break;
            }
            case 'file': {
              const dataString =
                typeof part.data === 'string'
                  ? part.data
                  : part.data instanceof URL
                    ? (() => {
                        throw new Error(
                          'URL data not supported for generated files'
                        );
                      })()
                    : Buffer.from(part.data).toString('base64');

              generatedFiles.push({
                media_type: part.mediaType,
                data: dataString,
              });
              break;
            }
            case 'tool-call': {
              toolCalls.push({
                id: part.toolCallId,
                type: 'function',
                function: {
                  name: part.toolName,
                  arguments: JSON.stringify(part.input),
                },
              });
              break;
            }
          }
        }

        const text = textParts.join('');
        const reasoning = reasoningParts.join('');

        const message: NordlysChatCompletionMessage = {
          role: 'assistant',
          content: text,
          ...(toolCalls.length > 0 && { tool_calls: toolCalls }),
          ...(reasoning && { reasoning_content: reasoning }),
          ...(generatedFiles.length > 0 && { generated_files: generatedFiles }),
        };

        messages.push(message);
        break;
      }
      case 'tool': {
        for (const toolResponse of content) {
          const contentValue = convertToolOutput(toolResponse.output);
          if (contentValue) {
            messages.push({
              role: 'tool',
              tool_call_id: toolResponse.toolCallId,
              content: contentValue,
            });
          }
        }
        break;
      }
      default: {
        const _exhaustiveCheck: never = role;
        throw new Error(`Unsupported role: ${_exhaustiveCheck}`);
      }
    }
  }

  return { messages, warnings };
}
