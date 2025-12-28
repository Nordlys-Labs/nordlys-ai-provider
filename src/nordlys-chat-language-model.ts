import {
  APICallError,
  type LanguageModelV3,
  type LanguageModelV3CallOptions,
  type LanguageModelV3Content,
  type LanguageModelV3FinishReason,
  type LanguageModelV3GenerateResult,
  type LanguageModelV3StreamPart,
  type LanguageModelV3StreamResult,
  type SharedV3ProviderMetadata,
  type SharedV3Warning,
} from '@ai-sdk/provider';
import type { FetchFunction } from '@ai-sdk/provider-utils';
import {
  combineHeaders,
  createEventSourceResponseHandler,
  createJsonResponseHandler,
  type ParseResult,
  parseProviderOptions,
  postJsonToApi,
} from '@ai-sdk/provider-utils';
import { z } from 'zod';
import {
  convertNordlysResponsesUsage,
  type NordlysResponsesUsage,
} from './convert-nordlys-responses-usage';
import { convertToNordlysResponseInput } from './convert-to-nordlys-response-input';
import { mapNordlysFinishReason } from './map-nordlys-finish-reason';
import {
  type NordlysChatSettings,
  nordlysProviderOptions,
} from './nordlys-chat-options';
import { nordlysFailedResponseHandler } from './nordlys-error';
import { prepareTools } from './nordlys-prepare-tools';
import type {
  NordlysResponseOutputItemDoneEvent,
  NordlysResponseOutputItemUnion,
  NordlysResponseStreamEventUnion,
} from './nordlys-responses-types';
import type { NordlysResponseRequest } from './nordlys-types';
import {
  createStreamState,
  getCompletedToolCall,
  handleContentPartAdded,
  handleContentPartDone,
  handleFunctionCallArgumentsDelta,
  handleOutputItemAdded,
  handleReasoningDelta,
  handleTextDelta,
  isToolCallComplete,
} from './parse-nordlys-stream-event';

interface NordlysChatConfig {
  provider: string;
  baseURL: string;
  headers: () => Record<string, string | undefined>;
  fetch?: FetchFunction;
  defaultProvider?: string;
}

// Constants for response status values
const RESPONSE_STATUS = {
  COMPLETED: 'completed',
  INCOMPLETE: 'incomplete',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  QUEUED: 'queued',
  IN_PROGRESS: 'in_progress',
} as const;

// Zod schema for Responses API response
const nordlysResponseSchema = z.object({
  id: z.string(),
  model: z.string(),
  created_at: z.number(),
  status: z.enum([
    RESPONSE_STATUS.COMPLETED,
    RESPONSE_STATUS.INCOMPLETE,
    RESPONSE_STATUS.FAILED,
    RESPONSE_STATUS.CANCELLED,
    RESPONSE_STATUS.QUEUED,
    RESPONSE_STATUS.IN_PROGRESS,
  ]),
  output: z.array(z.unknown()), // Accept all output item types, we'll filter in processing
  usage: z
    .object({
      input_tokens: z.number(),
      output_tokens: z.number(),
      total_tokens: z.number(),
      input_tokens_details: z
        .object({
          cached_tokens: z.number().optional(),
        })
        .optional(),
      output_tokens_details: z
        .object({
          reasoning_tokens: z.number().optional(),
        })
        .optional(),
    })
    .nullish(),
  provider: z.string().optional(),
  service_tier: z.string().optional(),
  system_fingerprint: z.string().optional(),
  error: z
    .object({
      message: z.string(),
      type: z.string(),
      param: z.unknown().nullish(),
      code: z.unknown().nullish(),
    })
    .nullish(),
});

