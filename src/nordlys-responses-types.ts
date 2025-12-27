/**
 * Type definitions for Nordlys Responses API
 * Migrated from Chat Completions API
 */

// ============================================================================
// Request Types
// ============================================================================

/**
 * Union type for all input items
 */
export type NordlysResponseInputItemUnion =
  | NordlysResponseInputItemMessage
  | NordlysResponseInputAudio
  | NordlysResponseInputImage
  | NordlysResponseInputFile
  | NordlysResponseInputFunctionCallOutput;

/**
 * Message input item
 */
export interface NordlysResponseInputItemMessage {
  type: 'message';
  role: 'user' | 'system' | 'developer';
  content: NordlysResponseInputContentUnion[];
}

/**
 * Audio input item
 */
export interface NordlysResponseInputAudio {
  type: 'input_audio';
  input_audio: {
    data: string;
    format: 'wav' | 'mp3';
  };
}

/**
 * Image input item
 */
export interface NordlysResponseInputImage {
  type: 'input_image';
  image_url: {
    url: string;
  };
}

/**
 * File input item
 */
export interface NordlysResponseInputFile {
  type: 'input_file';
  file: {
    filename: string;
    file_data: string;
  };
}

/**
 * Function call output (for tool messages)
 */
export interface NordlysResponseInputFunctionCallOutput {
  type: 'function_call_output';
  function_call_id: string;
  output: string;
}

/**
 * Union type for input content
 */
export type NordlysResponseInputContentUnion =
  | NordlysResponseInputText
  | NordlysResponseInputImage
  | NordlysResponseInputFile
  | NordlysResponseInputAudio;

/**
 * Text input content
 */
export interface NordlysResponseInputText {
  type: 'input_text';
  text: string;
}

/**
 * Tool union type (same as chat completions)
 */
export type NordlysToolUnion = {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters: unknown;
  };
};

/**
 * Tool choice union type (same as chat completions)
 */
export type NordlysToolChoiceUnion =
  | { type: 'function'; function: { name: string } }
  | 'auto'
  | 'none'
  | 'required';

/**
 * Audio parameter for responses API
 */
export interface V2ChatCompletionAudioParam {
  format?: string;
  voice?: string;
}

/**
 * Shared metadata for requests
 */
export interface SharedMetadata {
  [key: string]: string;
}

/**
 * Prediction content parameter
 */
export interface V2ChatCompletionPredictionContentParam {
  type?: string;
  content?: V2ChatCompletionPredictionContentContentUnionParam;
}

/**
 * Prediction content union parameter
 */
export interface V2ChatCompletionPredictionContentContentUnionParam {
  OfString?: string;
  OfArrayOfContentParts?: Array<{ type: 'text'; text: string }>;
}

/**
 * Response format union parameter
 */
export interface V2ChatCompletionNewParamsResponseFormatUnion {
  OfText?: SharedResponseFormatTextParam;
  OfJSONObject?: SharedResponseFormatJSONObjectParam;
  OfJSONSchema?: SharedResponseFormatJSONSchemaParam;
}

/**
 * Text response format parameter
 */
export interface SharedResponseFormatTextParam {
  type: string;
}

/**
 * JSON object response format parameter
 */
export interface SharedResponseFormatJSONObjectParam {
  type: string;
}

/**
 * JSON schema response format parameter
 */
export interface SharedResponseFormatJSONSchemaParam {
  type: string;
  json_schema?: SharedResponseFormatJSONSchemaJSONSchemaParam;
}

/**
 * JSON schema details parameter
 */
export interface SharedResponseFormatJSONSchemaJSONSchemaParam {
  name: string;
  schema: unknown;
  description?: string;
  strict?: boolean;
}

/**
 * Web search options parameter
 */
export interface V2ChatCompletionNewParamsWebSearchOptions {
  search_context_size?: string;
  user_location?: V2ChatCompletionNewParamsWebSearchOptionsUserLocation;
}

/**
 * User location for web search options
 */
export interface V2ChatCompletionNewParamsWebSearchOptionsUserLocation {
  type?: string;
  approximate?: V2ChatCompletionNewParamsWebSearchOptionsUserLocationApproximate;
}

/**
 * Approximate user location for web search options
 */
export interface V2ChatCompletionNewParamsWebSearchOptionsUserLocationApproximate {
  city?: string;
  country?: string;
  region?: string;
  timezone?: string;
}

/**
 * Stream options parameter
 */
export interface V2ChatCompletionStreamOptionsParam {
  include_usage?: boolean;
  include_obfuscation?: boolean;
}

/**
 * Reasoning configuration parameter
 */
export interface NordlysReasoningParam {
  effort?: string;
  summary?: 'auto' | 'concise' | 'detailed';
}

