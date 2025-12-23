# @nordlys-labs/nordlys-ai-provider

## Unreleased

### Major Changes

- **BREAKING**: Renamed from `@ai-sdk/adaptive` to `@nordlys-labs/nordlys-ai-provider`
- **BREAKING**: Renamed all `Adaptive*` types and functions to `Nordlys*`
- **BREAKING**: Renamed `adaptive` export to `nordlys`
- **BREAKING**: Renamed `createAdaptive` to `createNordlys`
- **BREAKING**: Changed provider identifier from `'adaptive.chat'` to `'nordlys.chat'`
- **BREAKING**: Changed environment variable from `ADAPTIVE_API_KEY` to `NORDLYS_API_KEY`
- **BREAKING**: Removed deprecated `model_router`, `fallback`, and `provider_configs` fields
- **BREAKING**: `model` field is now required in providerOptions

### Added

- Added support for new OpenAPI fields:
  - `model` (required) - model name
  - `audio` - audio parameter for chat completion
  - `logprobs` - return log probabilities
  - `max_completion_tokens` - maximum completion tokens
  - `metadata` - shared metadata
  - `modalities` - request modalities
  - `parallel_tool_calls` - allow parallel tool calls
  - `prediction` - prediction content parameter
  - `reasoning_effort` - reasoning effort level
  - `response_format` - response format parameter
  - `seed` - seed for deterministic outputs
  - `service_tier` - service tier to use
  - `store` - whether to store the conversation
  - `top_logprobs` - number of top logprobs to return
  - `web_search_options` - web search options
- Added `service_tier` and `system_fingerprint` to response types
- Added TypeScript type definitions for all new OpenAPI schemas

### Removed

- Removed `model_router` configuration (no longer supported)
- Removed `fallback` configuration (no longer supported)
- Removed `provider_configs` configuration (not adding per user request)

## 1.4.3

### Patch Changes

- 1a0a07b: chore: update deps

## 1.4.2

### Patch Changes

- ff06010: feat: change provider options for new model router cache keys

## 1.4.1

### Patch Changes

- 5f6fe92: update deps

## 1.4.0

### Minor Changes

- 3b7290b: Update adaptive provider options for new api naming

## 1.3.1

### Patch Changes

- 2bd6147: fix: streaming chunk choices && proivder optional

## 1.3.0

### Minor Changes

- 5f790b5: feat: allow configuration for protocol manager, semantic cache, and fallback

## 1.2.12

### Patch Changes

- b23f7a5: feat: make schema more permissive for hf

## 1.2.11

### Patch Changes

- 0b7f8b0: fix: handle empty strings from adaptive api

## 1.2.10

### Patch Changes

- 4ceece3: fix: handle partial tool calls finally

## 1.2.9

### Patch Changes

- 65aa506: fix: allow empty role in streaming response

## 1.2.8

### Patch Changes

- 94f2472: allow empty role cuz some providers dont add it for some reason

## 1.2.7

### Patch Changes

- ac5c3dc: fix: handle tool calls and make schema precise

## 1.2.6

### Patch Changes

- 2d9dbba: feat: handle partial tool calls and conform better to openai spec

## 1.2.5

### Patch Changes

- 0490f66: handle streaming errors properlyh

## 1.2.4

### Patch Changes

- b2435db: fix: tool call results not being passed

## 1.2.3

### Patch Changes

- 949aea5: update deps

## 1.2.2

### Patch Changes

- d52903a: fix build

## 1.2.1

### Patch Changes

- 1d7745e: ensure messages conform to openai spec

## 1.2.0

### Minor Changes

- 0d28f84: Allow tool registering for adaptive requests

## 1.1.0

### Minor Changes

- 68d11c9: support vercel ai sdk provider v2 types

## 1.0.0

### Major Changes

- 6fdedd6: remove ability to select provider and model manually

## 0.6.5

### Patch Changes

- cd7570a: update zod and node types to 24

## 0.6.4

### Patch Changes

- fe23dc1: fix base url to point to prod

## 0.6.3

### Patch Changes

- 742e13e: fix build issues to resolve module resolution

## 0.6.2

### Patch Changes

- 5077d82: Fix tsup config
