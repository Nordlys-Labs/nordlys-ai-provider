import { safeParseJSON } from '@ai-sdk/provider-utils';
import { describe, expect, it } from 'vitest';
import { nordlysErrorDataSchema } from './nordlys-error';

describe('nordlysErrorDataSchema', () => {
  it('should parse a standard error response', async () => {
    const error = JSON.stringify({
      error: { message: 'Something went wrong', code: 400 },
    });
    const result = await safeParseJSON({
      text: error,
      schema: nordlysErrorDataSchema,
    });
    if (!result.success) throw result.error;
    expect(result.value.error.message).toBe('Something went wrong');
    expect(result.value.error.code).toBe(400);
  });

  it('should parse an error response with only a message', async () => {
    const error = JSON.stringify({ error: { message: 'Just a message' } });
    const result = await safeParseJSON({
      text: error,
      schema: nordlysErrorDataSchema,
    });
    if (!result.success) throw result.error;
    expect(result.value.error.message).toBe('Just a message');
  });
});
