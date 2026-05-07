import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { apiRequest } from "@/lib/queryClient";
import {
  ShieldCheck,
  Printer,
  ClipboardCheck,
  BookOpenCheck,
  Users,
  GraduationCap,
  UserRound,
  FileText,
  LogOut,
  Link2,
  Download,
  TrendingUp,
  Activity,
  History,
  RotateCcw,
  Loader2,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { useToast } from "@/hooks/use-toast";

type AdminProfile = {
  login: string;
  title: string;
  panelUrl: string;
  printGuideUrl: string;
  wordGuideUrl: string;
};

type AdminSystemSummary = {
  usersTotal: number;
  teachers: number;
  students: number;
  testsTotal: number;
  questionsTotal: number;
  attemptsTotal: number;
  completedAttempts: number;
  messagesTotal: number;
  notificationsTotal: number;
  materialsTotal: number;
  groupsTotal: number;
  assignmentsTotal: number;
  generatedAt: string;
};

type AdminHealthCheck = {
  key: string;
  title: string;
  status: "ok" | "warning" | "error";
  message: string;
  details?: string;
  responseTimeMs?: number | null;
};

type AdminHealthResponse = {
  overallStatus: "ok" | "warning" | "error";
  generatedAt: string;
  checks: AdminHealthCheck[];
};

type AdminReadinessItem = {
  key: string;
  title: string;
  status: "ready" | "attention" | "critical";
  message: string;
};

type AdminReadinessResponse = {
  generatedAt: string;
  overallStatus: "ready" | "attention" | "critical";
  readyCount: number;
  attentionCount: number;
  criticalCount: number;
  items: AdminReadinessItem[];
};

type AdminAuditEntry = {
  id: string;
  timestamp: string;
  adminLogin: string;
  action: string;
  target: string | null;
  status: "success" | "warning" | "error" | "info";
  details: Record<string, unknown>;
  ip: string | null;
  userAgent: string | null;
};

type AdminAuditResponse = {
  items: AdminAuditEntry[];
};

type AdminDemoResetResponse = {
  message: string;
  usersCreated: number;
  testsCreated: number;
  questionsCreated: number;
  createdAttempts: number;
  createdGroups: number;
  createdAssignments: number;
  createdMaterials: number;
  createdMessages: number;
  createdNotifications: number;
  loggedActionId: string;
};

const roleMatrix = [
  {
    role: "Преподаватель",
    icon: GraduationCap,
    rights: [
      "Создание и редактирование тестов",
      "Генерация тестов из файлов и URL",
      "Назначение тестов группам и ученикам",
      "Аналитика по классу и по тестам",
      "Работа с материалами, сообщениями и уведомлениями",
    ],
  },
  {
    role: "Студент",
    icon: UserRound,
    rights: [
      "Прохождение назначенных и доступных тестов",
      "Просмотр результатов и динамики прогресса",
      "Получение AI-анализа и мини-плана повторения",
      "Обмен сообщениями с преподавателем",
      "Просмотр методических материалов",
    ],
  },
];

const featureCatalog = [
  {
    title: "1. Управление тестированием",
    items: [
      "Ручной конструктор тестов: типы вопросов, баллы, адаптивность, рубрики открытых ответов.",
      "AI/импорт генерация: создание теста по описанию, файлу или ссылке.",
      "Публикация, редактирование, предпросмотр и управление временем прохождения.",
      "Соревновательный режим и таблица лидеров по тесту.",
    ],
  },
  {
    title: "2. Контроль и честность прохождения",
    items: [
      "Сбор прокторинг-событий: смена вкладки, неактивность, потеря фокуса.",
      "Расчет прокторинг-оценки и журнал событий в результатах.",
      "Хранение попыток, статусов и фактических ответов.",
    ],
  },
  {
    title: "3. Аналитика и сопровождение обучения",
    items: [
      "Разделы " + '"Мои результаты"' + " и " + '"Мой прогресс"' + " с динамикой успеваемости.",
      "AI-анализ с разбором слабых зон, рекомендациями и планом повторения.",
      "Педагогическая аналитика: агрегированные показатели группы и тестов.",
      "Методические материалы: пособия, тренажеры и импортированные тесты.",
    ],
  },
  {
    title: "4. Коммуникации и оргконтур",
    items: [
      "Встроенные сообщения преподаватель-студент.",
      "Система уведомлений по учебным событиям.",
      "Органайзер преподавателя: группы, назначения, контроль сроков.",
    ],
  },
];

const scenarios = [
  {
    name: "Сценарий А. Подготовка и запуск контроля знаний",
    steps: [
      "Преподаватель создает тест в конструкторе или через генерацию из файла/URL.",
      "Проверяет структуру вопросов в предпросмотре и публикует тест.",
      "Назначает тест конкретным студентам или группам через органайзер.",
      "После выполнения анализирует результаты, ошибки и риски академической недобросовестности.",
    ],
    checks: [
      "Тест доступен назначенным студентам.",
      "Попытка корректно закрывается и сохраняется.",
      "Результаты отображают баллы, процент и журнал прокторинга.",
    ],
  },
  {
    name: "Сценарий Б. Индивидуальная траектория студента",
    steps: [
      "Студент проходит тесты и получает накопленные результаты.",
      "Открывает AI-анализ и получает интерпретацию сильных/слабых тем.",
      "Использует мини-план повторения и материалы из раздела пособий.",
      "Повторно проходит тесты и отслеживает рост показателей в динамике.",
    ],
    checks: [
      "График прогресса строится без ошибок.",
      "AI-анализ возвращает рекомендации или безопасный резервный ответ.",
      "Изменения в успеваемости фиксируются в истории попыток.",
    ],
  },
  {
    name: "Сценарий В. Административный контроль качества",
    steps: [
      "Ответственный сотрудник открывает эту админ-панель и сверяет контур процессов.",
      "Проверяет, что все ключевые разделы интерфейса доступны и заполнены тестовыми данными.",
      "Выполняет чек-лист приемки перед демонстрацией или внедрением.",
      "Формирует печатную версию отчета для согласования.",
    ],
    checks: [
      "Доступ по ролям соблюдается.",
      "Критические маршруты работают без runtime-ошибок.",
      "Есть подтверждаемые артефакты: результаты, аналитика, уведомления.",
    ],
  },
];

const acceptanceChecklist = [
  "Аутентификация: вход/выход и корректное определение роли пользователя.",
  "Тесты: создание, редактирование, публикация, прохождение, просмотр итогов.",
  "AI-контур: выбор модели, запуск анализа, обработка ошибок и fallback-режим.",
  "Аналитика: разделы студента и преподавателя открываются и показывают данные.",
  "Коммуникации: сообщения и уведомления работают по ролям.",
  "Печатный контур: админ-панель выводится в A4 без визуальных артефактов.",
];

const chartPalette = ["#2563eb", "#22c55e", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4"];

const roadmapItems = [
  {
    title: "Журнал действий администратора",
    priority: "Высокий приоритет",
    description: "Фиксировать входы, открытие печатных материалов, выгрузки и ключевые действия в административном контуре.",
    outcome: "Упростит приемку, внутренний аудит и разбор спорных ситуаций после демонстрации.",
  },
  {
    title: "Экспорт управленческих отчетов",
    priority: "Высокий приоритет",
    description: "Добавить выгрузку сводных показателей в PDF и Excel для передачи руководителю и комиссии.",
    outcome: "Позволит выдавать результаты проверки в формальном и пересылаемом формате без ручной сборки.",
  },
  {
    title: "Сброс и подготовка демо-контура",
    priority: "Средний приоритет",
    description: "Сделать одну административную команду для очистки старых попыток и восстановления демонстрационных данных.",
    outcome: "Сократит время подготовки к повторным показам и снизит риск демонстрации устаревших данных.",
  },
  {
    title: "Мониторинг интеграций и рисков",
    priority: "Средний приоритет",
    description: "Показывать доступность AI-провайдера, состояние базы и наличие fallback-режима в одном месте.",
    outcome: "Сделает сервис более зрелым с точки зрения эксплуатации и прозрачности для руководства.",
  },
];

const healthStatusMeta = {
  ok: { label: "Норма", className: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  warning: { label: "Риск", className: "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  error: { label: "Сбой", className: "border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300" },
} as const;

const readinessStatusMeta = {
  ready: { label: "Готово", className: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  attention: { label: "Нужно внимание", className: "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  critical: { label: "Критично", className: "border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300" },
} as const;

const auditStatusMeta = {
  success: { label: "Успешно", className: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  warning: { label: "Предупреждение", className: "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  error: { label: "Ошибка", className: "border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300" },
  info: { label: "Инфо", className: "border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300" },
} as const;

function humanizeAuditAction(action: string) {
  return action.replace(/_/g, " ");
}

function SectionTitle({ index, title }: { index: string; title: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-xl font-semibold tracking-tight print:text-[14pt]">
        {index}. {title}
      </h2>
      <Separator className="mt-2" />
    </div>
  );
}

export default function AdminPanelPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isResettingDemo, setIsResettingDemo] = useState(false);
  const { data: adminProfile } = useQuery<AdminProfile>({
    queryKey: ["/api/admin/me"],
    queryFn: async () => {
      const response = await fetch("/api/admin/me", { credentials: "include" });
      if (!response.ok) {
        throw new Error("Не удалось получить профиль администратора");
      }
      return response.json();
    },
  });
  const { data: systemSummary } = useQuery<AdminSystemSummary>({
    queryKey: ["/api/admin/system-summary"],
    queryFn: async () => {
      const response = await fetch("/api/admin/system-summary", { credentials: "include" });
      if (!response.ok) {
        throw new Error("Не удалось получить сводные показатели системы");
      }
      return response.json();
    },
  });
  const { data: systemHealth } = useQuery<AdminHealthResponse>({
    queryKey: ["/api/admin/system-health"],
    queryFn: async () => {
      const response = await fetch("/api/admin/system-health", { credentials: "include" });
      if (!response.ok) {
        throw new Error("Не удалось получить статус сервиса");
      }
      return response.json();
    },
  });
  const { data: readinessReport } = useQuery<AdminReadinessResponse>({
    queryKey: ["/api/admin/readiness-report"],
    queryFn: async () => {
      const response = await fetch("/api/admin/readiness-report", { credentials: "include" });
      if (!response.ok) {
        throw new Error("Не удалось получить отчет готовности");
      }
      return response.json();
    },
  });
  const { data: auditLog } = useQuery<AdminAuditResponse>({
    queryKey: ["/api/admin/audit-log"],
    queryFn: async () => {
      const response = await fetch("/api/admin/audit-log?limit=12", { credentials: "include" });
      if (!response.ok) {
        throw new Error("Не удалось получить журнал действий");
      }
      return response.json();
    },
  });

  const now = useMemo(
    () => new Date().toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" }),
    []
  );
  const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3333";
  const completionRate = useMemo(() => {
    if (!systemSummary?.attemptsTotal) {
      return 0;
    }

    return Math.round((systemSummary.completedAttempts / systemSummary.attemptsTotal) * 100);
  }, [systemSummary]);
  const averageQuestionsPerTest = useMemo(() => {
    if (!systemSummary?.testsTotal) {
      return 0;
    }

    return Number((systemSummary.questionsTotal / systemSummary.testsTotal).toFixed(1));
  }, [systemSummary]);
  const communicationEvents = (systemSummary?.messagesTotal ?? 0) + (systemSummary?.notificationsTotal ?? 0);
  const summaryCards = [
    { label: "Всего пользователей", value: systemSummary?.usersTotal ?? "-" },
    { label: "Преподаватели", value: systemSummary?.teachers ?? "-" },
    { label: "Студенты", value: systemSummary?.students ?? "-" },
    { label: "Тесты", value: systemSummary?.testsTotal ?? "-" },
    { label: "Вопросы", value: systemSummary?.questionsTotal ?? "-" },
    { label: "Попытки", value: systemSummary?.attemptsTotal ?? "-" },
    { label: "Завершенные попытки", value: systemSummary?.completedAttempts ?? "-" },
    { label: "Материалы", value: systemSummary?.materialsTotal ?? "-" },
    { label: "Сообщения", value: systemSummary?.messagesTotal ?? "-" },
    { label: "Уведомления", value: systemSummary?.notificationsTotal ?? "-" },
    { label: "Группы", value: systemSummary?.groupsTotal ?? "-" },
    { label: "Назначения", value: systemSummary?.assignmentsTotal ?? "-" },
  ];
  const executiveOverview = useMemo(
    () => [
      {
        title: "Контентная готовность",
        value: `${systemSummary?.testsTotal ?? 0} / ${systemSummary?.questionsTotal ?? 0}`,
        suffix: "тестов / вопросов",
        description: averageQuestionsPerTest > 0
          ? `Средняя насыщенность: ${averageQuestionsPerTest} вопроса на один тест.`
          : "Нужно наполнить контур демонстрационным учебным контентом.",
        status: (systemSummary?.testsTotal ?? 0) > 0 && (systemSummary?.questionsTotal ?? 0) > 0 ? "Готово" : "Нужно усилить",
        toneClass: (systemSummary?.testsTotal ?? 0) > 0 && (systemSummary?.questionsTotal ?? 0) > 0
          ? "border-emerald-500/20 bg-emerald-500/5"
          : "border-amber-500/20 bg-amber-500/5",
      },
      {
        title: "Завершенность прохождений",
        value: `${completionRate}%`,
        suffix: "завершено",
        description: (systemSummary?.attemptsTotal ?? 0) > 0
          ? `Завершено ${systemSummary?.completedAttempts ?? 0} из ${systemSummary?.attemptsTotal ?? 0} попыток.`
          : "Пока нет попыток для контрольной демонстрации процесса.",
        status: completionRate >= 80 ? "Готово" : (systemSummary?.attemptsTotal ?? 0) > 0 ? "Под контролем" : "Нужно усилить",
        toneClass: completionRate >= 80
          ? "border-emerald-500/20 bg-emerald-500/5"
          : (systemSummary?.attemptsTotal ?? 0) > 0
            ? "border-blue-500/20 bg-blue-500/5"
            : "border-amber-500/20 bg-amber-500/5",
      },
      {
        title: "Ролевое покрытие",
        value: `${systemSummary?.teachers ?? 0} / ${systemSummary?.students ?? 0}`,
        suffix: "преподаватели / студенты",
        description: (systemSummary?.teachers ?? 0) > 0 && (systemSummary?.students ?? 0) > 0
          ? "В демонстрации представлены обе ключевые пользовательские роли."
          : "Для полноценного показа требуется наличие преподавателей и студентов.",
        status: (systemSummary?.teachers ?? 0) > 0 && (systemSummary?.students ?? 0) > 0 ? "Готово" : "Нужно усилить",
        toneClass: (systemSummary?.teachers ?? 0) > 0 && (systemSummary?.students ?? 0) > 0
          ? "border-emerald-500/20 bg-emerald-500/5"
          : "border-amber-500/20 bg-amber-500/5",
      },
      {
        title: "Коммуникационный контур",
        value: `${communicationEvents}`,
        suffix: "сообщений и уведомлений",
        description: communicationEvents > 0
          ? "В системе уже есть события взаимодействия, пригодные для показа руководителю."
          : "Стоит наполнить контур уведомлениями и сообщениями для более убедительной демонстрации.",
        status: communicationEvents > 0 ? "Под контролем" : "Нужно усилить",
        toneClass: communicationEvents > 0
          ? "border-blue-500/20 bg-blue-500/5"
          : "border-amber-500/20 bg-amber-500/5",
      },
    ],
    [averageQuestionsPerTest, communicationEvents, completionRate, systemSummary]
  );
  const systemVolumeChartData = useMemo(
    () => [
      { name: "Пользователи", value: systemSummary?.usersTotal ?? 0 },
      { name: "Тесты", value: systemSummary?.testsTotal ?? 0 },
      { name: "Вопросы", value: systemSummary?.questionsTotal ?? 0 },
      { name: "Попытки", value: systemSummary?.attemptsTotal ?? 0 },
      { name: "Сообщения", value: systemSummary?.messagesTotal ?? 0 },
      { name: "Уведомления", value: systemSummary?.notificationsTotal ?? 0 },
    ],
    [systemSummary]
  );
  const userRoleChartData = useMemo(
    () => [
      { name: "Преподаватели", value: systemSummary?.teachers ?? 0, color: chartPalette[0] },
      { name: "Студенты", value: systemSummary?.students ?? 0, color: chartPalette[1] },
    ].filter((item) => item.value > 0),
    [systemSummary]
  );
  const attemptStatusChartData = useMemo(
    () => [
      { name: "Завершено", value: systemSummary?.completedAttempts ?? 0, color: chartPalette[0] },
      { name: "Не завершено", value: Math.max((systemSummary?.attemptsTotal ?? 0) - (systemSummary?.completedAttempts ?? 0), 0), color: "#cbd5e1" },
    ].filter((item) => item.value > 0),
    [systemSummary]
  );

  async function recordAdminAction(action: string, target: string, details: Record<string, unknown> = {}) {
    try {
      await fetch("/api/admin/audit-log", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action, target, status: "info", details }),
      });
    } catch {
      // silent best-effort logging
    } finally {
      void queryClient.invalidateQueries({ queryKey: ["/api/admin/audit-log"] });
    }
  }

  function openAdminResource(url: string, action: string, target: string) {
    void recordAdminAction(action, target, { url });
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function handlePrint() {
    void recordAdminAction("print_dashboard", "admin-panel", { source: "admin-panel" });
    window.print();
  }

  function handleAdminExport(format: "excel" | "pdf") {
    window.open(`/api/admin/export/summary/${format}`, "_blank", "noopener,noreferrer");
  }

  async function handleDemoReset() {
    const confirmed = window.confirm(
      "Восстановить демо-контур? Это действие очистит текущие учебные данные, заново создаст тестовые аккаунты, тесты, попытки, сообщения и уведомления."
    );
    if (!confirmed) {
      return;
    }

    setIsResettingDemo(true);
    try {
      const response = await apiRequest("POST", "/api/admin/demo-reset", { resetAuditLog: true });
      const result = await response.json() as AdminDemoResetResponse;

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/admin/system-summary"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/system-health"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/readiness-report"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/audit-log"] }),
      ]);

      toast({
        title: "Демо-контур восстановлен",
        description: `Создано: ${result.testsCreated} тестов, ${result.createdAttempts} попыток, ${result.createdMessages} сообщений и ${result.createdNotifications} уведомлений.`,
      });
    } catch (error: any) {
      toast({
        title: "Ошибка восстановления",
        description: error.message || "Не удалось восстановить демо-контур",
        variant: "destructive",
      });
    } finally {
      setIsResettingDemo(false);
    }
  }

  async function handleAdminLogout() {
    await apiRequest("POST", "/api/admin/logout", {});
    setLocation("/admin/login");
  }

  return (
    <div className="space-y-6 print:space-y-3">
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 14mm; }
          body { background: white !important; }
          .print-hide { display: none !important; }
          .print-card { break-inside: avoid; }
        }
      `}</style>

      <Card className="print-card border-primary/20 bg-gradient-to-br from-background via-background to-primary/5">
        <CardHeader>
          <CardTitle className="text-2xl print:text-[18pt] leading-tight">
            Административная панель
            <br />
            EduTest: отдельный контур демонстрации, контроля и печатной отчетности
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 text-sm print:text-[11pt]">
            <div className="rounded-lg border p-3">
              <div className="text-muted-foreground">Организация</div>
              <div className="font-medium">Государственное учреждение (демонстрационный контур)</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-muted-foreground">Дата формирования</div>
              <div className="font-medium">{now}</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-muted-foreground">Ответственный пользователь</div>
              <div className="font-medium">{adminProfile?.title || "Администратор контура"}</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-muted-foreground">Назначение</div>
              <div className="font-medium">Демонстрация, приемка, контроль внедрения</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-muted-foreground">Отдельный логин</div>
              <div className="font-medium">{adminProfile?.login || "admin"}</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-muted-foreground">Отдельная ссылка входа</div>
              <div className="font-medium">{origin}/admin/login</div>
            </div>
          </div>
          <div className="print-hide flex flex-wrap gap-2">
            <Button onClick={handlePrint} className="gap-2" data-testid="button-admin-print">
              <Printer className="h-4 w-4" />
              Печать / экспорт в PDF
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => handleAdminExport("excel")}>
              <Download className="h-4 w-4" />
              Excel-отчет для руководителя
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => handleAdminExport("pdf")}>
              <FileText className="h-4 w-4" />
              PDF-сводка для руководителя
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => openAdminResource(adminProfile?.printGuideUrl || "/admin-guide-print.html", "open_print_guide", "html-print-guide")}>
              <FileText className="h-4 w-4" />
              Открыть HTML-регламент
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => openAdminResource(adminProfile?.wordGuideUrl || "/EduTest_Admin_Guide.docx", "open_word_guide", "word-guide")}>
              <Download className="h-4 w-4" />
              Скачать Word-документ
            </Button>
            <Button variant="destructive" onClick={handleDemoReset} className="gap-2" disabled={isResettingDemo}>
              {isResettingDemo ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Восстанавливаю демо-контур...
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4" />
                  Восстановить демо-контур
                </>
              )}
            </Button>
            <Button variant="secondary" onClick={handleAdminLogout} className="gap-2">
              <LogOut className="h-4 w-4" />
              Выйти из admin-контура
            </Button>
            <Badge variant="secondary" className="text-sm">Оформление: деловой регламент, A4</Badge>
          </div>
          <div className="print-hide text-xs leading-5 text-muted-foreground">
            Операция восстановления демо-контура очищает текущие учебные данные и заново наполняет систему тестовыми аккаунтами, тестами, попытками, сообщениями, уведомлениями, материалами и назначениями.
          </div>
        </CardContent>
      </Card>

      <Card className="print-card border-primary/15">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 print:text-[14pt]">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Живые сводные показатели системы
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {summaryCards.map((card) => (
              <div key={card.label} className="rounded-xl border bg-background/70 p-4">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">{card.label}</div>
                <div className="mt-2 text-3xl font-semibold tracking-tight">{card.value}</div>
              </div>
            ))}
          </div>
          <div className="text-xs text-muted-foreground">
            Обновлено: {systemSummary?.generatedAt ? new Date(systemSummary.generatedAt).toLocaleString("ru-RU") : "данные загружаются"}
          </div>
        </CardContent>
      </Card>

      <Card className="print-card border-primary/15">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 print:text-[14pt]">
            <TrendingUp className="h-5 w-5 text-primary" />
            Исполнительный обзор и визуальный дашборд
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {executiveOverview.map((item) => (
              <div key={item.title} className={`rounded-xl border p-4 ${item.toneClass}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="text-sm font-medium">{item.title}</div>
                  <Badge variant="secondary" className="whitespace-nowrap">{item.status}</Badge>
                </div>
                <div className="mt-4 text-3xl font-semibold tracking-tight">{item.value}</div>
                <div className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">{item.suffix}</div>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-xl border bg-background/70 p-4">
              <div className="mb-4">
                <div className="text-sm font-medium">Наполнение демонстрационного контура</div>
                <div className="text-sm text-muted-foreground">Быстрая оценка масштаба данных, которые можно показать руководителю и комиссии.</div>
              </div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={systemVolumeChartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={0} angle={-10} textAnchor="end" height={54} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(value: number) => [value, "Количество"]} />
                    <Bar dataKey="value" radius={[8, 8, 0, 0]} fill={chartPalette[0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="grid gap-4">
              <div className="rounded-xl border bg-background/70 p-4">
                <div className="mb-4">
                  <div className="text-sm font-medium">Структура ролей</div>
                  <div className="text-sm text-muted-foreground">Кто участвует в демонстрационном контуре прямо сейчас.</div>
                </div>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={userRoleChartData} dataKey="value" nameKey="name" innerRadius={42} outerRadius={74} paddingAngle={3}>
                        {userRoleChartData.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => [value, "Количество"]} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid gap-2 text-sm">
                  {userRoleChartData.length > 0 ? userRoleChartData.map((item) => (
                    <div key={item.name} className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                        <span>{item.name}</span>
                      </div>
                      <span className="font-medium">{item.value}</span>
                    </div>
                  )) : (
                    <div className="text-sm text-muted-foreground">Недостаточно данных для построения диаграммы.</div>
                  )}
                </div>
              </div>

              <div className="rounded-xl border bg-background/70 p-4">
                <div className="mb-4">
                  <div className="text-sm font-medium">Статус прохождений</div>
                  <div className="text-sm text-muted-foreground">Насколько завершены уже созданные попытки тестирования.</div>
                </div>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={attemptStatusChartData} dataKey="value" nameKey="name" innerRadius={42} outerRadius={74} paddingAngle={3}>
                        {attemptStatusChartData.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => [value, "Количество"]} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid gap-2 text-sm">
                  {attemptStatusChartData.length > 0 ? attemptStatusChartData.map((item) => (
                    <div key={item.name} className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                        <span>{item.name}</span>
                      </div>
                      <span className="font-medium">{item.value}</span>
                    </div>
                  )) : (
                    <div className="text-sm text-muted-foreground">Попытки пока не сформированы.</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="print-card border-primary/15">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 print:text-[14pt]">
            <Activity className="h-5 w-5 text-primary" />
            Мониторинг сервиса и рисков
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border bg-background/70 p-4">
              <div className="text-sm text-muted-foreground">Общий статус сервиса</div>
              <div className="mt-3 flex items-center gap-2">
                <Badge variant="secondary" className={healthStatusMeta[systemHealth?.overallStatus || "warning"].className}>
                  {healthStatusMeta[systemHealth?.overallStatus || "warning"].label}
                </Badge>
              </div>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Последняя проверка: {systemHealth?.generatedAt ? new Date(systemHealth.generatedAt).toLocaleString("ru-RU") : "данные загружаются"}.
              </p>
            </div>
            <div className="rounded-xl border bg-background/70 p-4">
              <div className="text-sm text-muted-foreground">Автопроверка готовности</div>
              <div className="mt-3 flex items-center gap-2">
                <Badge variant="secondary" className={readinessStatusMeta[readinessReport?.overallStatus || "attention"].className}>
                  {readinessStatusMeta[readinessReport?.overallStatus || "attention"].label}
                </Badge>
              </div>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Готово: {readinessReport?.readyCount ?? 0}, требует внимания: {readinessReport?.attentionCount ?? 0}, критично: {readinessReport?.criticalCount ?? 0}.
              </p>
            </div>
            <div className="rounded-xl border bg-background/70 p-4">
              <div className="text-sm text-muted-foreground">Последние действия админа</div>
              <div className="mt-3 text-3xl font-semibold tracking-tight">{auditLog?.items.length ?? 0}</div>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                В журнале отображаются входы, выходы, открытия печатных материалов и управленческие выгрузки.
              </p>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            {(systemHealth?.checks || []).map((check) => (
              <div key={check.key} className="rounded-xl border bg-background/70 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">{check.title}</div>
                    <div className="mt-1 text-sm text-muted-foreground">{check.message}</div>
                  </div>
                  <Badge variant="secondary" className={healthStatusMeta[check.status].className}>
                    {healthStatusMeta[check.status].label}
                  </Badge>
                </div>
                <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                  {typeof check.responseTimeMs === "number" ? <div>Время ответа: {check.responseTimeMs} мс</div> : null}
                  {check.details ? <div>{check.details}</div> : null}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="print-card border-primary/15">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 print:text-[14pt]">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Автопроверка готовности к демонстрации
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border bg-emerald-500/5 p-4">
              <div className="text-sm text-muted-foreground">Готово</div>
              <div className="mt-2 text-3xl font-semibold tracking-tight">{readinessReport?.readyCount ?? 0}</div>
            </div>
            <div className="rounded-xl border bg-amber-500/5 p-4">
              <div className="text-sm text-muted-foreground">Требует внимания</div>
              <div className="mt-2 text-3xl font-semibold tracking-tight">{readinessReport?.attentionCount ?? 0}</div>
            </div>
            <div className="rounded-xl border bg-rose-500/5 p-4">
              <div className="text-sm text-muted-foreground">Критично</div>
              <div className="mt-2 text-3xl font-semibold tracking-tight">{readinessReport?.criticalCount ?? 0}</div>
            </div>
          </div>
          <div className="space-y-3">
            {(readinessReport?.items || []).map((item) => (
              <div key={item.key} className="rounded-xl border bg-background/70 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">{item.title}</div>
                    <div className="mt-1 text-sm text-muted-foreground">{item.message}</div>
                  </div>
                  <Badge variant="secondary" className={readinessStatusMeta[item.status].className}>
                    {readinessStatusMeta[item.status].label}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="print-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 print:text-[14pt]">
            <Link2 className="h-5 w-5 text-primary" />
            Ссылки административного контура
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm print:text-[11pt]">
          <div className="rounded-lg border p-3">
            <div className="text-muted-foreground mb-1">Вход администратора</div>
            <div className="font-medium">{origin}/admin/login</div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-muted-foreground mb-1">Панель после авторизации</div>
            <div className="font-medium">{origin}/admin-panel</div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-muted-foreground mb-1">Печатный HTML-регламент</div>
            <div className="font-medium">{origin}{adminProfile?.printGuideUrl || "/admin-guide-print.html"}</div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-muted-foreground mb-1">Word-документ</div>
            <div className="font-medium">{origin}{adminProfile?.wordGuideUrl || "/EduTest_Admin_Guide.docx"}</div>
          </div>
        </CardContent>
      </Card>

      <Card className="print-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 print:text-[14pt]">
            <Users className="h-5 w-5 text-primary" />
            Матрица ролей и ответственности
          </CardTitle>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-4">
          {roleMatrix.map((r) => (
            <div key={r.role} className="rounded-lg border p-4">
              <div className="flex items-center gap-2 mb-3">
                <r.icon className="h-5 w-5 text-primary" />
                <h3 className="font-semibold print:text-[12pt]">{r.role}</h3>
              </div>
              <ul className="list-disc ml-5 space-y-1 text-sm print:text-[11pt]">
                {r.rights.map((right) => (
                  <li key={right}>{right}</li>
                ))}
              </ul>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="print-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 print:text-[14pt]">
            <BookOpenCheck className="h-5 w-5 text-primary" />
            Каталог функциональных подсистем
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {featureCatalog.map((section) => (
            <div key={section.title}>
              <h3 className="font-semibold mb-2 print:text-[12pt]">{section.title}</h3>
              <ul className="list-disc ml-5 space-y-1 text-sm print:text-[11pt]">
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="print-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 print:text-[14pt]">
            <ClipboardCheck className="h-5 w-5 text-primary" />
            Сценарии эксплуатации и проверки
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {scenarios.map((scenario, idx) => (
            <div key={scenario.name} className="rounded-lg border p-4 space-y-3">
              <SectionTitle index={`3.${idx + 1}`} title={scenario.name} />
              <div>
                <h4 className="font-medium mb-1 print:text-[11pt]">Порядок выполнения</h4>
                <ol className="list-decimal ml-5 space-y-1 text-sm print:text-[11pt]">
                  {scenario.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </div>
              <div>
                <h4 className="font-medium mb-1 print:text-[11pt]">Критерии проверки</h4>
                <ul className="list-disc ml-5 space-y-1 text-sm print:text-[11pt]">
                  {scenario.checks.map((check) => (
                    <li key={check}>{check}</li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="print-card">
        <CardHeader>
          <CardTitle>4. Чек-лист приемки перед демонстрацией</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm print:text-[11pt]">
            {acceptanceChecklist.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="mt-1 h-3 w-3 rounded-sm border border-muted-foreground" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card className="print-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 print:text-[14pt]">
            <History className="h-5 w-5 text-primary" />
            Журнал действий администратора
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(auditLog?.items || []).length > 0 ? (auditLog?.items || []).map((entry) => (
            <div key={entry.id} className="rounded-lg border p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-medium">{humanizeAuditAction(entry.action)}</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {new Date(entry.timestamp).toLocaleString("ru-RU")} • {entry.adminLogin} • {entry.target || "admin-panel"}
                  </div>
                </div>
                <Badge variant="secondary" className={auditStatusMeta[entry.status].className}>
                  {auditStatusMeta[entry.status].label}
                </Badge>
              </div>
              <div className="mt-3 text-xs text-muted-foreground">
                IP: {entry.ip || "не определен"}
              </div>
            </div>
          )) : (
            <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
              Журнал пока пуст. После входов, выгрузок и открытия печатных материалов здесь появятся записи.
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="print-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 print:text-[14pt]">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Приоритетные улучшения сервиса
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {roadmapItems.map((item) => (
            <div key={item.title} className="rounded-lg border p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-semibold print:text-[12pt]">{item.title}</h3>
                <Badge variant="outline">{item.priority}</Badge>
              </div>
              <p className="text-sm leading-6 text-muted-foreground print:text-[11pt]">{item.description}</p>
              <div className="rounded-lg bg-muted/50 px-3 py-2 text-sm print:text-[11pt]">
                <span className="font-medium">Эффект: </span>
                {item.outcome}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
