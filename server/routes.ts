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

declare module "express-session" {
  interface SessionData {
    userId: string;
  }
}

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

async function callGemini(prompt: string): Promise<string> {
  const response = await fetch(GEMINI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3, responseMimeType: "application/json" },
    }),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${err.slice(0, 200)}`);
  }
  const data = await response.json() as any;
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

async function evaluateWithAI(studentAnswer: string, correctAnswer: string, questionText: string): Promise<{ score: number; feedback: string }> {
  if (!GEMINI_API_KEY) {
    return { score: 50, feedback: "AI-оценка недоступна: не задан GEMINI_API_KEY." };
  }
  try {
    const prompt = `Ты - эксперт по оценке знаний студентов. Оцени ответ студента на вопрос.

Вопрос: ${questionText}

Эталонный ответ: ${correctAnswer}

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

    const text = await callGemini(prompt);
    const result = JSON.parse(text);
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
      const tests = await storage.getPublishedTests();
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
      
      const test = await storage.createTest({
        ...testData,
        teacherId: req.session.userId!,
      });

      for (let i = 0; i < questionsData.length; i++) {
        const { options, ...questionData } = questionsData[i];
        
        const question = await storage.createQuestion({
          ...questionData,
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
      res.status(500).json({ message: "Ошибка создания теста" });
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
      
      await storage.updateTest(req.params.id, testData);
      
      await storage.deleteQuestionsByTest(req.params.id);

      for (let i = 0; i < questionsData.length; i++) {
        const { options, id: questionId, ...questionData } = questionsData[i];
        
        const question = await storage.createQuestion({
          ...questionData,
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
      res.status(500).json({ message: "Ошибка обновления теста" });
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

  app.post("/api/tests/:id/start", requireAuth, async (req, res) => {
    try {
      const test = await storage.getTest(req.params.id);
      if (!test) {
        return res.status(404).json({ message: "Тест не найден" });
      }
      
      if (!test.isPublished) {
        return res.status(400).json({ message: "Тест не опубликован" });
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
              question.text
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
          pointsAwarded: pointsAwarded.toString(),
          aiFeedback,
        });
      }

      await storage.updateTestAttempt(req.params.id, {
        status: "completed",
        completedAt: new Date(),
        score: totalScore.toString(),
        maxScore,
      });

      res.json({ 
        message: "Тест завершен",
        score: totalScore,
        maxScore,
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
          "Студент": student?.lastName && student?.firstName 
            ? `${student.lastName} ${student.firstName}` 
            : student?.username || "Неизвестен",
          "Дата начала": new Date(attempt.startedAt).toLocaleString("ru-RU"),
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
        const studentName = student?.lastName && student?.firstName 
          ? `${student.lastName} ${student.firstName}` 
          : student?.username || "Неизвестен";
        
        doc.fontSize(12).text(`Студент: ${studentName}`);
        doc.text(`Дата: ${new Date(attempt.startedAt).toLocaleString("ru-RU")}`);
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

  // Все завершённые попытки текущего студента
  app.get("/api/student/results", requireAuth, async (req, res) => {
    try {
      const results = await storage.getStudentResults(req.session.userId!);
      res.json(results);
    } catch (error) {
      console.error("Get student results error:", error);
      res.status(500).json({ message: "Ошибка получения результатов" });
    }
  });

  // AI-анализ студента: слабые места + рекомендации
  app.post("/api/student/ai-analysis", requireAuth, async (req, res) => {
    try {
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

      const prompt = `Ты — педагогический AI-аналитик системы EduTest. Проанализируй результаты студента и дай персональную обратную связь.

Студент: ${user.fullName || user.username}
Пройдено тестов: ${results.length}

Результаты по тестам (предмет, название, процент правильных ответов, дата):
${results.map((a: any) => `- [${a.testSubject || "Без предмета"}] ${a.testTitle}: ${a.percent}% (${a.completedAt ? new Date(a.completedAt).toLocaleDateString("ru-RU") : ""})`).join("\n")}

Средний балл: ${Math.round(results.reduce((s: number, a: any) => s + a.percent, 0) / results.length)}%

Верни JSON строго в таком формате (без markdown):
{
  "summary": "Краткая характеристика успеваемости студента (2-3 предложения)",
  "overallLevel": "Один из уровней: Отличник / Хорошист / Требует улучшения / Начальный уровень",
  "strengths": ["сильная сторона 1", "сильная сторона 2"],
  "weaknesses": ["слабое место 1", "слабое место 2"],
  "recommendations": ["рекомендация 1", "рекомендация 2", "рекомендация 3"]
}`;

      const groqApiKey = process.env.GEMINI_API_KEY;
      if (!groqApiKey) return res.status(500).json({ message: "AI недоступен: не настроен API ключ" });

      const aiText = await callGemini(prompt);
      const analysis = JSON.parse(aiText);
      res.json(analysis);
    } catch (error) {
      console.error("AI analysis error:", error);
      res.status(500).json({ message: "Ошибка AI-анализа" });
    }
  });

  return httpServer;
}
