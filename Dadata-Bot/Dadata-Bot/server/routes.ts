import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import fetch from "node-fetch";

// We'll run a simple polling loop here to act as the TG bot using the stored configuration
let isPolling = false;
let pollingTimeout: NodeJS.Timeout | null = null;
let lastUpdateId = 0;

async function dadataSuggest(query: string, apiKey: string, secretKey?: string | null) {
  const isInn = /^\d{10}$|^\d{12}$/.test(query.trim());

  if (isInn) {
    // Search by INN
    const url = "https://suggestions.dadata.ru/suggestions/api/4_1/rs/findById/party";
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "Authorization": `Token ${apiKey}`
    };

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ query: query.trim() })
    });

    if (!response.ok) {
      throw new Error(`Dadata API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as any;
    if (data.suggestions && data.suggestions.length > 0) {
      const company = data.suggestions[0];
      const d = company.data;
      const status = d.state.status === "ACTIVE" ? "✅ Действующее" : 
                     d.state.status === "LIQUIDATED" ? "❌ Ликвидировано" : 
                     d.state.status === "LIQUIDATING" ? "⚠️ Ликвидируется" : d.state.status;
      
      let responseText = `🏢 **${company.value}**\n` +
             `━━━━━━━━━━━━━━━━━━\n` +
             `🔹 **ИНН:** \`${d.inn}\`\n` +
             `🔹 **КПП:** \`${d.kpp || "—"}\`\n` +
             `🔹 **ОГРН:** \`${d.ogrn}\`\n\n` +
             `📌 **Статус:** ${status}\n` +
             `📅 **Дата регистрации:** ${d.state.registration_date ? new Date(d.state.registration_date).toLocaleDateString('ru-RU') : "—"}\n\n` +
             `👤 **Руководитель:**\n${d.management?.name || "нет данных"}\n` +
             `💼 *${d.management?.post || "должность не указана"}*\n\n` +
             `📍 **Адрес:**\n${d.address.value}\n\n` +
             `📊 **Дополнительно:**\n` +
             `• Уставный капитал: ${d.capital?.value ? new Intl.NumberFormat('ru-RU').format(d.capital.value) + ' ₽' : "—"}\n` +
             `• Число сотрудников: ${d.employee_count || "нет данных"}\n` +
             `• Основной ОКВЭД: \`${d.okved}\`\n` +
             `  _${d.okveds?.[0]?.name || "—"}_\n\n` +
             `📞 **Контакты:**\n` +
             `• Тел: ${d.phones?.[0]?.value || "—"}\n` +
             `• Email: ${d.emails?.[0]?.value || "—"}`;

      // Build inline keyboard like @egrul_bot
      const inline_keyboard = [
        [
          { text: "📂 Выписка из ЕГРЮЛ (PDF)", url: `https://egrul.nalog.ru/index.html?query=${d.inn}` },
        ],
        [
          { text: "⚖️ Арбитраж", url: `https://pb.nalog.ru/search.html?query=${d.inn}&mode=search-all` },
          { text: "💸 Долги (ФССП)", url: `https://pb.nalog.ru/search.html?query=${d.inn}&mode=search-all` }
        ],
        [
          { text: "🏗️ Госзакупки", url: `https://zakupki.gov.ru/epz/order/extendedsearch/results.html?searchString=${d.inn}` },
          { text: "🔗 Связи", url: `https://pb.nalog.ru/search.html?query=${d.inn}&mode=search-all` }
        ],
        [
          { text: "📊 Бух. отчетность", url: `https://bo.nalog.ru/search?query=${d.inn}` },
          { text: "🔍 Проверки", url: `https://pb.nalog.ru/search.html?query=${d.inn}&mode=search-all` }
        ],
        [
          { text: "📈 Финансы и налоги", url: `https://pb.nalog.ru/search.html?query=${d.inn}&mode=search-all` }
        ]
      ];

      return { text: responseText, parse_mode: "Markdown", reply_markup: { inline_keyboard } };
    }
    return { text: "Организация по ИНН не найдена" };
  } else {
    // Standardize address
    const url = "https://cleaner.dadata.ru/api/v1/clean/address";
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "Authorization": `Token ${apiKey}`
    };
    if (secretKey) {
      headers["X-Secret"] = secretKey;
    }
    
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify([query])
    });

    if (!response.ok) {
      throw new Error(`Dadata API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as any[];
    if (data && data.length > 0 && data[0].result) {
      const resultText = `📍 ${data[0].result}\n` +
             `📮 Индекс: ${data[0].postal_code || "нет"}\n` +
             `🌍 Координаты: ${data[0].geo_lat}, ${data[0].geo_lon}`;
      return { text: resultText };
    }
    return { text: "Ничего не найдено или не удалось стандартизировать адрес" };
  }
}

async function startBot() {
  if (isPolling) return;
  const config = await storage.getConfig();
  if (!config || !config.isActive || !config.tgToken) return;

  isPolling = true;
  pollTelegram(config);
}

function stopBot() {
  isPolling = false;
  if (pollingTimeout) {
    clearTimeout(pollingTimeout);
    pollingTimeout = null;
  }
}

async function pollTelegram(config: any) {
  if (!isPolling) return;

  try {
    const url = `https://api.telegram.org/bot${config.tgToken}/getUpdates?offset=${lastUpdateId + 1}&timeout=30`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json() as any;
      if (data.ok && data.result) {
        for (const update of data.result) {
          lastUpdateId = update.update_id;
          
          if (update.message && update.message.text) {
            const chatId = update.message.chat.id;
            const text = update.message.text;
            const username = update.message.from?.username || update.message.from?.first_name || "Unknown";

            if (text === "/start") {
              const menuText = "Привет! Я бот для работы с Dadata.\n\n" +
                "🔍 Что я умею:\n" +
                "1. **Стандартизация адресов**: просто пришли мне адрес текстом.\n" +
                "2. **Поиск организаций по ИНН**: пришли 10 или 12 цифр ИНН.\n\n" +
                "Доступные команды:\n" +
                "/start - Показать это меню\n" +
                "/help - Справка по работе с ботом";
              
              await fetch(`https://api.telegram.org/bot${config.tgToken}/sendMessage`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  chat_id: chatId,
                  text: menuText
                })
              });
              continue;
            }

            if (text === "/help") {
              const helpText = "📖 Как пользоваться ботом:\n\n" +
                "🏠 **Адреса**:\n" +
                "Отправьте текст адреса в любом формате, например:\n" +
                "'мск сухонская 11 89'\n" +
                "Я верну полный официальный адрес, индекс и координаты.\n\n" +
                "🏢 **Организации**:\n" +
                "Отправьте ИНН компании (10 цифр) или ИП (12 цифр), например:\n" +
                "'7707083893'\n" +
                "Я найду название, статус (действующая или нет), руководителя и адрес.";
              
              await fetch(`https://api.telegram.org/bot${config.tgToken}/sendMessage`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  chat_id: chatId,
                  text: helpText
                })
              });
              continue;
            }

            let botResponse: any = "";
            try {
              botResponse = await dadataSuggest(text, config.dadataApiKey, config.dadataSecretKey);
            } catch (err: any) {
              botResponse = { text: `Ошибка Dadata: ${err.message}` };
            }

            const responseObj = typeof botResponse === "string" ? { text: botResponse } : botResponse;

            await storage.addLog({
              chatId: String(chatId),
              username,
              query: text,
              response: responseObj.text
            });

            await fetch(`https://api.telegram.org/bot${config.tgToken}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: chatId,
                ...responseObj
              })
            });
          }
        }
      }
    }
  } catch (err) {
    console.error("Telegram polling error:", err);
  }

  if (isPolling) {
    pollingTimeout = setTimeout(() => pollTelegram(config), 1000);
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.get(api.config.get.path, async (req, res) => {
    const config = await storage.getConfig();
    res.json(config || null);
  });

  app.post(api.config.save.path, async (req, res) => {
    try {
      const input = api.config.save.input.parse(req.body);
      const config = await storage.saveConfig(input);
      if (config.isActive) {
        startBot();
      } else {
        stopBot();
      }
      res.status(200).json(config);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post(api.config.toggle.path, async (req, res) => {
    try {
      const input = api.config.toggle.input.parse(req.body);
      const config = await storage.getConfig();
      if (!config) {
        return res.status(404).json({ message: "Config not found" });
      }
      const updated = await storage.updateConfig(config.id, { isActive: input.isActive });
      
      if (updated.isActive) {
        startBot();
      } else {
        stopBot();
      }
      
      res.status(200).json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get(api.logs.list.path, async (req, res) => {
    const logs = await storage.getLogs();
    res.json(logs);
  });

  startBot();

  return httpServer;
}
