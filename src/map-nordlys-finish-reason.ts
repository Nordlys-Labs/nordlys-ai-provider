import type { LanguageModelV3FinishReason } from '@ai-sdk/provider';

export function mapNordlysFinishReason(
  reason?: string
): LanguageModelV3FinishReason {
  switch (reason) {
    case 'stop':
      return { unified: 'stop', raw: reason };
    case 'length':
      return { unified: 'length', raw: reason };
    case 'content_filter':
      return { unified: 'content-filter', raw: reason };
    case 'tool_calls':
      return { unified: 'tool-calls', raw: reason };
    default:
      return { unified: 'other', raw: reason };
  }
}
