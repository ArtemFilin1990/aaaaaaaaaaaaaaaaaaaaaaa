import { db } from "./db";
import { botConfig, botLogs, type BotConfig, type InsertBotConfig, type BotLog, type InsertBotLog } from "@shared/schema";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  getConfig(): Promise<BotConfig | undefined>;
  saveConfig(config: InsertBotConfig): Promise<BotConfig>;
  updateConfig(id: number, updates: Partial<InsertBotConfig>): Promise<BotConfig>;
  getLogs(): Promise<BotLog[]>;
  addLog(log: InsertBotLog): Promise<BotLog>;
}

export class DatabaseStorage implements IStorage {
  async getConfig(): Promise<BotConfig | undefined> {
    const configs = await db.select().from(botConfig).limit(1);
    return configs[0] || undefined;
  }

  async saveConfig(config: InsertBotConfig): Promise<BotConfig> {
    const existing = await this.getConfig();
    if (existing) {
      const [updated] = await db.update(botConfig)
        .set(config)
        .where(eq(botConfig.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(botConfig).values(config).returning();
      return created;
    }
  }

  async updateConfig(id: number, updates: Partial<InsertBotConfig>): Promise<BotConfig> {
    const [updated] = await db.update(botConfig)
      .set(updates)
      .where(eq(botConfig.id, id))
      .returning();
    return updated;
  }

  async getLogs(): Promise<BotLog[]> {
    return await db.select().from(botLogs).orderBy(desc(botLogs.createdAt)).limit(50);
  }

  async addLog(log: InsertBotLog): Promise<BotLog> {
    const [created] = await db.insert(botLogs).values(log).returning();
    return created;
  }
}

export const storage = new DatabaseStorage();
