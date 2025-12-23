import { createJsonErrorResponseHandler } from '@ai-sdk/provider-utils';
import { z } from 'zod';

export const nordlysErrorDataSchema = z.object({
  error: z.object({
    message: z.string(),
    type: z.string().nullish(),
    param: z.any().nullish(),
    code: z.union([z.string(), z.number()]).nullish(),
  }),
});

export type NordlysErrorData = z.infer<typeof nordlysErrorDataSchema>;

export const nordlysFailedResponseHandler: ReturnType<
  typeof createJsonErrorResponseHandler<NordlysErrorData>
> = createJsonErrorResponseHandler({
  errorSchema: nordlysErrorDataSchema,
  errorToMessage: (data: NordlysErrorData) => data.error.message,
});
