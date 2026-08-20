import { z } from 'zod';

export const brandingSchema = z.object({
  logoUrl: z
    .string()
    .trim()
    .max(2048, 'Must be 2048 characters or fewer')
    .refine((v) => v === '' || /^https?:\/\/.+/i.test(v), 'Must be a valid http(s) URL'),
});

export type BrandingFormValues = z.infer<typeof brandingSchema>;
