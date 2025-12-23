# Nordlys AI Provider

Intelligent AI provider for [Vercel AI SDK v5](https://ai-sdk.dev/docs) with automatic model selection and V3 specification compliance.

## Features

- 🤖 **Intelligent Model Selection** - Automatically picks optimal models
- 🧠 **V3 Spec Compliant** - Reasoning, file generation, enhanced usage tracking
- 🔄 **Multi-Provider** - OpenAI, Anthropic, Google, DeepSeek, Groq, etc.
- 🚀 **Production Ready** - TypeScript, full test coverage

## Install

```bash
npm i @nordlys-labs/nordlys-ai-provider
```

## Usage

```ts
import { nordlys } from '@nordlys-labs/nordlys-ai-provider';
import { generateText } from 'ai';

// Intelligent model selection
const { text } = await generateText({
  model: nordlys(),
  prompt: 'Explain quantum computing',
  providerOptions: { model: 'claude-opus-4-5' },
});
```

## V3 Content Types

```ts
const { content, usage } = await generateText({
  model: nordlys(),
  prompt: 'Solve: 2x + 5 = 17',
  providerOptions: { model: 'claude-opus-4-5' },
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
  providerOptions: { model: 'claude-opus-4-5' },
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
  providerOptions: { model: 'claude-opus-4-5' },
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
  providerOptions: { model: 'claude-opus-4-5' },
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
    providerOptions: { model: 'claude-opus-4-5' },
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
