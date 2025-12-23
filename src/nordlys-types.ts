/**
 * Request payload for Nordlys chat completion API.
 */
export interface NordlysChatCompletionRequest {
  messages: NordlysChatCompletionMessage[];
  model: string; // Required field
  max_tokens?: number;
  max_completion_tokens?: number;
  temperature?: number;
  top_p?: number;
  n?: number;
  stream?: boolean;
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
  reasoning_effort?: string;
  response_format?: V2ChatCompletionNewParamsResponseFormatUnion;
  seed?: number;
  service_tier?: string;
  store?: boolean;
  top_logprobs?: number;
  web_search_options?: V2ChatCompletionNewParamsWebSearchOptions;
  stream_options?: V2ChatCompletionStreamOptionsParam;
  tools?: Array<{
    type: 'function';
    function: {
      name: string;
      description?: string;
      parameters: unknown;
    };
  }>;
  tool_choice?:
    | { type: 'function'; function: { name: string } }
    | 'auto'
    | 'none'
    | 'required';
}

export interface NordlysChatCompletionDeveloperMessage {
  role: 'developer';
  content: string;
}

/**
 * All possible message types for Nordlys chat completion.
 */
export type NordlysChatCompletionMessage =
  | NordlysChatCompletionSystemMessage
  | NordlysChatCompletionUserMessage
  | NordlysChatCompletionAssistantMessage
  | NordlysChatCompletionToolMessage
  | NordlysChatCompletionDeveloperMessage;

/**
 * System message for Nordlys chat completion.
 */
export interface NordlysChatCompletionSystemMessage {
  role: 'system';
  content: string;
}

/**
 * User message for Nordlys chat completion.
 */
export interface NordlysChatCompletionUserMessage {
  role: 'user';
  content: string | Array<NordlysChatCompletionContentPart>;
}

/**
 * Content part for user messages.
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
 * Assistant message for Nordlys chat completion.
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
 * Tool call for assistant messages.
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
 * Tool message for Nordlys chat completion.
 */
export interface NordlysChatCompletionToolMessage {
  role: 'tool';
  content: string;
  tool_call_id: string;
}

/**
 * Response from Nordlys chat completion API.
 */
export interface NordlysChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: NordlysChatCompletionAssistantMessage;
    finish_reason: string | null;
  }>;
  usage?: NordlysChatCompletionUsage;
  provider: string;
  service_tier?: string;
  system_fingerprint?: string;
}

/**
 * Usage statistics for Nordlys chat completion API.
 */
export interface NordlysChatCompletionUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  reasoning_tokens?: number;
  cached_input_tokens?: number;
}

/**
 * Audio parameter for chat completion.
 */
export interface V2ChatCompletionAudioParam {
  format?: string;
  voice?: string;
}

/**
 * Shared metadata for requests.
 */
export interface SharedMetadata {
  [key: string]: string;
}

/**
 * Prediction content parameter.
 */
export interface V2ChatCompletionPredictionContentParam {
  type?: string;
  content?: V2ChatCompletionPredictionContentContentUnionParam;
}

/**
 * Prediction content union parameter.
 */
export interface V2ChatCompletionPredictionContentContentUnionParam {
  OfString?: string;
  OfArrayOfContentParts?: Array<{ type: 'text'; text: string }>;
}

/**
 * Response format union parameter.
 */
export interface V2ChatCompletionNewParamsResponseFormatUnion {
  OfText?: SharedResponseFormatTextParam;
  OfJSONObject?: SharedResponseFormatJSONObjectParam;
  OfJSONSchema?: SharedResponseFormatJSONSchemaParam;
}

/**
 * Text response format parameter.
 */
export interface SharedResponseFormatTextParam {
  type: string;
}

/**
 * JSON object response format parameter.
 */
export interface SharedResponseFormatJSONObjectParam {
  type: string;
}

/**
 * JSON schema response format parameter.
 */
export interface SharedResponseFormatJSONSchemaParam {
  type: string;
  json_schema?: SharedResponseFormatJSONSchemaJSONSchemaParam;
}

/**
 * JSON schema details parameter.
 */
export interface SharedResponseFormatJSONSchemaJSONSchemaParam {
  name: string;
  schema: unknown;
  description?: string;
  strict?: boolean;
}

/**
 * Web search options parameter.
 */
export interface V2ChatCompletionNewParamsWebSearchOptions {
  search_context_size?: string;
  user_location?: V2ChatCompletionNewParamsWebSearchOptionsUserLocation;
}

/**
 * User location for web search options.
 */
export interface V2ChatCompletionNewParamsWebSearchOptionsUserLocation {
  type?: string;
  approximate?: V2ChatCompletionNewParamsWebSearchOptionsUserLocationApproximate;
}

/**
 * Approximate user location for web search options.
 */
export interface V2ChatCompletionNewParamsWebSearchOptionsUserLocationApproximate {
  city?: string;
  country?: string;
  region?: string;
  timezone?: string;
}

/**
 * Stream options parameter.
 */
export interface V2ChatCompletionStreamOptionsParam {
  include_usage?: boolean;
  include_obfuscation?: boolean;
}
