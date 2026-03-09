import { z } from 'zod';
import { insertBotConfigSchema, botConfig, botLogs } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  config: {
    get: {
      method: 'GET' as const,
      path: '/api/config' as const,
      responses: {
        200: z.custom<typeof botConfig.$inferSelect>().nullable(),
      },
    },
    save: {
      method: 'POST' as const,
      path: '/api/config' as const,
      input: insertBotConfigSchema,
      responses: {
        200: z.custom<typeof botConfig.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    toggle: {
      method: 'POST' as const,
      path: '/api/config/toggle' as const,
      input: z.object({ isActive: z.boolean() }),
      responses: {
        200: z.custom<typeof botConfig.$inferSelect>(),
        400: errorSchemas.validation,
      }
    }
  },
  logs: {
    list: {
      method: 'GET' as const,
      path: '/api/logs' as const,
      responses: {
        200: z.array(z.custom<typeof botLogs.$inferSelect>()),
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
