import { describe, expect, it } from 'vitest';
import { mapNordlysFinishReason } from './map-nordlys-finish-reason';

describe('mapNordlysFinishReason', () => {
  it('should map null to stop when no function calls', () => {
    expect(
      mapNordlysFinishReason({ finishReason: null, hasFunctionCall: false })
    ).toBe('stop');
  });

  it('should map null to tool-calls when function calls exist', () => {
    expect(
      mapNordlysFinishReason({ finishReason: null, hasFunctionCall: true })
    ).toBe('tool-calls');
  });

  it('should map max_output_tokens to length', () => {
    expect(
      mapNordlysFinishReason({
        finishReason: 'max_output_tokens',
        hasFunctionCall: false,
      })
    ).toBe('length');
  });

  it('should map content_filter to content-filter', () => {
    expect(
      mapNordlysFinishReason({
        finishReason: 'content_filter',
        hasFunctionCall: false,
      })
    ).toBe('content-filter');
  });

  it('should map unknown to other when no function calls', () => {
    expect(
      mapNordlysFinishReason({
        finishReason: 'unknown',
        hasFunctionCall: false,
      })
    ).toBe('other');
  });

  it('should map unknown to tool-calls when function calls exist', () => {
    expect(
      mapNordlysFinishReason({ finishReason: 'unknown', hasFunctionCall: true })
    ).toBe('tool-calls');
  });
});
