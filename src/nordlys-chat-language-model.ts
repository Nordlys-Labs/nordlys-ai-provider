import {
  InvalidResponseDataError,
  type LanguageModelV3,
  type LanguageModelV3Content,
  type LanguageModelV3FinishReason,
  type LanguageModelV3Usage,
  type SharedV3Warning,
} from '@ai-sdk/provider';
import type { FetchFunction } from '@ai-sdk/provider-utils';
import {
  combineHeaders,
  createEventSourceResponseHandler,
  createJsonResponseHandler,
  generateId,
  isParsableJson,
  postJsonToApi,
} from '@ai-sdk/provider-utils';
import { z } from 'zod';
import { convertToNordlysChatMessages } from './convert-to-nordlys-chat-messages';
import { getResponseMetadata } from './get-response-metadata';
import { mapNordlysFinishReason } from './map-nordlys-finish-reason';
import {
  type NordlysChatSettings,
  nordlysProviderOptions,
} from './nordlys-chat-options';
import { nordlysFailedResponseHandler } from './nordlys-error';
import { prepareTools } from './nordlys-prepare-tools';
import type { NordlysChatCompletionRequest } from './nordlys-types';

interface NordlysChatConfig {
  provider: string;
  baseURL: string;
  headers: () => Record<string, string | undefined>;
  fetch?: FetchFunction;
  defaultProvider?: string;
}

const nordlysChatResponseSchema = z.object({
  id: z.string().nullish(),
  created: z.number().nullish(),
  model: z.string().nullish(),
  choices: z
    .array(
      z.object({
        message: z.object({
          role: z.enum(['assistant', '']).nullish(),
          content: z.string().nullish(),
          tool_calls: z
            .array(
              z.object({
                id: z.string().nullish(),
                type: z.literal('function'),
                function: z.object({
                  name: z.string(),
                  arguments: z.string(),
                }),
              })
            )
            .nullish(),
          reasoning_content: z.string().optional(),
          generated_files: z
            .array(
              z.object({
                media_type: z.string(),
                data: z.string(),
              })
            )
            .optional(),
        }),
        index: z.number(),
        logprobs: z
          .object({
            content: z
              .array(
                z.object({
                  token: z.string(),
                  logprob: z.number(),
                  top_logprobs: z.array(
                    z.object({
                      token: z.string(),
                      logprob: z.number(),
                    })
                  ),
                })
              )
              .nullish(),
          })
          .nullish(),
        finish_reason: z.string().nullish(),
      })
    )
    .optional(),
  usage: z
    .object({
      completion_tokens: z.number(),
      prompt_tokens: z.number(),
      total_tokens: z.number(),
      reasoning_tokens: z.number().optional(),
      cached_input_tokens: z.number().optional(),
    })
    .optional(),
  system_fingerprint: z.string().optional(),
  service_tier: z.string().optional(),
  provider: z.string().optional(),
  error: z
    .object({
      message: z.string(),
      type: z.string(),
      param: z.any().nullish(),
      code: z.any().nullish(),
    })
    .optional(),
});

