import { z } from "zod";

export const requestItemSchema = z.object({
  productSlug: z.string().trim().min(1).max(200),
  designation: z.string().trim().min(1).max(200),
  quantity: z.coerce.number().positive().max(1_000_000),
  unit: z.enum(["шт", "компл", "кг"]).default("шт"),
  requiredDate: z.string().trim().max(30).optional().default(""),
  analogAllowed: z.boolean().default(false),
  comment: z.string().trim().max(1000).optional().default("")
});

export const commercialRequestSchema = z.object({
  idempotencyKey: z.string().uuid(),
  companyName: z.string().trim().min(2).max(300),
  inn: z.string().trim().regex(/^(\d{10}|\d{12})$/, "ИНН должен содержать 10 или 12 цифр"),
  contactName: z.string().trim().min(2).max(200),
  phone: z.string().trim().min(7).max(40),
  email: z.string().trim().email().max(254),
  city: z.string().trim().min(2).max(200),
  requiredDate: z.string().trim().max(30).optional().default(""),
  contactMethod: z.enum(["phone", "email", "messenger"]),
  paymentTerms: z.string().trim().max(500).optional().default(""),
  comment: z.string().trim().max(3000).optional().default(""),
  consent: z.literal(true),
  sourcePath: z.string().trim().max(500).optional().default("/request"),
  items: z.array(requestItemSchema).min(1).max(200)
});

export type RequestItemInput = z.infer<typeof requestItemSchema>;
export type CommercialRequestInput = z.infer<typeof commercialRequestSchema>;
