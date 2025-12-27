/**
 * Type definitions for Nordlys Responses API
 * Migrated from Chat Completions API
 */

// Re-export all types from nordlys-responses-types.ts
export type {
  NordlysResponse,
  NordlysResponseCompletedEvent,
  NordlysResponseCreatedEvent,
  NordlysResponseErrorEvent,
  NordlysResponseFileSearchToolCall,
  NordlysResponseFunctionCallArgumentsDeltaEvent,
  NordlysResponseFunctionCallArgumentsDoneEvent,
  NordlysResponseFunctionToolCall,
  NordlysResponseFunctionWebSearch,
  NordlysResponseInProgressEvent,
  NordlysResponseInputAudio,
  NordlysResponseInputContentUnion,
  NordlysResponseInputFile,
  NordlysResponseInputFunctionCallOutput,
  NordlysResponseInputImage,
  NordlysResponseInputItemMessage,
  NordlysResponseInputItemUnion,
  NordlysResponseInputText,
  NordlysResponseOutputItemAddedEvent,
  NordlysResponseOutputItemDoneEvent,
  NordlysResponseOutputItemUnion,
  NordlysResponseOutputMessage,
  NordlysResponseOutputMessageContentUnion,
  NordlysResponseOutputText,
  NordlysResponseReasoningItem,
  NordlysResponseReasoningTextDeltaEvent,
  NordlysResponseRefusal,
  NordlysResponseRequest,
  NordlysResponseStreamEventUnion,
  NordlysResponseTextDeltaEvent,
  NordlysResponseUsage,
  NordlysToolChoiceUnion,
  NordlysToolUnion,
} from './nordlys-responses-types';

// Legacy types for backward compatibility (deprecated - will be removed in future versions)
// These are kept for now but should not be used in new code

// Import types from responses-types for type aliases
import type {
  NordlysResponse,
  NordlysResponseRequest,
} from './nordlys-responses-types';

/**
 * @deprecated Use NordlysResponseRequest instead
 */
export type NordlysChatCompletionRequest = NordlysResponseRequest;

/**
 * @deprecated Use NordlysResponse instead
 */
export type NordlysChatCompletionResponse = NordlysResponse;

// Re-export provider option types that are still used
export type {
  SharedMetadata,
  SharedResponseFormatJSONObjectParam,
  SharedResponseFormatJSONSchemaJSONSchemaParam,
  SharedResponseFormatJSONSchemaParam,
  SharedResponseFormatTextParam,
  V2ChatCompletionAudioParam,
  V2ChatCompletionNewParamsResponseFormatUnion,
  V2ChatCompletionNewParamsWebSearchOptions,
  V2ChatCompletionNewParamsWebSearchOptionsUserLocation,
  V2ChatCompletionNewParamsWebSearchOptionsUserLocationApproximate,
  V2ChatCompletionPredictionContentContentUnionParam,
  V2ChatCompletionPredictionContentParam,
  V2ChatCompletionStreamOptionsParam,
} from './nordlys-responses-types';

// These types are no longer needed but kept for reference
// They should be removed in a future cleanup

/**
 * @deprecated No longer used - system messages go to instructions field
 */
export interface NordlysChatCompletionSystemMessage {
  role: 'system';
  content: string;
}

/**
 * @deprecated No longer used - user messages are part of input array
 */
export interface NordlysChatCompletionUserMessage {
  role: 'user';
  content: string | Array<NordlysChatCompletionContentPart>;
}

/**
 * @deprecated No longer used
 */
export type NordlysChatCompletionContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }
  | {
      type: 'input_audio';
      input_audio: { data: string; format: 'wav' | 'mp3' };
    }
  | { type: 'file'; file: { filename: string; file_data: string } };

/**
 * @deprecated No longer used - assistant messages are part of input array for multi-turn
 */
export interface NordlysChatCompletionAssistantMessage {
  role: 'assistant';
  content?: string | null;
  tool_calls?: Array<NordlysChatCompletionMessageToolCall>;
  reasoning_content?: string;
  generated_files?: Array<{
    media_type: string;
    data: string;
  }>;
}

/**
 * @deprecated No longer used
 */
export interface NordlysChatCompletionMessageToolCall {
  type: 'function';
  id: string;
  function: {
    arguments: string;
    name: string;
  };
}

/**
 * @deprecated No longer used - tool messages are function_call_output items
 */
export interface NordlysChatCompletionToolMessage {
  role: 'tool';
  content: string;
  tool_call_id: string;
}

/**
 * @deprecated No longer used
 */
export interface NordlysChatCompletionDeveloperMessage {
  role: 'developer';
  content: string;
}

/**
 * @deprecated No longer used
 */
export type NordlysChatCompletionMessage =
  | NordlysChatCompletionSystemMessage
  | NordlysChatCompletionUserMessage
  | NordlysChatCompletionAssistantMessage
  | NordlysChatCompletionToolMessage
  | NordlysChatCompletionDeveloperMessage;

/**
 * @deprecated Use NordlysResponseUsage instead
 */
export interface NordlysChatCompletionUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  reasoning_tokens?: number;
  cached_input_tokens?: number;
}
