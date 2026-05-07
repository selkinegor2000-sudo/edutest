import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import bcrypt from "bcrypt";
import { storage } from "./storage";
import { registerSchema, loginSchema, insertTestSchema, updateProfileSchema } from "@shared/schema";
import { z } from "zod";
import memorystore from "memorystore";
import * as XLSX from "xlsx";
import PDFDocument from "pdfkit";
import { extractTextFromFile, cleanText } from "./document-parser";
import multer from "multer";
import * as path from "path";
import * as fs from "fs";
import { rebuildDemoContour } from "./demo-seed";

declare module "express-session" {
  interface SessionData {
    userId: string;
    adminAuthenticated?: boolean;
    adminLogin?: string;
  }
}

const AI_API_KEY = process.env.AI_API_KEY || "";
const AI_BASE_URL = process.env.AI_BASE_URL || "https://openrouter.ai/api/v1";
const AI_MODEL = process.env.AI_MODEL || "";
const ADMIN_PANEL_LOGIN = process.env.ADMIN_PANEL_LOGIN || "admin";
const ADMIN_PANEL_PASSWORD = process.env.ADMIN_PANEL_PASSWORD || "Admin12345!";
const ADMIN_PANEL_PASSWORD_HASH = process.env.ADMIN_PANEL_PASSWORD_HASH || "";
const AI_MODEL_CANDIDATES = (process.env.AI_MODEL_CANDIDATES || "")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);
const YANDEX_API_KEY = process.env.YANDEX_API_KEY || "";

type AdminAuditStatus = "success" | "warning" | "error" | "info";
type AdminHealthStatus = "ok" | "warning" | "error";
type AdminReadinessStatus = "ready" | "attention" | "critical";

type AdminAuditLogEntry = {
  id: string;
  timestamp: string;
  adminLogin: string;
  action: string;
  target: string | null;
  status: AdminAuditStatus;
  details: Record<string, unknown>;
  ip: string | null;
  userAgent: string | null;
};

type AdminHealthCheck = {
  key: string;
  title: string;
  status: AdminHealthStatus;
  message: string;
  details?: string;
  responseTimeMs?: number | null;
};

type AdminReadinessItem = {
  key: string;
  title: string;
  status: AdminReadinessStatus;
  message: string;
};

// Multer configuration для загрузки файлов
const uploadDir = "./uploads";
const appDataDir = path.resolve("./data");
const adminAuditLogPath = path.join(appDataDir, "admin-audit-log.jsonl");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
if (!fs.existsSync(appDataDir)) {
  fs.mkdirSync(appDataDir, { recursive: true });
}

const uploadStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({
  storage: uploadStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const validMimes = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain", "application/json"];
    if (validMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type"));
    }
  },
});

const OPENROUTER_FALLBACK_MODELS = [
  "google/gemma-4-26b-a4b-it:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "qwen/qwen3-next-80b-a3b-instruct:free",
  "nousresearch/hermes-3-llama-3.1-405b:free",
];

const GROQ_FALLBACK_MODELS = [
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
  "openai/gpt-oss-20b",
];

const groupSchema = z.object({
  name: z.string().min(2, "Название группы должно содержать минимум 2 символа"),
  description: z.string().optional().nullable(),
});

const groupMemberSchema = z.object({
  studentId: z.string().min(1, "Не выбран студент"),
});

const bulkAssignSchema = z.object({
  testId: z.string().min(1, "Не выбран тест"),
  studentIds: z.array(z.string()).default([]),
  groupIds: z.array(z.string()).default([]),
  dueAt: z.string().datetime().optional().nullable(),
});

const messageSchema = z.object({
  content: z.string().min(1, "Сообщение не может быть пустым").max(2000, "Сообщение слишком длинное"),
});

const batchCreateSchema = z.object({
  tests: z.array(
    z.object({
      title: z.string().min(1),
      description: z.string().optional(),
      subject: z.string().min(1),
      timeLimitMinutes: z.number().min(1).max(180).default(30),
      isPublished: z.boolean().default(false),
      isCompetitive: z.boolean().default(false),
      scheduledAt: z.string().datetime().optional().nullable(),
      questions: z.array(z.any()).min(1),
    })
  ).min(1, "Добавьте хотя бы один тест"),
});

const templateCloneSchema = z.object({
  title: z.string().min(1, "Введите название теста"),
  isPublished: z.boolean().default(false),
  scheduledAt: z.string().datetime().optional().nullable(),
});

const materialMetaSchema = z.object({
  title: z.string().min(2, "Введите название материала"),
  description: z.string().optional().nullable(),
  materialType: z.enum(["book", "manual", "trainer_test", "test_import"]).default("manual"),
});

const proctorEventsSchema = z.object({
  events: z.array(z.object({
    eventType: z.string().min(1),
    details: z.string().optional().nullable(),
    idleSeconds: z.number().optional().nullable(),
  })).default([]),
});

const rubricPreviewSchema = z.object({
  questionText: z.string().min(1),
  rubricCriteria: z.array(z.string()).min(1),
  sampleAnswer: z.string().min(1),
});

const importReadyTestBodySchema = z.object({
  title: z.string().optional(),
  subject: z.string().optional(),
});

const aiAnalysisRequestSchema = z.object({
  model: z.string().min(1).optional(),
});

const adminLoginSchema = z.object({
  login: z.string().min(3, "Логин администратора должен содержать минимум 3 символа"),
  password: z.string().min(6, "Пароль администратора должен содержать минимум 6 символов"),
});

const adminAuditEventSchema = z.object({
  action: z.string().min(2, "Не указано действие"),
  target: z.string().max(200).optional().nullable(),
  status: z.enum(["success", "warning", "error", "info"]).optional().default("info"),
  details: z.record(z.unknown()).optional().default({}),
});

const adminDemoResetSchema = z.object({
  resetAuditLog: z.boolean().optional().default(true),
});

const groupReportQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
});

const generateFromUrlSchema = z.object({
  url: z.string().url("Некорректная ссылка"),
  title: z.string().min(1, "Укажите название теста"),
  subject: z.string().min(1, "Укажите предмет"),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
  questionCount: z.number().min(3).max(20).default(5),
});

const seedDemoAttemptsSchema = z.object({
  testId: z.string().optional(),
  studentsPerTest: z.number().min(1).max(50).default(5),
});

let aiModelsCache: { fetchedAt: number; models: string[] } = { fetchedAt: 0, models: [] };

function buildUserLabel(user: any) {
  return user?.fullName || user?.username || "Неизвестный пользователь";
}

function getClientIp(req?: Request) {
  if (!req) return null;

  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0].trim();
  }

  if (Array.isArray(forwarded) && forwarded[0]) {
    return forwarded[0];
  }

  return req.socket.remoteAddress || null;
}

function appendAdminAuditLogEntry(params: {
  adminLogin: string;
  action: string;
  req?: Request;
  target?: string | null;
  status?: AdminAuditStatus;
  details?: Record<string, unknown>;
}) {
  const entry: AdminAuditLogEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    adminLogin: params.adminLogin,
    action: params.action,
    target: params.target ?? null,
    status: params.status ?? "info",
    details: params.details ?? {},
    ip: getClientIp(params.req),
    userAgent: params.req?.headers["user-agent"] || null,
  };

  fs.appendFileSync(adminAuditLogPath, `${JSON.stringify(entry)}\n`, "utf-8");
  return entry;
}

function readAdminAuditLogEntries(limit = 25): AdminAuditLogEntry[] {
  if (!fs.existsSync(adminAuditLogPath)) {
    return [];
  }

  const lines = fs.readFileSync(adminAuditLogPath, "utf-8")
    .split(/\r?\n/)
    .filter(Boolean)
    .slice(-limit)
    .reverse();

  return lines.flatMap((line) => {
    try {
      return [JSON.parse(line) as AdminAuditLogEntry];
    } catch {
      return [];
    }
  });
}

function resolvePdfFontPath() {
  const candidates = [
    path.join(process.env.WINDIR || "C:\\Windows", "Fonts", "arial.ttf"),
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf",
  ];

  return candidates.find((candidate) => fs.existsSync(candidate));
}

function applyReadablePdfFont(doc: any) {
  const fontPath = resolvePdfFontPath();
  if (fontPath) {
    doc.font(fontPath);
  }
}

function buildAdminSummaryRows(summary: any) {
  return [
    { "Показатель": "Всего пользователей", "Значение": summary.usersTotal },
    { "Показатель": "Преподаватели", "Значение": summary.teachers },
    { "Показатель": "Студенты", "Значение": summary.students },
    { "Показатель": "Тесты", "Значение": summary.testsTotal },
    { "Показатель": "Вопросы", "Значение": summary.questionsTotal },
    { "Показатель": "Попытки", "Значение": summary.attemptsTotal },
    { "Показатель": "Завершенные попытки", "Значение": summary.completedAttempts },
    { "Показатель": "Материалы", "Значение": summary.materialsTotal },
    { "Показатель": "Сообщения", "Значение": summary.messagesTotal },
    { "Показатель": "Уведомления", "Значение": summary.notificationsTotal },
    { "Показатель": "Группы", "Значение": summary.groupsTotal },
    { "Показатель": "Назначения", "Значение": summary.assignmentsTotal },
    { "Показатель": "Сформировано", "Значение": new Date(summary.generatedAt).toLocaleString("ru-RU") },
  ];
}

