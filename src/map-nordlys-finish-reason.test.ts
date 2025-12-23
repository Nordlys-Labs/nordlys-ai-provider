import { describe, expect, it } from 'vitest';
import { mapNordlysFinishReason } from './map-nordlys-finish-reason';

describe('mapNordlysFinishReason', () => {
  it('should map stop', () => {
    expect(mapNordlysFinishReason('stop')).toEqual({
      unified: 'stop',
      raw: 'stop',
    });
  });
  it('should map length', () => {
    expect(mapNordlysFinishReason('length')).toEqual({
      unified: 'length',
      raw: 'length',
    });
  });
  it('should map content_filter', () => {
    expect(mapNordlysFinishReason('content_filter')).toEqual({
      unified: 'content-filter',
      raw: 'content_filter',
    });
  });
  it('should map tool_calls', () => {
    expect(mapNordlysFinishReason('tool_calls')).toEqual({
      unified: 'tool-calls',
      raw: 'tool_calls',
    });
  });
  it('should map unknown/undefined', () => {
    expect(mapNordlysFinishReason('something-else')).toEqual({
      unified: 'other',
      raw: 'something-else',
    });
    expect(mapNordlysFinishReason(undefined)).toEqual({
      unified: 'other',
      raw: undefined,
    });
  });
});
