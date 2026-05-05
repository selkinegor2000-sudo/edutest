import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BrainCircuit, CheckCircle, XCircle, Lightbulb, Sparkles, AlertCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

const levelColors: Record<string, string> = {
  "Отличник": "bg-green-500",
  "Хорошист": "bg-blue-500",
  "Требует улучшения": "bg-yellow-500",
  "Начальный уровень": "bg-red-500",
  "Нет данных": "bg-gray-400",
};

export default function AiAnalysisPage() {
  const [analysis, setAnalysis] = useState<any>(null);

  const { data: results } = useQuery<any[]>({
    queryKey: ["/api/student/results"],
  });

  const { mutate: runAnalysis, isPending } = useMutation({
    mutationFn: () => apiRequest("POST", "/api/student/ai-analysis"),
    onSuccess: async (res) => {
      const data = await res.json();
      setAnalysis(data);
    },
  });

  const hasResults = results && results.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BrainCircuit className="h-6 w-6 text-primary" />
          AI-анализ успеваемости
        </h1>
        <p className="text-muted-foreground mt-1">
          Персональный анализ ваших результатов на основе искусственного интеллекта
        </p>
      </div>

      {/* Кнопка запуска */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className="font-medium">Получить персональный отчёт</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                ИИ проанализирует все ваши результаты и даст рекомендации
                {results ? ` (пройдено тестов: ${results.length})` : ""}
              </p>
            </div>
            <Button
              onClick={() => runAnalysis()}
              disabled={isPending || !hasResults}
              className="gap-2 min-w-[160px]"
            >
              {isPending ? (
                <>
                  <Sparkles className="h-4 w-4 animate-spin" />
                  Анализирую…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  {analysis ? "Обновить анализ" : "Запустить анализ"}
                </>
              )}
            </Button>
          </div>
          {!hasResults && (
            <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground p-3 bg-muted rounded-lg">
              <AlertCircle className="h-4 w-4 shrink-0" />
              Пройдите хотя бы один тест, чтобы получить AI-анализ
            </div>
          )}
        </CardContent>
      </Card>

      {/* Скелетон во время загрузки */}
      {isPending && (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
          <Skeleton className="h-40 w-full" />
        </div>
      )}

      {/* Результаты анализа */}
      {analysis && !isPending && (
        <div className="space-y-4">
          {/* Общий уровень + краткая характеристика */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle>Общая оценка</CardTitle>
                <Badge
                  className={`${levelColors[analysis.overallLevel] || "bg-gray-400"} text-white`}
                >
                  {analysis.overallLevel}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed">{analysis.summary}</p>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Сильные стороны */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  Сильные стороны
                </CardTitle>
              </CardHeader>
              <CardContent>
                {analysis.strengths?.length > 0 ? (
                  <ul className="space-y-2">
                    {analysis.strengths.map((s: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">Пройдите больше тестов для анализа</p>
                )}
              </CardContent>
            </Card>

            {/* Слабые места */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <XCircle className="h-5 w-5 text-red-500" />
                  Требует внимания
                </CardTitle>
              </CardHeader>
              <CardContent>
                {analysis.weaknesses?.length > 0 ? (
                  <ul className="space-y-2">
                    {analysis.weaknesses.map((w: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <XCircle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
                        <span>{w}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">Слабых мест не выявлено</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Рекомендации */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-yellow-500" />
                Рекомендации
              </CardTitle>
            </CardHeader>
            <CardContent>
              {analysis.recommendations?.length > 0 ? (
                <ol className="space-y-3">
                  {analysis.recommendations.map((rec: string, i: number) => (
                    <li key={i} className="flex items-start gap-3 text-sm">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-xs">
                        {i + 1}
                      </span>
                      <span className="mt-0.5">{rec}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-muted-foreground">Рекомендации не сформированы</p>
              )}
            </CardContent>
          </Card>

          <p className="text-xs text-muted-foreground text-center">
            Анализ выполнен с помощью Llama 3.3 via Groq AI
          </p>
        </div>
      )}
    </div>
  );
}
