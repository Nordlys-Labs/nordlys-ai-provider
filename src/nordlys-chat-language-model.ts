import type {
  LanguageModelV3,
  LanguageModelV3FinishReason,
  LanguageModelV3Usage,
  SharedV3Warning,
} from '@ai-sdk/provider';
import type { FetchFunction } from '@ai-sdk/provider-utils';
import {
  combineHeaders,
  createEventSourceResponseHandler,
  createJsonResponseHandler,
  postJsonToApi,
} from '@ai-sdk/provider-utils';
import { z } from 'zod';
import { convertToNordlysResponseInput } from './convert-to-nordlys-response-input';
import { getResponseMetadata } from './get-response-metadata';
import { mapNordlysFinishReason } from './map-nordlys-finish-reason';
import {
  type NordlysChatSettings,
  nordlysProviderOptions,
} from './nordlys-chat-options';
import { nordlysFailedResponseHandler } from './nordlys-error';
import { prepareTools } from './nordlys-prepare-tools';
import type { NordlysResponseStreamEventUnion } from './nordlys-responses-types';
import type { NordlysResponseRequest } from './nordlys-types';
import { parseNordlysResponse } from './parse-nordlys-response';
import {
  createStreamState,
  extractResponseMetadata,
  extractUsageFromCompleted,
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

// Zod schema for Responses API response
const nordlysResponseSchema = z.object({
  id: z.string(),
  model: z.string(),
  created_at: z.number(),
  status: z.enum([
    'completed',
    'incomplete',
    'failed',
    'cancelled',
    'queued',
    'in_progress',
  ]),
  output: z.array(
    z.union([
      z.object({
        type: z.literal('message'),
        id: z.string(),
        role: z.literal('assistant'),
        status: z.enum(['in_progress', 'completed', 'incomplete']),
        content: z.array(
          z.union([
            z.object({
              type: z.literal('output_text'),
              text: z.string(),
            }),
            z.object({
              type: z.literal('refusal'),
              text: z.string(),
            }),
          ])
        ),
        created_at: z.number().optional(),
      }),
      z.object({
        type: z.literal('reasoning'),
        id: z.string(),
        summary: z.array(
          z.object({
            text: z.string(),
            type: z.string(),
          })
        ),
        content: z
          .array(
            z.object({
              text: z.string(),
              type: z.string(),
            })
          )
          .optional(),
        encrypted_content: z.string().nullable().optional(),
        status: z.enum(['in_progress', 'completed', 'incomplete']).optional(),
      }),
      z.object({
        type: z.literal('function_call'),
        id: z.string(),
        name: z.string(),
        arguments: z.string(),
        status: z.enum(['in_progress', 'completed', 'incomplete']),
      }),
      z.object({
        type: z.literal('file_search'),
        id: z.string(),
        status: z.enum(['in_progress', 'completed', 'incomplete']),
      }),
      z.object({
        type: z.literal('web_search'),
        id: z.string(),
        status: z.enum(['in_progress', 'completed', 'incomplete']),
      }),
    ])
  ),
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
      param: z.any().nullish(),
      code: z.any().nullish(),
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
    item: z.union([
      z.object({
        type: z.literal('message'),
        id: z.string(),
        role: z.literal('assistant'),
        status: z.enum(['in_progress', 'completed', 'incomplete']),
        content: z.array(
          z.union([
            z.object({
              type: z.literal('output_text'),
              text: z.string(),
            }),
            z.object({
              type: z.literal('refusal'),
              text: z.string(),
            }),
          ])
        ),
      }),
      z.object({
        type: z.literal('reasoning'),
        id: z.string(),
        summary: z.array(
          z.object({
            text: z.string(),
            type: z.string(),
          })
        ),
        content: z
          .array(
            z.object({
              text: z.string(),
              type: z.string(),
            })
          )
          .optional(),
        encrypted_content: z.string().nullable().optional(),
        status: z.enum(['in_progress', 'completed', 'incomplete']).optional(),
      }),
      z.object({
        type: z.literal('function_call'),
        id: z.string(),
        name: z.string(),
        arguments: z.string().optional(),
        status: z.enum(['in_progress', 'completed', 'incomplete']),
      }),
    ]),
    output_index: z.number(),
  }),
  z.object({
    type: z.literal('response.output_item.done'),
    item_id: z.string(),
    output_index: z.number(),
  }),
  z.object({
    type: z.literal('response.output_text.delta'),
    delta: z.string(),
    item_id: z.string(),
    output_index: z.number(),
    content_index: z.number(),
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
        annotations: z.array(z.any()).optional(),
        logprobs: z.array(z.any()).optional(),
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
        annotations: z.array(z.any()).optional(),
        logprobs: z.array(z.any()).optional(),
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
    type: z.literal('response.completed'),
    response: nordlysResponseSchema,
  }),
  z.object({
    type: z.literal('response.error'),
    error: z.object({
      message: z.string(),
      type: z.string(),
      param: z.any().nullish(),
      code: z.any().nullish(),
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

  get provider(): string {
    return this.config.provider;
  }

  readonly supportedUrls: Record<string, RegExp[]> = {
    'application/pdf': [/^https:\/\/.*$/],
  };

  private async getArgs({
    prompt,
    maxOutputTokens,
    temperature,
    topP,
    topK,
    frequencyPenalty,
    presencePenalty,
    stopSequences,
    responseFormat,
    providerOptions,
    tools,
    toolChoice,
  }: Parameters<LanguageModelV3['doGenerate']>[0]) {
    const warnings: SharedV3Warning[] = [];

    // Merge model-level settings with call-level options (call-level takes precedence)
    const mergedMaxOutputTokens =
      maxOutputTokens ?? this.settings?.maxOutputTokens;
    const mergedTemperature = temperature ?? this.settings?.temperature;
    const mergedTopP = topP ?? this.settings?.topP;
    const mergedTopK = topK ?? this.settings?.topK;
    const mergedFrequencyPenalty =
      frequencyPenalty ?? this.settings?.frequencyPenalty;
    const mergedPresencePenalty =
      presencePenalty ?? this.settings?.presencePenalty;
    const mergedStopSequences = stopSequences ?? this.settings?.stopSequences;
    const mergedProviderOptions = {
      ...this.settings?.providerOptions,
      ...providerOptions,
    };

    // Warn for unsupported settings
    if (mergedTopK != null) {
      warnings.push({ type: 'unsupported', feature: 'topK' });
    }
    if (responseFormat != null) {
      warnings.push({ type: 'unsupported', feature: 'responseFormat' });
    }

    // Parse provider options with zod schema (flat, not nested)
    const result = nordlysProviderOptions.safeParse(
      mergedProviderOptions ?? {}
    );
    const nordlysOptions = result.success ? result.data : {};

    // Prepare tools
    const {
      tools: nordlysTools,
      toolChoice: nordlysToolChoice,
      toolWarnings,
    } = prepareTools({
      tools,
      toolChoice,
    });
    warnings.push(...toolWarnings);

    // Convert prompt to Responses API input format
    const {
      input,
      instructions,
      warnings: inputWarnings,
    } = convertToNordlysResponseInput({ prompt });
    warnings.push(...inputWarnings);

    // Build request with Responses API structure
    const args: NordlysResponseRequest = {
      input,
      model: this.modelId,
      instructions,
      max_output_tokens:
        typeof mergedMaxOutputTokens === 'number'
          ? mergedMaxOutputTokens
          : undefined,
      max_completion_tokens: nordlysOptions.max_completion_tokens,
      temperature: mergedTemperature,
      top_p: mergedTopP,
      stop: mergedStopSequences,
      presence_penalty: mergedPresencePenalty,
      frequency_penalty: mergedFrequencyPenalty,
      user: nordlysOptions.user,
      tools: nordlysTools,
      tool_choice: nordlysToolChoice,
      ...(nordlysOptions.logit_bias
        ? { logit_bias: nordlysOptions.logit_bias }
        : {}),
      ...(nordlysOptions.audio ? { audio: nordlysOptions.audio } : {}),
      ...(nordlysOptions.logprobs !== undefined
        ? { logprobs: nordlysOptions.logprobs }
        : {}),
      ...(nordlysOptions.metadata ? { metadata: nordlysOptions.metadata } : {}),
      ...(nordlysOptions.modalities
        ? { modalities: nordlysOptions.modalities }
        : {}),
      ...(nordlysOptions.parallel_tool_calls !== undefined
        ? { parallel_tool_calls: nordlysOptions.parallel_tool_calls }
        : {}),
      ...(nordlysOptions.prediction
        ? { prediction: nordlysOptions.prediction }
        : {}),
      ...(nordlysOptions.reasoning
        ? {
            reasoning: {
              ...(nordlysOptions.reasoning.effort
                ? { effort: nordlysOptions.reasoning.effort }
                : {}),
              ...(nordlysOptions.reasoning.summary
                ? { summary: nordlysOptions.reasoning.summary }
                : {}),
            },
          }
        : {}),
      ...(nordlysOptions.response_format
        ? { response_format: nordlysOptions.response_format }
        : {}),
      ...(nordlysOptions.seed !== undefined
        ? { seed: nordlysOptions.seed }
        : {}),
      ...(nordlysOptions.service_tier
        ? { service_tier: nordlysOptions.service_tier }
        : {}),
      ...(nordlysOptions.store !== undefined
        ? { store: nordlysOptions.store }
        : {}),
      ...(nordlysOptions.top_logprobs !== undefined
        ? { top_logprobs: nordlysOptions.top_logprobs }
        : {}),
      ...(nordlysOptions.web_search_options
        ? { web_search_options: nordlysOptions.web_search_options }
        : {}),
      ...(nordlysOptions.max_tool_calls !== undefined
        ? { max_tool_calls: nordlysOptions.max_tool_calls }
        : {}),
      ...(nordlysOptions.strict_json_schema !== undefined
        ? { strict_json_schema: nordlysOptions.strict_json_schema }
        : {}),
      ...(nordlysOptions.text_verbosity
        ? { text_verbosity: nordlysOptions.text_verbosity }
        : {}),
      ...(nordlysOptions.include ? { include: nordlysOptions.include } : {}),
      ...(nordlysOptions.truncation
        ? { truncation: nordlysOptions.truncation }
        : {}),
    };

    return {
      args,
      warnings,
    };
  }

  async doGenerate(
    options: Parameters<LanguageModelV3['doGenerate']>[0]
  ): Promise<Awaited<ReturnType<LanguageModelV3['doGenerate']>>> {
    const { args: body, warnings } = await this.getArgs(options);

    const { responseHeaders, value, rawValue } = await postJsonToApi({
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

    if (!value) {
      throw new Error('Failed to parse Nordlys API response');
    }

    // Handle error responses
    if (value.error) {
      throw new Error(`Nordlys API Error: ${value.error.message}`);
    }

    // Parse response output to AI SDK content format
    const content = parseNordlysResponse(value);

    // Extract usage information
    const {
      input_tokens,
      output_tokens,
      input_tokens_details,
      output_tokens_details,
    } = value.usage ?? {};

    const cachedTokens = input_tokens_details?.cached_tokens;
    const reasoningTokens = output_tokens_details?.reasoning_tokens;

    return {
      content,
      finishReason: mapNordlysFinishReason(value.status),
      usage:
        value.usage && input_tokens != null
          ? {
              inputTokens: {
                total: input_tokens,
                noCache:
                  cachedTokens != null
                    ? input_tokens - cachedTokens
                    : undefined,
                cacheRead: cachedTokens,
                cacheWrite: undefined,
              },
              outputTokens: {
                total: output_tokens,
                text:
                  output_tokens != null && reasoningTokens != null
                    ? output_tokens - reasoningTokens
                    : undefined,
                reasoning: reasoningTokens,
              },
            }
          : {
              inputTokens: {
                total: 0,
                noCache: undefined,
                cacheRead: undefined,
                cacheWrite: undefined,
              },
              outputTokens: { total: 0, text: undefined, reasoning: undefined },
            },
      providerMetadata: value.provider
        ? {
            nordlys: {
              provider: value.provider,
              service_tier: value.service_tier,
              system_fingerprint: value.system_fingerprint,
            },
          }
        : undefined,
      request: { body },
      response: {
        id: value.id ?? '',
        modelId: value.model ?? '',
        timestamp: new Date((value.created_at ?? 0) * 1000),
        headers: responseHeaders,
        body: rawValue,
      },
      warnings,
    };
  }

  async doStream(
    options: Parameters<LanguageModelV3['doStream']>[0]
  ): Promise<Awaited<ReturnType<LanguageModelV3['doStream']>>> {
    const { args, warnings } = await this.getArgs(options);
    const body = {
      ...args,
      stream: true,
      stream_options: { include_usage: true },
    };

    const { responseHeaders, value: response } = await postJsonToApi({
      url: `${this.config.baseURL}/responses`,
      headers: combineHeaders(this.config.headers(), options.headers),
      body,
      failedResponseHandler: nordlysFailedResponseHandler,
      successfulResponseHandler: createEventSourceResponseHandler(
        nordlysResponseStreamEventSchema
      ),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch,
    });

    const streamParseState = createStreamState();
    const streamState: {
      finishReason: LanguageModelV3FinishReason;
      usage: LanguageModelV3Usage;
      isFirstChunk: boolean;
      provider: string | undefined;
      serviceTier: string | undefined;
      systemFingerprint: string | undefined;
    } = {
      finishReason: { unified: 'other', raw: undefined },
      usage: {
        inputTokens: {
          total: undefined,
          noCache: undefined,
          cacheRead: undefined,
          cacheWrite: undefined,
        },
        outputTokens: {
          total: undefined,
          text: undefined,
          reasoning: undefined,
        },
      },
      isFirstChunk: true,
      provider: undefined,
      serviceTier: undefined,
      systemFingerprint: undefined,
    };

    return {
      stream: response.pipeThrough(
        new TransformStream({
          start(controller) {
            controller.enqueue({ type: 'stream-start', warnings });
          },
          async transform(chunk, controller) {
            // Handle failed chunk parsing / validation
            if (!chunk.success) {
              streamState.finishReason = { unified: 'error', raw: undefined };
              controller.enqueue({ type: 'error', error: chunk.error });
              return;
            }

            const event = chunk.value as NordlysResponseStreamEventUnion;

            // Handle error events
            if (event.type === 'response.error') {
              streamState.finishReason = { unified: 'error', raw: undefined };
              controller.enqueue({
                type: 'error',
                error: new Error(event.error.message),
              });
              return;
            }

            // Handle response.created event
            if (event.type === 'response.created') {
              if (streamState.isFirstChunk) {
                streamState.isFirstChunk = false;
                const metadata = extractResponseMetadata(event);
                controller.enqueue({
                  type: 'response-metadata',
                  ...getResponseMetadata({
                    id: metadata.id,
                    model: metadata.model,
                    created: metadata.created,
                  }),
                });
              }
            }

            // Handle response.completed event
            if (event.type === 'response.completed') {
              const usage = extractUsageFromCompleted(event);
              streamState.usage = {
                inputTokens: {
                  total: usage.inputTokens.total,
                  noCache: usage.inputTokens.noCache,
                  cacheRead: usage.inputTokens.cacheRead,
                  cacheWrite: undefined,
                },
                outputTokens: {
                  total: usage.outputTokens.total,
                  text: usage.outputTokens.text,
                  reasoning: usage.outputTokens.reasoning,
                },
              };
              streamState.finishReason = mapNordlysFinishReason(
                event.response.status
              );
              if (event.response.provider) {
                streamState.provider = event.response.provider;
              }
              if (event.response.service_tier) {
                streamState.serviceTier = event.response.service_tier;
              }
              if (event.response.system_fingerprint) {
                streamState.systemFingerprint =
                  event.response.system_fingerprint;
              }
            }

            // Handle response.output_item.added event
            if (event.type === 'response.output_item.added') {
              const result = handleOutputItemAdded(event, streamParseState);
              if (result.shouldEmitTextStart && result.textItemId) {
                controller.enqueue({
                  type: 'text-start',
                  id: result.textItemId,
                });
              }
              if (result.shouldEmitReasoningStart && result.reasoningItemId) {
                controller.enqueue({
                  type: 'reasoning-delta',
                  id: result.reasoningItemId,
                  delta: '', // Initial empty delta for start
                });
              }
              if (
                result.shouldEmitToolInputStart &&
                result.toolCallId &&
                result.toolName
              ) {
                controller.enqueue({
                  type: 'tool-input-start',
                  id: result.toolCallId,
                  toolName: result.toolName,
                });
              }
            }

            // Handle response.output_text.delta event
            if (event.type === 'response.output_text.delta') {
              const { delta, itemId } = handleTextDelta(
                event,
                streamParseState
              );
              controller.enqueue({
                type: 'text-delta',
                id: itemId,
                delta,
              });
            }

            // Handle response.reasoning_text.delta event
            if (event.type === 'response.reasoning_text.delta') {
              const { delta, itemId } = handleReasoningDelta(
                event,
                streamParseState
              );
              controller.enqueue({
                type: 'reasoning-delta',
                id: itemId,
                delta,
              });
            }

            // Handle response.function_call_arguments.delta event
            if (event.type === 'response.function_call_arguments.delta') {
              const { delta, toolCallId } = handleFunctionCallArgumentsDelta(
                event,
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

                const toolCall = getCompletedToolCall(
                  toolCallId,
                  streamParseState
                );
                if (toolCall) {
                  controller.enqueue({
                    type: 'tool-call',
                    toolCallId: toolCall.toolCallId,
                    toolName: toolCall.toolName,
                    input: toolCall.input,
                  });
                }
              }
            }

            // Handle response.function_call_arguments.done event
            if (event.type === 'response.function_call_arguments.done') {
              controller.enqueue({
                type: 'tool-input-end',
                id: event.item_id,
              });

              const toolCall = getCompletedToolCall(
                event.item_id,
                streamParseState
              );
              if (toolCall) {
                controller.enqueue({
                  type: 'tool-call',
                  toolCallId: toolCall.toolCallId,
                  toolName: toolCall.toolName,
                  input: toolCall.input,
                });
              }
            }

            // Handle response.content_part.added event
            if (event.type === 'response.content_part.added') {
              const result = handleContentPartAdded(event, streamParseState);

              if (result.shouldEmitTextStart && result.itemId) {
                controller.enqueue({
                  type: 'text-start',
                  id: result.itemId,
                });
              }

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
                // Emit reasoning delta (no start event needed as it's already handled)
                controller.enqueue({
                  type: 'reasoning-delta',
                  id: result.reasoningItemId,
                  delta: result.reasoningDelta,
                });
              }
            }

            // Handle response.content_part.done event
            if (event.type === 'response.content_part.done') {
              const result = handleContentPartDone(event, streamParseState);

              if (result.shouldEmitTextEnd && result.itemId) {
                controller.enqueue({
                  type: 'text-end',
                  id: result.itemId,
                });
              }

              if (result.shouldEmitReasoningEnd && result.reasoningItemId) {
                // Note: AI SDK doesn't have a reasoning-end event, so we just
                // mark it as done in the state
                streamParseState.activeReasoningItems.delete(
                  result.reasoningItemId
                );
              }
            }
          },
          flush(controller) {
            // End any active text items
            for (const itemId of streamParseState.activeTextItems) {
              controller.enqueue({ type: 'text-end', id: itemId });
            }

            controller.enqueue({
              type: 'finish',
              finishReason: streamState.finishReason ?? {
                unified: 'stop',
                raw: undefined,
              },
              usage: streamState.usage ?? {
                inputTokens: {
                  total: 0,
                  noCache: undefined,
                  cacheRead: undefined,
                  cacheWrite: undefined,
                },
                outputTokens: {
                  total: 0,
                  text: undefined,
                  reasoning: undefined,
                },
              },
              providerMetadata:
                streamState.provider ||
                streamState.serviceTier ||
                streamState.systemFingerprint
                  ? {
                      nordlys: {
                        provider: streamState.provider,
                        service_tier: streamState.serviceTier,
                        system_fingerprint: streamState.systemFingerprint,
                      },
                    }
                  : undefined,
            });
          },
        })
      ),
      request: { body },
      response: {
        headers: responseHeaders,
      },
    };
  }
}
