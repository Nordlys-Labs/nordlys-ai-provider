# Changelog

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
