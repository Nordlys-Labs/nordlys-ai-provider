// Parses Nordlys Responses API output to AI SDK LanguageModelV3Content format
import type { LanguageModelV3Content } from '@ai-sdk/provider';
import type {
  NordlysResponse,
  NordlysResponseFunctionToolCall,
  NordlysResponseOutputMessage,
  NordlysResponseReasoningItem,
} from './nordlys-responses-types';

/**
 * Parses Nordlys Response output array to AI SDK content format
 */
export function parseNordlysResponse(
  response: NordlysResponse
): LanguageModelV3Content[] {
  const content: LanguageModelV3Content[] = [];

  // Process each output item
  for (const item of response.output) {
    switch (item.type) {
      case 'message': {
        // Extract text and refusal from message content
        const message = item as NordlysResponseOutputMessage;
        for (const contentItem of message.content) {
          switch (contentItem.type) {
            case 'output_text': {
              content.push({
                type: 'text',
                text: contentItem.text,
              });
              break;
            }
            case 'refusal': {
              // Refusal is typically treated as text in AI SDK
              content.push({
                type: 'text',
                text: contentItem.text,
              });
              break;
            }
          }
        }
        break;
      }
      case 'reasoning': {
        // Extract reasoning text from content array
        const reasoning = item as NordlysResponseReasoningItem;
        // Combine all reasoning text from content array
        const reasoningText =
          reasoning.content?.map((c) => c.text).join('') || '';
        if (reasoningText) {
          content.push({
            type: 'reasoning',
            text: reasoningText,
          });
        }
        break;
      }
      case 'function_call': {
        // Extract tool call information
        const toolCall = item as NordlysResponseFunctionToolCall;
        content.push({
          type: 'tool-call',
          toolCallId: toolCall.id,
          toolName: toolCall.name,
          input: toolCall.arguments,
        });
        break;
      }
      case 'file_search':
      case 'web_search': {
        // These tool types are not directly supported in AI SDK content
        // They might be handled differently or ignored
        // For now, we'll skip them or add a warning
        break;
      }
      default: {
        // Unknown output type - skip
        break;
      }
    }
  }

  return content;
}
