import { describe, expect, it } from 'vitest';
import { mapNordlysFinishReason } from './map-nordlys-finish-reason';

describe('mapNordlysFinishReason', () => {
  it('should map stop', () => {
    expect(mapNordlysFinishReason('stop')).toBe('stop');
  });
  it('should map length', () => {
    expect(mapNordlysFinishReason('length')).toBe('length');
  });
  it('should map content_filter', () => {
    expect(mapNordlysFinishReason('content_filter')).toBe('content-filter');
  });
  it('should map tool_calls', () => {
    expect(mapNordlysFinishReason('tool_calls')).toBe('tool-calls');
  });
  it('should map unknown/undefined', () => {
    expect(mapNordlysFinishReason('something-else')).toBe('unknown');
    expect(mapNordlysFinishReason(undefined)).toBe('unknown');
  });
});