// Zod schema for Responses API stream events
const nordlysResponseStreamEventSchema = z.union([
  z.object({
    type: z.literal('response.created'),
    response: nordlysResponseSchema,
  }),
  z.object({
    type: z.literal('response.in_progress'),
    response: z.object({
      id: z.string(),
      status: z.literal('in_progress'),
    }),
  }),
  z.object({
    type: z.literal('response.output_item.added'),
    item: z.unknown(), // Accept all item types, we'll filter in processing
    output_index: z.number(),
  }),
  z.object({
    type: z.literal('response.output_item.done'),
    item: z.object({
      id: z.string(),
      type: z.string(),
      role: z.string().optional(),
      status: z.string().optional(),
      content: z.array(z.unknown()).optional(),
    }),
    output_index: z.number(),
    // Nordlys-specific optional fields
    model: z.string().optional(),
    sequence_number: z.number().optional(),
  }),
  z.object({
    type: z.literal('response.output_text.delta'),
    delta: z.string(),
    item_id: z.string(),
    output_index: z.number(),
    content_index: z.number(),
  }),
  z.object({
    type: z.literal('response.output_text.done'),
    item_id: z.string(),
    content_index: z.number(),
    output_index: z.number(),
    text: z.string(),
    logprobs: z.array(z.unknown()).optional(),
    // Nordlys-specific optional fields
    model: z.string().optional(),
    sequence_number: z.number().optional(),
  }),
  z.object({
    type: z.literal('response.reasoning_text.delta'),
    delta: z.string(),
    item_id: z.string(),
    output_index: z.number(),
  }),
  z.object({
    type: z.literal('response.function_call_arguments.delta'),
    delta: z.string(),
    item_id: z.string(),
    output_index: z.number(),
  }),
  z.object({
    type: z.literal('response.function_call_arguments.done'),
    item_id: z.string(),
    output_index: z.number(),
  }),
  z.object({
    type: z.literal('response.content_part.added'),
    content_index: z.number(),
    item_id: z.string(),
    output_index: z.number(),
    part: z.discriminatedUnion('type', [
      z.object({
        type: z.literal('output_text'),
        text: z.string(),
        annotations: z.array(z.unknown()).optional(),
        logprobs: z.array(z.unknown()).optional(),
      }),
      z.object({
        type: z.literal('refusal'),
        refusal: z.string(),
      }),
      z.object({
        type: z.literal('reasoning_text'),
        text: z.string(),
      }),
    ]),
    sequence_number: z.number(),
  }),
  z.object({
    type: z.literal('response.content_part.done'),
    content_index: z.number(),
    item_id: z.string(),
    output_index: z.number(),
    part: z.discriminatedUnion('type', [
      z.object({
        type: z.literal('output_text'),
        text: z.string(),
        annotations: z.array(z.unknown()).optional(),
        logprobs: z.array(z.unknown()).optional(),
      }),
      z.object({
        type: z.literal('refusal'),
        refusal: z.string(),
      }),
      z.object({
        type: z.literal('reasoning_text'),
        text: z.string(),
      }),
    ]),
    sequence_number: z.number(),
  }),
  z.object({
    type: z.literal('response.reasoning_summary_part.added'),
    item_id: z.string(),
    summary_index: z.number(),
    // Nordlys-specific optional fields
    output_index: z.number().optional(),
    model: z.string().optional(),
    part: z
      .object({
        type: z.literal('summary_text'),
        text: z.string(),
      })
      .optional(),
    sequence_number: z.number().optional(),
  }),
  z.object({
    type: z.literal('response.reasoning_summary_text.delta'),
    item_id: z.string(),
    summary_index: z.number(),
    delta: z.string(),
    // Nordlys-specific optional fields
    output_index: z.number().optional(),
  }),
  z.object({
    type: z.literal('response.reasoning_summary_text.done'),
    item_id: z.string(),
    summary_index: z.number(),
    text: z.string(),
    // Nordlys-specific optional fields
    model: z.string().optional(),
    output_index: z.number().optional(),
    sequence_number: z.number().optional(),
  }),
  z.object({
    type: z.literal('response.reasoning_summary_part.done'),
    item_id: z.string(),
    summary_index: z.number(),
    // Nordlys-specific optional fields
    output_index: z.number().optional(),
  }),
  z.object({
    type: z.literal('response.completed'),
    response: nordlysResponseSchema,
  }),
  z.object({
    type: z.literal('response.error'),
    error: z.object({
      message: z.string(),
      type: z.string(),
      param: z.unknown().nullish(),
      code: z.unknown().nullish(),
    }),
  }),
]);

export class NordlysChatLanguageModel implements LanguageModelV3 {
  readonly specificationVersion = 'v3';
  readonly modelId: string;
  private readonly config: NordlysChatConfig;
  private readonly settings?: NordlysChatSettings;

