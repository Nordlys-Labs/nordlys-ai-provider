# Nordlys AI Provider

AI provider for [Vercel AI SDK v5](https://ai-sdk.dev/docs) that provides access to Nordlys models—a Mixture of Models system that behaves like a single unified model. V3 specification compliant.

## Features

- 🧠 **V3 Spec Compliant** - Reasoning, file generation, enhanced usage tracking
- 🎯 **Mixture of Models** - Access to Nordlys models that activate the right models per prompt
- 🔄 **Drop-in Replacement** - OpenAI-compatible API, works with existing code
- 🚀 **Production Ready** - TypeScript, full test coverage

## Install

```bash
npm i @nordlys-labs/nordlys-ai-provider
```

## Usage

```ts
import { nordlys } from '@nordlys-labs/nordlys-ai-provider';
import { generateText } from 'ai';

// Use Nordlys models
const { text } = await generateText({
  model: nordlys(),
  prompt: 'Explain quantum computing',
  providerOptions: { model: 'nordlys/hypernova' },
});
```

## V3 Content Types

```ts
const { content, usage } = await generateText({
  model: nordlys(),
  prompt: 'Solve: 2x + 5 = 17',
  providerOptions: { model: 'nordlys/hypernova' },
});

// Access reasoning, files, tool calls
content.forEach((item) => {
  switch (item.type) {
    case 'text': console.log(item.text); break;
    case 'reasoning': console.log(item.text); break;
    case 'file': console.log(item.media_type, item.data); break;
    case 'tool-call': console.log(item.toolName, item.args); break;
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
  model: nordlys(),
  prompt: 'Count to 10',
  providerOptions: { model: 'nordlys/hypernova' },
});

for await (const part of fullStream) {
  if (part.type === 'text') process.stdout.write(part.textDelta);
  if (part.type === 'reasoning') console.log('💭', part.text);
}
```

## Tools

```ts
const { text } = await generateText({
  model: nordlys(),
  prompt: 'What is the weather in SF?',
  providerOptions: { model: 'nordlys/hypernova' },
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

```ts
import { createNordlys } from '@nordlys-labs/nordlys-ai-provider';

const nordlys = createNordlys({
  baseURL: 'https://your-api.com/v1',
  apiKey: 'your-key', // or NORDLYS_API_KEY env var
  headers: { 'Custom-Header': 'value' },
});
```

## Multimodal

```ts
const { text } = await generateText({
  model: nordlys(),
  messages: [{
    role: 'user',
    content: [
      { type: 'text', text: 'Analyze this image' },
      { type: 'file', data: 'data:image/jpeg;base64,...', media_type: 'image/jpeg' },
    ],
  }],
  providerOptions: { model: 'nordlys/hypernova' },
});
```

## Supported Features

- ✅ Text, reasoning, file generation, tool calls
- ✅ Streaming with all event types
- ✅ Multimodal inputs (images, audio, PDFs)
- ✅ Enhanced usage tracking
- ✅ AI SDK standard error handling
- ✅ Full TypeScript support

## Error Handling

```ts
import { APICallError, TooManyRequestsError } from 'ai';

try {
  const result = await generateText({
    model: nordlys(),
    prompt: 'Hello',
    providerOptions: { model: 'nordlys/hypernova' },
  });
} catch (error) {
  if (error instanceof TooManyRequestsError) {
    console.log('Rate limited, retry after:', error.retryAfter);
  }
}
```

## Environment

```bash
export NORDLYS_API_KEY="your-api-key"
```
