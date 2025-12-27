// Nordlys chat model options/types

import { z } from 'zod/v4';

/**
 * Provider options for Nordlys chat models.
 */
export const nordlysProviderOptions = z.object({
  /**
   * Model name (required for API requests).
   */
  model: z.string().optional(),
  /**
   * Modify the likelihood of specified tokens appearing in the completion.
   */
  logit_bias: z.record(z.string(), z.number()).optional(),
  /**
   * Number of completions to generate for each prompt.
   */
  n: z.number().optional(),
  /**
   * Whether to stream responses.
   */
  stream: z.boolean().optional(),
  /**
   * Unique identifier representing your end-user.
   */
  user: z.string().optional(),
  /**
   * Audio parameter for chat completion.
   */
  audio: z
    .object({
      format: z.string().optional(),
      voice: z.string().optional(),
    })
    .optional(),
  /**
   * Whether to return log probabilities of the output tokens.
   */
  logprobs: z.boolean().optional(),
  /**
   * Maximum number of completion tokens.
   */
  max_completion_tokens: z.number().optional(),
  /**
   * Metadata for the request.
   */
  metadata: z.record(z.string(), z.string()).optional(),
  /**
   * Modalities for the request.
   */
  modalities: z.array(z.string()).optional(),
  /**
   * Whether to allow parallel tool calls.
   */
  parallel_tool_calls: z.boolean().optional(),
  /**
   * Prediction content parameter.
   */
  prediction: z
    .object({
      type: z.string().optional(),
      content: z
        .object({
          OfString: z.string().optional(),
          OfArrayOfContentParts: z
            .array(z.object({ type: z.literal('text'), text: z.string() }))
            .optional(),
        })
        .optional(),
    })
    .optional(),
  /**
   * Reasoning configuration options.
   */
  reasoning: z
    .object({
      effort: z.string().optional(),
      summary: z.enum(['auto', 'concise', 'detailed']).optional(),
    })
    .optional(),
  /**
   * Response format parameter.
   */
  response_format: z
    .object({
      OfText: z.object({ type: z.string() }).optional(),
      OfJSONObject: z.object({ type: z.string() }).optional(),
      OfJSONSchema: z
        .object({
          type: z.string(),
          json_schema: z
            .object({
              name: z.string(),
              schema: z.unknown(),
              description: z.string().optional(),
              strict: z.boolean().optional(),
            })
            .optional(),
        })
        .optional(),
    })
    .optional(),
  /**
   * Seed for deterministic outputs.
   */
  seed: z.number().optional(),
  /**
   * Service tier to use.
   */
  service_tier: z.string().optional(),
  /**
   * Whether to store the conversation.
   */
  store: z.boolean().optional(),
  /**
   * Number of top logprobs to return.
   */
  top_logprobs: z.number().optional(),
  /**
   * Web search options.
   */
  web_search_options: z
    .object({
      search_context_size: z.string().optional(),
      user_location: z
        .object({
          type: z.string().optional(),
          approximate: z
            .object({
              city: z.string().optional(),
              country: z.string().optional(),
              region: z.string().optional(),
              timezone: z.string().optional(),
            })
            .optional(),
        })
        .optional(),
    })
    .optional(),
  /**
   * The maximum number of total calls to built-in tools that can be processed in a response.
   * This maximum number applies across all built-in tool calls, not per individual tool.
   */
  max_tool_calls: z.number().optional(),
  /**
   * Whether to use strict JSON schema validation. Defaults to true.
   */
  strict_json_schema: z.boolean().optional(),
  /**
   * Controls the verbosity of the model's response. Lower values result in more concise responses,
   * while higher values result in more verbose responses.
   */
  text_verbosity: z.enum(['low', 'medium', 'high']).optional(),
  /**
   * Specifies additional content to include in the response.
   * Supported values: ['file_search_call.results'], ['message.output_text.logprobs'], etc.
   */
  include: z.array(z.string()).optional(),
  /**
   * The truncation strategy to use for the model response.
   * 'auto': If the input exceeds the model's context window, truncate by dropping items from the beginning.
   * 'disabled': If input will exceed context window, fail with 400 error.
   */
  truncation: z.enum(['auto', 'disabled']).optional(),
});

/**
 * Type for validated Nordlys provider options.
 */
export type NordlysProviderOptions = z.infer<typeof nordlysProviderOptions>;

/**
 * Settings that can be set at model creation time.
 * These settings will be merged with call-level options, with call-level taking precedence.
 */
export interface NordlysChatSettings {
  /**
   * Temperature setting for the model.
   */
  temperature?: number;
  /**
   * Maximum number of output tokens.
   */
  maxOutputTokens?: number;
  /**
   * Top-p sampling parameter.
   */
  topP?: number;
  /**
   * Top-k sampling parameter.
   */
  topK?: number;
  /**
   * Frequency penalty.
   */
  frequencyPenalty?: number;
  /**
   * Presence penalty.
   */
  presencePenalty?: number;
  /**
   * Stop sequences.
   */
  stopSequences?: string[];
  /**
   * Provider-specific options.
   */
  providerOptions?: NordlysProviderOptions;
}
