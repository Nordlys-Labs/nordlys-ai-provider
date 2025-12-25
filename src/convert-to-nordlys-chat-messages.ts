// Converts generic chat messages to Nordlys API format
// Uses OpenAI compatible logic patterns but adds Nordlys-specific features (audio, PDF, developer role, reasoning, generated_files)
import type {
  LanguageModelV3Prompt,
  LanguageModelV3ToolResultPart,
  SharedV3Warning,
} from '@ai-sdk/provider';
import { UnsupportedFunctionalityError } from '@ai-sdk/provider';
import { convertToBase64 } from '@ai-sdk/provider-utils';
import type { NordlysChatCompletionMessage } from './nordlys-types';

// Convert tool output using OpenAI compatible logic
function convertToolOutput(
  output: LanguageModelV3ToolResultPart['output']
): string {
  switch (output.type) {
    case 'text':
    case 'error-text':
      return output.value;
    case 'json':
    case 'error-json':
    case 'content':
      return JSON.stringify(output.value);
    case 'execution-denied':
      return output.reason ?? 'Tool execution denied.';
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
  warnings: Array<SharedV3Warning>;
} {
  const messages: NordlysChatCompletionMessage[] = [];
  const warnings: Array<SharedV3Warning> = [];

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
        // Use OpenAI compatible logic: if single text part, use string content
        if (content.length === 1 && content[0].type === 'text') {
          messages.push({ role: 'user', content: content[0].text });
          break;
        }

        // Process content parts - use OpenAI compatible logic for images/text, add Nordlys-specific for audio/PDF
        messages.push({
          role: 'user',
          content: content.map((part, index) => {
            switch (part.type) {
              case 'text': {
                // OpenAI compatible logic
                return { type: 'text', text: part.text };
              }
              case 'file': {
                // Validate data exists
                if (part.data === undefined || part.data === null) {
                  throw new Error(
                    'File part data is required but was undefined or null'
                  );
                }

                // Handle images using OpenAI compatible logic (exact match)
                if (part.mediaType?.startsWith('image/')) {
                  const mediaType =
                    part.mediaType === 'image/*'
                      ? 'image/jpeg'
                      : part.mediaType;
                  // OpenAI compatible always calls convertToBase64 (handles strings, buffers, etc.)
                  // Note: OpenAI compatible doesn't validate data existence, but we do for safety
                  const url =
                    part.data instanceof URL
                      ? part.data.toString()
                      : `data:${mediaType};base64,${convertToBase64(part.data)}`;

                  return {
                    type: 'image_url',
                    image_url: { url },
                  };
                }

                // Handle audio files (Nordlys-specific)
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

                  const data =
                    typeof part.data === 'string'
                      ? part.data
                      : convertToBase64(part.data);

                  return {
                    type: 'input_audio',
                    input_audio: {
                      data,
                      format: (part.mediaType === 'audio/wav'
                        ? 'wav'
                        : 'mp3') as 'wav' | 'mp3',
                    },
                  };
                }

                // Handle PDF files (Nordlys-specific)
                if (part.mediaType && part.mediaType === 'application/pdf') {
                  if (part.data instanceof URL) {
                    throw new UnsupportedFunctionalityError({
                      functionality: 'PDF file parts with URLs',
                    });
                  }

                  const base64Data =
                    typeof part.data === 'string'
                      ? part.data
                      : convertToBase64(part.data);

                  return {
                    type: 'file',
                    file: {
                      filename: part.filename ?? `part-${index}.pdf`,
                      file_data: `data:application/pdf;base64,${base64Data}`,
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
        // Use OpenAI compatible logic for text and tool calls, add Nordlys-specific fields
        let text = '';
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
              // OpenAI compatible logic: concatenate text
              text += part.text;
              break;
            }
            case 'reasoning': {
              // Nordlys-specific: collect reasoning parts
              reasoningParts.push(part.text);
              break;
            }
            case 'file': {
              // Nordlys-specific: handle generated files
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
                media_type: part.mediaType ?? 'application/octet-stream',
                data: dataString,
              });
              break;
            }
            case 'tool-call': {
              // OpenAI compatible logic for tool calls
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

        const reasoning = reasoningParts.join('');

        // Build message using OpenAI compatible structure + Nordlys-specific fields
        // OpenAI compatible uses: tool_calls: toolCalls.length > 0 ? toolCalls : void 0
        // We use spread operator which omits the field when empty (equivalent behavior)
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
        // Use OpenAI compatible logic for tool messages
        // Note: We filter out empty tool results (Nordlys-specific behavior)
        for (const toolResponse of content) {
          if (toolResponse.type === 'tool-approval-response') {
            continue;
          }

          const contentValue = convertToolOutput(toolResponse.output);
          // Filter out empty tool results (original Nordlys behavior)
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
