import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BrainCircuit, CheckCircle, XCircle, Lightbulb, Sparkles, AlertCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type TopicBreakdownItem = {
  topic: string;
  risk?: string;
  note?: string;
};

type AnalysisResponse = {
  overallLevel: string;
  summary: string;
  strengths?: string[];
  weaknesses?: string[];
  recommendations?: string[];
  topicBreakdown?: TopicBreakdownItem[];
  revisionPlan?: string[];
};

type StudentResultsResponse = {
  results: any[];
  totalTests?: number;
};

type AiModelsResponse = {
  provider: string;
  currentModel: string | null;
  models: string[];
};

const levelColors: Record<string, string> = {
  "Отличник": "bg-green-500",
  "Хорошист": "bg-blue-500",
  "Требует улучшения": "bg-yellow-500",
  "Начальный уровень": "bg-red-500",
  "Нет данных": "bg-gray-400",
};

export default function AiAnalysisPage() {
  const { toast } = useToast();
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [analysisError, setAnalysisError] = useState<string>("");
  const [selectedModel, setSelectedModel] = useState<string>("");

  const { data: resultsResponse } = useQuery<StudentResultsResponse | any[]>({
    queryKey: ["/api/student/results"],
  });

  const { data: aiModelsData } = useQuery<AiModelsResponse>({
    queryKey: ["/api/ai/models"],
    queryFn: async () => {
      const response = await fetch("/api/ai/models", { credentials: "include" });
      if (!response.ok) {
        throw new Error("Не удалось загрузить список моделей");
      }
      return response.json();
    },
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!selectedModel && aiModelsData?.models?.length) {
      setSelectedModel(aiModelsData.currentModel || aiModelsData.models[0]);
    }
  }, [aiModelsData, selectedModel]);

  const { mutate: runAnalysis, isPending } = useMutation({
    mutationFn: () => apiRequest("POST", "/api/student/ai-analysis", selectedModel ? { model: selectedModel } : undefined),
    onSuccess: async (res) => {
      const data = await res.json();
      setAnalysis(data);
      setAnalysisError("");
    },
    onError: (error: Error) => {
      const message = error.message || "Не удалось выполнить AI-анализ";
      setAnalysisError(message);
      toast({
        title: "Ошибка AI-анализа",
        description: message,
        variant: "destructive",
      });
    },
  });

  const results = Array.isArray(resultsResponse)
    ? resultsResponse
    : Array.isArray(resultsResponse?.results)
      ? resultsResponse.results
      : [];
  const resultsCount = typeof resultsResponse === "object" && resultsResponse && !Array.isArray(resultsResponse)
    ? Number(resultsResponse.totalTests ?? results.length)
    : results.length;
  const hasResults = resultsCount > 0;
  const availableModels = aiModelsData?.models ?? [];
  const hasModels = availableModels.length > 0;
  const strengths = analysis?.strengths ?? [];
  const weaknesses = analysis?.weaknesses ?? [];
  const recommendations = analysis?.recommendations ?? [];

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
                {resultsResponse ? ` (пройдено тестов: ${resultsCount})` : ""}
              </p>
              <div className="mt-3 max-w-sm">
                <p className="text-xs text-muted-foreground mb-1">Модель для приоритетного запуска</p>
                <Select value={selectedModel} onValueChange={setSelectedModel} disabled={isPending}>
                  <SelectTrigger>
                    <SelectValue placeholder="Автовыбор модели" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableModels.map((model) => (
                      <SelectItem key={model} value={model}>{model}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-2">
                  Если выбранная модель недоступна, система автоматически попробует другие.
                </p>
              </div>
            </div>
            <Button
              onClick={() => {
                setAnalysisError("");
                runAnalysis();
              }}
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
          {!hasModels && (
            <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground p-3 bg-muted rounded-lg">
              <AlertCircle className="h-4 w-4 shrink-0" />
              Список моделей временно недоступен. Анализ запустится в авто-режиме.
            </div>
          )}
          {analysisError && (
            <div className="mt-4 flex items-center gap-2 text-sm text-destructive p-3 bg-destructive/10 rounded-lg">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {analysisError}
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
                {strengths.length > 0 ? (
                  <ul className="space-y-2">
                    {strengths.map((s: string, i: number) => (
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
                {weaknesses.length > 0 ? (
                  <ul className="space-y-2">
                    {weaknesses.map((w: string, i: number) => (
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
              {recommendations.length > 0 ? (
                <ol className="space-y-3">
                  {recommendations.map((rec: string, i: number) => (
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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle>Разбор по темам</CardTitle>
              </CardHeader>
              <CardContent>
                {analysis.topicBreakdown && analysis.topicBreakdown.length > 0 ? (
                  <div className="space-y-3">
                    {analysis.topicBreakdown.map((item, index) => (
                      <div key={`${item.topic}-${index}`} className="rounded-lg border p-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-medium text-sm">{item.topic}</p>
                          {item.risk && <Badge variant="outline">Риск: {item.risk}</Badge>}
                        </div>
                        {item.note && <p className="mt-2 text-sm text-muted-foreground">{item.note}</p>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Разбивка по темам пока не сформирована</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle>Мини-план повторения</CardTitle>
              </CardHeader>
              <CardContent>
                {analysis.revisionPlan && analysis.revisionPlan.length > 0 ? (
                  <ol className="space-y-3">
                    {analysis.revisionPlan.map((step, index) => (
                      <li key={`${step}-${index}`} className="flex items-start gap-3 text-sm">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-xs">
                          {index + 1}
                        </span>
                        <span className="mt-0.5">{step}</span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-sm text-muted-foreground">План повторения пока не сформирован</p>
                )}
              </CardContent>
            </Card>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Анализ выполнен с помощью AI-модели {selectedModel || aiModelsData?.currentModel || "по умолчанию"}
          </p>
        </div>
      )}
    </div>
  );
}
