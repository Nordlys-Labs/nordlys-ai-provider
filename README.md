# Nordlys AI Provider

AI provider for [Vercel AI SDK v5](https://ai-sdk.dev/docs) that provides access to Nordlys models—a Mixture of Models system that behaves like a single unified model. V3 specification compliant.

## Features

- **V3 Spec Compliant** - Reasoning, file generation, enhanced usage tracking
- **Mixture of Models** - Access to Nordlys models that activate the right models per prompt
- **Drop-in Replacement** - OpenAI-compatible API, works with existing code
- **Production Ready** - TypeScript, full test coverage

## Install

```bash
# npm
npm i @nordlys-labs/nordlys-ai-provider

# pnpm
pnpm add @nordlys-labs/nordlys-ai-provider

# bun
bun add @nordlys-labs/nordlys-ai-provider
```

## Usage

```ts
import { nordlys } from '@nordlys-labs/nordlys-ai-provider';
import { generateText } from 'ai';

// Use Nordlys models
const { text } = await generateText({
  model: nordlys('nordlys/hypernova'),
  prompt: 'Explain quantum computing',
});

// With model-level settings
const { text: creativeText } = await generateText({
  model: nordlys('nordlys/hypernova', {
    temperature: 0.9,
    maxOutputTokens: 2000,
  }),
  prompt: 'Write a creative story',
});
```

## V3 Content Types

```ts
const { content, usage } = await generateText({
  model: nordlys('nordlys/hypernova'),
  prompt: 'Solve: 2x + 5 = 17',
});

// Access reasoning, files, tool calls
content.forEach((item) => {
  switch (item.type) {
    case 'text': console.log(item.text); break;
    case 'reasoning': console.log(item.text); break;
    case 'file': console.log(item.media_type, item.data); break;
    case 'tool-call': console.log(item.toolName, item.input); break;
  }
});

// Enhanced usage tracking
console.log({
  input: usage.inputTokens,
  output: usage.outputTokens,
  reasoning: usage.reasoningTokens,
  cached: usage.cachedInputTokens,
});
```

## Streaming

```ts
const { fullStream } = streamText({
  model: nordlys('nordlys/hypernova'),
  prompt: 'Count to 10',
});

for await (const part of fullStream) {
  if (part.type === 'text') process.stdout.write(part.textDelta);
  if (part.type === 'reasoning') console.log('💭', part.text);
}
```

## Tools

```ts
const { text } = await generateText({
  model: nordlys('nordlys/hypernova'),
  prompt: 'What is the weather in SF?',
  tools: {
    getWeather: {
      description: 'Get weather for location',
      parameters: {
        type: 'object',
        properties: { location: { type: 'string' } },
        required: ['location'],
      },
      execute: async ({ location }) => `Weather in ${location}: Sunny, 72°F`,
    },
  },
});
```

## Configuration

### Provider Configuration

```ts
import { createNordlys } from '@nordlys-labs/nordlys-ai-provider';

// Default provider (uses NORDLYS_API_KEY env var)
const nordlys = createNordlys();

// Provider with explicit API key
const nordlysWithKey = createNordlys({
  apiKey: 'your-api-key-here',
});

// Provider with custom base URL and API key
const customNordlys = createNordlys({
  baseURL: 'https://your-api.com/v1',
  apiKey: 'your-api-key-here',
  headers: { 'Custom-Header': 'value' },
});

// Multiple providers with different API keys
const provider1 = createNordlys({ apiKey: 'key-for-user-1' });
const provider2 = createNordlys({ apiKey: 'key-for-user-2' });

// Use different providers for different models
const { text } = await generateText({
  model: provider1('nordlys/hypernova'),
  prompt: 'Hello',
});
```

**API Key Priority:**
1. Explicit `apiKey` parameter in `createNordlys()`
2. `NORDLYS_API_KEY` environment variable (if `apiKey` not provided)

### Model Settings

You can pass settings when creating a model instance. These settings will be used as defaults for all calls, but can be overridden at call time:

```ts
import { nordlys } from '@nordlys-labs/nordlys-ai-provider';
import { generateText } from 'ai';

// Create a model with default settings
const creativeModel = nordlys('nordlys/hypernova', {
  temperature: 0.9,
  topP: 0.95,
  maxOutputTokens: 2000,
});

// Use the model (settings apply automatically)
const { text } = await generateText({
  model: creativeModel,
  prompt: 'Write a story',
});

// Override settings at call time (call-level takes precedence)
const { text: preciseText } = await generateText({
  model: creativeModel,
  prompt: 'Solve this math problem',
  temperature: 0.1, // Overrides model-level temperature
});

// Settings can also be passed to languageModel and chat methods
const model1 = nordlys.languageModel('nordlys/hypernova', {
  temperature: 0.7,
});

const model2 = nordlys.chat('nordlys/hypernova', {
  temperature: 0.8,
  maxOutputTokens: 1000,
});
```

### Available Settings

- `temperature?: number` - Sampling temperature
- `maxOutputTokens?: number` - Maximum tokens to generate
- `topP?: number` - Top-p sampling parameter
- `topK?: number` - Top-k sampling parameter (unsupported, will warn)
- `frequencyPenalty?: number` - Frequency penalty
- `presencePenalty?: number` - Presence penalty
- `stopSequences?: string[]` - Stop sequences
- `providerOptions?: NordlysProviderOptions` - Provider-specific options

## Multimodal

```ts
const { text } = await generateText({
  model: nordlys('nordlys/hypernova'),
  messages: [{
    role: 'user',
    content: [
      { type: 'text', text: 'Analyze this image' },
      { type: 'file', data: 'data:image/jpeg;base64,...', media_type: 'image/jpeg' },
    ],
  }],
});
```

## Supported Features

- Text, reasoning, file generation, tool calls
- Streaming with all event types
- Multimodal inputs (images, audio, PDFs)
- Enhanced usage tracking
- Model-level settings support
- AI SDK standard error handling
- Full TypeScript support

## Error Handling

```ts
import { APICallError, TooManyRequestsError } from 'ai';

try {
  const result = await generateText({
    model: nordlys('nordlys/hypernova'),
    prompt: 'Hello',
  });
} catch (error) {
  if (error instanceof TooManyRequestsError) {
    console.log('Rate limited, retry after:', error.retryAfter);
  }
}
```

## Environment

The API key can be provided via environment variable or explicitly when creating the provider:

```bash
# Set environment variable (used as fallback if apiKey not provided)
export NORDLYS_API_KEY="your-api-key"
```

```ts
// Or provide it explicitly when creating the provider
import { createNordlys } from '@nordlys-labs/nordlys-ai-provider';

const nordlys = createNordlys({
  apiKey: process.env.NORDLYS_API_KEY, // Explicit API key takes precedence
});
```

**Note:** If you provide an `apiKey` parameter to `createNordlys()`, it will override the `NORDLYS_API_KEY` environment variable for that provider instance.
