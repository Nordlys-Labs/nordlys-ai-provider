import { describe, expect, it } from 'vitest';
import { mapNordlysFinishReason } from './map-nordlys-finish-reason';

describe('mapNordlysFinishReason', () => {
  it('should map completed to stop', () => {
    expect(mapNordlysFinishReason('completed')).toEqual({
      unified: 'stop',
      raw: undefined,
    });
  });

  it('should map incomplete to length', () => {
    expect(mapNordlysFinishReason('incomplete')).toEqual({
      unified: 'length',
      raw: undefined,
    });
  });

  it('should map failed to error', () => {
    expect(mapNordlysFinishReason('failed')).toEqual({
      unified: 'error',
      raw: undefined,
    });
  });

  it('should map cancelled to other', () => {
    expect(mapNordlysFinishReason('cancelled')).toEqual({
      unified: 'other',
      raw: 'cancelled',
    });
  });

  it('should map queued to other', () => {
    expect(mapNordlysFinishReason('queued')).toEqual({
      unified: 'other',
      raw: 'queued',
    });
  });

  it('should map in_progress to other', () => {
    expect(mapNordlysFinishReason('in_progress')).toEqual({
      unified: 'other',
      raw: 'in_progress',
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
