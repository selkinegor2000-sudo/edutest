import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  ArrowLeft, 
  Trophy,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Clock,
  Sparkles
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { TestAttempt, Test, Answer, Question, QuestionOption } from "@shared/schema";

type FullAttempt = TestAttempt & {
  test: Test;
  proctorEvents?: Array<{
    id: string;
    eventType: string;
    details?: string | null;
    idleSeconds?: number | null;
    createdAt?: string | Date | null;
  }>;
  answers: (Answer & {
    question: Question & { options: QuestionOption[] };
  })[];
};

export default function ResultsPage() {
  const { id } = useParams<{ id: string }>();

  const { data: attempt, isLoading } = useQuery<FullAttempt>({
    queryKey: ["/api/attempts", id, "full"],
  });

  const { data: testResults } = useQuery<{ attempts: any[] }>({
    queryKey: ["/api/tests", attempt?.testId, "stats"],
    enabled: !!attempt?.testId,
  });

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!attempt) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <h2 className="text-xl font-semibold mb-2">Результат не найден</h2>
        <Link href="/">
          <Button>Вернуться на главную</Button>
        </Link>
      </div>
    );
  }

  const scorePercent = attempt.maxScore 
    ? (Number(attempt.score) / attempt.maxScore) * 100 
    : 0;

  const getScoreColor = (percent: number) => {
    if (percent >= 80) return "text-green-600 dark:text-green-400";
    if (percent >= 60) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  const getScoreBg = (percent: number) => {
    if (percent >= 80) return "bg-green-500/10";
    if (percent >= 60) return "bg-yellow-500/10";
    return "bg-red-500/10";
  };

  const proctorScore = Number(attempt.proctorScore || 0);
  const suspiciousEventsCount = Number(attempt.suspiciousEventsCount || 0);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Результаты теста</h1>
          <p className="text-muted-foreground">{attempt.test.title}</p>
        </div>
      </div>

      <Card className={getScoreBg(scorePercent)}>
        <CardContent className="py-8">
          <div className="flex flex-col items-center text-center">
            <Trophy className={`h-16 w-16 mb-4 ${getScoreColor(scorePercent)}`} />
            <div className={`text-5xl font-bold mb-2 ${getScoreColor(scorePercent)}`}>
              {scorePercent.toFixed(0)}%
            </div>
            <p className="text-muted-foreground mb-4">
              {Number(attempt.score).toFixed(1)} из {attempt.maxScore} баллов
            </p>
            <Progress value={scorePercent} className="w-64 h-3" />
            {attempt.test.isCompetitive && (
              <Link href={`/test/${attempt.testId}/leaderboard`}>
                <Button variant="outline" className="mt-4" data-testid="button-view-leaderboard">
                  <Trophy className="mr-2 h-4 w-4" />
                  Посмотреть рейтинг
                </Button>
              </Link>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="py-4 flex items-center gap-3">
            <CheckCircle2 className="h-8 w-8 text-green-500" />
            <div>
              <p className="font-medium">
                {attempt.answers.filter((a) => a.isCorrect).length}
              </p>
              <p className="text-sm text-muted-foreground">Правильных</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 flex items-center gap-3">
            <XCircle className="h-8 w-8 text-red-500" />
            <div>
              <p className="font-medium">
                {attempt.answers.filter((a) => !a.isCorrect).length}
              </p>
              <p className="text-sm text-muted-foreground">Неправильных</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 flex items-center gap-3">
            <Clock className="h-8 w-8 text-primary" />
            <div>
              <p className="font-medium">
                {attempt.completedAt && attempt.startedAt
                  ? Math.round((new Date(attempt.completedAt).getTime() - new Date(attempt.startedAt).getTime()) / 60000)
                  : "—"} мин
              </p>
              <p className="text-sm text-muted-foreground">Затрачено</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Прокторинг</CardTitle>
            <CardDescription>Оценка достоверности прохождения</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-center justify-between text-sm mb-2">
                <span>Индекс доверия</span>
                <span className="font-medium">{proctorScore}%</span>
              </div>
              <Progress value={proctorScore} className="h-2" />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3 text-sm">
              <span>Подозрительных событий</span>
              <Badge variant={suspiciousEventsCount > 0 ? "destructive" : "secondary"}>{suspiciousEventsCount}</Badge>
            </div>
            <div className="rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">
              {attempt.proctorSummary || "Данные прокторинга отсутствуют"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Таймлайн действий</CardTitle>
            <CardDescription>События, зафиксированные во время прохождения</CardDescription>
          </CardHeader>
          <CardContent>
            {attempt.proctorEvents && attempt.proctorEvents.length > 0 ? (
              <div className="space-y-3">
                {attempt.proctorEvents.map((event) => (
                  <div key={event.id} className="rounded-lg border p-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium">{event.eventType}</span>
                      <span className="text-xs text-muted-foreground">
                        {event.createdAt ? new Date(event.createdAt).toLocaleTimeString("ru-RU") : "без времени"}
                      </span>
                    </div>
                    {event.details && <p className="mt-1 text-muted-foreground">{event.details}</p>}
                    {event.idleSeconds ? <p className="mt-1 text-muted-foreground">Пауза: {event.idleSeconds} сек.</p> : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">События прокторинга не зафиксированы</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Разбор ответов</CardTitle>
          <CardDescription>
            Детальный анализ ваших ответов
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {attempt.answers.map((answer, index) => (
            <div 
              key={answer.id} 
              className="p-4 rounded-lg border"
              data-testid={`result-answer-${index}`}
            >
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex items-center gap-2">
                  <span className="font-medium">Вопрос {index + 1}</span>
                  {answer.isCorrect ? (
                    <Badge className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Верно
                    </Badge>
                  ) : (
                    <Badge className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20">
                      <XCircle className="h-3 w-3 mr-1" />
                      Неверно
                    </Badge>
                  )}
                </div>
                <Badge variant="secondary">
                  {Number(answer.pointsAwarded || 0).toFixed(1)} / {answer.question.points}
                </Badge>
              </div>

              <p className="text-muted-foreground mb-4">{answer.question.text}</p>

              {answer.question.type !== "open_answer" && (
                <div className="space-y-2 mb-4">
                  {answer.question.options.map((option) => {
                    const isSelected = answer.selectedOptionIds?.includes(option.id);
                    const isCorrect = option.isCorrect;
                    
                    let optionClass = "p-3 rounded-lg border ";
                    if (isSelected && isCorrect) {
                      optionClass += "bg-green-500/10 border-green-500/30";
                    } else if (isSelected && !isCorrect) {
                      optionClass += "bg-red-500/10 border-red-500/30";
                    } else if (!isSelected && isCorrect) {
                      optionClass += "bg-green-500/5 border-green-500/20";
                    }

                    return (
                      <div key={option.id} className={optionClass}>
                        <div className="flex items-center gap-2">
                          {isCorrect && (
                            <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                          )}
                          {isSelected && !isCorrect && (
                            <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                          )}
                          <span className={isCorrect ? "font-medium" : ""}>{option.text}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {answer.question.type === "open_answer" && (
                <div className="space-y-4">
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-sm font-medium mb-1 flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" />
                      Ваш ответ:
                    </p>
                    <p>{answer.answerText || "Ответ не дан"}</p>
                  </div>

                  {answer.question.correctAnswer && (
                    <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                      <p className="text-sm font-medium mb-1 flex items-center gap-2 text-green-600 dark:text-green-400">
                        <CheckCircle2 className="h-4 w-4" />
                        Эталонный ответ:
                      </p>
                      <p>{answer.question.correctAnswer}</p>
                    </div>
                  )}

                  {answer.aiFeedback && (
                    <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                      <p className="text-sm font-medium mb-1 flex items-center gap-2 text-primary">
                        <Sparkles className="h-4 w-4" />
                        Анализ AI (Llama 3.3 via Groq):
                      </p>
                      <p className="text-sm whitespace-pre-line">{answer.aiFeedback}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {testResults && testResults.attempts && testResults.attempts.length > 1 && (() => {
        const completed = testResults.attempts.filter((a: any) => a.status === "completed");
        const avgAll = completed.length > 0
          ? completed.reduce((acc: number, a: any) => acc + (a.maxScore ? (Number(a.score) / a.maxScore) * 100 : 0), 0) / completed.length
          : 0;
        const chartData = [
          { name: "Ваш результат", value: scorePercent },
          { name: "Средний по группе", value: avgAll },
        ];
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5" />
                Сравнение с группой
              </CardTitle>
              <CardDescription>Ваш результат по сравнению со средним среди всех студентов</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} barSize={60}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" className="text-xs" />
                    <YAxis domain={[0, 100]} unit="%" className="text-xs" />
                    <Tooltip formatter={(v: number) => [`${v.toFixed(1)}%`]} contentStyle={{ backgroundColor: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      <Cell fill="hsl(var(--primary))" />
                      <Cell fill="hsl(var(--muted-foreground))" opacity={0.5} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="text-sm text-muted-foreground mt-2 text-center">
                Всего попыток в этом тесте: {completed.length}
              </p>
            </CardContent>
          </Card>
        );
      })()}

      <div className="flex justify-center">
        <Link href="/">
          <Button size="lg" data-testid="button-back-to-dashboard">
            Вернуться на главную
          </Button>
        </Link>
      </div>
    </div>
  );
}
