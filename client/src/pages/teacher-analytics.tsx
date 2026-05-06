import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ScatterChart, Scatter,
} from "recharts";
import { TrendingUp, Users, BookOpen, BarChart3, AlertCircle } from "lucide-react";

type AnalyticsData = {
  totalTests: number;
  totalAttempts: number;
  totalStudents: number;
  averageScore: number;
  testStats: Array<{
    testId: string;
    testTitle: string;
    subject: string;
    attempts: number;
    avgScore: number;
    maxScore: number;
    minScore: number;
  }>;
  studentStats: Array<{
    studentId: string;
    studentName: string;
    testsTaken: number;
    averageScore: number;
  }>;
  chartData: Array<{ name: string; avgScore: number; attempts: number }>;
  difficultyStats: Array<{ questionKey: string; correctRate: number; attempts: number }>;
};

export default function TeacherAnalyticsPage() {
  const { data: analytics, isLoading, error } = useQuery<AnalyticsData>({
    queryKey: ["/api/teacher/analytics"],
  });

  const seedDemoMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/teacher/analytics/seed-demo", { studentsPerTest: 5 });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teacher/analytics"] });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Аналитика</h1>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-80 w-full rounded-lg" />
      </div>
    );
  }

  if (error) {
    const message = error instanceof Error ? error.message : "Не удалось получить данные аналитики";
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Пока нет данных для аналитики или сервер вернул ошибку. Детали: {message}
        </AlertDescription>
      </Alert>
    );
  }

  if (!analytics || analytics.totalTests === 0) {
    return (
      <div className="space-y-4">
        <Alert>
          <BookOpen className="h-4 w-4" />
          <AlertDescription>У вас ещё нет опубликованных тестов. Создайте тест, чтобы начать собирать аналитику.</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (analytics.totalAttempts === 0) {
    return (
      <div className="space-y-4">
        <Alert>
          <BarChart3 className="h-4 w-4" />
          <AlertDescription>
            Тесты созданы, но ещё нет завершённых попыток студентов. Можно сгенерировать демо-прохождения для презентации.
          </AlertDescription>
        </Alert>
        <Button onClick={() => seedDemoMutation.mutate()} disabled={seedDemoMutation.isPending}>
          {seedDemoMutation.isPending ? "Генерируем демо-данные..." : "Создать демо-прохождения"}
        </Button>
      </div>
    );
  }

  const performanceDistribution = [
    { name: "Отлично (80-100%)", value: analytics.studentStats.filter((s) => s.averageScore >= 80).length, fill: "#22c55e" },
    { name: "Хорошо (60-79%)", value: analytics.studentStats.filter((s) => s.averageScore >= 60 && s.averageScore < 80).length, fill: "#3b82f6" },
    { name: "Удовлетворительно (40-59%)", value: analytics.studentStats.filter((s) => s.averageScore >= 40 && s.averageScore < 60).length, fill: "#f59e0b" },
    { name: "Неудовлетворительно (<40%)", value: analytics.studentStats.filter((s) => s.averageScore < 40).length, fill: "#ef4444" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Аналитика</h1>
        <p className="text-muted-foreground mt-1">Статистика тестирования и успеваемость студентов</p>
      </div>

      <div className="flex justify-end">
        <Button variant="outline" onClick={() => seedDemoMutation.mutate()} disabled={seedDemoMutation.isPending}>
          {seedDemoMutation.isPending ? "Генерируем демо-данные..." : "Добавить демо-прохождения"}
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Всего тестов</p>
                <p className="text-3xl font-bold">{analytics.totalTests}</p>
              </div>
              <BookOpen className="h-8 w-8 text-blue-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Попыток</p>
                <p className="text-3xl font-bold">{analytics.totalAttempts}</p>
              </div>
              <BarChart3 className="h-8 w-8 text-green-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Студентов</p>
                <p className="text-3xl font-bold">{analytics.totalStudents}</p>
              </div>
              <Users className="h-8 w-8 text-purple-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Средний балл</p>
                <p className="text-3xl font-bold">{analytics.averageScore}%</p>
              </div>
              <TrendingUp className="h-8 w-8 text-orange-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Средний балл по тестам */}
        <Card>
          <CardHeader>
            <CardTitle>Успеваемость по тестам</CardTitle>
            <CardDescription>Средний процент правильных ответов</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.chartData} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} className="text-xs" />
                  <YAxis domain={[0, 100]} unit="%" className="text-xs" />
                  <Tooltip formatter={(v: number) => [`${v}%`, "Средний балл"]} />
                  <Bar dataKey="avgScore" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Распределение оценок */}
        <Card>
          <CardHeader>
            <CardTitle>Распределение успеваемости</CardTitle>
            <CardDescription>Количество студентов по уровням</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={performanceDistribution.filter((d) => d.value > 0)}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {performanceDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Сложность вопросов */}
      {analytics.difficultyStats.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Самые сложные вопросы</CardTitle>
            <CardDescription>Вопросы, на которые студенты ошибаются чаще всего</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analytics.difficultyStats.map((stat, index) => (
                <div key={index} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex-1">
                    <p className="text-sm font-medium">Вопрос {index + 1}</p>
                    <p className="text-xs text-muted-foreground">Попыток: {stat.attempts}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-32 bg-muted rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${stat.correctRate >= 70 ? "bg-green-500" : stat.correctRate >= 40 ? "bg-yellow-500" : "bg-red-500"}`}
                        style={{ width: `${stat.correctRate}%` }}
                      />
                    </div>
                    <Badge variant="secondary" className="min-w-12 text-right">
                      {stat.correctRate}%
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top Students */}
      <Card>
        <CardHeader>
          <CardTitle>Лучшие студенты</CardTitle>
          <CardDescription>Рейтинг по среднему баллу</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {analytics.studentStats.slice(0, 10).map((stat, index) => (
              <div key={stat.studentId} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="min-w-8 text-center">
                    #{index + 1}
                  </Badge>
                  <div>
                    <p className="font-medium">{stat.studentName}</p>
                    <p className="text-xs text-muted-foreground">Тестов пройдено: {stat.testsTaken}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold">{stat.averageScore}%</p>
                  <p className="text-xs text-muted-foreground">средний балл</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Таблица по тестам */}
      <Card>
        <CardHeader>
          <CardTitle>Статистика по тестам</CardTitle>
          <CardDescription>Детальная информация о каждом тесте</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-semibold">Тест</th>
                  <th className="text-left py-3 px-4 font-semibold">Предмет</th>
                  <th className="text-center py-3 px-4 font-semibold">Попыток</th>
                  <th className="text-right py-3 px-4 font-semibold">Средний балл</th>
                  <th className="text-right py-3 px-4 font-semibold">Макс/Мин</th>
                </tr>
              </thead>
              <tbody>
                {analytics.testStats.map((test) => (
                  <tr key={test.testId} className="border-b hover:bg-muted/50 transition-colors">
                    <td className="py-3 px-4 font-medium">{test.testTitle}</td>
                    <td className="py-3 px-4">
                      <Badge variant="secondary">{test.subject}</Badge>
                    </td>
                    <td className="text-center py-3 px-4">{test.attempts}</td>
                    <td className="text-right py-3 px-4">
                      <span className={`font-semibold ${test.avgScore >= 70 ? "text-green-600" : test.avgScore >= 50 ? "text-yellow-600" : "text-red-600"}`}>
                        {test.avgScore}%
                      </span>
                    </td>
                    <td className="text-right py-3 px-4">
                      <span className="text-muted-foreground">
                        {test.maxScore}% / {test.minScore}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