  constructor(
    modelId: string,
    settings: NordlysChatSettings | undefined,
    config: NordlysChatConfig
  ) {
    this.modelId = modelId;
    this.config = config;
    this.settings = settings;
  }

  readonly supportedUrls: Record<string, RegExp[]> = {
    'application/pdf': [/^https:\/\/.*$/],
  };

  get provider(): string {
    return this.config.provider;
  }

  /**
   * Merges reasoning configuration from model settings and call options.
   * Call-level options take precedence over model-level settings.
   */
  private mergeReasoningOptions(
    modelReasoning?: {
      effort?: string;
      summary?: 'auto' | 'concise' | 'detailed';
    },
    callReasoning?: {
      effort?: string;
      summary?: 'auto' | 'concise' | 'detailed';
    }
  ):
    | {
        effort?: string;
        summary?: 'auto' | 'concise' | 'detailed';
      }
    | undefined {
    if (!modelReasoning && !callReasoning) {
      return undefined;
    }

    return {
      ...(modelReasoning || {}),
      ...(callReasoning || {}),
    };
  }

  /**
   * Builds the reasoning configuration object for the API request.
   * Only includes properties that are actually set.
   */
  private buildReasoningConfig(reasoning?: {
    effort?: string;
    summary?: 'auto' | 'concise' | 'detailed';
  }):
    | { effort?: string; summary?: 'auto' | 'concise' | 'detailed' }
    | undefined {
    if (!reasoning) {
      return undefined;
    }

    const hasEffort = Boolean(reasoning.effort);
    const hasSummary = Boolean(reasoning.summary);

    if (!hasEffort && !hasSummary) {
      return undefined;
    }

    const result: {
      effort?: string;
      summary?: 'auto' | 'concise' | 'detailed';
    } = {};

    if (hasEffort && reasoning.effort) {
      result.effort = reasoning.effort;
    }

    if (hasSummary && reasoning.summary) {
      result.summary = reasoning.summary;
    }

    return result;
  }

  /**
   * Prepares arguments for API requests by merging model settings with call options.
   */
  private async getArgs({
    maxOutputTokens,
    temperature,
    topP,
    prompt,
    providerOptions,
    tools,
    toolChoice,
  }: LanguageModelV3CallOptions): Promise<{
    args: NordlysResponseRequest;
    warnings: SharedV3Warning[];
    store: boolean;
  }> {
    const warnings: SharedV3Warning[] = [];

    // Merge model-level settings with call-level options
    const mergedReasoning = this.mergeReasoningOptions(
      this.settings?.providerOptions?.reasoning,
      providerOptions?.reasoning
    );

    const mergedProviderOptions = {
      ...(this.settings?.providerOptions || {}),
      ...(providerOptions || {}),
      ...(mergedReasoning ? { reasoning: mergedReasoning } : {}),
    };

    const nordlysOptions = await parseProviderOptions({
      provider: 'nordlys',
      providerOptions: mergedProviderOptions,
      schema: nordlysProviderOptions,
    });

    // Ensure nordlysOptions exists and restore reasoning if it was stripped by parseProviderOptions
    const finalNordlysOptions = nordlysOptions || {};
    if (mergedReasoning && !finalNordlysOptions.reasoning) {
      finalNordlysOptions.reasoning = mergedReasoning;
    }

    const {
      input,
      instructions,
      warnings: inputWarnings,
    } = convertToNordlysResponseInput({ prompt });

    warnings.push(...inputWarnings);

    const {
      tools: nordlysTools,
      toolChoice: nordlysToolChoice,
      toolWarnings,
    } = prepareTools({
      tools,
      toolChoice,
    });

    warnings.push(...toolWarnings);

    const args: NordlysResponseRequest = {
      input,
      model: this.modelId,
      instructions,
      max_output_tokens: maxOutputTokens,
      temperature,
      top_p: topP,
      tools: nordlysTools,
      tool_choice: nordlysToolChoice,
      ...(finalNordlysOptions.user && { user: finalNordlysOptions.user }),
      ...(finalNordlysOptions.metadata && {
        metadata: finalNordlysOptions.metadata,
      }),
      ...(finalNordlysOptions.parallel_tool_calls !== undefined && {
        parallel_tool_calls: finalNordlysOptions.parallel_tool_calls,
      }),
      ...(() => {
        const reasoningConfig = this.buildReasoningConfig(
          finalNordlysOptions.reasoning
        );
        return reasoningConfig ? { reasoning: reasoningConfig } : {};
      })(),
      ...(finalNordlysOptions.service_tier && {
        service_tier: finalNordlysOptions.service_tier,
      }),
      ...(finalNordlysOptions.store !== undefined && {
        store: finalNordlysOptions.store,
      }),
      ...(finalNordlysOptions.max_tool_calls !== undefined && {
        max_tool_calls: finalNordlysOptions.max_tool_calls,
      }),
    };

    const store = finalNordlysOptions.store ?? true;

    return {
      args,
      warnings,
      store,
    };
  }