/**
 * Request payload for Nordlys Responses API
 */
export interface NordlysResponseRequest {
  input?: string | NordlysResponseInputItemUnion[];
  model: string;
  instructions?: string | NordlysResponseInputItemUnion[];
  tools?: NordlysToolUnion[];
  tool_choice?: NordlysToolChoiceUnion;
  temperature?: number;
  top_p?: number;
  max_output_tokens?: number;
  max_completion_tokens?: number;
  max_tool_calls?: number;
  stop?: string | string[];
  presence_penalty?: number;
  frequency_penalty?: number;
  logit_bias?: Record<string, number>;
  user?: string;
  audio?: V2ChatCompletionAudioParam;
  logprobs?: boolean;
  metadata?: SharedMetadata;
  modalities?: string[];
  parallel_tool_calls?: boolean;
  prediction?: V2ChatCompletionPredictionContentParam;
  reasoning?: NordlysReasoningParam;
  response_format?: V2ChatCompletionNewParamsResponseFormatUnion;
  seed?: number;
  service_tier?: string;
  store?: boolean;
  top_logprobs?: number;
  web_search_options?: V2ChatCompletionNewParamsWebSearchOptions;
  stream?: boolean;
  stream_options?: V2ChatCompletionStreamOptionsParam;
  strict_json_schema?: boolean;
  text_verbosity?: 'low' | 'medium' | 'high';
  include?: string[];
  truncation?: 'auto' | 'disabled';
}

// ============================================================================
// Response Types
// ============================================================================

/**
 * Union type for all output items
 */
export type NordlysResponseOutputItemUnion =
  | NordlysResponseOutputMessage
  | NordlysResponseReasoningItem
  | NordlysResponseFunctionToolCall
  | NordlysResponseFileSearchToolCall
  | NordlysResponseFunctionWebSearch;

/**
 * Output message
 */
export interface NordlysResponseOutputMessage {
  type: 'message';
  id: string;
  role: 'assistant';
  status: 'in_progress' | 'completed' | 'incomplete';
  content: NordlysResponseOutputMessageContentUnion[];
  created_at?: number;
}

/**
 * Union type for output message content
 */
export type NordlysResponseOutputMessageContentUnion =
  | NordlysResponseOutputText
  | NordlysResponseRefusal;

/**
 * Output text content
 */
export interface NordlysResponseOutputText {
  type: 'output_text';
  text: string;
}

/**
 * Refusal content
 */
export interface NordlysResponseRefusal {
  type: 'refusal';
  text: string;
}

/**
 * Reasoning item
 */
export interface NordlysResponseReasoningItem {
  type: 'reasoning';
  id: string;
  summary: Array<{
    text: string;
    type: string;
  }>;
  content?: Array<{
    text: string;
    type: string;
  }>;
  encrypted_content?: string | null;
  status?: 'in_progress' | 'completed' | 'incomplete';
}

/**
 * Function tool call output item
 */
export interface NordlysResponseFunctionToolCall {
  type: 'function_call';
  id: string;
  name: string;
  arguments: string;
  status: 'in_progress' | 'completed' | 'incomplete';
}

/**
 * File search tool call output item
 */
export interface NordlysResponseFileSearchToolCall {
  type: 'file_search';
  id: string;
  status: 'in_progress' | 'completed' | 'incomplete';
}

/**
 * Web search tool call output item
 */
export interface NordlysResponseFunctionWebSearch {
  type: 'web_search';
  id: string;
  status: 'in_progress' | 'completed' | 'incomplete';
}

/**
 * Usage statistics for Responses API
 */
export interface NordlysResponseUsage {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  input_tokens_details?: {
    cached_tokens?: number;
  };
  output_tokens_details?: {
    reasoning_tokens?: number;
  };
}

/**
 * Response from Nordlys Responses API
 */
export interface NordlysResponse {
  id: string;
  model: string;
  created_at: number;
  status:
    | 'completed'
    | 'incomplete'
    | 'failed'
    | 'cancelled'
    | 'queued'
    | 'in_progress';
  output: NordlysResponseOutputItemUnion[];
  usage?: NordlysResponseUsage | null;
  provider?: string;
  service_tier?: string;
  system_fingerprint?: string;
  error?: {
    message: string;
    type: string;
    param?: unknown;
    code?: unknown;
  } | null;
}

// ============================================================================
// Stream Event Types
// ============================================================================

/**
 * Reasoning summary part added event
 */
export interface NordlysResponseReasoningSummaryPartAddedEvent {
  type: 'response.reasoning_summary_part.added';
  item_id: string;
  summary_index: number;
  output_index?: number;
  model?: string;
  part?: {
    type: 'summary_text';
    text: string;
  };
  sequence_number?: number;
}

