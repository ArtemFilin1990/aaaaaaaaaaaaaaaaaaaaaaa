import { pgTable, text, serial, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const botConfig = pgTable("bot_config", {
  id: serial("id").primaryKey(),
  tgToken: text("tg_token").notNull(),
  dadataApiKey: text("dadata_api_key").notNull(),
  dadataSecretKey: text("dadata_secret_key"),
  isActive: boolean("is_active").default(false).notNull(),
});

export const botLogs = pgTable("bot_logs", {
  id: serial("id").primaryKey(),
  chatId: text("chat_id").notNull(),
  username: text("username"),
  query: text("query").notNull(),
  response: text("response").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertBotConfigSchema = createInsertSchema(botConfig).omit({ id: true });
export const insertBotLogSchema = createInsertSchema(botLogs).omit({ id: true, createdAt: true });

export type BotConfig = typeof botConfig.$inferSelect;
export type InsertBotConfig = z.infer<typeof insertBotConfigSchema>;

export type BotLog = typeof botLogs.$inferSelect;
export type InsertBotLog = z.infer<typeof insertBotLogSchema>;
