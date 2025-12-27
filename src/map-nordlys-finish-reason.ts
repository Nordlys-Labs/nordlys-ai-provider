import type { LanguageModelV3FinishReason } from '@ai-sdk/provider';

/**
 * Maps Nordlys Responses API status field to AI SDK finish reason
 */
export function mapNordlysFinishReason(
  status?: string
): LanguageModelV3FinishReason {
  switch (status) {
    case 'completed':
      return { unified: 'stop', raw: undefined };
    case 'incomplete':
      return { unified: 'length', raw: undefined };
    case 'failed':
      return { unified: 'error', raw: undefined };
    case 'cancelled':
      return { unified: 'other', raw: 'cancelled' };
    case 'queued':
    case 'in_progress':
      // These are intermediate states, treat as 'other'
      return { unified: 'other', raw: status };
    default:
      return { unified: 'other', raw: status };
  }
}
