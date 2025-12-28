# Changelog

## 1.1.14

### Patch Changes

- 923ab7c: align Responses API types with OpenAI format

## 1.1.13

### Patch Changes

- ad0b59b: always emit text-start for message items to prevent 'text part not found' error

## 1.1.12

### Patch Changes

- fb868f0: remove text-start/text-end emissions from content_part events

## 1.1.11

### Patch Changes

- 3d5ee4d: remove duplicate end events by cleaning up active sets and simplifying flush

## 1.1.10

### Patch Changes

- e198896: add defensive checks and error handling in flush function

## 1.1.9

### Patch Changes

- 672a108: update nordlys-chat-language-model and nordlys-responses-types

## 1.1.8

### Patch Changes

- 883da45: add support for response.output_text.done event

## 1.1.7

### Patch Changes

- 90aa241: feat: add support for response.reasoning_summary_text.done event

## 1.1.6

### Patch Changes

- 34680c5: feat(nordlys-ai-provider): add reasoning summary events support matching OpenAI implementation

## 1.1.5

### Patch Changes

- 2b8dcff: refactor: improve code quality and align with TypeScript best practices

## 1.1.4

### Patch Changes

- 6e6ec96: fix: handle content_part events to prevent 'Cannot read properties of undefined' error

## 1.1.3

### Patch Changes

- 1196b33: Add response.content_part.added and response.content_part.done event types

## 1.1.2

### Patch Changes

- 189b10d: Fix reasoning item schema to match OpenAI API structure

## 1.1.1

### Patch Changes

- f8db89a: allow usage to be nullish

## 1.1.0

### Minor Changes

- 0001cd9: remove openai specific infra options and consolidate reasoning options

## 1.0.0

### Major Changes

- 1ad72f0: Migrate from chat completions to responses api

## 0.2.2

### Patch Changes

- 762a844: make usage and system fingerprint schema nullish instead of optional to handle null

## 0.2.1

### Patch Changes

- 6b98745: Make sure our package is openai compatible

## 0.2.0

### Minor Changes

- 1aa5925: Add model-level settings support to provider functions. Users can now pass optional settings (temperature, maxOutputTokens, topP, etc.) when creating model instances. Settings are merged with call-level options, with call-level taking precedence. Also includes improved README documentation for settings and API key configuration.

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2024-12-23

### Breaking Changes

- Upgraded to Language Model Specification V3
  - All types updated from V2 to V3 (ProviderV3, LanguageModelV3, EmbeddingModelV3, etc.)
  - Specification version changed from `'v2'` to `'v3'`
- API change: Model ID must now be passed directly to `nordlys()` constructor
  - Before: `nordlys()` with `providerOptions: { model: 'nordlys/hypernova' }`
  - After: `nordlys('nordlys/hypernova')`
- Method name change: `textEmbeddingModel` → `embeddingModel`

### Added

- Added AGENTS.md with comprehensive project documentation
- Added installation commands for npm, pnpm, and bun

### Changed

- Updated terminology: Removed references to "intelligent model selection" and "routing", now uses "Mixture of Models" terminology
- Updated all examples to use `nordlys/hypernova` model name
- Removed emojis from README

### Fixed

- Removed unused `seed` parameter
- Removed unused imports

[Unreleased]: https://github.com/Nordlys-Labs/nordlys-ai-provider/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/Nordlys-Labs/nordlys-ai-provider/releases/tag/v0.1.0
