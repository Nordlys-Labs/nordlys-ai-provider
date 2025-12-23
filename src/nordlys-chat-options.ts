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
   * Reasoning effort level.
   */
  reasoning_effort: z.string().optional(),
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
});

/**
 * Type for validated Nordlys provider options.
 */
export type NordlysProviderOptions = z.infer<typeof nordlysProviderOptions>;
