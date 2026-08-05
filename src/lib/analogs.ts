export type AnalogStatus = "DIRECT" | "ONE_WAY" | "PARTIAL" | "SIZE_ONLY" | "NO_DIRECT" | "CONFLICT";
export type EvidenceLevel = "A" | "B" | "C" | "R";

export const analogStatusLabels: Record<AnalogStatus, string> = {
  DIRECT: "Подтверждённый прямой аналог",
  ONE_WAY: "Односторонняя замена",
  PARTIAL: "Частичное соответствие",
  SIZE_ONLY: "Совпадение только по размерам",
  NO_DIRECT: "Прямой аналог не подтверждён",
  CONFLICT: "Обнаружены противоречивые данные",
};

export const evidenceLabels: Record<EvidenceLevel, string> = {
  A: "A — высокий уровень подтверждения",
  B: "B — подтверждённый источник, требуется проверка применения",
  C: "C — ограниченное подтверждение",
  R: "R — справочная или размерная информация",
};

export function analogWarnings(status: AnalogStatus): string[] {
  if (status === "SIZE_ONLY") return ["Совпадение только по размерам не подтверждает взаимозаменяемость. Проверьте конструкцию, зазор, точность, уплотнения, сепаратор, нагрузки, обороты и условия эксплуатации."];
  if (status === "CONFLICT") return ["Есть противоречивые данные. Нужна ручная инженерная проверка до подбора замены."];
  if (status === "NO_DIRECT") return ["Прямой аналог не подтверждён. Рассмотрите подбор специалистом."];
  return [];
}