  /**
   * Generates a completion for the given prompt.
   * @param options - Call options including prompt, temperature, max tokens, etc.
   * @returns Promise resolving to the generation result with content, usage, and metadata
   */
  async doGenerate(
    options: LanguageModelV3CallOptions
  ): Promise<LanguageModelV3GenerateResult> {
    const { args: body, warnings } = await this.getArgs(options);

    const {
      responseHeaders,
      value: response,
      rawValue: rawResponse,
    } = await postJsonToApi({
      url: `${this.config.baseURL}/responses`,
      headers: combineHeaders(this.config.headers(), options.headers),
      body,
      failedResponseHandler: nordlysFailedResponseHandler,
      successfulResponseHandler: createJsonResponseHandler(
        nordlysResponseSchema
      ),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch,
    });

    if (response.error) {
      throw new APICallError({
        message: response.error.message,
        url: `${this.config.baseURL}/responses`,
        requestBodyValues: body,
        statusCode: 400,
        responseHeaders,
        responseBody: rawResponse as string,
        isRetryable: false,
      });
    }

    if (!response.output) {
      throw new APICallError({
        message: 'Response missing output',
        url: `${this.config.baseURL}/responses`,
        requestBodyValues: body,
        statusCode: 400,
        responseHeaders,
        responseBody: rawResponse as string,
        isRetryable: false,
      });
    }

    const content: Array<LanguageModelV3Content> = [];

    // flag that checks if there have been client-side tool calls (not executed by provider)
    let hasFunctionCall = false;

    // map response content to content array (defined when there is no error)
    // Type assertion is safe here because we validate the response schema
    for (const part of response.output as Array<
      | {
          type: 'reasoning';
          id: string;
          summary: Array<{ text: string; type: string }>;
          encrypted_content?: string | null;
        }
      | {
          type: 'message';
          id: string;
          content: Array<{ text: string; type: string }>;
        }
      | { type: 'function_call'; id: string; name: string; arguments: string }
    >) {
      switch (part.type) {
        case 'reasoning': {
          // When there are no summary parts, add an empty reasoning part to ensure
          // at least one reasoning content item is present
          if (part.summary.length === 0) {
            part.summary.push({ type: 'summary_text', text: '' });
          }

          for (const summary of part.summary) {
            content.push({
              type: 'reasoning' as const,
              text: summary.text,
              providerMetadata: {
                nordlys: {
                  itemId: part.id,
                  reasoningEncryptedContent: part.encrypted_content ?? null,
                },
              },
            });
          }
          break;
        }

        case 'message': {
          for (const contentPart of part.content) {
            const providerMetadata: SharedV3ProviderMetadata[string] = {
              itemId: part.id,
            };

            content.push({
              type: 'text',
              text: contentPart.text,
              providerMetadata: {
                nordlys: providerMetadata,
              },
            });
          }

          break;
        }

        case 'function_call': {
          hasFunctionCall = true;

          content.push({
            type: 'tool-call',
            toolCallId: part.id,
            toolName: part.name,
            input: part.arguments,
            providerMetadata: {
              nordlys: {
                itemId: part.id,
              },
            },
          });
          break;
        }
      }
    }

    const providerMetadata: SharedV3ProviderMetadata = {
      nordlys: { responseId: response.id },
    };

    if (typeof response.service_tier === 'string') {
      providerMetadata.nordlys.serviceTier = response.service_tier;
    }

    if (!response.usage) {
      throw new APICallError({
        message: 'Response missing usage',
        url: `${this.config.baseURL}/responses`,
        requestBodyValues: body,
        statusCode: 400,
        responseHeaders,
        responseBody: rawResponse as string,
        isRetryable: false,
      });
    }

    const usage = response.usage;

    return {
      content,
      finishReason: {
        unified: mapNordlysFinishReason({
          finishReason:
            response.status === RESPONSE_STATUS.INCOMPLETE
              ? 'max_output_tokens'
              : null,
          hasFunctionCall,
        }),
        raw:
          response.status === RESPONSE_STATUS.INCOMPLETE
            ? 'max_output_tokens'
            : undefined,
      },
      usage: convertNordlysResponsesUsage(usage),
      request: { body },
      response: {
        id: response.id,
        timestamp: new Date((response.created_at ?? Date.now() / 1000) * 1000),
        modelId: response.model,
        headers: responseHeaders,
        body: rawResponse,
      },
      providerMetadata,
      warnings,
    };
  }

