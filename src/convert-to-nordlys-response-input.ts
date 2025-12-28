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

// Constants
const OPENAI_FILE_ID_PREFIX = 'file-' as const;
const DEFAULT_IMAGE_MEDIA_TYPE = 'image/jpeg' as const;
const DEFAULT_PDF_FILENAME = 'document.pdf' as const;

const AUDIO_MEDIA_TYPES = ['audio/wav', 'audio/mp3', 'audio/mpeg'] as const;
const PDF_MEDIA_TYPE = 'application/pdf' as const;

type AudioMediaType = (typeof AUDIO_MEDIA_TYPES)[number];

// Pre-compute Set for O(1) lookup performance
const AUDIO_MEDIA_TYPES_SET = new Set<string>(AUDIO_MEDIA_TYPES);

/**
 * Checks if a media type is a supported audio format.
 * Uses a pre-computed Set for O(1) lookup performance instead of array includes.
 *
 * @param mediaType - The media type string to check, or undefined
 * @returns True if the media type is a supported audio format, false otherwise
 */
function isAudioMediaType(
  mediaType: string | undefined
): mediaType is AudioMediaType {
  if (mediaType === undefined) {
    return false;
  }
  return AUDIO_MEDIA_TYPES_SET.has(mediaType);
}

/**
 * Converts tool output to string representation.
 *
 * @param output - The tool result output to convert
 * @returns String representation of the tool output
 */
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
 * Checks if a string is an OpenAI file ID.
 * OpenAI file IDs typically start with "file-"
 *
 * @param data - The string to check
 * @returns True if the string appears to be an OpenAI file ID, false otherwise
 */
function isFileId(data: string): boolean {
  return data.startsWith(OPENAI_FILE_ID_PREFIX);
}

/**
 * Builds instructions from system messages.
 * Returns a string if there's a single message, an array of system message objects
 * if there are multiple, or undefined if there are no system messages.
 *
 * @param systemMessages - Array of system message strings
 * @returns Instructions as string, array of system message objects, or undefined
 */
function buildInstructions(
  systemMessages: string[]
): string | NordlysResponseInputItemUnion[] | undefined {
  if (systemMessages.length === 0) {
    return undefined;
  }
  if (systemMessages.length === 1) {
    return systemMessages[0];
  }
  return systemMessages.map((msg) => ({
    role: 'system' as const,
    content: msg,
  }));
}

/**
 * Converts AI SDK LanguageModelV3Prompt to Nordlys Responses API input format.
 *
 * This function transforms the AI SDK's standardized prompt format into the
 * format expected by the Nordlys Responses API. Key transformations include:
 * - System messages are extracted to the `instructions` field
 * - User messages are converted to input items with proper content types
 * - Images support both `image_url` and `file_id` (mutually exclusive)
 * - Audio files are converted to separate input items
 * - PDF files are converted to file input content
 * - Assistant messages are converted to user messages with warnings
 * - Tool results are converted to function call outputs
 *
 * @param options - Configuration options
 * @param options.prompt - The AI SDK LanguageModelV3Prompt to convert
 * @returns An object containing:
 *   - `input`: The converted input (string for simple text prompts, array for complex prompts)
 *   - `instructions`: Optional instructions from system messages (string or array)
 *   - `warnings`: Array of warnings about unsupported features or conversions
 *
 * @example
 * ```typescript
 * const result = convertToNordlysResponseInput({
 *   prompt: [
 *     { role: 'system', content: 'You are a helpful assistant.' },
 *     { role: 'user', content: [{ type: 'text', text: 'Hello' }] }
 *   ]
 * });
 * // Returns: { input: 'Hello', instructions: 'You are a helpful assistant.', warnings: [] }
 * ```
 */
