import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  BookOpen, 
  Users, 
  Trophy, 
  TrendingUp, 
  ChevronRight,
  Plus,
  FileText,
  BarChart3,
  Eye,
  Edit,
  Trash2,
  Download,
  FileSpreadsheet,
  Layers3,
  MessageSquare,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Test, TestAttempt, User } from "@shared/schema";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend, ComposedChart, Area } from "recharts";
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type TestWithStats = Test & { 
  questionCount: number;
  attemptCount: number;
  avgScore: number;
};

type StudentStats = {
  student: User;
  testsCompleted: number;
  averageScore: number;
};

export default function TeacherDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [testToDelete, setTestToDelete] = useState<Test | null>(null);

  const { data: myTests, isLoading: testsLoading } = useQuery<TestWithStats[]>({
    queryKey: ["/api/tests/my"],
  });

  const { data: stats, isLoading: statsLoading } = useQuery<{
    totalTests: number;
    totalStudents: number;
    totalAttempts: number;
    averageScore: number;
    testScores: { name: string; score: number }[];
    questionTypeDistribution: { type: string; count: number }[];
    progressOverTime: { date: string; attempts: number; avgScore: number }[];
    subjectDistribution: { subject: string; count: number }[];
    difficultyAnalysis: { name: string; avgScore: number; passRate: number; attempts: number }[];
  }>({
    queryKey: ["/api/stats/teacher"],
  });

  const { data: studentStats, isLoading: studentsLoading } = useQuery<StudentStats[]>({
    queryKey: ["/api/stats/students"],
  });

  const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))'];

  async function handleDeleteTest() {
    if (!testToDelete) return;
    
    try {
      await apiRequest("DELETE", `/api/tests/${testToDelete.id}`);
      queryClient.invalidateQueries({ queryKey: ["/api/tests/my"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats/teacher"] });
      toast({
        title: "Тест удален",
        description: "Тест успешно удален",
      });
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось удалить тест",
        variant: "destructive",
      });
    } finally {
      setDeleteDialogOpen(false);
      setTestToDelete(null);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Панель преподавателя
          </h1>
          <p className="text-muted-foreground">
            Управление тестами и аналитика успеваемости
          </p>
        </div>
        <Link href="/test/create">
          <Button data-testid="button-create-test">
            <Plus className="mr-2 h-4 w-4" />
            Создать тест
          </Button>
        </Link>
        <div className="flex gap-2">
          <Link href="/teacher/organizer">
            <Button variant="outline">
              <Layers3 className="mr-2 h-4 w-4" />
              Органайзер
            </Button>
          </Link>
          <Link href="/messages">
            <Button variant="outline">
              <MessageSquare className="mr-2 h-4 w-4" />
              Сообщения
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Всего тестов
            </CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold">{stats?.totalTests || 0}</div>
            )}
            <p className="text-xs text-muted-foreground">
              созданных тестов
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Студентов
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold">{stats?.totalStudents || 0}</div>
            )}
            <p className="text-xs text-muted-foreground">
              прошли тесты
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Попыток
            </CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold">{stats?.totalAttempts || 0}</div>
            )}
            <p className="text-xs text-muted-foreground">
              всего прохождений
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
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {stats?.testScores && stats.testScores.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Результаты по тестам
              </CardTitle>
              <CardDescription>
                Средние баллы студентов по каждому тесту
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.testScores}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" className="text-xs" />
                    <YAxis domain={[0, 100]} className="text-xs" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px"
                      }}
                    />
                    <Bar 
                      dataKey="score" 
                      fill="hsl(var(--primary))" 
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {stats?.questionTypeDistribution && stats.questionTypeDistribution.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Типы вопросов
              </CardTitle>
              <CardDescription>
                Распределение вопросов по типам
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats.questionTypeDistribution}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ type, percent }) => `${type}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="count"
                    >
                      {stats.questionTypeDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px"
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {stats?.progressOverTime && stats.progressOverTime.some((p) => p.attempts > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Активность за неделю
            </CardTitle>
            <CardDescription>
              Динамика прохождений и средний балл за последние 7 дней
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={stats.progressOverTime}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" className="text-xs" />
                  <YAxis yAxisId="left" domain={[0, 'auto']} className="text-xs" />
                  <YAxis yAxisId="right" orientation="right" domain={[0, 100]} className="text-xs" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px"
                    }}
                  />
                  <Legend />
                  <Bar 
                    yAxisId="left"
                    dataKey="attempts" 
                    name="Прохождений"
                    fill="hsl(var(--chart-1))" 
                    radius={[4, 4, 0, 0]}
                  />
                  <Line 
                    yAxisId="right"
                    type="monotone" 
                    dataKey="avgScore" 
                    name="Средний балл %"
                    stroke="hsl(var(--chart-2))" 
                    strokeWidth={2}
                    dot={{ fill: "hsl(var(--chart-2))" }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {stats?.subjectDistribution && stats.subjectDistribution.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Тесты по предметам
              </CardTitle>
              <CardDescription>
                Распределение тестов по предметным областям
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats.subjectDistribution}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ subject, percent }) => `${subject}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="count"
                      nameKey="subject"
                    >
                      {stats.subjectDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px"
                      }}
                      formatter={(value, name) => [value, 'Количество']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {stats?.difficultyAnalysis && stats.difficultyAnalysis.some((d) => d.attempts > 0) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Анализ сложности тестов
              </CardTitle>
              <CardDescription>
                Сравнение среднего балла и процента успешных прохождений (60%+)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={stats.difficultyAnalysis.filter((d) => d.attempts > 0)}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" className="text-xs" />
                    <YAxis domain={[0, 100]} className="text-xs" tickFormatter={(v) => `${v}%`} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px"
                      }}
                      formatter={(value: number) => `${value}%`}
                    />
                    <Legend />
                    <Bar 
                      dataKey="avgScore" 
                      name="Средний балл"
                      fill="hsl(var(--chart-1))" 
                      radius={[4, 4, 0, 0]}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="passRate" 
                      name="Процент сдавших"
                      stroke="hsl(var(--chart-3))" 
                      strokeWidth={2}
                      dot={{ fill: "hsl(var(--chart-3))" }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Мои тесты
          </CardTitle>
          <CardDescription>
            Управление созданными тестами
          </CardDescription>
        </CardHeader>
        <CardContent>
          {testsLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : myTests?.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-medium text-lg">Нет созданных тестов</h3>
              <p className="text-muted-foreground mb-4">
                Создайте свой первый тест для студентов
              </p>
              <Link href="/test/create">
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Создать тест
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {myTests?.map((test) => (
                <div
                  key={test.id}
                  className="flex items-center justify-between gap-4 p-4 rounded-lg border"
                  data-testid={`card-my-test-${test.id}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h4 className="font-medium truncate">{test.title}</h4>
                      <Badge variant="secondary" className="shrink-0">
                        {test.subject}
                      </Badge>
                      {test.isPublished ? (
                        <Badge className="shrink-0 bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20">
                          Опубликован
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="shrink-0">
                          Черновик
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span>{test.questionCount} вопросов</span>
                      <span>{test.attemptCount} попыток</span>
                      {test.avgScore > 0 && (
                        <span>Средний балл: {test.avgScore.toFixed(0)}%</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" data-testid={`button-export-${test.id}`}>
                          <Download className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <a 
                            href={`/api/export/test/${test.id}/excel`} 
                            download
                            data-testid={`button-export-excel-${test.id}`}
                          >
                            <FileSpreadsheet className="mr-2 h-4 w-4" />
                            Экспорт в Excel
                          </a>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <a 
                            href={`/api/export/test/${test.id}/pdf`} 
                            download
                            data-testid={`button-export-pdf-${test.id}`}
                          >
                            <FileText className="mr-2 h-4 w-4" />
                            Экспорт в PDF
                          </a>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <a 
                            href={`/api/export/test/${test.id}/csv`} 
                            download
                            data-testid={`button-export-csv-${test.id}`}
                          >
                            <FileSpreadsheet className="mr-2 h-4 w-4" />
                            Экспорт в CSV
                          </a>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Link href={`/test/${test.id}/results`}>
                      <Button variant="ghost" size="icon" data-testid={`button-view-results-${test.id}`}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </Link>
                    <Link href={`/test/${test.id}/edit`}>
                      <Button variant="ghost" size="icon" data-testid={`button-edit-test-${test.id}`}>
                        <Edit className="h-4 w-4" />
                      </Button>
                    </Link>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => {
                        setTestToDelete(test);
                        setDeleteDialogOpen(true);
                      }}
                      data-testid={`button-delete-test-${test.id}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {studentStats && studentStats.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Успеваемость студентов
              </CardTitle>
              <CardDescription>
                Статистика по каждому студенту
              </CardDescription>
            </div>
            <Button variant="outline" asChild data-testid="button-export-students">
              <a href="/api/export/students/excel" download>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Экспорт
              </a>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {studentStats.map((stat) => (
                <div
                  key={stat.student.id}
                  className="flex items-center justify-between gap-4 p-4 rounded-lg border"
                >
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium truncate">{stat.student.fullName}</h4>
                    <p className="text-sm text-muted-foreground">@{stat.student.username}</p>
                  </div>
                  <div className="flex items-center gap-6 text-sm">
                    <div className="text-center">
                      <div className="font-bold">{stat.testsCompleted}</div>
                      <div className="text-xs text-muted-foreground">тестов</div>
                    </div>
                    <div className="text-center">
                      <div className="font-bold">{stat.averageScore.toFixed(0)}%</div>
                      <div className="text-xs text-muted-foreground">средний</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Удалить тест?</DialogTitle>
            <DialogDescription>
              Вы уверены, что хотите удалить тест "{testToDelete?.title}"? 
              Это действие нельзя отменить. Все результаты студентов также будут удалены.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Отмена
            </Button>
            <Button variant="destructive" onClick={handleDeleteTest}>
              Удалить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
