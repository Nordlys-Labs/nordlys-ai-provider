# AGENTS.md

This file provides guidance for AI coding agents working on the Nordlys AI Provider project.

## Project Overview

Nordlys AI Provider is a TypeScript package that provides an AI provider implementation for the [Vercel AI SDK](https://ai-sdk.dev/docs). It implements the Language Model Specification V3 and provides access to Nordlys models—a Mixture of Models system that activates the right models per prompt and behaves like a single unified model.

**Key Technologies:**
- **Language**: TypeScript (ESM modules)
- **Package Manager**: Bun
- **Build Tool**: tsup
- **Testing**: Vitest (Node.js and Edge runtime environments)
- **Linting/Formatting**: Biome
- **Versioning**: Changesets
- **Specification**: AI SDK Language Model Specification V3

## Build and Test Commands

### Development
```bash
# Install dependencies
bun install

# Build the project
bun run build

# Build in watch mode
bun run build:watch

# Run development build in watch mode
bun run dev
```

### Testing
```bash
# Run all tests (Node.js + Edge)
bun run test

# Run Node.js tests only
bun run test:node

# Run Edge runtime tests only
bun run test:edge

# Run tests in watch mode
bun run test:watch

# Update test snapshots
bun run test:update

# Generate test coverage
bun run test:coverage
```

### Code Quality
```bash
# Run linter
bun run lint

# Fix linting issues automatically
bun run check:fix

# Fix linting issues (including unsafe fixes)
bun run check:unsafe

# Format code
bun run format

# Type check
bun run typecheck

# Run CI checks (lint + typecheck + test)
bun run ci
```

### Versioning and Publishing
```bash
# Create a changeset
bun run changeset

# Version packages
bun run version

# Publish packages
bun run release
```

## Code Style Guidelines

### Formatting
- **Indentation**: 2 spaces
- **Line endings**: LF
- **Quotes**: Single quotes for strings
- **Semicolons**: Always use semicolons
- **Trailing commas**: ES5 style (objects/arrays)

### Linting Rules
- Follow Biome recommended rules
- `noConsole` is a warning (not an error)
- Node.js import protocol is disabled
- Imports are automatically organized

### TypeScript
- Use ESM modules (`type: "module"` in package.json)
- Strict type checking enabled
- Target: ES2018
- Use type imports: `import type { ... }` for types

### Naming Conventions
- Files: kebab-case (e.g., `nordlys-provider.ts`)
- Classes: PascalCase (e.g., `NordlysChatLanguageModel`)
- Functions/variables: camelCase (e.g., `createNordlys`)
- Types/interfaces: PascalCase (e.g., `NordlysProvider`)

## Testing Instructions

### Test Structure
- Test files are co-located with source files (e.g., `nordlys-provider.test.ts`)
- Tests use Vitest framework
- Both Node.js and Edge runtime environments are tested

### Writing Tests
```typescript
import { describe, expect, it } from 'vitest';

describe('feature name', () => {
  it('should do something', () => {
    expect(actual).toBe(expected);
  });
});
```

### Test Coverage
- Aim for high test coverage
- Test both success and error cases
- Test edge runtime compatibility
- Use `bun run test:coverage` to check coverage

## Architecture

### Core Components
1. **Provider** (`nordlys-provider.ts`): Main provider interface implementing `ProviderV3`
2. **Language Model** (`nordlys-chat-language-model.ts`): Implements `LanguageModelV3` with `doGenerate` and `doStream`
3. **Message Converter** (`convert-to-nordlys-chat-messages.ts`): Converts AI SDK prompts to Nordlys API format
4. **Tools Preparer** (`nordlys-prepare-tools.ts`): Prepares tools for API requests
5. **Finish Reason Mapper** (`map-nordlys-finish-reason.ts`): Maps API finish reasons to V3 spec

### Specification Compliance
- **Version**: Language Model Specification V3
- **Specification Version**: `'v3'` (lowercase)
- All types use V3 naming: `LanguageModelV3`, `ProviderV3`, `EmbeddingModelV3`, etc.
- Method names: `embeddingModel` (not `textEmbeddingModel`)

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/) format:

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Test additions/changes
- `chore`: Maintenance tasks
- `perf`: Performance improvements
- `ci`: CI/CD changes

