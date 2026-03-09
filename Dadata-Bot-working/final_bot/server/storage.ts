import { promises as fs } from "fs";
import path from "path";
import type { BotConfig, InsertBotConfig, BotLog, InsertBotLog } from "@shared/schema";

export interface IStorage {
  getConfig(): Promise<BotConfig | undefined>;
  saveConfig(config: InsertBotConfig): Promise<BotConfig>;
  updateConfig(id: number, updates: Partial<InsertBotConfig>): Promise<BotConfig>;
  getLogs(): Promise<BotLog[]>;
  addLog(log: InsertBotLog): Promise<BotLog>;
}

type StorageFile = {
  nextConfigId: number;
  nextLogId: number;
  config?: BotConfig;
  logs: BotLog[];
};

const DATA_DIR = process.env.BOT_DATA_DIR || path.resolve(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "bot-storage.json");
const MAX_LOGS = 200;

const defaultState: StorageFile = {
  nextConfigId: 1,
  nextLogId: 1,
  config: undefined,
  logs: [],
};

class FileStorage implements IStorage {
  private state: StorageFile | null = null;
  private writeQueue: Promise<void> = Promise.resolve();

  private async ensureLoaded(): Promise<StorageFile> {
    if (this.state) return this.state;

    await fs.mkdir(DATA_DIR, { recursive: true });

    try {
      const raw = await fs.readFile(DATA_FILE, "utf8");
      const parsed = JSON.parse(raw) as Partial<StorageFile>;
      this.state = {
        nextConfigId: Number(parsed.nextConfigId || 1),
        nextLogId: Number(parsed.nextLogId || 1),
        config: parsed.config,
        logs: Array.isArray(parsed.logs) ? parsed.logs : [],
      };
    } catch {
      this.state = { ...defaultState };
      await this.persist();
    }

    return this.state;
  }

  private async persist(): Promise<void> {
    const snapshot = this.state ?? { ...defaultState };
    const body = JSON.stringify(snapshot, null, 2);
    this.writeQueue = this.writeQueue.then(() => fs.writeFile(DATA_FILE, body, "utf8"));
    await this.writeQueue;
  }

  async getConfig(): Promise<BotConfig | undefined> {
    const state = await this.ensureLoaded();
    return state.config;
  }

  async saveConfig(config: InsertBotConfig): Promise<BotConfig> {
    const state = await this.ensureLoaded();
    const now = state.config;

    state.config = now
      ? { ...now, ...config }
      : {
          id: state.nextConfigId++,
          tgToken: config.tgToken,
          dadataApiKey: config.dadataApiKey,
          dadataSecretKey: config.dadataSecretKey ?? null,
          checkoApiKey: config.checkoApiKey ?? null,
          isActive: Boolean(config.isActive),
        };

    await this.persist();
    return state.config;
  }

  async updateConfig(id: number, updates: Partial<InsertBotConfig>): Promise<BotConfig> {
    const state = await this.ensureLoaded();
    if (!state.config || state.config.id !== id) {
      throw new Error("Config not found");
    }

    state.config = {
      ...state.config,
      ...updates,
      dadataSecretKey: updates.dadataSecretKey ?? state.config.dadataSecretKey,
      checkoApiKey: updates.checkoApiKey ?? state.config.checkoApiKey,
    };

    await this.persist();
    return state.config;
  }

  async getLogs(): Promise<BotLog[]> {
    const state = await this.ensureLoaded();
    return [...state.logs]
      .sort((a, b) => new Date(String(b.createdAt ?? 0)).getTime() - new Date(String(a.createdAt ?? 0)).getTime())
      .slice(0, 50);
  }

  async addLog(log: InsertBotLog): Promise<BotLog> {
    const state = await this.ensureLoaded();
    const created: BotLog = {
      id: state.nextLogId++,
      chatId: log.chatId,
      username: log.username ?? null,
      query: log.query,
      response: log.response,
      createdAt: new Date(),
    };

    state.logs.unshift(created);
    if (state.logs.length > MAX_LOGS) {
      state.logs = state.logs.slice(0, MAX_LOGS);
    }

    await this.persist();
    return created;
  }
}

export const storage: IStorage = new FileStorage();