  /**
   * Streams a completion for the given prompt.
   * @param options - Call options including prompt, temperature, max tokens, etc.
   * @returns Promise resolving to a stream result with a readable stream of content parts
   */
  async doStream(
    options: LanguageModelV3CallOptions
  ): Promise<LanguageModelV3StreamResult> {
    const { args: body, warnings, store } = await this.getArgs(options);

    const { responseHeaders, value: response } = await postJsonToApi({
      url: `${this.config.baseURL}/responses`,
      headers: combineHeaders(this.config.headers(), options.headers),
      body: {
        ...body,
        stream: true,
        stream_options: { include_usage: true },
      },
      failedResponseHandler: nordlysFailedResponseHandler,
      successfulResponseHandler: createEventSourceResponseHandler(
        nordlysResponseStreamEventSchema
      ),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch,
    });

    const providerKey = 'nordlys';

    let finishReason: LanguageModelV3FinishReason = {
      unified: 'other',
      raw: undefined,
    };
    let usage: NordlysResponsesUsage | undefined;
    let responseId: string | null = null;

    const ongoingToolCalls: Record<
      number,
      | {
          toolName: string;
          toolCallId: string;
        }
      | undefined
    > = {};

    // Track item types by item_id to handle output_item.done events
    const itemTypes: Record<string, NordlysResponseOutputItemUnion['type']> =
      {};

    // flag that checks if there have been client-side tool calls (not executed by provider)
    let hasFunctionCall = false;

    const activeReasoning: Record<
      string,
      {
        encryptedContent?: string | null;
        // summary index as string to reasoning part state:
        summaryParts: Record<string, 'active' | 'can-conclude' | 'concluded'>;
      }
    > = {};

    let serviceTier: string | undefined;

    const streamParseState = createStreamState();

    return {
      stream: response.pipeThrough(
        new TransformStream<
          ParseResult<NordlysResponseStreamEventUnion>,
          LanguageModelV3StreamPart
        >({
          start(controller) {
            controller.enqueue({ type: 'stream-start', warnings });
          },

          transform(chunk, controller) {
            if (options.includeRawChunks) {
              controller.enqueue({ type: 'raw', rawValue: chunk.rawValue });
            }

            // handle failed chunk parsing / validation:
            if (!chunk.success) {
              finishReason = { unified: 'error', raw: undefined };
              controller.enqueue({ type: 'error', error: chunk.error });
              return;
            }

            const value = chunk.value;

            if (isResponseOutputItemAddedChunk(value)) {
              // Track item type for later use in output_item.done
              itemTypes[value.item.id] = value.item.type;

              if (value.item.type === 'function_call') {
                ongoingToolCalls[value.output_index] = {
                  toolName: value.item.name,
                  toolCallId: value.item.id,
                };

                controller.enqueue({
                  type: 'tool-input-start',
                  id: value.item.id,
                  toolName: value.item.name,
                });
              } else if (value.item.type === 'message') {
                const result = handleOutputItemAdded(value, streamParseState);
                if (result.shouldEmitTextStart && result.textItemId) {
                  controller.enqueue({
                    type: 'text-start',
                    id: result.textItemId,
                    providerMetadata: {
                      [providerKey]: {
                        itemId: value.item.id,
                      },
                    },
                  });
                }
              } else if (value.item.type === 'reasoning') {
                activeReasoning[value.item.id] = {
                  encryptedContent: value.item.encrypted_content,
                  summaryParts: { 0: 'active' },
                };

                const result = handleOutputItemAdded(value, streamParseState);
                if (result.shouldEmitReasoningStart && result.reasoningItemId) {
                  controller.enqueue({
                    type: 'reasoning-start',
                    id: `${value.item.id}:0`,
                    providerMetadata: {
                      [providerKey]: {
                        itemId: value.item.id,
                        reasoningEncryptedContent:
                          value.item.encrypted_content ?? null,
                      },
                    },
                  });
                }
              }
            } else if (isResponseOutputItemDoneChunk(value)) {
              const itemId = value.item.id;

              // Track item type from item object if we haven't tracked it yet
              if (!itemTypes[itemId]) {
                itemTypes[itemId] = value.item
                  .type as NordlysResponseOutputItemUnion['type'];
              }

              const itemType = itemTypes[itemId];

              if (itemType === 'message') {
                controller.enqueue({
                  type: 'text-end',
                  id: itemId,
                  providerMetadata: {
                    [providerKey]: {
                      itemId: itemId,
                    },
                  },
                });
                // Remove from activeTextItems to prevent duplicate text-end in flush
                streamParseState.activeTextItems.delete(itemId);
              } else if (itemType === 'reasoning') {
                const activeReasoningPart = activeReasoning[itemId];

                if (activeReasoningPart) {
                  // get all active or can-conclude summary parts' ids
                  const summaryPartIndices = Object.entries(
                    activeReasoningPart.summaryParts
                  )
                    .filter(
                      ([_, status]) =>
                        status === 'active' || status === 'can-conclude'
                    )
                    .map(([summaryIndex]) => summaryIndex);

                  for (const summaryIndex of summaryPartIndices) {
                    controller.enqueue({
                      type: 'reasoning-end',
                      id: `${itemId}:${summaryIndex}`,
                      providerMetadata: {
                        [providerKey]: {
                          itemId: itemId,
                        },
                      },
                    });
                  }

                  delete activeReasoning[itemId];
                }
              }
              // function_call items are handled via function_call_arguments.done
            } else if (isResponseFunctionCallArgumentsDeltaChunk(value)) {
              const { delta, toolCallId } = handleFunctionCallArgumentsDelta(
                value,
                streamParseState
              );
              controller.enqueue({
                type: 'tool-input-delta',
                id: toolCallId,
                delta,
              });

              // Check if tool call is complete
              if (isToolCallComplete(toolCallId, streamParseState)) {
                controller.enqueue({
                  type: 'tool-input-end',
                  id: toolCallId,
                });
                // Remove from activeToolCalls to prevent duplicate tool-input-end in flush
                streamParseState.activeToolCalls.delete(toolCallId);

                const toolCall = getCompletedToolCall(
                  toolCallId,
                  streamParseState
                );
                if (toolCall) {
                  hasFunctionCall = true;
                  controller.enqueue({
                    type: 'tool-call',
                    toolCallId: toolCall.toolCallId,
                    toolName: toolCall.toolName,
                    input: toolCall.input,
                  });
                }
              }
            } else if (isResponseCreatedChunk(value)) {
              responseId = value.response.id;
              controller.enqueue({
                type: 'response-metadata',
                id: value.response.id,
                timestamp: new Date(value.response.created_at * 1000),
                modelId: value.response.model,
              });
            } else if (isTextDeltaChunk(value)) {
              const { delta, itemId } = handleTextDelta(
                value,
                streamParseState
              );
              controller.enqueue({
                type: 'text-delta',
                id: itemId,
                delta,
              });
            } else if (value.type === 'response.output_text.done') {
              // This event signals completion of output text with full text content.
              // The streaming was already handled by delta events, so we don't need to emit
              // any AI SDK events here. We just ensure the event is properly parsed.
            } else if (value.type === 'response.reasoning_text.delta') {
              const { delta, itemId } = handleReasoningDelta(
                value,
                streamParseState
              );
              controller.enqueue({
                type: 'reasoning-delta',
                id: itemId,
                delta,
              });
            } else if (value.type === 'response.reasoning_summary_part.added') {
              // the first reasoning start is pushed in isResponseOutputItemAddedReasoningChunk
              if (value.summary_index > 0) {
                const activeReasoningPart = activeReasoning[value.item_id];
                if (activeReasoningPart) {
                  activeReasoningPart.summaryParts[value.summary_index] =
                    'active';

                  // since there is a new active summary part, we can conclude all can-conclude summary parts
                  for (const summaryIndex of Object.keys(
                    activeReasoningPart.summaryParts
                  )) {
                    if (
                      activeReasoningPart.summaryParts[summaryIndex] ===
                      'can-conclude'
                    ) {
                      controller.enqueue({
                        type: 'reasoning-end',
                        id: `${value.item_id}:${summaryIndex}`,
                        providerMetadata: {
                          [providerKey]: { itemId: value.item_id },
                        },
                      });
                      activeReasoningPart.summaryParts[summaryIndex] =
                        'concluded';
                    }
                  }

                  controller.enqueue({
                    type: 'reasoning-start',
                    id: `${value.item_id}:${value.summary_index}`,
                    providerMetadata: {
                      [providerKey]: {
                        itemId: value.item_id,
                        reasoningEncryptedContent:
                          activeReasoning[value.item_id]?.encryptedContent ??
                          null,
                      },
                    },
                  });
                }
              }
            } else if (value.type === 'response.reasoning_summary_text.delta') {
              controller.enqueue({
                type: 'reasoning-delta',
                id: `${value.item_id}:${value.summary_index}`,
                delta: value.delta,
                providerMetadata: {
                  [providerKey]: {
                    itemId: value.item_id,
                  },
                },
              });
            } else if (value.type === 'response.reasoning_summary_text.done') {
              // This event signals completion of reasoning summary text with full text content.
              // The streaming was already handled by delta events, so we don't need to emit
              // any AI SDK events here. We just ensure the event is properly parsed.
            } else if (value.type === 'response.reasoning_summary_part.done') {
              // when Nordlys stores the message data, we can immediately conclude the reasoning part
              // since we do not need to send the encrypted content.
              const activeReasoningPart = activeReasoning[value.item_id];
              if (activeReasoningPart) {
                if (store) {
                  controller.enqueue({
                    type: 'reasoning-end',
                    id: `${value.item_id}:${value.summary_index}`,
                    providerMetadata: {
                      [providerKey]: { itemId: value.item_id },
                    },
                  });

                  // mark the summary part as concluded
                  activeReasoningPart.summaryParts[value.summary_index] =
                    'concluded';
                } else {
                  // mark the summary part as can-conclude only
                  // because we need to have a final summary part with the encrypted content
                  activeReasoningPart.summaryParts[value.summary_index] =
                    'can-conclude';
                }
              }
            } else if (isResponseFinishedChunk(value)) {
              finishReason = {
                unified: mapNordlysFinishReason({
                  finishReason:
                    value.response.status === RESPONSE_STATUS.INCOMPLETE
                      ? 'max_output_tokens'
                      : null,
                  hasFunctionCall,
                }),
                raw:
                  value.response.status === RESPONSE_STATUS.INCOMPLETE
                    ? 'max_output_tokens'
                    : undefined,
              };
              if (value.response.usage) {
                usage = {
                  input_tokens: value.response.usage.input_tokens,
                  output_tokens: value.response.usage.output_tokens,
                  input_tokens_details:
                    value.response.usage.input_tokens_details,
                  output_tokens_details:
                    value.response.usage.output_tokens_details,
                };
              }
              if (typeof value.response.service_tier === 'string') {
                serviceTier = value.response.service_tier;
              }
            } else if (value.type === 'response.content_part.added') {
              const result = handleContentPartAdded(value, streamParseState);

              // Only emit text-delta for content parts
              // text-start should have already been emitted by output_item.added
              if (
                result.shouldEmitTextDelta &&
                result.textDelta &&
                result.itemId
              ) {
                controller.enqueue({
                  type: 'text-delta',
                  id: result.itemId,
                  delta: result.textDelta,
                });
              }

              if (
                result.shouldEmitReasoningDelta &&
                result.reasoningDelta &&
                result.reasoningItemId
              ) {
                controller.enqueue({
                  type: 'reasoning-delta',
                  id: result.reasoningItemId,
                  delta: result.reasoningDelta,
                });
              }
            } else if (value.type === 'response.content_part.done') {
              const result = handleContentPartDone(value, streamParseState);

              // Only handle buffer updates and delta handling
              // text-end should be emitted by output_item.done
              if (result.shouldEmitReasoningEnd && result.reasoningItemId) {
                streamParseState.activeReasoningItems.delete(
                  result.reasoningItemId
                );
              }
            } else if (value.type === 'response.function_call_arguments.done') {
              controller.enqueue({
                type: 'tool-input-end',
                id: value.item_id,
              });
              // Remove from activeToolCalls to prevent duplicate tool-input-end in flush
              streamParseState.activeToolCalls.delete(value.item_id);

              const toolCall = getCompletedToolCall(
                value.item_id,
                streamParseState
              );
              if (toolCall) {
                hasFunctionCall = true;
                controller.enqueue({
                  type: 'tool-call',
                  toolCallId: toolCall.toolCallId,
                  toolName: toolCall.toolName,
                  input: toolCall.input,
                });
              }
            } else if (isErrorChunk(value)) {
              finishReason = { unified: 'error', raw: undefined };
              controller.enqueue({
                type: 'error',
                error: new Error(value.error.message),
              });
              return;
            }
          },

          flush(controller) {
            // Ensure providerMetadata structure is always valid
            // Always include responseId (even if null) to match expected structure
            const providerMetadata: SharedV3ProviderMetadata = {
              [providerKey]: {
                responseId,
              },
            };

            // Only set serviceTier if the metadata object exists and is valid
            // Add defensive check to prevent accessing properties on undefined
            if (serviceTier !== undefined && providerMetadata[providerKey]) {
              providerMetadata[providerKey].serviceTier = serviceTier;
            }

            controller.enqueue({
              type: 'finish',
              finishReason,
              usage: convertNordlysResponsesUsage(usage),
              providerMetadata,
            });
          },
        })
      ),
      request: { body },
      response: { headers: responseHeaders },
    };
  }
}

