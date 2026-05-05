import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  BookOpen, 
  Clock, 
  Trophy, 
  TrendingUp, 
  ChevronRight,
  CheckCircle2,
  PlayCircle,
  BarChart3,
  Lightbulb,
  AlertTriangle,
  AlertCircle,
  Info
} from "lucide-react";
import { Star } from "lucide-react";
import { Test, TestAttempt } from "@shared/schema";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

type AvailableTest = Test & { questionCount: number };
type AttemptWithTest = TestAttempt & { test: Test };

export default function StudentDashboard() {
  const { user } = useAuth();

  const { data: availableTests, isLoading: testsLoading } = useQuery<AvailableTest[]>({
    queryKey: ["/api/tests/available"],
  });

  const { data: myAttempts, isLoading: attemptsLoading } = useQuery<AttemptWithTest[]>({
    queryKey: ["/api/attempts/my"],
  });

  const { data: stats, isLoading: statsLoading } = useQuery<{
    totalTests: number;
    averageScore: number;
    completedTests: number;
    progressData: { date: string; score: number }[];
  }>({
    queryKey: ["/api/stats/student"],
  });

  const { data: recommendations, isLoading: recommendationsLoading } = useQuery<{
    weakAreas: { subject: string; incorrectCount: number; totalCount: number; errorRate: number; problemQuestions: string[] }[];
    recommendations: { subject: string; message: string; priority: "high" | "medium" | "low" }[];
    totalQuestions: number;
    totalIncorrect: number;
  }>({
    queryKey: ["/api/recommendations"],
  });

  const completedAttempts = myAttempts?.filter(a => a.status === "completed") || [];
  const inProgressAttempts = myAttempts?.filter(a => a.status === "in_progress") || [];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">
          Добро пожаловать, {user?.fullName}!
        </h1>
        <p className="text-muted-foreground">
          Ваша панель управления с доступными тестами и статистикой
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Пройдено тестов
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold">{stats?.completedTests || 0}</div>
            )}
            <p className="text-xs text-muted-foreground">
              всего тестов
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Средний балл
            </CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold">
                {stats?.averageScore?.toFixed(1) || 0}%
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              по всем тестам
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Доступно тестов
            </CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {testsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold">{availableTests?.length || 0}</div>
            )}
            <p className="text-xs text-muted-foreground">
              для прохождения
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              В процессе
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {attemptsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold">{inProgressAttempts.length}</div>
            )}
            <p className="text-xs text-muted-foreground">
              незавершенных
            </p>
          </CardContent>
        </Card>
      </div>

      {stats?.progressData && stats.progressData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Прогресс обучения
            </CardTitle>
            <CardDescription>
              Ваши результаты за последнее время
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats.progressData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" className="text-xs" />
                  <YAxis domain={[0, 100]} className="text-xs" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px"
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="score" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    dot={{ fill: "hsl(var(--primary))" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {recommendations?.recommendations && recommendations.recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5" />
              Рекомендации к обучению
            </CardTitle>
            <CardDescription>
              Области для улучшения на основе анализа ваших ответов
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recommendations.recommendations.map((rec, index) => {
                const priorityIcon = rec.priority === "high" 
                  ? <AlertTriangle className="h-5 w-5 text-destructive" />
                  : rec.priority === "medium"
                  ? <AlertCircle className="h-5 w-5 text-yellow-500" />
                  : <Info className="h-5 w-5 text-blue-500" />;
                
                const priorityColor = rec.priority === "high"
                  ? "bg-destructive/10 border-destructive/20"
                  : rec.priority === "medium"
                  ? "bg-yellow-500/10 border-yellow-500/20"
                  : "bg-blue-500/10 border-blue-500/20";

                return (
                  <div
                    key={index}
                    className={`flex items-start gap-4 p-4 rounded-lg border ${priorityColor}`}
                    data-testid={`recommendation-${index}`}
                  >
                    <div className="shrink-0 mt-0.5">
                      {priorityIcon}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium">{rec.subject}</h4>
                      <p className="text-sm text-muted-foreground mt-1">{rec.message}</p>
                    </div>
                    <Badge variant="outline" className="shrink-0">
                      {rec.priority === "high" ? "Высокий" : rec.priority === "medium" ? "Средний" : "Низкий"}
                    </Badge>
                  </div>
                );
              })}
            </div>
            {recommendations.totalQuestions > 0 && (
              <div className="mt-4 pt-4 border-t text-sm text-muted-foreground">
                Всего проанализировано вопросов: {recommendations.totalQuestions}, 
                ошибок: {recommendations.totalIncorrect} ({((recommendations.totalIncorrect / recommendations.totalQuestions) * 100).toFixed(0)}%)
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {inProgressAttempts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PlayCircle className="h-5 w-5" />
              Продолжить тест
            </CardTitle>
            <CardDescription>
              У вас есть незавершенные тесты
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {inProgressAttempts.map((attempt) => (
                <div
                  key={attempt.id}
                  className="flex items-center justify-between gap-4 p-4 rounded-lg border hover-elevate"
                >
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium truncate">{attempt.test.title}</h4>
                    <p className="text-sm text-muted-foreground">{attempt.test.subject}</p>
                  </div>
                  <Link href={`/test/${attempt.testId}/take?attempt=${attempt.id}`}>
                    <Button data-testid={`button-continue-test-${attempt.id}`}>
                      Продолжить
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Доступные тесты
          </CardTitle>
          <CardDescription>
            Выберите тест для прохождения
          </CardDescription>
        </CardHeader>
        <CardContent>
          {testsLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : availableTests?.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-medium text-lg">Нет доступных тестов</h3>
              <p className="text-muted-foreground">
                Преподаватели еще не опубликовали тесты
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {availableTests?.map((test) => (
                <div
                  key={test.id}
                  className="flex items-center justify-between gap-4 p-4 rounded-lg border hover-elevate"
                  data-testid={`card-test-${test.id}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium truncate">{test.title}</h4>
                      <Badge variant="secondary" className="shrink-0">
                        {test.subject}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-1">
                      {test.description || "Без описания"}
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {test.timeLimitMinutes} мин
                      </span>
                      <span className="flex items-center gap-1">
                        <BookOpen className="h-3 w-3" />
                        {test.questionCount} вопросов
                      </span>
                    </div>
                  </div>
                  {(() => {
                    const doneAttempt = completedAttempts.find((a) => a.testId === test.id);
                    if (doneAttempt) {
                      const pct = doneAttempt.maxScore ? (Number(doneAttempt.score) / doneAttempt.maxScore) * 100 : 0;
                      return (
                        <div className="flex flex-col items-end gap-1">
                          <Badge className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            {pct >= 99 ? "100% 🏆" : `${pct.toFixed(0)}% — пройдено`}
                          </Badge>
                          <Link href={`/results/${doneAttempt.id}`}>
                            <Button variant="outline" size="sm" data-testid={`button-view-result-${test.id}`}>
                              Результат
                            </Button>
                          </Link>
                        </div>
                      );
                    }
                    return (
                      <Link href={`/test/${test.id}`}>
                        <Button data-testid={`button-start-test-${test.id}`}>
                          Начать тест
                          <ChevronRight className="ml-2 h-4 w-4" />
                        </Button>
                      </Link>
                    );
                  })()}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {completedAttempts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              История тестов
            </CardTitle>
            <CardDescription>
              Ваши пройденные тесты и результаты
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {completedAttempts.slice(0, 5).map((attempt) => {
                const scorePercent = attempt.maxScore 
                  ? (Number(attempt.score) / attempt.maxScore) * 100 
                  : 0;
                return (
                  <div
                    key={attempt.id}
                    className="flex items-center justify-between gap-4 p-4 rounded-lg border"
                    data-testid={`card-result-${attempt.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium truncate">{attempt.test.title}</h4>
                      <p className="text-sm text-muted-foreground">{attempt.test.subject}</p>
                      <div className="mt-2">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span>Результат</span>
                          <span className="font-medium">{scorePercent.toFixed(0)}%</span>
                        </div>
                        <Progress value={scorePercent} className="h-2" />
                      </div>
                    </div>
                    <Link href={`/results/${attempt.id}`}>
                      <Button variant="outline" data-testid={`button-view-result-${attempt.id}`}>
                        Подробнее
                      </Button>
                    </Link>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
