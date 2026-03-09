import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Activity, Bot, Power, Save, KeyRound, Database, RefreshCcw, ShieldAlert, TerminalSquare } from "lucide-react";
import { z } from "zod";

import { useBotConfig, useSaveBotConfig, useToggleBot, useBotLogs } from "@/hooks/use-bot-api";
import { insertBotConfigSchema, type InsertBotConfig } from "@shared/schema";
import { cn, formatDate } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";

export default function Dashboard() {
  const { data: config, isLoading: isConfigLoading } = useBotConfig();
  const { data: logs, isLoading: isLogsLoading, isRefetching } = useBotLogs();
  
  const saveConfig = useSaveBotConfig();
  const toggleBot = useToggleBot();

  const form = useForm<InsertBotConfig>({
    resolver: zodResolver(insertBotConfigSchema),
    defaultValues: {
      tgToken: "",
      dadataApiKey: "",
      dadataSecretKey: "",
      isActive: false,
    },
  });

  // Reset form when config data arrives
  useEffect(() => {
    if (config) {
      form.reset({
        tgToken: config.tgToken,
        dadataApiKey: config.dadataApiKey,
        dadataSecretKey: config.dadataSecretKey || "",
        isActive: config.isActive,
      });
    }
  }, [config, form]);

  const onSubmit = (data: InsertBotConfig) => {
    saveConfig.mutate(data);
  };

  const handleToggle = () => {
    if (!config) return;
    toggleBot.mutate(!config.isActive);
  };

  const isConfigured = !!config && config.tgToken && config.dadataApiKey;
  const isRunning = config?.isActive;

  if (isConfigLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Spinner className="w-8 h-8 text-primary" />
          <p className="text-zinc-500 font-medium animate-pulse">Загрузка панели управления...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F2F2F7] pb-10">
      
      {/* iOS Header */}
      <header className="px-4 pt-14 pb-4 bg-[#F2F2F7]/80 backdrop-blur-md sticky top-0 z-50">
        <h1 className="text-[34px] font-bold tracking-tight text-black">Dadata Бот</h1>
      </header>

      <div className="px-4 space-y-8 max-w-2xl mx-auto">
        
        {/* Status Group */}
        <section className="space-y-2">
          <h2 className="px-4 text-[13px] uppercase text-zinc-500 font-medium">Статус</h2>
          <div className="ios-inset-group">
            <div className="ios-row justify-between">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-2.5 h-2.5 rounded-full",
                  isRunning ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]" : "bg-zinc-300"
                )} />
                <span className="text-[17px] font-medium">Бот {isRunning ? "активен" : "выключен"}</span>
              </div>
              <button
                onClick={handleToggle}
                disabled={!isConfigured || toggleBot.isPending}
                className={cn(
                  "text-[17px] font-semibold transition-opacity active:opacity-50",
                  isRunning ? "text-red-500" : "text-[#007AFF]",
                  (!isConfigured || toggleBot.isPending) && "opacity-30"
                )}
              >
                {isRunning ? "Выключить" : "Включить"}
              </button>
            </div>
            {!isConfigured && (
              <div className="ios-row py-2">
                <p className="text-[13px] text-amber-600 flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  Нужна настройка
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Config Group */}
        <section className="space-y-2">
          <h2 className="px-4 text-[13px] uppercase text-zinc-500 font-medium">Настройки API</h2>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="ios-inset-group">
              <div className="ios-row">
                <KeyRound className="w-5 h-5 text-[#007AFF] mr-3" />
                <input
                  type="password"
                  placeholder="Токен Telegram"
                  className="ios-input"
                  {...form.register("tgToken")}
                />
              </div>
              <div className="ios-row">
                <Database className="w-5 h-5 text-[#5856D6] mr-3" />
                <input
                  type="password"
                  placeholder="API-ключ Dadata"
                  className="ios-input"
                  {...form.register("dadataApiKey")}
                />
              </div>
              <div className="ios-row">
                <TerminalSquare className="w-5 h-5 text-[#AF52DE] mr-3" />
                <input
                  type="password"
                  placeholder="Секретный ключ (опционально)"
                  className="ios-input"
                  {...form.register("dadataSecretKey")}
                />
              </div>
            </div>

            <div className="px-4">
              <button
                type="submit"
                disabled={saveConfig.isPending || !form.formState.isDirty}
                className="ios-button-primary disabled:opacity-30 flex items-center justify-center gap-2"
              >
                {saveConfig.isPending && <Spinner className="w-4 h-4" />}
                Сохранить изменения
              </button>
            </div>
          </form>
        </section>

        {/* Logs Group */}
        <section className="space-y-2">
          <div className="flex items-center justify-between px-4">
            <h2 className="text-[13px] uppercase text-zinc-500 font-medium">Последние запросы</h2>
            <RefreshCcw className={cn("w-3.5 h-3.5 text-zinc-400", isRefetching && "animate-spin")} />
          </div>
          
          <div className="ios-inset-group">
            {isLogsLoading ? (
              <div className="p-8 flex justify-center"><Spinner /></div>
            ) : logs && logs.length > 0 ? (
              logs.map((log) => (
                <div key={log.id} className="ios-row items-start py-4 flex-col gap-1">
                  <div className="flex justify-between w-full items-baseline">
                    <span className="font-bold text-[17px] text-black truncate max-w-[70%]">
                      {log.username || "Аноним"}
                    </span>
                    <span className="text-[13px] text-zinc-400 whitespace-nowrap">
                      {formatDate(log.createdAt)}
                    </span>
                  </div>
                  <div className="text-[15px] text-zinc-500 truncate w-full">
                    📥 {log.query}
                  </div>
                  <div className="text-[15px] text-[#007AFF] font-medium line-clamp-2 mt-1">
                    📤 {log.response}
                  </div>
                </div>
              ))
            ) : (
              <div className="p-10 text-center text-zinc-400 text-[15px]">
                Нет запросов
              </div>
            )}
          </div>
        </section>
        
        <p className="text-center text-[12px] text-zinc-400 font-medium">
          Dadata Telegram Bot v1.0
        </p>
      </div>
    </div>
  );
}