function isTextDeltaChunk(
  chunk: NordlysResponseStreamEventUnion
): chunk is NordlysResponseStreamEventUnion & {
  type: 'response.output_text.delta';
} {
  return chunk.type === 'response.output_text.delta';
}

function isResponseOutputItemDoneChunk(
  chunk: NordlysResponseStreamEventUnion
): chunk is NordlysResponseOutputItemDoneEvent {
  return chunk.type === 'response.output_item.done';
}

function isResponseFinishedChunk(
  chunk: NordlysResponseStreamEventUnion
): chunk is NordlysResponseStreamEventUnion & {
  type: 'response.completed';
  response: {
    usage?: NordlysResponsesUsage;
    service_tier?: string;
    status: string;
  };
} {
  return chunk.type === 'response.completed';
}

function isResponseCreatedChunk(
  chunk: NordlysResponseStreamEventUnion
): chunk is NordlysResponseStreamEventUnion & { type: 'response.created' } {
  return chunk.type === 'response.created';
}

function isResponseFunctionCallArgumentsDeltaChunk(
  chunk: NordlysResponseStreamEventUnion
): chunk is NordlysResponseStreamEventUnion & {
  type: 'response.function_call_arguments.delta';
} {
  return chunk.type === 'response.function_call_arguments.delta';
}

function isResponseOutputItemAddedChunk(
  chunk: NordlysResponseStreamEventUnion
): chunk is NordlysResponseStreamEventUnion & {
  type: 'response.output_item.added';
} {
  return chunk.type === 'response.output_item.added';
}

function isErrorChunk(
  chunk: NordlysResponseStreamEventUnion
): chunk is NordlysResponseStreamEventUnion & { type: 'response.error' } {
  return chunk.type === 'response.error';
}