/**
 * Reasoning summary text delta event
 */
export interface NordlysResponseReasoningSummaryTextDeltaEvent {
  type: 'response.reasoning_summary_text.delta';
  item_id: string;
  summary_index: number;
  delta: string;
  output_index?: number;
}

/**
 * Reasoning summary text done event
 */
export interface NordlysResponseReasoningSummaryTextDoneEvent {
  type: 'response.reasoning_summary_text.done';
  item_id: string;
  summary_index: number;
  text: string;
  model?: string;
  output_index?: number;
  sequence_number?: number;
}

/**
 * Reasoning summary part done event
 */
export interface NordlysResponseReasoningSummaryPartDoneEvent {
  type: 'response.reasoning_summary_part.done';
  item_id: string;
  summary_index: number;
  output_index?: number;
}

/**
 * Union type for all stream events
 */
export type NordlysResponseStreamEventUnion =
  | NordlysResponseCreatedEvent
  | NordlysResponseInProgressEvent
  | NordlysResponseOutputItemAddedEvent
  | NordlysResponseOutputItemDoneEvent
  | NordlysResponseTextDeltaEvent
  | NordlysResponseReasoningTextDeltaEvent
  | NordlysResponseFunctionCallArgumentsDeltaEvent
  | NordlysResponseFunctionCallArgumentsDoneEvent
  | NordlysResponseContentPartAddedEvent
  | NordlysResponseContentPartDoneEvent
  | NordlysResponseReasoningSummaryPartAddedEvent
  | NordlysResponseReasoningSummaryTextDeltaEvent
  | NordlysResponseReasoningSummaryTextDoneEvent
  | NordlysResponseReasoningSummaryPartDoneEvent
  | NordlysResponseCompletedEvent
  | NordlysResponseErrorEvent;

/**
 * Response created event
 */
export interface NordlysResponseCreatedEvent {
  type: 'response.created';
  response: NordlysResponse;
}

/**
 * Response in progress event
 */
export interface NordlysResponseInProgressEvent {
  type: 'response.in_progress';
  response: {
    id: string;
    status: 'in_progress';
  };
}

/**
 * Output item added event
 */
export interface NordlysResponseOutputItemAddedEvent {
  type: 'response.output_item.added';
  item: NordlysResponseOutputItemUnion;
  output_index: number;
}

/**
 * Output item done event
 */
export interface NordlysResponseOutputItemDoneEvent {
  type: 'response.output_item.done';
  item_id: string;
  output_index: number;
}

/**
 * Text delta event
 */
export interface NordlysResponseTextDeltaEvent {
  type: 'response.output_text.delta';
  delta: string;
  item_id: string;
  output_index: number;
  content_index: number;
}

/**
 * Reasoning text delta event
 */
export interface NordlysResponseReasoningTextDeltaEvent {
  type: 'response.reasoning_text.delta';
  delta: string;
  item_id: string;
  output_index: number;
}

/**
 * Function call arguments delta event
 */
export interface NordlysResponseFunctionCallArgumentsDeltaEvent {
  type: 'response.function_call_arguments.delta';
  delta: string;
  item_id: string;
  output_index: number;
}

/**
 * Function call arguments done event
 */
export interface NordlysResponseFunctionCallArgumentsDoneEvent {
  type: 'response.function_call_arguments.done';
  item_id: string;
  output_index: number;
}

/**
 * Response completed event
 */
export interface NordlysResponseCompletedEvent {
  type: 'response.completed';
  response: NordlysResponse;
}

/**
 * Content part added event
 */
export interface NordlysResponseContentPartAddedEvent {
  type: 'response.content_part.added';
  content_index: number;
  item_id: string;
  output_index: number;
  part:
    | {
        type: 'output_text';
        text: string;
        annotations?: unknown[];
        logprobs?: unknown[];
      }
    | {
        type: 'refusal';
        refusal: string;
      }
    | {
        type: 'reasoning_text';
        text: string;
      };
  sequence_number: number;
}

/**
 * Content part done event
 */
export interface NordlysResponseContentPartDoneEvent {
  type: 'response.content_part.done';
  content_index: number;
  item_id: string;
  output_index: number;
  part:
    | {
        type: 'output_text';
        text: string;
        annotations?: unknown[];
        logprobs?: unknown[];
      }
    | {
        type: 'refusal';
        refusal: string;
      }
    | {
        type: 'reasoning_text';
        text: string;
      };
  sequence_number: number;
}

/**
 * Response error event
 */
export interface NordlysResponseErrorEvent {
  type: 'response.error';
  error: {
    message: string;
    type: string;
    param?: unknown;
    code?: unknown;
  };
}