const nordlysChatChunkSchema = z.union([
  z.object({
    id: z.string().nullish(),
    created: z.number().nullish(),
    model: z.string().nullish(),
    choices: z.array(
      z.object({
        delta: z
          .object({
            role: z.enum(['assistant', '']).nullish(),
            content: z.string().nullish(),
            tool_calls: z
              .array(
                z.object({
                  index: z.number(),
                  id: z.string().nullish(),
                  type: z
                    .union([z.literal('function'), z.literal('')])
                    .nullish(),
                  function: z.object({
                    name: z.string().nullish(),
                    arguments: z.string().nullish(),
                  }),
                })
              )
              .nullish(),
            reasoning_content: z.string().optional(),
            generated_files: z
              .array(
                z.object({
                  media_type: z.string(),
                  data: z.string(),
                })
              )
              .optional(),
          })
          .nullish(),
        logprobs: z
          .object({
            content: z
              .array(
                z.object({
                  token: z.string(),
                  logprob: z.number(),
                  top_logprobs: z.array(
                    z.object({
                      token: z.string(),
                      logprob: z.number(),
                    })
                  ),
                })
              )
              .nullish(),
          })
          .nullish(),
        finish_reason: z.string().nullish(),
        index: z.number(),
      })
    ),
    usage: z
      .object({
        completion_tokens: z.number(),
        prompt_tokens: z.number(),
        total_tokens: z.number(),
        reasoning_tokens: z.number().optional(),
        cached_input_tokens: z.number().optional(),
      })
      .nullish(),
    provider: z.string().optional(),
    service_tier: z.string().optional(),
    system_fingerprint: z.string().nullish(),
  }),
  z.object({
    error: z.object({
      message: z.string(),
      type: z.string(),
      param: z.any().nullish(),
      code: z.any().nullish(),
    }),
    provider: z.string().optional(),
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

    // Use modelId from constructor (model is set when creating the model instance)

    const {
      tools: nordlysTools,
      toolChoice: nordlysToolChoice,
      toolWarnings,
    } = prepareTools({
      tools,
      toolChoice,
    });
    warnings.push(...toolWarnings);

    // Convert messages
    const { messages, warnings: messageWarnings } =
      convertToNordlysChatMessages({ prompt });
    warnings.push(...messageWarnings);

    // Standardized settings
    const standardizedArgs = {
      messages,
      model: this.modelId,
      max_tokens:
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
    };

    // Map new provider option fields
    const args: NordlysChatCompletionRequest = {
      ...standardizedArgs,
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
      ...(nordlysOptions.reasoning_effort
        ? { reasoning_effort: nordlysOptions.reasoning_effort }
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
      url: `${this.config.baseURL}/chat/completions`,
      headers: combineHeaders(this.config.headers(), options.headers),
      body,
      failedResponseHandler: nordlysFailedResponseHandler,
      successfulResponseHandler: createJsonResponseHandler(
        nordlysChatResponseSchema
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

    if (!value.choices || value.choices.length === 0) {
      throw new Error('No choices returned from Nordlys API');
    }

    const choice = value.choices[0];
    const content: Array<LanguageModelV3Content> = [];

    if (choice.message?.content) {
      content.push({ type: 'text', text: choice.message.content });
    }

    if (choice.message?.reasoning_content) {
      content.push({
        type: 'reasoning',
        text: choice.message.reasoning_content,
      });
    }

    if (
      choice.message?.generated_files &&
      choice.message.generated_files.length > 0
    ) {
      for (const file of choice.message.generated_files) {
        content.push({
          type: 'file',
          mediaType: file.media_type,
          data: file.data,
        });
      }
    }

    if (choice.message?.tool_calls && choice.message.tool_calls.length > 0) {
      for (const toolCall of choice.message.tool_calls) {
        content.push({
          type: 'tool-call',
          toolCallId: toolCall.id || '',
          toolName: toolCall.function?.name || '',
          input: toolCall.function?.arguments || '{}',
        });
      }
    }

    // Extract usage information
    const {
      prompt_tokens,
      completion_tokens,
      reasoning_tokens,
      cached_input_tokens,
    } = value.usage ?? {};

    return {
      content,
      finishReason: choice.finish_reason
        ? mapNordlysFinishReason(choice.finish_reason)
        : { unified: 'stop', raw: undefined },
      usage:
        value.usage && prompt_tokens != null
          ? {
              inputTokens: {
                total: prompt_tokens,
                noCache:
                  cached_input_tokens != null
                    ? prompt_tokens - cached_input_tokens
                    : undefined,
                cacheRead: cached_input_tokens,
                cacheWrite: undefined,
              },
              outputTokens: {
                total: completion_tokens,
                text:
                  completion_tokens != null && reasoning_tokens != null
                    ? completion_tokens - reasoning_tokens
                    : undefined,
                reasoning: reasoning_tokens,
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
        timestamp: new Date((value.created ?? 0) * 1000),
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
      url: `${this.config.baseURL}/chat/completions`,
      headers: combineHeaders(this.config.headers(), options.headers),
      body,
      failedResponseHandler: nordlysFailedResponseHandler,
      successfulResponseHandler: createEventSourceResponseHandler(
        nordlysChatChunkSchema
      ),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch,
    });

    const toolCalls: Array<{
      id: string;
      type: 'function';
      function: {
        name: string;
        arguments: string;
      };
      hasFinished: boolean;
    }> = [];

    const state: {
      finishReason: LanguageModelV3FinishReason;
      usage: LanguageModelV3Usage;
      isFirstChunk: boolean;
      isActiveText: boolean;
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
      isActiveText: false,
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
            // handle failed chunk parsing / validation:
            if (!chunk.success) {
              state.finishReason = { unified: 'error', raw: undefined };
              controller.enqueue({ type: 'error', error: chunk.error });
              return;
            }

            const value = chunk.value;

            // Handle error responses
            if ('error' in value) {
              state.finishReason = { unified: 'error', raw: undefined };
              controller.enqueue({
                type: 'error',
                error: new Error(value.error.message),
              });
              return;
            }

            if (state.isFirstChunk) {
              state.isFirstChunk = false;
              controller.enqueue({
                type: 'response-metadata',
                ...getResponseMetadata({
                  id: value.id ?? '',
                  model: value.model ?? '',
                  created: value.created ?? 0,
                }),
              });
            }

            if (value.usage != null) {
              state.usage.inputTokens.total =
                value.usage.prompt_tokens ?? undefined;
              state.usage.inputTokens.cacheRead =
                value.usage.cached_input_tokens ?? undefined;
              state.usage.inputTokens.noCache =
                value.usage.prompt_tokens != null &&
                value.usage.cached_input_tokens != null
                  ? value.usage.prompt_tokens - value.usage.cached_input_tokens
                  : undefined;
              state.usage.outputTokens.total =
                value.usage.completion_tokens ?? undefined;
              state.usage.outputTokens.reasoning =
                value.usage.reasoning_tokens ?? undefined;
              state.usage.outputTokens.text =
                value.usage.completion_tokens != null &&
                value.usage.reasoning_tokens != null
                  ? value.usage.completion_tokens - value.usage.reasoning_tokens
                  : undefined;
            }

            if (value.provider) {
              state.provider = value.provider;
            }

            if (value.service_tier) {
              state.serviceTier = value.service_tier;
            }

            if (value.system_fingerprint) {
              state.systemFingerprint = value.system_fingerprint;
            }

            const choice = value.choices[0];
            if (choice?.finish_reason != null) {
              state.finishReason = mapNordlysFinishReason(choice.finish_reason);
            }

            if (!choice?.delta) {
              return;
            }

            const delta = choice.delta;

            if (delta.content != null) {
              if (!state.isActiveText) {
                controller.enqueue({ type: 'text-start', id: 'text-1' });
                state.isActiveText = true;
              }
              controller.enqueue({
                type: 'text-delta',
                id: 'text-1',
                delta: delta.content,
              });
            }

            if (delta.reasoning_content != null) {
              controller.enqueue({
                type: 'reasoning-delta',
                id: 'reasoning-1',
                delta: delta.reasoning_content,
              });
            }

            if (
              delta.generated_files != null &&
              Array.isArray(delta.generated_files)
            ) {
              for (const file of delta.generated_files) {
                controller.enqueue({
                  type: 'file',
                  mediaType: file.media_type,
                  data: file.data,
                });
              }
            }

            if (delta.tool_calls != null && Array.isArray(delta.tool_calls)) {
              for (const toolCallDelta of delta.tool_calls) {
                const index = toolCallDelta.index;

                // Tool call start. Nordlys returns all information except the arguments in the first chunk.
                if (toolCalls[index] == null) {
                  if (
                    toolCallDelta.type !== 'function' &&
                    toolCallDelta.type !== ''
                  ) {
                    throw new InvalidResponseDataError({
                      data: toolCallDelta,
                      message: `Expected 'function' type.`,
                    });
                  }

                  if (toolCallDelta.id == null) {
                    throw new InvalidResponseDataError({
                      data: toolCallDelta,
                      message: `Expected 'id' to be a string.`,
                    });
                  }

                  if (toolCallDelta.function?.name == null) {
                    throw new InvalidResponseDataError({
                      data: toolCallDelta,
                      message: `Expected 'function.name' to be a string.`,
                    });
                  }

                  controller.enqueue({
                    type: 'tool-input-start',
                    id: toolCallDelta.id,
                    toolName: toolCallDelta.function.name,
                  });

                  toolCalls[index] = {
                    id: toolCallDelta.id,
                    type: 'function',
                    function: {
                      name: toolCallDelta.function.name,
                      arguments: toolCallDelta.function.arguments ?? '',
                    },
                    hasFinished: false,
                  };

                  const toolCall = toolCalls[index];

                  if (
                    toolCall.function?.name != null &&
                    toolCall.function?.arguments != null
                  ) {
                    // send delta if the argument text has already started:
                    if (toolCall.function.arguments.length > 0) {
                      controller.enqueue({
                        type: 'tool-input-delta',
                        id: toolCall.id,
                        delta: toolCall.function.arguments,
                      });
                    }

                    // check if tool call is complete
                    // (some providers send the full tool call in one chunk):
                    if (isParsableJson(toolCall.function.arguments)) {
                      controller.enqueue({
                        type: 'tool-input-end',
                        id: toolCall.id,
                      });

                      controller.enqueue({
                        type: 'tool-call',
                        toolCallId: toolCall.id ?? generateId(),
                        toolName: toolCall.function.name,
                        input: toolCall.function.arguments,
                      });
                      toolCall.hasFinished = true;
                    }
                  }

                  continue;
                }

                // existing tool call, merge if not finished
                const toolCall = toolCalls[index];

                if (toolCall.hasFinished) {
                  continue;
                }

                if (toolCallDelta.function?.arguments != null) {
                  toolCall.function.arguments +=
                    toolCallDelta.function?.arguments ?? '';
                }

                // send delta
                controller.enqueue({
                  type: 'tool-input-delta',
                  id: toolCall.id,
                  delta: toolCallDelta.function.arguments ?? '',
                });

                // check if tool call is complete
                if (
                  toolCall.function?.name != null &&
                  toolCall.function?.arguments != null &&
                  isParsableJson(toolCall.function.arguments)
                ) {
                  controller.enqueue({
                    type: 'tool-input-end',
                    id: toolCall.id,
                  });

                  controller.enqueue({
                    type: 'tool-call',
                    toolCallId: toolCall.id ?? generateId(),
                    toolName: toolCall.function.name,
                    input: toolCall.function.arguments,
                  });
                  toolCall.hasFinished = true;
                }
              }
            }
          },
          flush(controller) {
            if (state.isActiveText) {
              controller.enqueue({ type: 'text-end', id: 'text-1' });
            }

            controller.enqueue({
              type: 'finish',
              finishReason: state.finishReason ?? {
                unified: 'stop',
                raw: undefined,
              },
              usage: state.usage ?? {
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
                state.provider || state.serviceTier || state.systemFingerprint
                  ? {
                      nordlys: {
                        provider: state.provider,
                        service_tier: state.serviceTier,
                        system_fingerprint: state.systemFingerprint,
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