### Examples
```
feat: add support for reasoning tokens in usage tracking
fix: handle null finish_reason in streaming responses
docs: update README with V3 specification details
refactor: migrate from V2 to V3 specification types
```

## Pull Request Guidelines

1. **Ensure all checks pass**: `bun run ci` must pass
2. **Update tests**: Add tests for new features
3. **Update documentation**: Update README.md if needed
4. **Create changeset**: Use `bun run changeset` for version changes
5. **Keep PRs focused**: One feature/fix per PR
6. **Write clear descriptions**: Explain what and why

## Security Considerations

### API Keys
- Never commit API keys or secrets
- Use environment variables: `NORDLYS_API_KEY`
- Document required environment variables in README

### Dependencies
- Keep dependencies up to date
- Review security advisories regularly
- Use exact versions for critical dependencies when possible

### Input Validation
- Validate all API inputs using Zod schemas
- Handle errors gracefully
- Don't expose internal error details to users

## Deployment Steps

### Pre-publish Checklist
1. Run `bun run ci` (lint + typecheck + test)
2. Ensure all tests pass
3. Build succeeds: `bun run build`
4. Check dist files are generated correctly
5. Create changeset if version bump needed

### Publishing
```bash
# 1. Create changeset (if needed)
bun run changeset

# 2. Version packages
bun run version

# 3. Build
bun run build

# 4. Publish (runs prepublishOnly hook automatically)
bun run release
```

The `prepublishOnly` hook automatically runs:
- `bun run build`
- `bun run test`
- `bun run lint`
- `bun run typecheck`

## Common Tasks

### Adding a New Feature
1. Create feature branch
2. Implement feature with tests
3. Update documentation if needed
4. Run `bun run ci`
5. Create PR with changeset if version bump needed

### Fixing a Bug
1. Write failing test first (TDD)
2. Fix the bug
3. Ensure test passes
4. Run `bun run ci`
5. Create PR

### Updating Dependencies
1. Update package.json
2. Run `bun install`
3. Run `bun run ci`
4. Test thoroughly
5. Create PR

## File Structure

```
nordlys-ai-provider/
├── src/
│   ├── index.ts                    # Main exports
│   ├── nordlys-provider.ts         # Provider implementation
│   ├── nordlys-chat-language-model.ts  # Language model implementation
│   ├── convert-to-nordlys-chat-messages.ts  # Message conversion
│   ├── nordlys-prepare-tools.ts    # Tools preparation
│   ├── map-nordlys-finish-reason.ts # Finish reason mapping
│   ├── nordlys-chat-options.ts     # Provider options schema
│   ├── nordlys-types.ts            # Type definitions
│   ├── nordlys-error.ts            # Error handling
│   ├── get-response-metadata.ts    # Response metadata extraction
│   └── *.test.ts                   # Test files
├── dist/                           # Build output (gitignored)
├── .changeset/                     # Changeset files
├── package.json
├── tsconfig.json
├── tsconfig.build.json
├── tsup.config.ts
├── biome.json
├── vitest.node.config.js
├── vitest.edge.config.js
├── README.md
├── CHANGELOG.md
└── AGENTS.md                       # This file
```

## Important Notes

### Specification Version
- Always use **V3** specification types
- Specification version string is **lowercase** `'v3'` (not `'V3'`)
- Method name is `embeddingModel` (not `textEmbeddingModel`)

### Type Imports
- Use `import type { ... }` for type-only imports
- V3 types: `LanguageModelV3`, `ProviderV3`, `EmbeddingModelV3`, etc.

### Error Handling
- Use AI SDK error types: `APICallError`, `TooManyRequestsError`, etc.
- Handle API errors gracefully
- Provide meaningful error messages

### Testing
- Always test both Node.js and Edge runtimes
- Mock external API calls in tests
- Test error cases, not just happy paths

## Getting Help

- Check existing issues on GitHub
- Review AI SDK documentation: https://ai-sdk.dev/docs
- Check Vercel AI SDK provider examples
- Review test files for usage examples