async function buildAdminSystemHealth() {
  const checks: AdminHealthCheck[] = [];

  const dbStartedAt = Date.now();
  try {
    await storage.getAdminSystemSummary();
    checks.push({
      key: "database",
      title: "База данных",
      status: "ok",
      message: "Сводные данные читаются без ошибок.",
      responseTimeMs: Date.now() - dbStartedAt,
    });
  } catch (error) {
    checks.push({
      key: "database",
      title: "База данных",
      status: "error",
      message: "Не удалось получить системную сводку.",
      details: error instanceof Error ? error.message : "Неизвестная ошибка",
      responseTimeMs: Date.now() - dbStartedAt,
    });
  }

  const configuredModels = uniqueNonEmptyModels([AI_MODEL, ...AI_MODEL_CANDIDATES]);
  if (!AI_API_KEY) {
    checks.push({
      key: "ai-provider",
      title: "AI-провайдер",
      status: "warning",
      message: "AI_API_KEY не задан. Нужен fallback или ручной сценарий показа.",
      details: configuredModels.length > 0 ? `Настроенные модели: ${configuredModels.join(", ")}` : "Модели не указаны.",
    });
  } else {
    const aiStartedAt = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    try {
      const modelsUrl = new URL("models", AI_BASE_URL.endsWith("/") ? AI_BASE_URL : `${AI_BASE_URL}/`);
      const headers: Record<string, string> = {
        Authorization: `Bearer ${AI_API_KEY}`,
      };

      if (AI_BASE_URL.includes("openrouter.ai")) {
        headers["HTTP-Referer"] = "http://localhost:3333";
        headers["X-Title"] = "EduTest";
      }

      const response = await fetch(modelsUrl.toString(), {
        method: "GET",
        headers,
        signal: controller.signal,
      });

      const responseTimeMs = Date.now() - aiStartedAt;
      if (!response.ok) {
        checks.push({
          key: "ai-provider",
          title: "AI-провайдер",
          status: "warning",
          message: `Провайдер ответил кодом ${response.status}.`,
          details: `Базовый URL: ${AI_BASE_URL}`,
          responseTimeMs,
        });
      } else {
        checks.push({
          key: "ai-provider",
          title: "AI-провайдер",
          status: "ok",
          message: `Провайдер доступен, настроено моделей: ${configuredModels.length || 1}.`,
          details: `Базовый URL: ${AI_BASE_URL}`,
          responseTimeMs,
        });
      }
    } catch (error) {
      checks.push({
        key: "ai-provider",
        title: "AI-провайдер",
        status: "warning",
        message: "Не удалось подтвердить доступность AI-провайдера в рамках быстрой проверки.",
        details: error instanceof Error ? error.message : "Неизвестная ошибка",
        responseTimeMs: Date.now() - aiStartedAt,
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  const requiredArtifacts = [
    path.resolve("public", "admin-guide-print.html"),
    path.resolve("public", "EduTest_Admin_Guide.docx"),
    path.resolve("docs", "EduTest_Admin_Guide.docx"),
  ];
  const missingArtifacts = requiredArtifacts.filter((artifactPath) => !fs.existsSync(artifactPath));
  checks.push({
    key: "documents",
    title: "Печатные материалы",
    status: missingArtifacts.length === 0 ? "ok" : "warning",
    message: missingArtifacts.length === 0
      ? "HTML и Word-материалы доступны для печати и передачи."
      : "Часть печатных артефактов отсутствует.",
    details: missingArtifacts.length === 0
      ? "public/admin-guide-print.html, public/EduTest_Admin_Guide.docx, docs/EduTest_Admin_Guide.docx"
      : missingArtifacts.join("; "),
  });

  try {
    fs.appendFileSync(adminAuditLogPath, "", "utf-8");
    checks.push({
      key: "audit-log",
      title: "Журнал администратора",
      status: "ok",
      message: "Файл журнала доступен для записи.",
      details: adminAuditLogPath,
    });
  } catch (error) {
    checks.push({
      key: "audit-log",
      title: "Журнал администратора",
      status: "error",
      message: "Не удалось открыть журнал администратора для записи.",
      details: error instanceof Error ? error.message : "Неизвестная ошибка",
    });
  }

  checks.push({
    key: "admin-access",
    title: "Административный доступ",
    status: ADMIN_PANEL_LOGIN && (ADMIN_PANEL_PASSWORD_HASH || ADMIN_PANEL_PASSWORD) ? "ok" : "error",
    message: ADMIN_PANEL_LOGIN && (ADMIN_PANEL_PASSWORD_HASH || ADMIN_PANEL_PASSWORD)
      ? `Отдельный контур настроен для логина ${ADMIN_PANEL_LOGIN}.`
      : "Не настроены отдельные учетные данные администратора.",
  });

  const overallStatus: AdminHealthStatus = checks.some((check) => check.status === "error")
    ? "error"
    : checks.some((check) => check.status === "warning")
      ? "warning"
      : "ok";

  return {
    overallStatus,
    generatedAt: new Date().toISOString(),
    checks,
  };
}

async function buildAdminReadinessReport() {
  const summary = await storage.getAdminSystemSummary();
  const printArtifactsReady = fs.existsSync(path.resolve("public", "admin-guide-print.html"))
    && fs.existsSync(path.resolve("public", "EduTest_Admin_Guide.docx"));

  const items: AdminReadinessItem[] = [
    {
      key: "admin-access",
      title: "Отдельный административный вход",
      status: ADMIN_PANEL_LOGIN && (ADMIN_PANEL_PASSWORD_HASH || ADMIN_PANEL_PASSWORD) ? "ready" : "critical",
      message: ADMIN_PANEL_LOGIN && (ADMIN_PANEL_PASSWORD_HASH || ADMIN_PANEL_PASSWORD)
        ? "Административный контур выделен и готов к использованию."
        : "Не заданы отдельные реквизиты администратора.",
    },
    {
      key: "roles",
      title: "Ролевое покрытие демонстрации",
      status: summary.teachers > 0 && summary.students > 0 ? "ready" : "attention",
      message: summary.teachers > 0 && summary.students > 0
        ? `Доступны обе ключевые роли: преподаватели (${summary.teachers}) и студенты (${summary.students}).`
        : "Для полноценного показа желательно иметь и преподавателей, и студентов.",
    },
    {
      key: "content",
      title: "Учебный контент",
      status: summary.testsTotal > 0 && summary.questionsTotal > 0 ? "ready" : "attention",
      message: summary.testsTotal > 0 && summary.questionsTotal > 0
        ? `Контур наполнен: ${summary.testsTotal} тестов и ${summary.questionsTotal} вопросов.`
        : "Не хватает тестов или вопросов для убедительной демонстрации.",
    },
    {
      key: "attempts",
      title: "История прохождения",
      status: summary.completedAttempts > 0 ? "ready" : "attention",
      message: summary.completedAttempts > 0
        ? `Есть завершенные попытки: ${summary.completedAttempts} из ${summary.attemptsTotal}.`
        : "Желательно подготовить хотя бы одну завершенную попытку для показа результатов.",
    },
    {
      key: "communications",
      title: "Коммуникации и оргконтур",
      status: (summary.messagesTotal + summary.notificationsTotal) > 0 ? "ready" : "attention",
      message: (summary.messagesTotal + summary.notificationsTotal) > 0
        ? `Зафиксировано ${summary.messagesTotal + summary.notificationsTotal} коммуникационных событий.`
        : "Стоит наполнить контур сообщениями и уведомлениями.",
    },
    {
      key: "print-artifacts",
      title: "Печатные артефакты",
      status: printArtifactsReady ? "ready" : "critical",
      message: printArtifactsReady
        ? "HTML- и DOCX-материалы доступны для печати и передачи."
        : "Не все печатные материалы сформированы.",
    },
    {
      key: "ai-readiness",
      title: "AI-контур",
      status: AI_API_KEY ? "ready" : "attention",
      message: AI_API_KEY
        ? `AI-провайдер настроен, базовый URL: ${AI_BASE_URL}.`
        : "AI-провайдер не настроен, рекомендуется показывать fallback-сценарий.",
    },
  ];

  const readyCount = items.filter((item) => item.status === "ready").length;
  const attentionCount = items.filter((item) => item.status === "attention").length;
  const criticalCount = items.filter((item) => item.status === "critical").length;

  return {
    generatedAt: new Date().toISOString(),
    overallStatus: criticalCount > 0 ? "critical" : attentionCount > 0 ? "attention" : "ready",
    readyCount,
    attentionCount,
    criticalCount,
    items,
  };
}

function uniqueNonEmptyModels(models: Array<string | undefined | null>) {
  return Array.from(new Set(models.filter((item): item is string => Boolean(item && item.trim())).map((item) => item.trim())));
}

function parseAIJson<T = any>(raw: string): T {
  const direct = raw?.trim() || "";
  if (!direct) {
    throw new Error("Пустой ответ AI");
  }

  try {
    return JSON.parse(direct) as T;
  } catch {
    // continue
  }

  const fenceMatch = direct.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch?.[1]) {
    try {
      return JSON.parse(fenceMatch[1].trim()) as T;
    } catch {
      // continue
    }
  }

  const firstBrace = direct.indexOf("{");
  const lastBrace = direct.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const sliced = direct.slice(firstBrace, lastBrace + 1);
    return JSON.parse(sliced) as T;
  }

  throw new Error("AI вернул невалидный JSON");
}

function htmlToText(html: string) {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function validateAdminPassword(password: string) {
  if (ADMIN_PANEL_PASSWORD_HASH) {
    return bcrypt.compare(password, ADMIN_PANEL_PASSWORD_HASH);
  }

  return password === ADMIN_PANEL_PASSWORD;
}

function isDisallowedHost(hostname: string) {
  const h = hostname.toLowerCase();
  if (["localhost", "127.0.0.1", "::1"].includes(h)) return true;
  if (/^10\./.test(h)) return true;
  if (/^192\.168\./.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(h)) return true;
  return false;
}

async function notifyUsers(userIds: string[], title: string, body: string, link?: string) {
  for (const userId of Array.from(new Set(userIds))) {
    await storage.createNotification({
      userId,
      title,
      body,
      link: link || null,
      type: "info",
      isRead: false,
    });
  }
}

async function cloneTestForTeacher(sourceTestId: string, teacherId: string, overrides: Record<string, any>) {
  const sourceTest = await storage.getTestWithQuestions(sourceTestId);
  if (!sourceTest) {
    throw new Error("Исходный тест не найден");
  }

  const clonedTest = await storage.createTest({
    title: overrides.title || sourceTest.title,
    description: overrides.description ?? sourceTest.description,
    subject: overrides.subject || sourceTest.subject,
    teacherId,
    timeLimitMinutes: overrides.timeLimitMinutes ?? sourceTest.timeLimitMinutes,
    isPublished: overrides.isPublished ?? false,
    isCompetitive: overrides.isCompetitive ?? sourceTest.isCompetitive,
    isTemplate: overrides.isTemplate ?? false,
    templateCategory: overrides.templateCategory ?? sourceTest.templateCategory ?? null,
    scheduledAt: overrides.scheduledAt ?? null,
  });

  for (let questionIndex = 0; questionIndex < sourceTest.questions.length; questionIndex++) {
    const sourceQuestion = sourceTest.questions[questionIndex];
    const createdQuestion = await storage.createQuestion({
      testId: clonedTest.id,
      type: sourceQuestion.type,
      text: sourceQuestion.text,
      points: sourceQuestion.points,
      correctAnswer: sourceQuestion.correctAnswer,
      orderIndex: questionIndex,
      imageUrl: sourceQuestion.imageUrl,
      videoUrl: sourceQuestion.videoUrl,
    });

    for (let optionIndex = 0; optionIndex < sourceQuestion.options.length; optionIndex++) {
      const option = sourceQuestion.options[optionIndex];
      await storage.createQuestionOption({
        questionId: createdQuestion.id,
        text: option.text,
        isCorrect: option.isCorrect,
        orderIndex: optionIndex,
      });
    }
  }

  return clonedTest;
}

function normalizeImportedQuestions(rawQuestions: any[]) {
  return rawQuestions.map((question, index) => ({
    type: question.type || "single_choice",
    text: question.text,
    points: Number(question.points || 1),
    topic: question.topic || null,
    difficulty: question.difficulty || (Number(question.points || 1) >= 5 ? "hard" : Number(question.points || 1) >= 3 ? "medium" : "easy"),
    correctAnswer: question.correctAnswer || null,
    rubricCriteria: Array.isArray(question.rubricCriteria) ? question.rubricCriteria : null,
    orderIndex: index,
    imageUrl: question.imageUrl || null,
    videoUrl: question.videoUrl || null,
    options: Array.isArray(question.options)
      ? question.options.map((option: any) => ({
          text: option.text,
          isCorrect: Boolean(option.isCorrect),
        }))
      : [],
  }));
}

async function parseReadyTestContent(rawContent: string, fileName: string) {
  const trimmed = rawContent.trim();
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed.questions) && parsed.questions.length > 0) {
      return {
        title: parsed.title || fileName.replace(/\.[^.]+$/, ""),
        description: parsed.description || "Импортированный тест",
        subject: parsed.subject || "Без предмета",
        isAdaptive: Boolean(parsed.isAdaptive),
        questions: normalizeImportedQuestions(parsed.questions),
      };
    }
  } catch {
    // fall through to AI parsing
  }

  const prompt = `Ты преобразуешь готовый учебный тест в JSON-структуру для веб-интерфейса.

ИСХОДНЫЙ ТЕКСТ ТЕСТА:
${trimmed.substring(0, 7000)}

Верни только валидный JSON строго такого вида:
{
  "title": "Название теста",
  "description": "Краткое описание",
  "subject": "Предмет",
  "isAdaptive": false,
  "questions": [
    {
      "type": "single_choice",
      "text": "Текст вопроса",
      "topic": "Тема",
      "difficulty": "easy",
      "points": 1,
      "rubricCriteria": ["критерий 1"],
      "options": [
        { "text": "Вариант", "isCorrect": true }
      ]
    }
  ]
}`;

  const aiResponse = await callAI(prompt);
  const parsed = parseAIJson<any>(aiResponse);
  return {
    title: parsed.title || fileName.replace(/\.[^.]+$/, ""),
    description: parsed.description || "Импортированный тест",
    subject: parsed.subject || "Без предмета",
    isAdaptive: Boolean(parsed.isAdaptive),
    questions: normalizeImportedQuestions(parsed.questions || []),
  };
}

async function analyzeMaterialContent(title: string, content: string, materialType: string) {
  const prompt = `Ты анализируешь методический материал преподавателя.

Название: ${title}
Тип: ${materialType}
Содержимое:
${content.substring(0, 7000)}

Верни только JSON:
{
  "summary": "3-4 предложения",
  "keywords": ["ключевое слово"],
  "difficulty": "Начальный / Средний / Продвинутый",
  "topics": ["тема 1", "тема 2"],
  "trainerIdeas": ["идея тренажёра 1", "идея тренажёра 2"]
}`;

  const aiResponse = await callAI(prompt);
  return parseAIJson<any>(aiResponse);
}

function buildProctorSummary(events: any[]) {
  const suspiciousEvents = events.filter((event) => ["visibility_hidden", "window_blur", "idle_pause"].includes(event.eventType));
  const totalIdleSeconds = suspiciousEvents.reduce((sum, event) => sum + Number(event.idleSeconds || 0), 0);
  const proctorScore = Math.max(0, 100 - suspiciousEvents.length * 8 - Math.min(30, Math.round(totalIdleSeconds / 10)));
  const summary = suspiciousEvents.length === 0
    ? "Подозрительных событий не обнаружено."
    : `Зафиксировано ${suspiciousEvents.length} подозрительных событий, суммарные паузы: ${totalIdleSeconds} сек.`;

  return {
    suspiciousEventsCount: suspiciousEvents.length,
    proctorScore,
    proctorSummary: summary,
  };
}

async function callAI(prompt: string): Promise<string> {
  return callAIWithModel(prompt);
}