export function convertToNordlysResponseInput({
  prompt,
}: {
  prompt: LanguageModelV3Prompt;
}): {
  input: string | NordlysResponseInputItemUnion[];
  instructions?: string | NordlysResponseInputItemUnion[];
  warnings: SharedV3Warning[];
} {
  const warnings: SharedV3Warning[] = [];
  const inputItems: NordlysResponseInputItemUnion[] = [];
  const systemMessages: string[] = [];

  // Check if we have a simple single text prompt (no system, no other roles)
  const hasOnlySingleUserText =
    prompt.length === 1 &&
    prompt[0].role === 'user' &&
    Array.isArray(prompt[0].content) &&
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
                if (part.data == null) {
                  throw new Error(
                    'File part data is required but was undefined or null'
                  );
                }

                const { mediaType, data } = part;

                // Handle images
                if (mediaType?.startsWith('image/')) {
                  const normalizedMediaType =
                    mediaType === 'image/*'
                      ? DEFAULT_IMAGE_MEDIA_TYPE
                      : mediaType;

                  // Use conditional spread to ensure only one of image_url or file_id is present
                  const imageContent: NordlysResponseInputContentUnion =
                    data instanceof URL
                      ? {
                          type: 'input_image',
                          image_url: data.toString(),
                        }
                      : typeof data === 'string' && isFileId(data)
                        ? {
                            type: 'input_image',
                            file_id: data,
                          }
                        : {
                            type: 'input_image',
                            image_url: `data:${normalizedMediaType};base64,${convertToBase64(data)}`,
                          };

                  contentParts.push(imageContent);
                  break;
                }

                // Handle audio files
                if (isAudioMediaType(mediaType)) {
                  if (data instanceof URL) {
                    throw new UnsupportedFunctionalityError({
                      functionality: 'audio file parts with URLs',
                    });
                  }

                  const audioData =
                    typeof data === 'string' ? data : convertToBase64(data);
                  // Map audio media types to format: wav -> wav, mp3/mpeg -> mp3
                  const audioFormat: 'wav' | 'mp3' =
                    mediaType === 'audio/wav' ? 'wav' : 'mp3';

                  // Audio is a separate input item, not content
                  inputItems.push({
                    type: 'input_audio',
                    input_audio: {
                      data: audioData,
                      format: audioFormat,
                    },
                  });
                  break;
                }

                // Handle PDF files
                if (mediaType === PDF_MEDIA_TYPE) {
                  if (data instanceof URL) {
                    throw new UnsupportedFunctionalityError({
                      functionality: 'PDF file parts with URLs',
                    });
                  }

                  const base64Data =
                    typeof data === 'string' ? data : convertToBase64(data);

                  contentParts.push({
                    type: 'input_file',
                    filename: part.filename ?? DEFAULT_PDF_FILENAME,
                    file_data: `data:${PDF_MEDIA_TYPE};base64,${base64Data}`,
                  });
                  break;
                }

                throw new UnsupportedFunctionalityError({
                  functionality: `file part media type ${mediaType ?? 'unknown'}`,
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
        // Tool-calls are extracted and added as function_call items
        const textParts: string[] = [];

        for (const part of content) {
          switch (part.type) {
            case 'text': {
              textParts.push(part.text);
              break;
            }
            case 'tool-call': {
              // Extract tool-calls and add as function_call items
              // This ensures function_call_output items have corresponding function_call items
              inputItems.push({
                type: 'function_call',
                call_id: part.toolCallId,
                name: part.toolName,
                arguments:
                  typeof part.input === 'string'
                    ? part.input
                    : JSON.stringify(part.input),
              });
              break;
            }
            case 'reasoning':
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
    const firstPromptItem = prompt[0];
    // TypeScript knows content is an array due to hasOnlySingleUserText check
    // but we need to assert it for type narrowing
    if (!Array.isArray(firstPromptItem.content)) {
      throw new Error('Expected array content but got string');
    }
    const firstContent = firstPromptItem.content[0];
    // Type guard ensures type safety
    if (firstContent.type !== 'text') {
      // This should never happen due to hasOnlySingleUserText check, but TypeScript needs it
      throw new Error('Expected text content but got different type');
    }
    return {
      input: firstContent.text,
      instructions: undefined,
      warnings,
    };
  }

  // Build instructions from system messages
  const instructions = buildInstructions(systemMessages);

  // Return as array (must have at least one item or be a string)
  if (inputItems.length === 0) {
    // Invalid state: no input items found
    // This should never happen in normal flow - fail fast with clear error
    throw new Error(
      'Cannot generate request: no valid input items found. ' +
        'At least one input item (user message, system message, etc.) is required.'
    );
  }

  return {
    input: inputItems,
    instructions,
    warnings,
  };
}
