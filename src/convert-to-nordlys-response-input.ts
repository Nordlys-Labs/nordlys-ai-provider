// Converts AI SDK LanguageModelV3Prompt to Nordlys Responses API input format
import type {
  LanguageModelV3Prompt,
  LanguageModelV3ToolResultPart,
  SharedV3Warning,
} from '@ai-sdk/provider';
import { UnsupportedFunctionalityError } from '@ai-sdk/provider';
import { convertToBase64 } from '@ai-sdk/provider-utils';
import type {
  NordlysResponseInputContentUnion,
  NordlysResponseInputItemUnion,
} from './nordlys-responses-types';

// Convert tool output to string
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

/**
 * Converts AI SDK prompt to Nordlys Responses API input format
 * Returns input and instructions separately (system messages go to instructions)
 */
export function convertToNordlysResponseInput({
  prompt,
}: {
  prompt: LanguageModelV3Prompt;
}): {
  input: string | NordlysResponseInputItemUnion[];
  instructions?: string | NordlysResponseInputItemUnion[];
  warnings: Array<SharedV3Warning>;
} {
  const warnings: Array<SharedV3Warning> = [];
  const inputItems: NordlysResponseInputItemUnion[] = [];
  const systemMessages: string[] = [];

  // Check if we have a simple single text prompt (no system, no other roles)
  const hasOnlySingleUserText =
    prompt.length === 1 &&
    prompt[0].role === 'user' &&
    prompt[0].content.length === 1 &&
    prompt[0].content[0].type === 'text';

  // Process each prompt item
  for (const { role, content } of prompt) {
    switch (role) {
      case 'system': {
        // Extract system messages to instructions
        systemMessages.push(content);
        break;
      }
      case 'user': {
        // Convert user message to input item
        const contentParts: NordlysResponseInputContentUnion[] = [];

        // Handle single text content
        if (content.length === 1 && content[0].type === 'text') {
          contentParts.push({
            type: 'input_text',
            text: content[0].text,
          });
        } else {
          // Process multiple content parts
          for (const part of content) {
            switch (part.type) {
              case 'text': {
                contentParts.push({
                  type: 'input_text',
                  text: part.text,
                });
                break;
              }
              case 'file': {
                // Validate data exists
                if (part.data === undefined || part.data === null) {
                  throw new Error(
                    'File part data is required but was undefined or null'
                  );
                }

                // Handle images
                if (part.mediaType?.startsWith('image/')) {
                  const mediaType =
                    part.mediaType === 'image/*'
                      ? 'image/jpeg'
                      : part.mediaType;
                  const url =
                    part.data instanceof URL
                      ? part.data.toString()
                      : `data:${mediaType};base64,${convertToBase64(part.data)}`;

                  contentParts.push({
                    type: 'input_image',
                    image_url: url,
                  });
                  break;
                }

                // Handle audio files
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

                  // Audio is a separate input item, not content
                  inputItems.push({
                    type: 'input_audio',
                    input_audio: {
                      data,
                      format: (part.mediaType === 'audio/wav'
                        ? 'wav'
                        : 'mp3') as 'wav' | 'mp3',
                    },
                  });
                  break;
                }

                // Handle PDF files
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

                  contentParts.push({
                    type: 'input_file',
                    filename: part.filename ?? 'document.pdf',
                    file_data: `data:application/pdf;base64,${base64Data}`,
                  });
                  break;
                }

                throw new UnsupportedFunctionalityError({
                  functionality: `file part media type ${part.mediaType}`,
                });
              }
              default: {
                const _exhaustiveCheck: never = part;
                throw new Error(
                  `Unsupported content part type: ${_exhaustiveCheck}`
                );
              }
            }
          }
        }

        if (contentParts.length > 0) {
          inputItems.push({
            role: 'user',
            content: contentParts,
          });
        }
        break;
      }
      case 'assistant': {
        // Convert assistant message for multi-turn conversations
        // Note: Responses API doesn't support assistant role in input
        // We'll convert assistant text to user message with context
        const textParts: string[] = [];

        for (const part of content) {
          switch (part.type) {
            case 'text': {
              textParts.push(part.text);
              break;
            }
            case 'reasoning':
            case 'tool-call':
            case 'file': {
              // These are not supported in input for assistant messages
              warnings.push({
                type: 'other',
                message: `Assistant message contains ${part.type} which is not supported in Responses API input`,
              });
              break;
            }
          }
        }

        const text = textParts.join('');

        if (text) {
          // Convert assistant message to user message (multi-turn context)
          // This is a limitation - Responses API doesn't have assistant role in input
          warnings.push({
            type: 'other',
            message:
              'Assistant messages in multi-turn conversations are converted to user messages',
          });
          inputItems.push({
            role: 'user',
            content: [{ type: 'input_text', text }],
          });
        }
        break;
      }
      case 'tool': {
        // Convert tool messages to function call outputs
        for (const toolResponse of content) {
          if (toolResponse.type === 'tool-approval-response') {
            continue;
          }

          const contentValue = convertToolOutput(toolResponse.output);
          if (contentValue) {
            inputItems.push({
              type: 'function_call_output',
              call_id: toolResponse.toolCallId,
              output: contentValue,
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

  // Determine return format
  // If we have a simple single text prompt, return as string
  if (hasOnlySingleUserText) {
    const textInput = (prompt[0].content[0] as { text: string }).text;
    return {
      input: textInput,
      instructions: undefined,
      warnings,
    };
  }

  // Return as array (must have at least one item or be a string)
  if (inputItems.length === 0) {
    // No input items - this shouldn't happen but handle gracefully
    return {
      input: '',
      instructions:
        systemMessages.length > 0
          ? systemMessages.length === 1
            ? systemMessages[0]
            : systemMessages.map((msg) => ({
                role: 'system' as const,
                content: msg,
              }))
          : undefined,
      warnings,
    };
  }

  return {
    input: inputItems,
    instructions:
      systemMessages.length > 0
        ? systemMessages.length === 1
          ? systemMessages[0]
          : systemMessages.map((msg) => ({
              role: 'system' as const,
              content: msg,
            }))
        : undefined,
    warnings,
  };
}
