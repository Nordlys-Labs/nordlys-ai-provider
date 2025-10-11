/**
 * Request payload for Adaptive chat completion API.
 */
export interface AdaptiveChatCompletionRequest {
  messages: AdaptiveChatCompletionMessage[];
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  n?: number;
  stream?: boolean;
  stop?: string | string[];
  presence_penalty?: number;
  frequency_penalty?: number;
  logit_bias?: Record<string, number>;
  user?: string;
  model_router?: AdaptiveModelRouterConfig;
  fallback?: AdaptiveFallbackConfig;
  provider_configs?: Record<string, AdaptiveProviderConfig>;
  stream_options?: {
    include_usage?: boolean;
  };
}

export interface AdaptiveChatCompletionDeveloperMessage {
  role: 'developer';
  content: string;
}

/**
 * All possible message types for Adaptive chat completion.
 */
export type AdaptiveChatCompletionMessage =
  | AdaptiveChatCompletionSystemMessage
  | AdaptiveChatCompletionUserMessage
  | AdaptiveChatCompletionAssistantMessage
  | AdaptiveChatCompletionToolMessage
  | AdaptiveChatCompletionDeveloperMessage;

/**
 * System message for Adaptive chat completion.
 */
export interface AdaptiveChatCompletionSystemMessage {
  role: 'system';
  content: string;
}

/**
 * User message for Adaptive chat completion.
 */
export interface AdaptiveChatCompletionUserMessage {
  role: 'user';
  content: string | Array<AdaptiveChatCompletionContentPart>;
}

/**
 * Content part for user messages.
 */
export type AdaptiveChatCompletionContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }
  | {
      type: 'input_audio';
      input_audio: { data: string; format: 'wav' | 'mp3' };
    }
  | { type: 'file'; file: { filename: string; file_data: string } };

/**
 * Assistant message for Adaptive chat completion.
 */
export interface AdaptiveChatCompletionAssistantMessage {
  role: 'assistant';
  content?: string | null;
  tool_calls?: Array<AdaptiveChatCompletionMessageToolCall>;
  reasoning_content?: string;
  generated_files?: Array<{
    media_type: string;
    data: string;
  }>;
}

/**
 * Tool call for assistant messages.
 */
export interface AdaptiveChatCompletionMessageToolCall {
  type: 'function';
  id: string;
  function: {
    arguments: string;
    name: string;
  };
}

/**
 * Tool message for Adaptive chat completion.
 */
export interface AdaptiveChatCompletionToolMessage {
  role: 'tool';
  content: string;
  tool_call_id: string;
}

/**
 * Response from Adaptive chat completion API.
 */
export interface AdaptiveChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: AdaptiveChatCompletionAssistantMessage;
    finish_reason: string | null;
  }>;
  usage?: AdaptiveChatCompletionUsage;
  provider: string;
}

/**
 * Model configuration for intelligent routing.
 */
export interface AdaptiveModelConfig {
  provider: string;
  model_name?: string;
  cost_per_1m_input_tokens?: number;
  cost_per_1m_output_tokens?: number;
  max_context_tokens?: number;
  max_output_tokens?: number;
  supports_function_calling?: boolean;
  task_type?: string;
  complexity?: string;
}

/**
 * Model router configuration for intelligent model selection.
 */
export interface AdaptiveModelRouterConfig {
  models?: AdaptiveModelConfig[];
  cost_bias?: number;
  complexity_threshold?: number;
  token_threshold?: number;
  cache?: AdaptiveCacheConfig;
}

/**
 * Fallback configuration for provider resiliency.
 */
export interface AdaptiveFallbackConfig {
  enabled?: boolean;
  mode?: 'sequential' | 'parallel';
}

/**
 * Custom provider configuration.
 */
export interface AdaptiveProviderConfig {
  base_url?: string;
  api_key?: string;
  auth_type?: string;
  headers?: Record<string, string>;
  timeout_ms?: number;
}

/**
 * Cache configuration.
 */
export interface AdaptiveCacheConfig {
  enabled?: boolean;
  threshold?: number;
}

/**
 * Usage statistics for Adaptive chat completion API.
 */
export interface AdaptiveChatCompletionUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  reasoning_tokens?: number;
  cached_input_tokens?: number;
}
