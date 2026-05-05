import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  ArrowLeft, 
  Users,
  Trophy,
  Clock,
  TrendingUp,
  Eye
} from "lucide-react";
import { Test, TestAttempt, User } from "@shared/schema";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

type TestWithAttempts = Test & {
  attempts: (TestAttempt & { student: User })[];
  questionCount: number;
};

export default function TestResultsPage() {
  const { id } = useParams<{ id: string }>();

  const { data: test, isLoading } = useQuery<TestWithAttempts>({
    queryKey: ["/api/tests", id, "results"],
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!test) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <h2 className="text-xl font-semibold mb-2">Тест не найден</h2>
        <Link href="/">
          <Button>Вернуться на главную</Button>
        </Link>
      </div>
    );
  }

  const completedAttempts = test.attempts.filter((a) => a.status === "completed");
  const avgScore = completedAttempts.length > 0
    ? completedAttempts.reduce((acc, a) => acc + (a.maxScore ? (Number(a.score) / a.maxScore) * 100 : 0), 0) / completedAttempts.length
    : 0;

  const scoreDistribution = [
    { range: "0-20%", count: 0 },
    { range: "21-40%", count: 0 },
    { range: "41-60%", count: 0 },
    { range: "61-80%", count: 0 },
    { range: "81-100%", count: 0 },
  ];

  completedAttempts.forEach((attempt) => {
    const percent = attempt.maxScore ? (Number(attempt.score) / attempt.maxScore) * 100 : 0;
    if (percent <= 20) scoreDistribution[0].count++;
    else if (percent <= 40) scoreDistribution[1].count++;
    else if (percent <= 60) scoreDistribution[2].count++;
    else if (percent <= 80) scoreDistribution[3].count++;
    else scoreDistribution[4].count++;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{test.title}</h1>
          <p className="text-muted-foreground">Результаты студентов</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Всего попыток</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{test.attempts.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Завершено</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedAttempts.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Средний балл</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgScore.toFixed(0)}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Время</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{test.timeLimitMinutes} мин</div>
          </CardContent>
        </Card>
      </div>

      {completedAttempts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Распределение оценок</CardTitle>
            <CardDescription>Сколько студентов получили каждый диапазон баллов</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={scoreDistribution}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="range" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px"
                    }}
                  />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Все попытки</CardTitle>
          <CardDescription>Список всех прохождений теста</CardDescription>
        </CardHeader>
        <CardContent>
          {test.attempts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-medium text-lg">Нет попыток</h3>
              <p className="text-muted-foreground">
                Пока никто не начал проходить этот тест
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {test.attempts.map((attempt) => {
                const scorePercent = attempt.maxScore 
                  ? (Number(attempt.score) / attempt.maxScore) * 100 
                  : 0;
                return (
                  <div
                    key={attempt.id}
                    className="flex items-center justify-between gap-4 p-4 rounded-lg border"
                    data-testid={`attempt-row-${attempt.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium truncate">{attempt.student.fullName}</h4>
                      <p className="text-sm text-muted-foreground">@{attempt.student.username}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      {attempt.status === "completed" ? (
                        <>
                          <div className="text-right">
                            <div className="font-medium">{scorePercent.toFixed(0)}%</div>
                            <div className="text-xs text-muted-foreground">
                              {Number(attempt.score).toFixed(1)} / {attempt.maxScore}
                            </div>
                          </div>
                          <Progress value={scorePercent} className="w-24 h-2" />
                        </>
                      ) : (
                        <Badge variant="secondary">В процессе</Badge>
                      )}
                      <Link href={`/results/${attempt.id}`}>
                        <Button variant="ghost" size="icon" data-testid={`button-view-attempt-${attempt.id}`}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