async function getProviderModels() {
  const now = Date.now();
  if (now - aiModelsCache.fetchedAt < 60_000 && aiModelsCache.models.length > 0) {
    return aiModelsCache.models;
  }

  if (!AI_API_KEY) {
    return [];
  }

  try {
    const response = await fetch(`${AI_BASE_URL}/models`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${AI_API_KEY}`,
        "Content-Type": "application/json",
      },
    });
    if (!response.ok) {
      return [];
    }
    const data = await response.json() as any;
    const models = Array.isArray(data?.data)
      ? data.data.map((item: any) => String(item?.id || "")).filter(Boolean)
      : [];
    aiModelsCache = { fetchedAt: now, models };
    return models;
  } catch {
    return [];
  }
}

async function callAIWithModel(prompt: string, preferredModel?: string): Promise<string> {
  const isGroq = /api\.groq\.com/i.test(AI_BASE_URL);
  const providerFallbacks = isGroq ? GROQ_FALLBACK_MODELS : OPENROUTER_FALLBACK_MODELS;
  const basePool = uniqueNonEmptyModels([preferredModel, AI_MODEL, ...AI_MODEL_CANDIDATES, ...providerFallbacks]);
  const availableModels = await getProviderModels();
  const models = availableModels.length > 0
    ? uniqueNonEmptyModels([...basePool.filter((model) => availableModels.includes(model)), ...basePool])
    : basePool;

  if (models.length === 0) {
    throw new Error("Не найдено доступных AI-моделей");
  }

  let lastError = "";
  for (const model of models) {
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${AI_API_KEY}`,
      };
      if (!isGroq) {
        headers["HTTP-Referer"] = "http://localhost:3333";
      }

      const response = await fetch(`${AI_BASE_URL}/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
          temperature: 0.3,
        }),
      });

      if (response.ok) {
        const data = await response.json() as any;
        return data.choices?.[0]?.message?.content || "";
      }

      const err = await response.text();
      if (response.status === 400 && /response_format|json_object/i.test(err)) {
        const retry = await fetch(`${AI_BASE_URL}/chat/completions`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            model,
            messages: [{ role: "user", content: `${prompt}\n\nВерни строго JSON без markdown.` }],
            temperature: 0.3,
          }),
        });
        if (retry.ok) {
          const retryData = await retry.json() as any;
          return retryData.choices?.[0]?.message?.content || "";
        }
        const retryErr = await retry.text();
        lastError = `${isGroq ? "Groq" : "OpenRouter"}/${model}: ${retry.status} ${retryErr.substring(0, 120)}`;
        continue;
      }

      lastError = `${isGroq ? "Groq" : "OpenRouter"}/${model}: ${response.status} ${err.substring(0, 120)}`;
    } catch (error) {
      lastError = `${isGroq ? "Groq" : "OpenRouter"}/${model}: connection error`;
    }
  }

  if (YANDEX_API_KEY && process.env.USE_YANDEX === "true") {
    try {
      const response = await fetch("https://llm.api.cloud.yandex.net/foundationModels/v1/completion", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Api-Key ${YANDEX_API_KEY}`,
        },
        body: JSON.stringify({
          modelUri: "gpt://b1gvlvnrick8u8q3g5ng/yandexgpt/latest",
          completionOptions: { temperature: 0.3, maxTokens: 8000 },
          messages: [{ role: "user", text: prompt }],
        }),
      });
      if (response.ok) {
        const data = await response.json() as any;
        return data.result?.alternatives?.[0]?.message?.text || "";
      }
      lastError = `Yandex: ${response.status}`;
    } catch {
      lastError = "Yandex: connection error";
    }
  }

  throw new Error(`All AI services failed. Last: ${lastError}`);
}

async function evaluateWithAI(studentAnswer: string, correctAnswer: string, questionText: string, rubricCriteria?: string[] | null): Promise<{ score: number; feedback: string }> {
  if (!AI_API_KEY) {
    return { score: 50, feedback: "AI-оценка недоступна: не задан AI_API_KEY." };
  }
  try {
    const prompt = `Ты - эксперт по оценке знаний студентов. Оцени ответ студента на вопрос.

Вопрос: ${questionText}

Эталонный ответ: ${correctAnswer}

  Критерии оценивания: ${rubricCriteria && rubricCriteria.length > 0 ? rubricCriteria.join("; ") : "Нет дополнительных критериев"}

Ответ студента: ${studentAnswer}

Оцени ответ по шкале от 0 до 100, где:
- 0-30: Неверный или очень неполный ответ
- 31-60: Частично верный ответ
- 61-80: Хороший ответ с небольшими недочетами
- 81-100: Отличный, полный ответ

Верни ТОЛЬКО валидный JSON:
{
  "score": <число от 0 до 100>,
  "feedback": "<подробный комментарий о качестве ответа, что правильно, что можно улучшить>"
}`;

    const text = await callAI(prompt);
    const result = parseAIJson<{ score: number; feedback: string }>(text);
    return {
      score: Math.max(0, Math.min(100, result.score)),
      feedback: result.feedback || "Анализ выполнен",
    };
  } catch (error) {
    console.error("AI evaluation error:", error);
    return { score: 50, feedback: "AI-анализ временно недоступен. Ответ будет проверен преподавателем." };
  }
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Необходима авторизация" });
  }
  next();
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session.adminAuthenticated) {
    return res.status(401).json({ message: "Необходима авторизация администратора" });
  }

  next();
}

