import type {
  EmbeddingModelV3,
  LanguageModelV3,
  ProviderV3,
} from '@ai-sdk/provider';
import { NoSuchModelError } from '@ai-sdk/provider';
import type { FetchFunction } from '@ai-sdk/provider-utils';
import { loadApiKey, withoutTrailingSlash } from '@ai-sdk/provider-utils';
import { NordlysChatLanguageModel } from './nordlys-chat-language-model';
import type { NordlysChatSettings } from './nordlys-chat-options';

export type NordlysChatModelId = string;

export interface NordlysProvider extends ProviderV3 {
  (modelId: string, settings?: NordlysChatSettings): LanguageModelV3;

  /**
   * Creates a model for text generation with Nordlys models.
   */
  languageModel: (
    modelId: string,
    settings?: NordlysChatSettings
  ) => LanguageModelV3;

  /**
   * Creates a chat model with Nordlys models.
   */
  chat: (modelId: string, settings?: NordlysChatSettings) => LanguageModelV3;

  /**
   * Text embedding is not currently supported by the Nordlys provider.
   */
  embeddingModel: (modelId: string) => EmbeddingModelV3;
}

export interface NordlysProviderSettings {
  /**
   * Use a different URL prefix for API calls, e.g. to use proxy servers.
   * The default prefix is your Nordlys API endpoint.
   */
  baseURL?: string;

  /**
   * API key for the Nordlys service.
   * It defaults to the `NORDLYS_API_KEY` environment variable.
   */
  apiKey?: string;

  /**
   * Custom headers to include in the requests.
   */
  headers?: Record<string, string>;

  /**
   * Custom fetch implementation. You can use it as a middleware to intercept requests,
   * or to provide a custom fetch implementation for e.g. testing.
   */
  fetch?: FetchFunction;
}

/**
 * Create a Nordlys AI provider instance.
 */
export function createNordlys(
  options: NordlysProviderSettings = {}
): NordlysProvider {
  const baseURL =
    withoutTrailingSlash(options.baseURL) ??
    'https://backend.mangoplant-a7a21605.swedencentral.azurecontainerapps.io/v1';

  const getHeaders = () => ({
    Authorization: `Bearer ${loadApiKey({
      apiKey: options.apiKey,
      environmentVariableName: 'NORDLYS_API_KEY',
      description: 'Nordlys',
    })}`,
    'Content-Type': 'application/json',
    ...options.headers,
  });

  const createChatModel = (modelId: string, settings?: NordlysChatSettings) =>
    new NordlysChatLanguageModel(modelId, settings, {
      provider: 'nordlys.chat',
      baseURL,
      headers: getHeaders,
      fetch: options.fetch,
    });

  const provider = function (modelId: string, settings?: NordlysChatSettings) {
    if (new.target) {
      throw new Error(
        'The Nordlys model function cannot be called with the new keyword.'
      );
    }

    return createChatModel(modelId, settings);
  };

  provider.languageModel = createChatModel;
  provider.chat = createChatModel;

  provider.embeddingModel = (modelId: string) => {
    throw new NoSuchModelError({ modelId, modelType: 'embeddingModel' });
  };

  provider.imageModel = (modelId: string) => {
    throw new NoSuchModelError({ modelId, modelType: 'imageModel' });
  };

  provider.specificationVersion = 'v3' as const;

  return Object.freeze(provider);
}

/**
 * Default Nordlys provider instance.
 */
export const nordlys = createNordlys();
