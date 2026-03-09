import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { z } from "zod";
import type { InsertBotConfig } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

// ==========================================
// API HOOKS FOR BOT CONFIGURATION AND LOGS
// ==========================================

export function useBotConfig() {
  return useQuery({
    queryKey: [api.config.get.path],
    queryFn: async () => {
      const res = await fetch(api.config.get.path, { credentials: "include" });
      if (!res.ok) throw new Error("Не удалось загрузить настройки");
      const data = await res.json();
      return api.config.get.responses[200].parse(data);
    },
  });
}

export function useSaveBotConfig() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: InsertBotConfig) => {
      const validated = api.config.save.input.parse(data);
      const res = await fetch(api.config.save.path, {
        method: api.config.save.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
        credentials: "include",
      });
      
      if (!res.ok) {
        if (res.status === 400) {
          const error = api.config.save.responses[400].parse(await res.json());
          throw new Error(error.message);
        }
        throw new Error("Ошибка при сохранении настроек");
      }
      return api.config.save.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.config.get.path] });
      toast({
        title: "Сохранено",
        description: "Настройки бота успешно обновлены.",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: error.message,
      });
    }
  });
}

export function useToggleBot() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (isActive: boolean) => {
      const validated = api.config.toggle.input.parse({ isActive });
      const res = await fetch(api.config.toggle.path, {
        method: api.config.toggle.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
        credentials: "include",
      });
      
      if (!res.ok) {
        throw new Error("Не удалось изменить статус бота");
      }
      return api.config.toggle.responses[200].parse(await res.json());
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [api.config.get.path] });
      toast({
        title: data.isActive ? "Бот запущен" : "Бот остановлен",
        description: data.isActive ? "Бот теперь обрабатывает сообщения." : "Обработка сообщений приостановлена.",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: error.message,
      });
    }
  });
}

export function useBotLogs() {
  return useQuery({
    queryKey: [api.logs.list.path],
    // Poll every 5 seconds for new logs
    refetchInterval: 5000,
    queryFn: async () => {
      const res = await fetch(api.logs.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Не удалось загрузить логи");
      const data = await res.json();
      return api.logs.list.responses[200].parse(data);
    },
  });
}