async function requireTeacher(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Необходима авторизация" });
  }
  const user = await storage.getUser(req.session.userId);
  if (!user || user.role !== "teacher") {
    return res.status(403).json({ message: "Доступ только для преподавателей" });
  }
  next();
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  const MemoryStore = memorystore(session);
  
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "edutest-secret-key",
      resave: false,
      saveUninitialized: false,
      store: new MemoryStore({
        checkPeriod: 86400000,
      }),
      cookie: {
        secure: false,
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000,
      },
    })
  );
  
  function sanitizeUser(user: any) {
    const { password, ...safeUser } = user;
    return safeUser;
  }

  app.post("/api/admin/login", async (req, res) => {
    try {
      const data = adminLoginSchema.parse(req.body);

      if (data.login !== ADMIN_PANEL_LOGIN) {
        appendAdminAuditLogEntry({
          adminLogin: data.login,
          action: "login_failed",
          req,
          target: "admin-panel",
          status: "error",
          details: { reason: "invalid_login" },
        });
        return res.status(400).json({ message: "Неверный логин или пароль администратора" });
      }

      const validPassword = await validateAdminPassword(data.password);
      if (!validPassword) {
        appendAdminAuditLogEntry({
          adminLogin: data.login,
          action: "login_failed",
          req,
          target: "admin-panel",
          status: "error",
          details: { reason: "invalid_password" },
        });
        return res.status(400).json({ message: "Неверный логин или пароль администратора" });
      }

      req.session.adminAuthenticated = true;
      req.session.adminLogin = ADMIN_PANEL_LOGIN;
      appendAdminAuditLogEntry({
        adminLogin: ADMIN_PANEL_LOGIN,
        action: "login_success",
        req,
        target: "admin-panel",
        status: "success",
      });

      res.json({
        login: ADMIN_PANEL_LOGIN,
        title: "Администратор контура",
        panelUrl: "/admin-panel",
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Admin login error:", error);
      res.status(500).json({ message: "Ошибка входа в админ-панель" });
    }
  });

  app.post("/api/admin/logout", (req, res) => {
    const adminLogin = req.session.adminLogin || ADMIN_PANEL_LOGIN;
    appendAdminAuditLogEntry({
      adminLogin,
      action: "logout",
      req,
      target: "admin-panel",
      status: "success",
    });
    req.session.adminAuthenticated = false;
    delete req.session.adminLogin;
    res.json({ message: "Вы вышли из админ-панели" });
  });

  app.get("/api/admin/me", requireAdmin, (req, res) => {
    res.json({
      login: req.session.adminLogin || ADMIN_PANEL_LOGIN,
      title: "Администратор контура",
      panelUrl: "/admin-panel",
      printGuideUrl: "/admin-guide-print.html",
      wordGuideUrl: "/EduTest_Admin_Guide.docx",
    });
  });

  app.get("/api/admin/system-summary", requireAdmin, async (_req, res) => {
    try {
      const summary = await storage.getAdminSystemSummary();
      res.json(summary);
    } catch (error) {
      console.error("Admin system summary error:", error);
      res.status(500).json({ message: "Ошибка получения сводных показателей системы" });
    }
  });

  app.get("/api/admin/system-health", requireAdmin, async (_req, res) => {
    try {
      const health = await buildAdminSystemHealth();
      res.json(health);
    } catch (error) {
      console.error("Admin system health error:", error);
      res.status(500).json({ message: "Ошибка получения статуса сервиса" });
    }
  });

  app.get("/api/admin/readiness-report", requireAdmin, async (_req, res) => {
    try {
      const report = await buildAdminReadinessReport();
      res.json(report);
    } catch (error) {
      console.error("Admin readiness report error:", error);
      res.status(500).json({ message: "Ошибка формирования отчета готовности" });
    }
  });

  app.get("/api/admin/audit-log", requireAdmin, (req, res) => {
    const requestedLimit = Number(req.query.limit ?? 25);
    const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(100, requestedLimit)) : 25;
    res.json({ items: readAdminAuditLogEntries(limit) });
  });

  app.post("/api/admin/audit-log", requireAdmin, (req, res) => {
    try {
      const data = adminAuditEventSchema.parse(req.body);
      const entry = appendAdminAuditLogEntry({
        adminLogin: req.session.adminLogin || ADMIN_PANEL_LOGIN,
        action: data.action,
        req,
        target: data.target ?? null,
        status: data.status,
        details: data.details,
      });
      res.status(201).json(entry);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }

      console.error("Admin audit log error:", error);
      res.status(500).json({ message: "Ошибка записи административного журнала" });
    }
  });

  app.post("/api/admin/demo-reset", requireAdmin, async (req, res) => {
    try {
      const data = adminDemoResetSchema.parse(req.body || {});
      const result = await rebuildDemoContour();

      if (data.resetAuditLog) {
        fs.writeFileSync(adminAuditLogPath, "", "utf-8");
      }

      const entry = appendAdminAuditLogEntry({
        adminLogin: req.session.adminLogin || ADMIN_PANEL_LOGIN,
        action: "demo_reset",
        req,
        target: "demo-contour",
        status: "success",
        details: result,
      });

      res.json({
        message: "Демо-контур восстановлен",
        ...result,
        loggedActionId: entry.id,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }

      console.error("Admin demo reset error:", error);
      res.status(500).json({ message: "Ошибка восстановления демо-контура" });
    }
  });

  app.get("/api/admin/export/summary/excel", requireAdmin, async (req, res) => {
    try {
      const summary = await storage.getAdminSystemSummary();
      const health = await buildAdminSystemHealth();
      const readiness = await buildAdminReadinessReport();

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(buildAdminSummaryRows(summary)), "Сводка");
      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(
          health.checks.map((check) => ({
            "Компонент": check.title,
            "Статус": check.status,
            "Сообщение": check.message,
            "Детали": check.details || "",
            "Время ответа, мс": check.responseTimeMs ?? "",
          }))
        ),
        "Мониторинг"
      );
      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(
          readiness.items.map((item) => ({
            "Проверка": item.title,
            "Статус": item.status,
            "Комментарий": item.message,
          }))
        ),
        "Готовность"
      );
      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(
          readAdminAuditLogEntries(25).map((entry) => ({
            "Время": new Date(entry.timestamp).toLocaleString("ru-RU"),
            "Логин": entry.adminLogin,
            "Действие": entry.action,
            "Цель": entry.target || "",
            "Статус": entry.status,
          }))
        ),
        "Журнал"
      );

      const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
      appendAdminAuditLogEntry({
        adminLogin: req.session.adminLogin || ADMIN_PANEL_LOGIN,
        action: "export_summary_excel",
        req,
        target: "admin-summary-excel",
        status: "success",
        details: { overallHealth: health.overallStatus, overallReadiness: readiness.overallStatus },
      });

      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", "attachment; filename=admin_summary_report.xlsx");
      res.send(buffer);
    } catch (error) {
      console.error("Admin Excel export error:", error);
      res.status(500).json({ message: "Ошибка экспорта административной сводки в Excel" });
    }
  });

  app.get("/api/admin/export/summary/pdf", requireAdmin, async (req, res) => {
    try {
      const summary = await storage.getAdminSystemSummary();
      const health = await buildAdminSystemHealth();
      const readiness = await buildAdminReadinessReport();

      const doc = new PDFDocument({ margin: 40, size: "A4" });
      applyReadablePdfFont(doc);

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", "attachment; filename=admin_summary_report.pdf");
      doc.pipe(res);

      doc.fontSize(18).text("Административная сводка EduTest", { align: "center" });
      doc.moveDown(0.5);
      doc.fontSize(10).text(`Дата формирования: ${new Date().toLocaleString("ru-RU")}`);
      doc.text(`Администратор: ${req.session.adminLogin || ADMIN_PANEL_LOGIN}`);
      doc.text(`Общая готовность: ${readiness.overallStatus}`);
      doc.text(`Общий статус сервиса: ${health.overallStatus}`);
      doc.moveDown();

      doc.fontSize(14).text("1. Ключевые показатели", { underline: true });
      doc.moveDown(0.5);
      buildAdminSummaryRows(summary).forEach((row: Record<string, unknown>) => {
        doc.fontSize(10).text(`${row["Показатель"]}: ${row["Значение"]}`);
      });
      doc.moveDown();

      doc.fontSize(14).text("2. Мониторинг сервиса", { underline: true });
      doc.moveDown(0.5);
      health.checks.forEach((check) => {
        doc.fontSize(10).text(`• ${check.title}: ${check.status} — ${check.message}`);
        if (check.details) {
          doc.fontSize(9).fillColor("#475569").text(`  ${check.details}`);
          doc.fillColor("black");
        }
      });
      doc.moveDown();

      doc.fontSize(14).text("3. Автопроверка готовности", { underline: true });
      doc.moveDown(0.5);
      readiness.items.forEach((item) => {
        doc.fontSize(10).text(`• ${item.title}: ${item.status} — ${item.message}`);
      });
      doc.moveDown();

      doc.fontSize(14).text("4. Последние действия администратора", { underline: true });
      doc.moveDown(0.5);
      const auditEntries = readAdminAuditLogEntries(10);
      if (auditEntries.length === 0) {
        doc.fontSize(10).text("Журнал пока пуст.");
      } else {
        auditEntries.forEach((entry) => {
          doc.fontSize(10).text(`• ${new Date(entry.timestamp).toLocaleString("ru-RU")} — ${entry.action} (${entry.status})`);
        });
      }

      appendAdminAuditLogEntry({
        adminLogin: req.session.adminLogin || ADMIN_PANEL_LOGIN,
        action: "export_summary_pdf",
        req,
        target: "admin-summary-pdf",
        status: "success",
        details: { overallHealth: health.overallStatus, overallReadiness: readiness.overallStatus },
      });

      doc.end();
    } catch (error) {
      console.error("Admin PDF export error:", error);
      res.status(500).json({ message: "Ошибка экспорта административной сводки в PDF" });
    }
  });

  app.post("/api/auth/register", async (req, res) => {
    try {
      const data = registerSchema.parse(req.body);
      
      const existingUser = await storage.getUserByUsername(data.username);
      if (existingUser) {
        return res.status(400).json({ message: "Пользователь с таким логином уже существует" });
      }

      const hashedPassword = await bcrypt.hash(data.password, 10);
      const user = await storage.createUser({
        ...data,
        password: hashedPassword,
      });

      req.session.userId = user.id;
      res.json(sanitizeUser(user));
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Register error:", error);
      res.status(500).json({ message: "Ошибка регистрации" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const data = loginSchema.parse(req.body);
      
      const user = await storage.getUserByUsername(data.username);
      if (!user) {
        return res.status(400).json({ message: "Неверный логин или пароль" });
      }

      const validPassword = await bcrypt.compare(data.password, user.password);
      if (!validPassword) {
        return res.status(400).json({ message: "Неверный логин или пароль" });
      }

      req.session.userId = user.id;
      res.json(sanitizeUser(user));
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Login error:", error);
      res.status(500).json({ message: "Ошибка входа" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Ошибка выхода" });
      }
      res.json({ message: "Вы вышли из системы" });
    });
  });

  app.get("/api/auth/me", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Не авторизован" });
    }

    const user = await storage.getUser(req.session.userId);
    if (!user) {
      return res.status(401).json({ message: "Пользователь не найден" });
    }

    res.json(sanitizeUser(user));
  });

  app.put("/api/profile", requireAuth, async (req, res) => {
    try {
      const data = updateProfileSchema.parse(req.body);
      const user = await storage.updateProfile(req.session.userId!, data);
      res.json(sanitizeUser(user));
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Неверные данные", errors: error.errors });
      }
      console.error("Update profile error:", error);
      res.status(500).json({ message: "Ошибка обновления профиля" });
    }
  });

  app.get("/api/tests/available", requireAuth, async (req, res) => {
    try {
      const tests = await storage.getPublishedTestsForStudent(req.session.userId!);
      res.json(tests);
    } catch (error) {
      console.error("Get available tests error:", error);
      res.status(500).json({ message: "Ошибка получения тестов" });
    }
  });

  app.get("/api/tests/my", requireTeacher, async (req, res) => {
    try {
      const tests = await storage.getTestsByTeacher(req.session.userId!);
      res.json(tests);
    } catch (error) {
      console.error("Get my tests error:", error);
      res.status(500).json({ message: "Ошибка получения тестов" });
    }
  });

  app.get("/api/tests/:id", requireAuth, async (req, res) => {
    try {
      const test = await storage.getTestWithQuestions(req.params.id);
      if (!test) {
        return res.status(404).json({ message: "Тест не найден" });
      }
      res.json(test);
    } catch (error) {
      console.error("Get test error:", error);
      res.status(500).json({ message: "Ошибка получения теста" });
    }
  });

  app.get("/api/tests/:id/full", requireAuth, async (req, res) => {
    try {
      const test = await storage.getTestWithQuestions(req.params.id);
      if (!test) {
        return res.status(404).json({ message: "Тест не найден" });
      }
      res.json(test);
    } catch (error) {
      console.error("Get test full error:", error);
      res.status(500).json({ message: "Ошибка получения теста" });
    }
  });

  app.get("/api/tests/:id/stats", requireAuth, async (req, res) => {
    try {
      const attempts = await storage.getAttemptsByTest(req.params.id);
      res.json({ attempts });
    } catch (error) {
      console.error("Get test stats error:", error);
      res.status(500).json({ message: "Ошибка получения статистики теста" });
    }
  });

  app.get("/api/tests/:id/results", requireTeacher, async (req, res) => {
    try {
      const test = await storage.getTest(req.params.id);
      if (!test) {
        return res.status(404).json({ message: "Тест не найден" });
      }

      if (test.teacherId !== req.session.userId) {
        return res.status(403).json({ message: "Нет доступа к этому тесту" });
      }

      const attempts = await storage.getAttemptsByTest(req.params.id);
      const questions = await storage.getQuestionsByTest(req.params.id);

      res.json({
        ...test,
        attempts,
        questionCount: questions.length,
      });
    } catch (error) {
      console.error("Get test results error:", error);
      res.status(500).json({ message: "Ошибка получения результатов" });
    }
  });

  app.post("/api/tests", requireTeacher, async (req, res) => {
    try {
      const { questions: questionsData, ...testData } = req.body;

      if (!Array.isArray(questionsData) || questionsData.length === 0) {
        return res.status(400).json({ message: "Добавьте хотя бы один вопрос" });
      }

      const scheduledAtValue = testData.scheduledAt
        ? new Date(testData.scheduledAt)
        : null;
      const scheduledAt = scheduledAtValue && !Number.isNaN(scheduledAtValue.getTime())
        ? scheduledAtValue
        : null;

      const normalizedTimeLimit = Number(testData.timeLimitMinutes);
      if (!Number.isFinite(normalizedTimeLimit) || normalizedTimeLimit < 1 || normalizedTimeLimit > 180) {
        return res.status(400).json({ message: "Некорректное время теста (1-180 минут)" });
      }
      
      const test = await storage.createTest({
        ...testData,
        timeLimitMinutes: Math.round(normalizedTimeLimit),
        scheduledAt,
        teacherId: req.session.userId!,
      });

      for (let i = 0; i < questionsData.length; i++) {
        const { options, ...questionData } = questionsData[i];

        if (!questionData?.text || !String(questionData.text).trim()) {
          return res.status(400).json({ message: `У вопроса ${i + 1} отсутствует текст` });
        }
        
        const question = await storage.createQuestion({
          ...questionData,
          points: Number.isFinite(Number(questionData.points)) ? Math.max(1, Math.round(Number(questionData.points))) : 1,
          testId: test.id,
          orderIndex: i,
        });

        if (options && options.length > 0) {
          for (let j = 0; j < options.length; j++) {
            await storage.createQuestionOption({
              ...options[j],
              questionId: question.id,
              orderIndex: j,
            });
          }
        }
      }

      res.json(test);
    } catch (error) {
      console.error("Create test error:", error);
      res.status(500).json({ message: "Ошибка создания теста", details: String(error) });
    }
  });

  app.put("/api/tests/:id", requireTeacher, async (req, res) => {
    try {
      const test = await storage.getTest(req.params.id);
      if (!test) {
        return res.status(404).json({ message: "Тест не найден" });
      }
      
      if (test.teacherId !== req.session.userId) {
        return res.status(403).json({ message: "Нет доступа к этому тесту" });
      }

      const { questions: questionsData, ...testData } = req.body;

      if (!Array.isArray(questionsData) || questionsData.length === 0) {
        return res.status(400).json({ message: "Добавьте хотя бы один вопрос" });
      }

      const scheduledAtValue = testData.scheduledAt
        ? new Date(testData.scheduledAt)
        : null;
      const scheduledAt = scheduledAtValue && !Number.isNaN(scheduledAtValue.getTime())
        ? scheduledAtValue
        : null;
      const normalizedTimeLimit = Number(testData.timeLimitMinutes);
      if (!Number.isFinite(normalizedTimeLimit) || normalizedTimeLimit < 1 || normalizedTimeLimit > 180) {
        return res.status(400).json({ message: "Некорректное время теста (1-180 минут)" });
      }
      
      await storage.updateTest(req.params.id, {
        ...testData,
        timeLimitMinutes: Math.round(normalizedTimeLimit),
        scheduledAt,
      });
      
      await storage.deleteQuestionsByTest(req.params.id);

      for (let i = 0; i < questionsData.length; i++) {
        const { options, id: questionId, ...questionData } = questionsData[i];

        if (!questionData?.text || !String(questionData.text).trim()) {
          return res.status(400).json({ message: `У вопроса ${i + 1} отсутствует текст` });
        }
        
        const question = await storage.createQuestion({
          ...questionData,
          points: Number.isFinite(Number(questionData.points)) ? Math.max(1, Math.round(Number(questionData.points))) : 1,
          testId: req.params.id,
          orderIndex: i,
        });

        if (options && options.length > 0) {
          for (let j = 0; j < options.length; j++) {
            const { id: optionId, ...optionData } = options[j];
            await storage.createQuestionOption({
              ...optionData,
              questionId: question.id,
              orderIndex: j,
            });
          }
        }
      }

      const updatedTest = await storage.getTestWithQuestions(req.params.id);
      res.json(updatedTest);
    } catch (error) {
      console.error("Update test error:", error);
      res.status(500).json({ message: "Ошибка обновления теста", details: String(error) });
    }
  });

  app.delete("/api/tests/:id", requireTeacher, async (req, res) => {
    try {
      const test = await storage.getTest(req.params.id);
      if (!test) {
        return res.status(404).json({ message: "Тест не найден" });
      }
      
      if (test.teacherId !== req.session.userId) {
        return res.status(403).json({ message: "Нет доступа к этому тесту" });
      }

      await storage.deleteTest(req.params.id);
      res.json({ message: "Тест удален" });
    } catch (error) {
      console.error("Delete test error:", error);
      res.status(500).json({ message: "Ошибка удаления теста" });
    }
  });

  app.get("/api/tests/templates", requireTeacher, async (req, res) => {
    try {
      const templates = await storage.getTemplatesByTeacher(req.session.userId!);
      res.json(templates);
    } catch (error) {
      console.error("Get templates error:", error);
      res.status(500).json({ message: "Ошибка получения шаблонов" });
    }
  });

  app.post("/api/tests/:id/save-template", requireTeacher, async (req, res) => {
    try {
      const sourceTest = await storage.getTest(req.params.id);
      if (!sourceTest || sourceTest.teacherId !== req.session.userId) {
        return res.status(404).json({ message: "Тест не найден" });
      }

      const template = await cloneTestForTeacher(req.params.id, req.session.userId!, {
        title: `${sourceTest.title} (шаблон)`,
        isTemplate: true,
        isPublished: false,
        scheduledAt: null,
      });

      res.json(template);
    } catch (error) {
      console.error("Save template error:", error);
      res.status(500).json({ message: "Ошибка создания шаблона" });
    }
  });

  app.post("/api/tests/from-template/:id", requireTeacher, async (req, res) => {
    try {
      const template = await storage.getTest(req.params.id);
      if (!template || template.teacherId !== req.session.userId || !template.isTemplate) {
        return res.status(404).json({ message: "Шаблон не найден" });
      }

      const data = templateCloneSchema.parse(req.body);
      const cloned = await cloneTestForTeacher(req.params.id, req.session.userId!, {
        title: data.title,
        isPublished: data.isPublished,
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
        isTemplate: false,
      });

      res.json(cloned);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Clone template error:", error);
      res.status(500).json({ message: "Ошибка создания теста из шаблона" });
    }
  });

  app.post("/api/tests/batch", requireTeacher, async (req, res) => {
    try {
      const data = batchCreateSchema.parse(req.body);
      const createdTests = [];

      for (const item of data.tests) {
        const test = await storage.createTest({
          title: item.title,
          description: item.description,
          subject: item.subject,
          teacherId: req.session.userId!,
          timeLimitMinutes: item.timeLimitMinutes,
          isPublished: item.isPublished,
          isCompetitive: item.isCompetitive,
          isTemplate: false,
          templateCategory: null,
          scheduledAt: item.scheduledAt ? new Date(item.scheduledAt) : null,
        });

        for (let questionIndex = 0; questionIndex < item.questions.length; questionIndex++) {
          const { options, ...questionData } = item.questions[questionIndex];
          const question = await storage.createQuestion({
            ...questionData,
            testId: test.id,
            orderIndex: questionIndex,
          });

          if (Array.isArray(options)) {
            for (let optionIndex = 0; optionIndex < options.length; optionIndex++) {
              await storage.createQuestionOption({
                ...options[optionIndex],
                questionId: question.id,
                orderIndex: optionIndex,
              });
            }
          }
        }

        createdTests.push(test);
      }

      res.json({ createdCount: createdTests.length, tests: createdTests });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Batch create tests error:", error);
      res.status(500).json({ message: "Ошибка пакетного создания тестов" });
    }
  });

  app.post("/api/tests/import-ready", requireTeacher, upload.single("file"), async (req, res) => {
    try {
      const meta = importReadyTestBodySchema.parse(req.body);
      if (!req.file) {
        return res.status(400).json({ message: "Файл не загружен" });
      }

      const rawContent = req.file.mimetype === "application/json"
        ? fs.readFileSync(req.file.path, "utf-8")
        : cleanText(await extractTextFromFile(req.file.path, req.file.mimetype));

      const parsedTest = await parseReadyTestContent(rawContent, req.file.originalname);
      const preview = {
        ...parsedTest,
        title: meta.title || parsedTest.title,
        subject: meta.subject || parsedTest.subject,
      };

      fs.unlinkSync(req.file.path);
      res.json(preview);
    } catch (error) {
      if (req.file) {
        try {
          fs.unlinkSync(req.file.path);
        } catch {
          // ignore cleanup errors
        }
      }
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Import ready test error:", error);
      res.status(500).json({ message: "Ошибка импорта готового теста" });
    }
  });

  app.get("/api/questions/search", requireTeacher, async (req, res) => {
    try {
      const query = typeof req.query.q === "string" ? req.query.q : "";
      const results = await storage.searchQuestions(req.session.userId!, query);
      res.json(results);
    } catch (error) {
      console.error("Question search error:", error);
      res.status(500).json({ message: "Ошибка поиска вопросов" });
    }
  });

  app.post("/api/questions/:id/hint", requireAuth, async (req, res) => {
    try {
      const question = await storage.getQuestionsByTest(req.body.testId || "");
      const targetQuestion = question.find((item) => item.id === req.params.id);
      if (!targetQuestion) {
        return res.status(404).json({ message: "Вопрос не найден" });
      }

      const prompt = `Ты даёшь студенту короткую подсказку по вопросу, но не раскрываешь готовый ответ.

Вопрос: ${targetQuestion.text}
Тип вопроса: ${targetQuestion.type}

Верни JSON:
{
  "hint": "1-2 предложения с направляющей подсказкой без готового ответа",
  "focus": "на что обратить внимание"
}`;

      const aiResponse = await callAI(prompt);
      res.json(parseAIJson<any>(aiResponse));
    } catch (error) {
      console.error("Question hint error:", error);
      res.status(500).json({ message: "Ошибка получения подсказки" });
    }
  });

  app.post("/api/rubrics/preview", requireTeacher, async (req, res) => {
    try {
      const data = rubricPreviewSchema.parse(req.body);
      const prompt = `Ты оцениваешь пример ответа студента по рубрике.

Вопрос: ${data.questionText}
Критерии: ${data.rubricCriteria.join("; ")}
Ответ студента: ${data.sampleAnswer}

Верни только JSON:
{
  "score": 0,
  "feedback": "Короткий разбор по критериям",
  "criteriaCoverage": ["что покрыто", "что не покрыто"]
}`;

      const aiResponse = await callAI(prompt);
      res.json(parseAIJson<any>(aiResponse));
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Rubric preview error:", error);
      res.status(500).json({ message: "Ошибка предпросмотра рубрики" });
    }
  });

  app.get("/api/groups", requireTeacher, async (req, res) => {
    try {
      const groups = await storage.getGroupsByTeacher(req.session.userId!);
      res.json(groups);
    } catch (error) {
      console.error("Get groups error:", error);
      res.status(500).json({ message: "Ошибка получения групп" });
    }
  });

  app.post("/api/groups", requireTeacher, async (req, res) => {
    try {
      const data = groupSchema.parse(req.body);
      const group = await storage.createGroup({
        teacherId: req.session.userId!,
        name: data.name,
        description: data.description || null,
      });
      res.json(group);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Create group error:", error);
      res.status(500).json({ message: "Ошибка создания группы" });
    }
  });

  app.post("/api/groups/:id/members", requireTeacher, async (req, res) => {
    try {
      const data = groupMemberSchema.parse(req.body);
      const group = (await storage.getGroupsByTeacher(req.session.userId!)).find((item) => item.id === req.params.id);
      if (!group) {
        return res.status(404).json({ message: "Группа не найдена" });
      }

      const member = await storage.addStudentToGroup(req.params.id, data.studentId);
      res.json(member);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Add group member error:", error);
      res.status(500).json({ message: "Ошибка добавления участника" });
    }
  });

  app.delete("/api/groups/:id/members/:studentId", requireTeacher, async (req, res) => {
    try {
      await storage.removeStudentFromGroup(req.params.id, req.params.studentId);
      res.json({ message: "Участник удалён" });
    } catch (error) {
      console.error("Remove group member error:", error);
      res.status(500).json({ message: "Ошибка удаления участника" });
    }
  });

  app.post("/api/tests/bulk-assign", requireTeacher, async (req, res) => {
    try {
      const data = bulkAssignSchema.parse(req.body);
      const uniqueStudentIds = new Set<string>(data.studentIds);

      if (data.groupIds.length > 0) {
        const groups = await storage.getGroupsByTeacher(req.session.userId!);
        for (const group of groups.filter((item) => data.groupIds.includes(item.id))) {
          for (const member of group.members) {
            uniqueStudentIds.add(member.id);
          }
        }
      }

      const assignments = await storage.assignTestToStudents(
        Array.from(uniqueStudentIds).map((studentId) => ({
          testId: data.testId,
          studentId,
          groupId: null,
          assignedByTeacherId: req.session.userId!,
          dueAt: data.dueAt ? new Date(data.dueAt) : null,
        }))
      );

      const test = await storage.getTest(data.testId);
      if (test) {
        await notifyUsers(
          Array.from(uniqueStudentIds),
          "Назначен новый тест",
          `Вам назначен тест: ${test.title}`,
          "/"
        );
      }

      res.json({ assignedCount: assignments.length, assignments });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Bulk assign error:", error);
      res.status(500).json({ message: "Ошибка массового назначения теста" });
    }
  });

  app.get("/api/assignments/my", requireAuth, async (req, res) => {
    try {
      const assignments = await storage.getAssignmentsByStudent(req.session.userId!);
      res.json(assignments);
    } catch (error) {
      console.error("Get student assignments error:", error);
      res.status(500).json({ message: "Ошибка получения назначений" });
    }
  });

  app.get("/api/assignments/teacher", requireTeacher, async (req, res) => {
    try {
      const assignments = await storage.getAssignmentsByTeacher(req.session.userId!);
      res.json(assignments);
    } catch (error) {
      console.error("Get teacher assignments error:", error);
      res.status(500).json({ message: "Ошибка получения назначений" });
    }
  });

  app.get("/api/messages/contacts", requireAuth, async (req, res) => {
    try {
      const contacts = await storage.getChatContacts(req.session.userId!);
      res.json(contacts.map((contact) => ({
        id: contact.id,
        fullName: contact.fullName,
        username: contact.username,
        role: contact.role,
      })));
    } catch (error) {
      console.error("Get message contacts error:", error);
      res.status(500).json({ message: "Ошибка получения контактов" });
    }
  });

  app.get("/api/messages/:userId", requireAuth, async (req, res) => {
    try {
      const conversation = await storage.getConversation(req.session.userId!, req.params.userId);
      await storage.markConversationRead(req.session.userId!, req.params.userId);
      res.json(conversation);
    } catch (error) {
      console.error("Get conversation error:", error);
      res.status(500).json({ message: "Ошибка получения переписки" });
    }
  });

  app.post("/api/messages/:userId", requireAuth, async (req, res) => {
    try {
      const data = messageSchema.parse(req.body);
      const sender = await storage.getUser(req.session.userId!);
      const recipient = await storage.getUser(req.params.userId);
      if (!sender || !recipient) {
        return res.status(404).json({ message: "Пользователь не найден" });
      }

      const message = await storage.createMessage({
        fromUserId: req.session.userId!,
        toUserId: req.params.userId,
        content: data.content,
      });

      await notifyUsers(
        [req.params.userId],
        `Новое сообщение от ${buildUserLabel(sender)}`,
        data.content.slice(0, 120),
        "/messages"
      );

      res.json(message);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Send message error:", error);
      res.status(500).json({ message: "Ошибка отправки сообщения" });
    }
  });

  app.get("/api/notifications", requireAuth, async (req, res) => {
    try {
      const items = await storage.getNotifications(req.session.userId!);
      res.json(items);
    } catch (error) {
      console.error("Get notifications error:", error);
      res.status(500).json({ message: "Ошибка получения уведомлений" });
    }
  });

  app.post("/api/notifications/:id/read", requireAuth, async (req, res) => {
    try {
      await storage.markNotificationAsRead(req.params.id, req.session.userId!);
      res.json({ message: "Уведомление прочитано" });
    } catch (error) {
      console.error("Mark notification read error:", error);
      res.status(500).json({ message: "Ошибка обновления уведомления" });
    }
  });

  app.post("/api/tests/:id/start", requireAuth, async (req, res) => {
    try {
      const test = await storage.getTest(req.params.id);
      if (!test) {
        return res.status(404).json({ message: "Тест не найден" });
      }
      
      if (!test.isPublished) {
        return res.status(400).json({ message: "Тест не опубликован" });
      }

      if (test.isTemplate) {
        return res.status(400).json({ message: "Шаблон нельзя проходить как тест" });
      }

      if (test.scheduledAt && new Date(test.scheduledAt) > new Date()) {
        return res.status(400).json({ message: "Тест будет доступен позже", scheduledAt: test.scheduledAt });
      }

      // Проверяем: нет ли уже завершённой попытки
      const existingAttempts = await storage.getAttemptsByStudent(req.session.userId!);
      const completed = existingAttempts.find(
        (a: any) => a.testId === req.params.id && a.status === "completed"
      );
      if (completed) {
        return res.status(400).json({ message: "Вы уже прошли этот тест", attemptId: completed.id });
      }

      // Если есть незавершённая — возвращаем её
      const inProgress = existingAttempts.find(
        (a: any) => a.testId === req.params.id && a.status === "in_progress"
      );
      if (inProgress) {
        return res.json(inProgress);
      }

      const attempt = await storage.createTestAttempt({
        testId: req.params.id,
        studentId: req.session.userId!,
        status: "in_progress",
      });

      res.json(attempt);
    } catch (error) {
      console.error("Start test error:", error);
      res.status(500).json({ message: "Ошибка начала теста" });
    }
  });

  app.get("/api/attempts/my", requireAuth, async (req, res) => {
    try {
      const attempts = await storage.getAttemptsByStudent(req.session.userId!);
      res.json(attempts);
    } catch (error) {
      console.error("Get my attempts error:", error);
      res.status(500).json({ message: "Ошибка получения попыток" });
    }
  });

  app.get("/api/attempts/:id", requireAuth, async (req, res) => {
    try {
      const attempt = await storage.getTestAttempt(req.params.id);
      if (!attempt) {
        return res.status(404).json({ message: "Попытка не найдена" });
      }
      res.json(attempt);
    } catch (error) {
      console.error("Get attempt error:", error);
      res.status(500).json({ message: "Ошибка получения попытки" });
    }
  });

  app.get("/api/attempts/:id/full", requireAuth, async (req, res) => {
    try {
      const attempt = await storage.getTestAttemptWithDetails(req.params.id);
      if (!attempt) {
        return res.status(404).json({ message: "Попытка не найдена" });
      }
      res.json(attempt);
    } catch (error) {
      console.error("Get attempt full error:", error);
      res.status(500).json({ message: "Ошибка получения попытки" });
    }
  });

  app.put("/api/attempts/:id/save", requireAuth, async (req, res) => {
    try {
      const attempt = await storage.getTestAttempt(req.params.id);
      if (!attempt) {
        return res.status(404).json({ message: "Попытка не найдена" });
      }
      
      if (attempt.studentId !== req.session.userId) {
        return res.status(403).json({ message: "Нет доступа к этой попытке" });
      }

      await storage.updateTestAttempt(req.params.id, {
        savedAnswers: req.body.answers,
      });

      res.json({ message: "Прогресс сохранен" });
    } catch (error) {
      console.error("Save progress error:", error);
      res.status(500).json({ message: "Ошибка сохранения прогресса" });
    }
  });

  app.post("/api/attempts/:id/proctor-events", requireAuth, async (req, res) => {
    try {
      const attempt = await storage.getTestAttempt(req.params.id);
      if (!attempt) {
        return res.status(404).json({ message: "Попытка не найдена" });
      }
      if (attempt.studentId !== req.session.userId) {
        return res.status(403).json({ message: "Нет доступа к этой попытке" });
      }

      const data = proctorEventsSchema.parse(req.body);
      const created = await storage.createProctorEvents(data.events.map((event) => ({
        attemptId: req.params.id,
        eventType: event.eventType,
        details: event.details || null,
        idleSeconds: event.idleSeconds || null,
      })));

      res.json({ createdCount: created.length });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Save proctor events error:", error);
      res.status(500).json({ message: "Ошибка сохранения событий прокторинга" });
    }
  });

  app.post("/api/attempts/:id/submit", requireAuth, async (req, res) => {
    try {
      const attempt = await storage.getTestAttempt(req.params.id);
      if (!attempt) {
        return res.status(404).json({ message: "Попытка не найдена" });
      }
      
      if (attempt.studentId !== req.session.userId) {
        return res.status(403).json({ message: "Нет доступа к этой попытке" });
      }

      const test = await storage.getTestWithQuestions(attempt.testId);
      if (!test) {
        return res.status(404).json({ message: "Тест не найден" });
      }

      const { answers: studentAnswers } = req.body;
      let totalScore = 0;
      let maxScore = 0;

      for (const question of test.questions) {
        maxScore += question.points;
        const studentAnswer = studentAnswers[question.id];
        
        let isCorrect = false;
        let pointsAwarded = 0;
        let aiFeedback = null;

        if (question.type === "single_choice" || question.type === "multiple_choice") {
          const correctOptionIds = question.options
            .filter((o: any) => o.isCorrect)
            .map((o: any) => o.id)
            .sort();
          
          const selectedIds = (studentAnswer?.selectedOptions || []).sort();
          
          if (JSON.stringify(correctOptionIds) === JSON.stringify(selectedIds)) {
            isCorrect = true;
            pointsAwarded = question.points;
          }
        } else if (question.type === "open_answer") {
          if (studentAnswer?.text && question.correctAnswer) {
            const evaluation = await evaluateWithAI(
              studentAnswer.text,
              question.correctAnswer,
              question.text,
              question.rubricCriteria || null,
            );
            pointsAwarded = (evaluation.score / 100) * question.points;
            isCorrect = evaluation.score >= 60;
            aiFeedback = evaluation.feedback;
          }
        }

        totalScore += pointsAwarded;

        await storage.createAnswer({
          attemptId: req.params.id,
          questionId: question.id,
          answerText: studentAnswer?.text || null,
          selectedOptionIds: studentAnswer?.selectedOptions || null,
          isCorrect,
          pointsAwarded,
          aiFeedback,
        });
      }

      const proctorEvents = await storage.getProctorEventsByAttempt(req.params.id);
      const proctorSummary = buildProctorSummary(proctorEvents);

      await storage.updateTestAttempt(req.params.id, {
        status: "completed",
        completedAt: new Date(),
        score: totalScore,
        maxScore,
        suspiciousEventsCount: proctorSummary.suspiciousEventsCount,
        proctorScore: proctorSummary.proctorScore,
        proctorSummary: proctorSummary.proctorSummary,
      });

      res.json({ 
        message: "Тест завершен",
        score: totalScore,
        maxScore,
        proctorScore: proctorSummary.proctorScore,
      });
    } catch (error) {
      console.error("Submit test error:", error);
      res.status(500).json({ message: "Ошибка завершения теста" });
    }
  });

  app.get("/api/stats/student", requireAuth, async (req, res) => {
    try {
      const stats = await storage.getStudentStats(req.session.userId!);
      res.json(stats);
    } catch (error) {
      console.error("Get student stats error:", error);
      res.status(500).json({ message: "Ошибка получения статистики" });
    }
  });

  // Агрегированная статистика теста (для страницы результатов студента — сравнение с группой)
  app.get("/api/tests/:id/stats", requireAuth, async (req, res) => {
    try {
      const attempts = await storage.getAttemptsByTest(req.params.id);
      res.json({ attempts });
    } catch (error) {
      res.status(500).json({ message: "Ошибка получения статистики теста" });
    }
  });

  // Результаты теста для преподавателя
  app.get("/api/tests/:id/results", requireTeacher, async (req, res) => {
    try {
      const test = await storage.getTest(req.params.id);
      if (!test) {
        return res.status(404).json({ message: "Тест не найден" });
      }
      if (test.teacherId !== req.session.userId) {
        return res.status(403).json({ message: "Нет доступа к этому тесту" });
      }
      const attempts = await storage.getAttemptsByTest(req.params.id);
      const questions = await storage.getQuestionsByTest(req.params.id);
      res.json({ ...test, attempts, questionCount: questions.length });
    } catch (error) {
      console.error("Get test results error:", error);
      res.status(500).json({ message: "Ошибка получения результатов" });
    }
  });

  app.get("/api/my-students", requireTeacher, async (req, res) => {
    try {
      const students = await storage.getTeacherStudents(req.session.userId!);
      res.json(students.map((student) => ({
        id: student.id,
        fullName: student.fullName,
        username: student.username,
      })));
    } catch (error) {
      console.error("Get my students error:", error);
      res.status(500).json({ message: "Ошибка получения списка учеников" });
    }
  });

  app.get("/api/all-students", requireTeacher, async (req, res) => {
    try {
      const allStudents = await storage.getAllStudents();
      const myStudents = await storage.getTeacherStudents(req.session.userId!);
      const myStudentIds = new Set(myStudents.map((student) => student.id));

      res.json(allStudents.map((student) => ({
        id: student.id,
        fullName: student.fullName,
        username: student.username,
        isMyStudent: myStudentIds.has(student.id),
      })));
    } catch (error) {
      console.error("Get all students error:", error);
      res.status(500).json({ message: "Ошибка получения списка студентов" });
    }
  });

  app.post("/api/my-students/:studentId", requireTeacher, async (req, res) => {
    try {
      const student = await storage.getUser(req.params.studentId);
      if (!student || student.role !== "student") {
        return res.status(404).json({ message: "Студент не найден" });
      }
      
      await storage.addStudentToTeacher(req.session.userId!, req.params.studentId);
      res.json({ message: "Студент добавлен" });
    } catch (error) {
      console.error("Add student error:", error);
      res.status(500).json({ message: "Ошибка добавления студента" });
    }
  });

  app.delete("/api/my-students/:studentId", requireTeacher, async (req, res) => {
    try {
      await storage.removeStudentFromTeacher(req.session.userId!, req.params.studentId);
      res.json({ message: "Студент удален из списка" });
    } catch (error) {
      console.error("Remove student error:", error);
      res.status(500).json({ message: "Ошибка удаления студента" });
    }
  });

  app.get("/api/export/test/:id/excel", requireTeacher, async (req, res) => {
    try {
      const test = await storage.getTestWithQuestions(req.params.id);
      if (!test || test.teacherId !== req.session.userId) {
        return res.status(404).json({ message: "Тест не найден" });
      }

      const attempts = await storage.getTestAttempts(req.params.id);
      
      const data = [];
      for (const attempt of attempts) {
        const student = await storage.getUser(attempt.studentId);
        const answers = await storage.getAnswersByAttempt(attempt.id);
        
        const row: Record<string, any> = {
          "Студент": buildUserLabel(student),
          "Дата начала": attempt.startedAt ? new Date(attempt.startedAt).toLocaleString("ru-RU") : "—",
          "Статус": attempt.status === "completed" ? "Завершен" : "В процессе",
          "Баллы": attempt.score || 0,
          "Макс. баллы": attempt.maxScore || 0,
          "Процент": attempt.maxScore ? Math.round((Number(attempt.score || 0) / attempt.maxScore) * 100) : 0,
        };

        for (const q of test.questions) {
          const answer = answers.find((a) => a.questionId === q.id);
          row[`Вопрос ${q.id.substring(0, 6)}: ${q.text.substring(0, 30)}...`] = answer?.answerText || 
            (answer?.selectedOptionIds ? answer.selectedOptionIds.join(", ") : "Нет ответа");
        }
        
        data.push(row);
      }

      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Результаты");

      const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
      
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename=test_${req.params.id}_results.xlsx`);
      res.send(buffer);
    } catch (error) {
      console.error("Export Excel error:", error);
      res.status(500).json({ message: "Ошибка экспорта в Excel" });
    }
  });

  app.get("/api/export/test/:id/csv", requireTeacher, async (req, res) => {
    try {
      const test = await storage.getTestWithQuestions(req.params.id);
      if (!test || test.teacherId !== req.session.userId) {
        return res.status(404).json({ message: "Тест не найден" });
      }

      const attempts = await storage.getTestAttempts(req.params.id);
      const rows = await Promise.all(attempts.map(async (attempt) => {
        const student = await storage.getUser(attempt.studentId);
        return {
          student: buildUserLabel(student),
          startedAt: attempt.startedAt ? new Date(attempt.startedAt).toLocaleString("ru-RU") : "—",
          status: attempt.status,
          score: attempt.score || 0,
          maxScore: attempt.maxScore || 0,
          percent: attempt.maxScore ? Math.round((Number(attempt.score || 0) / attempt.maxScore) * 100) : 0,
        };
      }));

      const worksheet = XLSX.utils.json_to_sheet(rows);
      const csv = XLSX.utils.sheet_to_csv(worksheet);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename=test_${req.params.id}_results.csv`);
      res.send(`\uFEFF${csv}`);
    } catch (error) {
      console.error("Export CSV error:", error);
      res.status(500).json({ message: "Ошибка экспорта в CSV" });
    }
  });

  app.get("/api/export/test/:id/pdf", requireTeacher, async (req, res) => {
    try {
      const test = await storage.getTestWithQuestions(req.params.id);
      if (!test || test.teacherId !== req.session.userId) {
        return res.status(404).json({ message: "Тест не найден" });
      }

      const attempts = await storage.getTestAttempts(req.params.id);

      const doc = new PDFDocument({ margin: 50 });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename=test_${req.params.id}_results.pdf`);
      doc.pipe(res);

      doc.fontSize(20).text(test.title, { align: "center" });
      doc.moveDown();
      doc.fontSize(12).text(`Предмет: ${test.subject}`);
      doc.text(`Количество вопросов: ${test.questions.length}`);
      doc.text(`Лимит времени: ${test.timeLimitMinutes} минут`);
      doc.text(`Количество попыток: ${attempts.length}`);
      doc.moveDown();

      doc.fontSize(16).text("Результаты студентов:", { underline: true });
      doc.moveDown();

      for (const attempt of attempts) {
        const student = await storage.getUser(attempt.studentId);
        const studentName = buildUserLabel(student);
        
        doc.fontSize(12).text(`Студент: ${studentName}`);
        doc.text(`Дата: ${attempt.startedAt ? new Date(attempt.startedAt).toLocaleString("ru-RU") : "—"}`);
        doc.text(`Статус: ${attempt.status === "completed" ? "Завершен" : "В процессе"}`);
        doc.text(`Результат: ${attempt.score || 0} / ${attempt.maxScore || 0} (${attempt.maxScore ? Math.round((Number(attempt.score || 0) / attempt.maxScore) * 100) : 0}%)`);
        doc.moveDown();
      }

      doc.end();
    } catch (error) {
      console.error("Export PDF error:", error);
      res.status(500).json({ message: "Ошибка экспорта в PDF" });
    }
  });

  app.get("/api/export/students/excel", requireTeacher, async (req, res) => {
    try {
      const stats = await storage.getStudentsStatsByTeacher(req.session.userId!);
      
      const data = stats.map((s: any) => ({
        "Имя": s.student?.fullName || s.name || "Неизвестен",
        "Email": s.student?.username || s.email || "",
        "Пройдено тестов": s.testsCompleted,
        "Средний балл": s.averageScore?.toFixed(1) || 0,
      }));

      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Студенты");

      const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
      
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", "attachment; filename=students_stats.xlsx");
      res.send(buffer);
    } catch (error) {
      console.error("Export students Excel error:", error);
      res.status(500).json({ message: "Ошибка экспорта статистики студентов" });
    }
  });

  app.get("/api/export/group-report/pdf", requireTeacher, async (req, res) => {
    try {
      const query = groupReportQuerySchema.parse(req.query);
      const from = query.from ? new Date(query.from) : undefined;
      const to = query.to ? new Date(query.to) : undefined;

      const teacherStats = await storage.getTeacherStats(req.session.userId!);
      const studentsStats = await storage.getStudentsStatsByTeacher(req.session.userId!);
      const tests = await storage.getTeacherTestsInRange(req.session.userId!, from, to);

      const doc = new PDFDocument({ margin: 40, size: "A4" });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", "attachment; filename=group_report.pdf");
      doc.pipe(res);

      doc.fontSize(18).text("Групповой аналитический отчёт", { align: "center" });
      doc.moveDown();
      doc.fontSize(10).text(`Период: ${from ? from.toLocaleDateString("ru-RU") : "всё время"} - ${to ? to.toLocaleDateString("ru-RU") : "сейчас"}`);
      doc.text(`Тестов преподавателя: ${tests.length}`);
      doc.text(`Студентов в выборке: ${teacherStats.totalStudents}`);
      doc.text(`Средний балл: ${teacherStats.averageScore.toFixed(1)}%`);
      doc.moveDown();

      doc.fontSize(14).text("Успеваемость по студентам");
      doc.moveDown(0.5);

      let y = doc.y;
      studentsStats.slice(0, 8).forEach((student, index) => {
        const barWidth = Math.max(20, Math.round(student.averageScore * 3));
        doc.fontSize(10).text(student.student.fullName, 40, y + index * 28);
        doc.rect(210, y + index * 28 + 4, barWidth, 12).fill("#2563eb");
        doc.fillColor("black").text(`${student.averageScore.toFixed(1)}%`, 520, y + index * 28);
      });

      doc.moveDown(10);
      doc.fontSize(14).text("Топ тестов по активности");
      doc.moveDown(0.5);
      tests.slice(0, 6).forEach((test) => {
        doc.fontSize(10).text(`• ${test.title} — попыток: ${test.attemptCount}, средний балл: ${test.avgScore.toFixed(1)}%`);
      });

      doc.end();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Export group report PDF error:", error);
      res.status(500).json({ message: "Ошибка экспорта PDF-отчёта" });
    }
  });

  app.get("/api/recommendations", requireAuth, async (req, res) => {
    try {
      const weakAreas = await storage.getStudentWeakAreas(req.session.userId!);
      res.json(weakAreas);
    } catch (error) {
      console.error("Get recommendations error:", error);
      res.status(500).json({ message: "Ошибка получения рекомендаций" });
    }
  });

  app.get("/api/tests/:id/leaderboard", requireAuth, async (req, res) => {
    try {
      const test = await storage.getTest(req.params.id);
      if (!test) {
        return res.status(404).json({ message: "Тест не найден" });
      }
      
      const leaderboard = await storage.getTestLeaderboard(req.params.id);
      res.json({
        testId: test.id,
        testTitle: test.title,
        isCompetitive: test.isCompetitive,
        leaderboard,
      });
    } catch (error) {
      console.error("Get leaderboard error:", error);
      res.status(500).json({ message: "Ошибка получения рейтинга" });
    }
  });

  // Все завершённые попытки текущего студента + достижения
  app.get("/api/student/results", requireAuth, async (req, res) => {
    try {
      const results = await storage.getStudentResults(req.session.userId!);

      // Вычисляю достижения
      const achievements = [];
      const avgScore = results.length > 0 ? Math.round(results.reduce((s: number, r: any) => s + r.percent, 0) / results.length) : 0;
      const perfectScores = results.filter((r: any) => r.percent === 100).length;
      const passedTests = results.filter((r: any) => r.percent >= 60).length;

      // Бейджи
      if (avgScore >= 80) achievements.push({ id: "excellent", label: "🏆 Отличник", description: "Средний балл ≥ 80%", icon: "Trophy" });
      if (avgScore >= 60 && avgScore < 80) achievements.push({ id: "good", label: "⭐ Хорошист", description: "Средний балл ≥ 60%", icon: "Star" });
      if (perfectScores >= 1) achievements.push({ id: "perfect", label: "💯 Идеально!", description: `${perfectScores} тестов с 100%`, icon: "Zap" });
      if (results.length >= 5) achievements.push({ id: "dedicated", label: "🎯 Старательный", description: "Пройдено ≥ 5 тестов", icon: "Target" });
      if (results.length >= 10) achievements.push({ id: "master", label: "🔥 Мастер", description: "Пройдено ≥ 10 тестов", icon: "Flame" });
      if (passedTests === results.length && results.length > 0) achievements.push({ id: "streak", label: "🌟 Без ошибок", description: "Все тесты сданы на ≥60%", icon: "Sparkles" });

      res.json({
        results,
        avgScore,
        totalTests: results.length,
        perfectScores,
        passedTests,
        achievements,
      });
    } catch (error) {
      console.error("Get student results error:", error);
      res.status(500).json({ message: "Ошибка получения результатов" });
    }
  });

  app.get("/api/ai/models", requireAuth, async (_req, res) => {
    try {
      const provider = /api\.groq\.com/i.test(AI_BASE_URL) ? "groq" : "openrouter";
      const providerFallbacks = provider === "groq" ? GROQ_FALLBACK_MODELS : OPENROUTER_FALLBACK_MODELS;
      const providerModels = await getProviderModels();
      const models = providerModels.length > 0
        ? uniqueNonEmptyModels([...providerModels, AI_MODEL, ...AI_MODEL_CANDIDATES, ...providerFallbacks])
        : uniqueNonEmptyModels([AI_MODEL, ...AI_MODEL_CANDIDATES, ...providerFallbacks]);

      res.json({
        provider,
        currentModel: AI_MODEL || null,
        models,
      });
    } catch (error) {
      console.error("Get AI models error:", error);
      res.status(500).json({ message: "Ошибка получения списка AI-моделей" });
    }
  });

  // AI-анализ студента: слабые места + рекомендации
  app.post("/api/student/ai-analysis", requireAuth, async (req, res) => {
    try {
      const requestData = aiAnalysisRequestSchema.safeParse(req.body || {});
      const preferredModel = requestData.success ? requestData.data.model : undefined;
      const studentId = req.session.userId!;
      const user = await storage.getUser(studentId);
      if (!user) return res.status(404).json({ message: "Пользователь не найден" });

      const results = await storage.getStudentResults(studentId);

      if (results.length === 0) {
        return res.json({
          summary: "Вы ещё не прошли ни одного теста. Пройдите хотя бы один тест, чтобы получить персональный AI-анализ.",
          strengths: [],
          weaknesses: [],
          recommendations: [],
          overallLevel: "Нет данных",
        });
      }

      const weakAreas = await storage.getStudentWeakAreas(studentId);

      const prompt = `Ты — педагогический AI-аналитик системы EduTest. Проанализируй результаты студента и дай персональную обратную связь.

Студент: ${user.fullName || user.username}
Пройдено тестов: ${results.length}

Результаты по тестам (предмет, название, процент правильных ответов, дата):
${results.map((a: any) => `- [${a.testSubject || "Без предмета"}] ${a.testTitle}: ${a.percent}% (${a.completedAt ? new Date(a.completedAt).toLocaleDateString("ru-RU") : ""})`).join("\n")}

Средний балл: ${Math.round(results.reduce((s: number, a: any) => s + a.percent, 0) / results.length)}%

Слабые темы и ошибки:
${weakAreas.weakAreas?.map((area: any) => `- ${area.subject}: ${area.errorRate.toFixed(0)}% ошибок, проблемные вопросы: ${area.problemQuestions.join("; ")}`).join("\n") || "Нет данных"}

Верни JSON строго в таком формате (без markdown):
{
  "summary": "Краткая характеристика успеваемости студента (2-3 предложения)",
  "overallLevel": "Один из уровней: Отличник / Хорошист / Требует улучшения / Начальный уровень",
  "strengths": ["сильная сторона 1", "сильная сторона 2"],
  "weaknesses": ["слабое место 1", "слабое место 2"],
  "recommendations": ["рекомендация 1", "рекомендация 2", "рекомендация 3"],
  "topicBreakdown": [{ "topic": "Тема", "risk": "Высокий", "note": "Почему эта тема важна" }],
  "revisionPlan": ["Шаг 1", "Шаг 2", "Шаг 3"]
}`;

      const groqApiKey = process.env.AI_API_KEY;
      if (!groqApiKey) return res.status(500).json({ message: "AI недоступен: не настроен API ключ" });

      try {
        const aiText = await callAIWithModel(prompt, preferredModel);
        const analysis = parseAIJson<any>(aiText);
        return res.json(analysis);
      } catch (aiError) {
        console.error("AI analysis provider fallback:", aiError);

        const average = Math.round(results.reduce((s: number, a: any) => s + a.percent, 0) / results.length);
        const overallLevel = average >= 80
          ? "Отличник"
          : average >= 60
            ? "Хорошист"
            : average >= 40
              ? "Требует улучшения"
              : "Начальный уровень";

        const sortedWeakAreas = [...(weakAreas.weakAreas || [])]
          .sort((a: any, b: any) => Number(b.errorRate || 0) - Number(a.errorRate || 0));

        const weaknesses = sortedWeakAreas.slice(0, 3).map((area: any) => `${area.subject}: ${Math.round(area.errorRate || 0)}% ошибок`);
        const strengths = results
          .filter((item: any) => item.percent >= 70)
          .slice(0, 3)
          .map((item: any) => `${item.testSubject || "Без предмета"}: ${item.percent}%`);

        const topicBreakdown = sortedWeakAreas.slice(0, 4).map((area: any) => ({
          topic: area.subject || "Тема",
          risk: Number(area.errorRate || 0) >= 70 ? "Высокий" : Number(area.errorRate || 0) >= 40 ? "Средний" : "Низкий",
          note: `Проблемные вопросы: ${(area.problemQuestions || []).slice(0, 2).join("; ") || "н/д"}`,
        }));

        const revisionPlan = sortedWeakAreas.slice(0, 3).map((area: any, index: number) => `${index + 1}. Повторить тему «${area.subject}» и прорешать 5-10 вопросов.`);

        return res.json({
          summary: `AI-провайдер временно недоступен, поэтому показан резервный анализ по ${results.length} попыткам. Средний результат: ${average}%.`,
          overallLevel,
          strengths: strengths.length > 0 ? strengths : ["Есть завершённые попытки, продолжайте закреплять материал."],
          weaknesses: weaknesses.length > 0 ? weaknesses : ["Явные слабые зоны не обнаружены по текущим данным."],
          recommendations: [
            "Фокусируйтесь на темах с наибольшим процентом ошибок.",
            "После повторения тем пройдите 1-2 тренировочных теста.",
            "Сравните новые результаты с предыдущими и закрепите прогресс.",
          ],
          topicBreakdown,
          revisionPlan: revisionPlan.length > 0 ? revisionPlan : ["Повторить ключевые темы последнего теста и пройти новый тест."],
        });
      }
    } catch (error) {
      console.error("AI analysis error:", error);
      res.status(500).json({ message: "Ошибка AI-анализа" });
    }
  });

  // Загрузка документа и извлечение текста
  app.get("/api/materials", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user) {
        return res.status(404).json({ message: "Пользователь не найден" });
      }
      const materials = await storage.getLearningMaterials(req.session.userId!, user.role);
      res.json(materials);
    } catch (error) {
      console.error("Get materials error:", error);
      res.status(500).json({ message: "Ошибка получения методических материалов" });
    }
  });

  app.get("/api/materials/:id/file", requireAuth, async (req, res) => {
    try {
      const material = await storage.getLearningMaterial(req.params.id);
      if (!material || !material.filePath || !fs.existsSync(material.filePath)) {
        return res.status(404).json({ message: "Файл не найден" });
      }
      res.download(material.filePath, material.fileName);
    } catch (error) {
      console.error("Download material error:", error);
      res.status(500).json({ message: "Ошибка скачивания материала" });
    }
  });

  app.post("/api/materials/upload", requireTeacher, upload.single("file"), async (req, res) => {
    try {
      const meta = materialMetaSchema.parse(req.body);
      if (!req.file) {
        return res.status(400).json({ message: "Файл не загружен" });
      }

      const extractedContent = req.file.mimetype === "application/json"
        ? fs.readFileSync(req.file.path, "utf-8")
        : cleanText(await extractTextFromFile(req.file.path, req.file.mimetype));

      const analysis = await analyzeMaterialContent(meta.title, extractedContent, meta.materialType);
      const material = await storage.createLearningMaterial({
        teacherId: req.session.userId!,
        title: meta.title,
        description: meta.description || analysis.summary,
        materialType: meta.materialType,
        fileName: req.file.originalname,
        filePath: req.file.path,
        mimeType: req.file.mimetype,
        extractedContent,
        aiSummary: analysis.summary,
        aiKeywords: analysis.keywords || [],
        aiDifficulty: analysis.difficulty || null,
        linkedTestId: null,
      });

      res.json({ material, analysis });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Upload material error:", error);
      res.status(500).json({ message: "Ошибка загрузки методического материала" });
    }
  });

  app.post("/api/materials/:id/analyze", requireAuth, async (req, res) => {
    try {
      const material = await storage.getLearningMaterial(req.params.id);
      if (!material || !material.extractedContent) {
        return res.status(404).json({ message: "Материал не найден" });
      }
      const analysis = await analyzeMaterialContent(material.title, material.extractedContent, material.materialType);
      const updated = await storage.updateLearningMaterial(material.id, {
        aiSummary: analysis.summary,
        aiKeywords: analysis.keywords || [],
        aiDifficulty: analysis.difficulty || null,
      });
      res.json({ material: updated, analysis });
    } catch (error) {
      console.error("Analyze material error:", error);
      res.status(500).json({ message: "Ошибка анализа материала" });
    }
  });

  app.post("/api/materials/:id/create-trainer", requireTeacher, async (req, res) => {
    try {
      const material = await storage.getLearningMaterial(req.params.id);
      if (!material || !material.extractedContent) {
        return res.status(404).json({ message: "Материал не найден" });
      }

      const generated = await parseReadyTestContent(material.extractedContent, `${material.title}.txt`);
      const test = await storage.createTest({
        title: `${material.title} — тренажёр`,
        description: material.aiSummary || material.description || "Тренажёр по методическому материалу",
        subject: generated.subject,
        teacherId: req.session.userId!,
        timeLimitMinutes: Math.max(15, generated.questions.length * 2),
        isPublished: false,
        isCompetitive: false,
        isAdaptive: true,
        isTemplate: false,
        templateCategory: null,
        scheduledAt: null,
      });

      for (let questionIndex = 0; questionIndex < generated.questions.length; questionIndex++) {
        const { options, ...question } = generated.questions[questionIndex];
        const createdQuestion = await storage.createQuestion({
          ...question,
          testId: test.id,
          orderIndex: questionIndex,
        });

        for (let optionIndex = 0; optionIndex < options.length; optionIndex++) {
          await storage.createQuestionOption({
            ...options[optionIndex],
            questionId: createdQuestion.id,
            orderIndex: optionIndex,
          });
        }
      }

      await storage.updateLearningMaterial(material.id, { linkedTestId: test.id, materialType: "trainer_test" });
      res.json({ testId: test.id });
    } catch (error) {
      console.error("Create trainer from material error:", error);
      res.status(500).json({ message: "Ошибка создания тренажёра" });
    }
  });

  app.post("/api/documents/upload", requireTeacher, upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "Файл не загружен" });
      }

      const filePath = req.file.path;
      const mimeType = req.file.mimetype;

      try {
        let content = await extractTextFromFile(filePath, mimeType);
        content = cleanText(content);

        // Удалить файл после обработки
        fs.unlinkSync(filePath);

        res.json({ content });
      } catch (parseError) {
        fs.unlinkSync(filePath);
        throw parseError;
      }
    } catch (error) {
      if (req.file) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (e) {
          // ignore
        }
      }
      console.error("Document upload error:", error);
      res.status(500).json({ message: "Ошибка обработки документа" });
    }
  });

  // Генерация теста из текста с помощью ИИ
  app.post("/api/documents/generate-test", requireTeacher, async (req, res) => {
    try {
      const { content, title, subject, difficulty, questionCount } = req.body;

      if (!content || !title || !subject) {
        return res.status(400).json({ message: "Отсутствуют обязательные параметры" });
      }

      const prompt = `Ты - эксперт по созданию учебных тестов. На основе приведённого текста создай ${questionCount} учебных вопросов.

ТЕКСТ МАТЕРИАЛА:
${content.substring(0, 5000)}

ТРЕБОВАНИЯ:
- Сложность: ${difficulty === "easy" ? "Лёгкие вопросы для начинающих" : difficulty === "medium" ? "Вопросы среднего уровня" : "Сложные вопросы для продвинутых"}
- Типы вопросов: смешивать одиночный выбор, множественный выбор и открытые ответы
- Каждый вопрос должен быть понятным и иметь чёткий ответ
- Для открытых вопросов указать эталонный ответ
- Каждый вопрос стоит ${Math.floor(100 / questionCount)} баллов

Верни ТОЛЬКО валидный JSON в строго таком формате:
{
  "title": "Название теста",
  "description": "Краткое описание темы теста (2-3 предложения)",
  "questions": [
    {
      "type": "single_choice",
      "text": "Вопрос с одним ответом?",
      "points": ${Math.floor(100 / questionCount)},
      "options": [
        { "text": "Неверный ответ 1", "isCorrect": false },
        { "text": "Верный ответ", "isCorrect": true },
        { "text": "Неверный ответ 2", "isCorrect": false }
      ]
    },
    {
      "type": "open_answer",
      "text": "Открытый вопрос?",
      "points": ${Math.floor(100 / questionCount)},
      "correctAnswer": "Правильный ответ на открытый вопрос"
    }
  ]
}`;

      const aiResponse = await callAI(prompt);
      const testData = parseAIJson<any>(aiResponse);

      res.json(testData);
    } catch (error) {
      console.error("Test generation error:", error);
      res.status(500).json({ message: "Ошибка генерации теста" });
    }
  });

  app.post("/api/documents/generate-test-from-url", requireTeacher, async (req, res) => {
    try {
      const payload = generateFromUrlSchema.parse(req.body);
      const parsedUrl = new URL(payload.url);
      if (!["http:", "https:"].includes(parsedUrl.protocol) || isDisallowedHost(parsedUrl.hostname)) {
        return res.status(400).json({ message: "Разрешены только публичные http/https ссылки" });
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      const response = await fetch(payload.url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "EduTestBot/1.0",
          "Accept": "text/html,application/xhtml+xml,application/xml",
        },
      });
      clearTimeout(timeout);

      if (!response.ok) {
        return res.status(400).json({ message: `Не удалось загрузить страницу: ${response.status}` });
      }

      const html = await response.text();
      const content = htmlToText(html).slice(0, 12000);
      if (!content || content.length < 200) {
        return res.status(400).json({ message: "На странице недостаточно учебного текста для генерации теста" });
      }

      const prompt = `Ты - эксперт по созданию учебных тестов. На основе текста веб-страницы создай ${payload.questionCount} учебных вопросов.

ТЕКСТ СТРАНИЦЫ:
${content}

ТРЕБОВАНИЯ:
- Сложность: ${payload.difficulty === "easy" ? "Лёгкие вопросы для начинающих" : payload.difficulty === "medium" ? "Вопросы среднего уровня" : "Сложные вопросы для продвинутых"}
- Типы вопросов: смешивать одиночный выбор, множественный выбор и открытые ответы
- Каждый вопрос должен быть по фактам из текста страницы
- Для открытых вопросов указать эталонный ответ
- Каждый вопрос стоит ${Math.floor(100 / payload.questionCount)} баллов

Верни ТОЛЬКО валидный JSON в формате:
{
  "title": "${payload.title}",
  "description": "Краткое описание темы теста (2-3 предложения)",
  "questions": [
    {
      "type": "single_choice",
      "text": "Вопрос?",
      "topic": "Тема",
      "difficulty": "${payload.difficulty}",
      "points": ${Math.floor(100 / payload.questionCount)},
      "options": [
        { "text": "Вариант", "isCorrect": true }
      ]
    }
  ]
}`;

      const aiResponse = await callAI(prompt);
      const testData = parseAIJson<any>(aiResponse);
      res.json(testData);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Generate test from URL error:", error);
      res.status(500).json({ message: "Ошибка генерации теста по ссылке" });
    }
  });

  app.post("/api/teacher/analytics/seed-demo", requireTeacher, async (req, res) => {
    try {
      const teacherId = req.session.userId!;
      const payload = seedDemoAttemptsSchema.parse(req.body || {});
      const teacherTests = await storage.getTestsByTeacher(teacherId);
      const candidateTests = payload.testId
        ? teacherTests.filter((test) => test.id === payload.testId)
        : teacherTests.slice(0, 3);

      if (candidateTests.length === 0) {
        return res.status(400).json({ message: "Нет тестов для генерации демо-попыток" });
      }

      const students = await storage.getTeacherStudents(teacherId);
      if (students.length === 0) {
        return res.status(400).json({ message: "Нет студентов в списке преподавателя" });
      }

      const demoStudents = students.slice(0, payload.studentsPerTest);
      let createdAttempts = 0;

      for (const test of candidateTests) {
        const testWithQuestions = await storage.getTestWithQuestions(test.id);
        if (!testWithQuestions || !testWithQuestions.questions || testWithQuestions.questions.length === 0) {
          continue;
        }

        const existingAttempts = await storage.getAttemptsByTest(test.id);
        const completedStudents = new Set(
          existingAttempts
            .filter((attempt) => attempt.status === "completed")
            .map((attempt) => attempt.studentId)
        );

        for (const student of demoStudents) {
          if (completedStudents.has(student.id)) {
            continue;
          }

          const attempt = await storage.createTestAttempt({
            testId: test.id,
            studentId: student.id,
            status: "in_progress",
            savedAnswers: null,
          });

          let totalScore = 0;
          let maxScore = 0;

          for (const question of testWithQuestions.questions) {
            const difficultyWeight = question.difficulty === "hard" ? 0.55 : question.difficulty === "medium" ? 0.68 : 0.82;
            const isCorrect = Math.random() < difficultyWeight;
            const points = Number(question.points || 1);
            maxScore += points;
            const pointsAwarded = isCorrect ? points : 0;
            totalScore += pointsAwarded;

            if (question.type === "open_answer") {
              await storage.createAnswer({
                attemptId: attempt.id,
                questionId: question.id,
                answerText: isCorrect
                  ? (question.correctAnswer || "Корректный развернутый ответ по теме")
                  : "Неполный ответ, требуется доработка",
                selectedOptionIds: null,
                isCorrect,
                pointsAwarded,
                aiFeedback: isCorrect ? "Демо: ответ близок к эталону" : "Демо: ответ частично раскрывает тему",
              });
              continue;
            }

            const correctOptions = question.options.filter((option: any) => option.isCorrect);
            const wrongOptions = question.options.filter((option: any) => !option.isCorrect);
            let selectedOptionIds: string[] = [];

            if (isCorrect) {
              selectedOptionIds = correctOptions.map((option: any) => option.id);
            } else if (wrongOptions.length > 0) {
              selectedOptionIds = [wrongOptions[Math.floor(Math.random() * wrongOptions.length)].id];
            } else {
              selectedOptionIds = question.options.slice(0, 1).map((option: any) => option.id);
            }

            await storage.createAnswer({
              attemptId: attempt.id,
              questionId: question.id,
              answerText: null,
              selectedOptionIds,
              isCorrect,
              pointsAwarded,
              aiFeedback: null,
            });
          }

          await storage.updateTestAttempt(attempt.id, {
            status: "completed",
            completedAt: new Date(),
            score: totalScore,
            maxScore,
            proctorScore: 88 + Math.floor(Math.random() * 12),
            suspiciousEventsCount: Math.floor(Math.random() * 2),
            proctorSummary: "Демо-прохождение для витрины аналитики",
          });

          createdAttempts++;
        }
      }

      res.json({ message: "Демо-данные созданы", createdAttempts });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Seed demo analytics error:", error);
      res.status(500).json({ message: "Ошибка генерации демо-данных" });
    }
  });

  // Аналитика преподавателя
  app.get("/api/teacher/analytics", requireTeacher, async (req, res) => {
    try {
      const teacherId = req.session.userId;
      if (!teacherId) {
        return res.status(401).json({ message: "Не авторизован" });
      }

      const teacherTests = await storage.getTestsByTeacher(teacherId);
      if (teacherTests.length === 0) {
        return res.json({
          totalTests: 0,
          totalAttempts: 0,
          totalStudents: 0,
          averageScore: 0,
          testStats: [],
          studentStats: [],
          chartData: [],
          difficultyStats: [],
        });
      }

      let totalAttempts = 0;
      const totalStudents = new Set<string>();
      const testStats: any[] = [];
      const studentStats = new Map<string, any>();
      const difficultyMap: Map<string, { correct: number; total: number }> = new Map();

      for (const test of teacherTests) {
        const attempts = (await storage.getAttemptsByTest(test.id)).filter((attempt: any) => attempt.status === "completed");

        totalAttempts += attempts.length;
        attempts.forEach((attempt: any) => totalStudents.add(attempt.studentId));

        const scores = attempts.map((a: any) => a.maxScore ? (Number(a.score) / a.maxScore) * 100 : 0);
        const avgScore = scores.length > 0 ? scores.reduce((s: number, sc: number) => s + sc, 0) / scores.length : 0;
        const maxScore = scores.length > 0 ? Math.max(...scores) : 0;
        const minScore = scores.length > 0 ? Math.min(...scores) : 0;

        const testQuestions = await storage.getQuestionsByTest(test.id);

        testStats.push({
          testId: test.id,
          testTitle: test.title,
          subject: test.subject,
          attempts: attempts.length,
          avgScore: Math.round(avgScore),
          maxScore: Math.round(maxScore),
          minScore: Math.round(minScore),
          questionCount: testQuestions.length,
        });

        for (const attempt of attempts) {
          const answers = await storage.getAnswersByAttempt(attempt.id);
          for (const answer of answers) {
            const key = `${test.id}-${answer.questionId}`;
            if (!difficultyMap.has(key)) {
              difficultyMap.set(key, { correct: 0, total: 0 });
            }
            const stat = difficultyMap.get(key)!;
            stat.total++;
            if (answer.isCorrect) {
              stat.correct++;
            }
          }
        }

        for (const attempt of attempts) {
          const student = await storage.getUser(attempt.studentId);
          if (!student) continue;

          if (!studentStats.has(student.id)) {
            studentStats.set(student.id, {
              studentId: student.id,
              studentName: student.fullName || student.username,
              testsTaken: 0,
              totalScore: 0,
              averageScore: 0,
            });
          }
          const stat = studentStats.get(student.id)!;
          const score = attempt.maxScore ? (Number(attempt.score) / attempt.maxScore) * 100 : 0;
          stat.testsTaken++;
          stat.totalScore += score;
          stat.averageScore = Math.round(stat.totalScore / stat.testsTaken);
        }
      }

      // Топ сложные вопросы
      const difficultyStats = Array.from(difficultyMap.entries())
        .map(([key, stat]) => ({
          questionKey: key,
          correctRate: Math.round((stat.correct / stat.total) * 100),
          attempts: stat.total,
        }))
        .sort((a, b) => a.correctRate - b.correctRate)
        .slice(0, 5);

      const chartData = testStats.map((ts: any) => ({
        name: ts.testTitle.substring(0, 20),
        avgScore: ts.avgScore,
        attempts: ts.attempts,
      }));

      const allScores = testStats.map((ts: any) => ts.avgScore);
      const overallAverage = allScores.length > 0 ? Math.round(allScores.reduce((s: number, sc: number) => s + sc, 0) / allScores.length) : 0;

      res.json({
        totalTests: teacherTests.length,
        totalAttempts,
        totalStudents: totalStudents.size,
        averageScore: overallAverage,
        testStats: testStats.sort((a, b) => b.attempts - a.attempts),
        studentStats: Array.from(studentStats.values()).sort((a, b) => b.averageScore - a.averageScore),
        chartData,
        difficultyStats,
      });
    } catch (error) {
      console.error("Analytics error:", error);
      res.status(500).json({ message: "Ошибка получения аналитики", error: String(error) });
    }
  });

  return httpServer;
}
