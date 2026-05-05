import { 
  users, 
  tests, 
  questions, 
  questionOptions, 
  testAttempts, 
  answers,
  teacherStudents,
  type User, 
  type InsertUser,
  type Test,
  type InsertTest,
  type Question,
  type InsertQuestion,
  type QuestionOption,
  type InsertQuestionOption,
  type TestAttempt,
  type InsertTestAttempt,
  type Answer,
  type InsertAnswer,
  type TeacherStudent,
  type InsertTeacherStudent,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sql, inArray } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  createTest(test: InsertTest): Promise<Test>;
  getTest(id: string): Promise<Test | undefined>;
  getTestWithQuestions(id: string): Promise<any>;
  getTestsByTeacher(teacherId: string): Promise<any[]>;
  getPublishedTests(): Promise<any[]>;
  updateTest(id: string, data: Partial<InsertTest>): Promise<Test>;
  deleteTest(id: string): Promise<void>;

  createQuestion(question: InsertQuestion): Promise<Question>;
  getQuestionsByTest(testId: string): Promise<Question[]>;
  updateQuestion(id: string, data: Partial<InsertQuestion>): Promise<Question>;
  deleteQuestion(id: string): Promise<void>;
  deleteQuestionsByTest(testId: string): Promise<void>;

  createQuestionOption(option: InsertQuestionOption): Promise<QuestionOption>;
  getOptionsByQuestion(questionId: string): Promise<QuestionOption[]>;
  deleteOptionsByQuestion(questionId: string): Promise<void>;

  createTestAttempt(attempt: InsertTestAttempt): Promise<TestAttempt>;
  getTestAttempt(id: string): Promise<TestAttempt | undefined>;
  getTestAttemptWithDetails(id: string): Promise<any>;
  getAttemptsByStudent(studentId: string): Promise<any[]>;
  getAttemptsByTest(testId: string): Promise<any[]>;
  updateTestAttempt(id: string, data: Partial<TestAttempt>): Promise<TestAttempt>;

  createAnswer(answer: InsertAnswer): Promise<Answer>;
  getAnswersByAttempt(attemptId: string): Promise<Answer[]>;
  updateAnswer(id: string, data: Partial<Answer>): Promise<Answer>;

  getStudentStats(studentId: string): Promise<any>;
  getTeacherStats(teacherId: string): Promise<any>;
  getStudentsStatsByTeacher(teacherId: string): Promise<any[]>;
  getStudentWeakAreas(studentId: string): Promise<any>;
  getTestAttempts(testId: string): Promise<TestAttempt[]>;
  getTestLeaderboard(testId: string): Promise<any[]>;

  // Teacher-Student management
  addStudentToTeacher(teacherId: string, studentId: string): Promise<TeacherStudent>;
  removeStudentFromTeacher(teacherId: string, studentId: string): Promise<void>;
  getTeacherStudents(teacherId: string): Promise<User[]>;
  getAllStudents(): Promise<User[]>;
  isStudentOfTeacher(teacherId: string, studentId: string): Promise<boolean>;
  
  // Profile
  updateProfile(userId: string, data: { fullName?: string; photoUrl?: string | null; hobbies?: string | null; wishes?: string | null }): Promise<User>;

  // Student results for personal pages
  getStudentResults(studentId: string): Promise<any[]>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async createTest(test: InsertTest): Promise<Test> {
    const [newTest] = await db.insert(tests).values(test).returning();
    return newTest;
  }

  async getTest(id: string): Promise<Test | undefined> {
    const [test] = await db.select().from(tests).where(eq(tests.id, id));
    return test || undefined;
  }

  async getTestWithQuestions(id: string): Promise<any> {
    const [test] = await db.select().from(tests).where(eq(tests.id, id));
    if (!test) return undefined;

    const questionsData = await db.select()
      .from(questions)
      .where(eq(questions.testId, id))
      .orderBy(questions.orderIndex);

    const questionsWithOptions = await Promise.all(
      questionsData.map(async (q) => {
        const options = await db.select()
          .from(questionOptions)
          .where(eq(questionOptions.questionId, q.id))
          .orderBy(questionOptions.orderIndex);
        return { ...q, options };
      })
    );

    const [teacher] = await db.select().from(users).where(eq(users.id, test.teacherId));

    return {
      ...test,
      questions: questionsWithOptions,
      teacher: teacher ? { id: teacher.id, fullName: teacher.fullName, username: teacher.username } : undefined,
    };
  }

  async getTestsByTeacher(teacherId: string): Promise<any[]> {
    const teacherTests = await db.select()
      .from(tests)
      .where(eq(tests.teacherId, teacherId))
      .orderBy(desc(tests.createdAt));

    return Promise.all(teacherTests.map(async (test) => {
      const questionsData = await db.select().from(questions).where(eq(questions.testId, test.id));
      const attemptsData = await db.select().from(testAttempts)
        .where(and(eq(testAttempts.testId, test.id), eq(testAttempts.status, "completed")));
      
      const avgScore = attemptsData.length > 0
        ? attemptsData.reduce((acc, a) => acc + (a.maxScore ? (Number(a.score) / a.maxScore) * 100 : 0), 0) / attemptsData.length
        : 0;

      return {
        ...test,
        questionCount: questionsData.length,
        attemptCount: attemptsData.length,
        avgScore,
      };
    }));
  }

  async getPublishedTests(): Promise<any[]> {
    const publishedTests = await db.select()
      .from(tests)
      .where(eq(tests.isPublished, true))
      .orderBy(desc(tests.createdAt));

    return Promise.all(publishedTests.map(async (test) => {
      const questionsData = await db.select().from(questions).where(eq(questions.testId, test.id));
      return {
        ...test,
        questionCount: questionsData.length,
      };
    }));
  }

  async updateTest(id: string, data: Partial<InsertTest>): Promise<Test> {
    const [updated] = await db.update(tests)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(tests.id, id))
      .returning();
    return updated;
  }

  async deleteTest(id: string): Promise<void> {
    await db.delete(tests).where(eq(tests.id, id));
  }

  async createQuestion(question: InsertQuestion): Promise<Question> {
    const [newQuestion] = await db.insert(questions).values(question).returning();
    return newQuestion;
  }

  async getQuestionsByTest(testId: string): Promise<Question[]> {
    return db.select()
      .from(questions)
      .where(eq(questions.testId, testId))
      .orderBy(questions.orderIndex);
  }

  async updateQuestion(id: string, data: Partial<InsertQuestion>): Promise<Question> {
    const [updated] = await db.update(questions)
      .set(data)
      .where(eq(questions.id, id))
      .returning();
    return updated;
  }

  async deleteQuestion(id: string): Promise<void> {
    await db.delete(questions).where(eq(questions.id, id));
  }

  async deleteQuestionsByTest(testId: string): Promise<void> {
    await db.delete(questions).where(eq(questions.testId, testId));
  }

  async createQuestionOption(option: InsertQuestionOption): Promise<QuestionOption> {
    const [newOption] = await db.insert(questionOptions).values(option).returning();
    return newOption;
  }

  async getOptionsByQuestion(questionId: string): Promise<QuestionOption[]> {
    return db.select()
      .from(questionOptions)
      .where(eq(questionOptions.questionId, questionId))
      .orderBy(questionOptions.orderIndex);
  }

  async deleteOptionsByQuestion(questionId: string): Promise<void> {
    await db.delete(questionOptions).where(eq(questionOptions.questionId, questionId));
  }

  async createTestAttempt(attempt: InsertTestAttempt): Promise<TestAttempt> {
    const [newAttempt] = await db.insert(testAttempts).values(attempt).returning();
    return newAttempt;
  }

  async getTestAttempt(id: string): Promise<TestAttempt | undefined> {
    const [attempt] = await db.select().from(testAttempts).where(eq(testAttempts.id, id));
    return attempt || undefined;
  }

  async getTestAttemptWithDetails(id: string): Promise<any> {
    const [attempt] = await db.select().from(testAttempts).where(eq(testAttempts.id, id));
    if (!attempt) return undefined;

    const [test] = await db.select().from(tests).where(eq(tests.id, attempt.testId));
    const answersData = await db.select().from(answers).where(eq(answers.attemptId, id));

    const answersWithQuestions = await Promise.all(
      answersData.map(async (answer) => {
        const [question] = await db.select().from(questions).where(eq(questions.id, answer.questionId));
        const options = await db.select().from(questionOptions).where(eq(questionOptions.questionId, question.id));
        return {
          ...answer,
          question: { ...question, options },
        };
      })
    );

    return {
      ...attempt,
      test,
      answers: answersWithQuestions,
    };
  }

  async getAttemptsByStudent(studentId: string): Promise<any[]> {
    const attemptsList = await db.select()
      .from(testAttempts)
      .where(eq(testAttempts.studentId, studentId))
      .orderBy(desc(testAttempts.startedAt));

    return Promise.all(attemptsList.map(async (attempt) => {
      const [test] = await db.select().from(tests).where(eq(tests.id, attempt.testId));
      return { ...attempt, test };
    }));
  }

  async getAttemptsByTest(testId: string): Promise<any[]> {
    const attemptsList = await db.select()
      .from(testAttempts)
      .where(eq(testAttempts.testId, testId))
      .orderBy(desc(testAttempts.startedAt));

    return Promise.all(attemptsList.map(async (attempt) => {
      const [student] = await db.select().from(users).where(eq(users.id, attempt.studentId));
      return { ...attempt, student };
    }));
  }

  async updateTestAttempt(id: string, data: Partial<TestAttempt>): Promise<TestAttempt> {
    const [updated] = await db.update(testAttempts)
      .set(data)
      .where(eq(testAttempts.id, id))
      .returning();
    return updated;
  }

  async createAnswer(answer: InsertAnswer): Promise<Answer> {
    const [newAnswer] = await db.insert(answers).values(answer).returning();
    return newAnswer;
  }

  async getAnswersByAttempt(attemptId: string): Promise<Answer[]> {
    return db.select().from(answers).where(eq(answers.attemptId, attemptId));
  }

  async updateAnswer(id: string, data: Partial<Answer>): Promise<Answer> {
    const [updated] = await db.update(answers)
      .set(data)
      .where(eq(answers.id, id))
      .returning();
    return updated;
  }

  async getStudentStats(studentId: string): Promise<any> {
    const completedAttempts = await db.select()
      .from(testAttempts)
      .where(and(
        eq(testAttempts.studentId, studentId),
        eq(testAttempts.status, "completed")
      ))
      .orderBy(desc(testAttempts.completedAt));

    const totalTests = completedAttempts.length;
    const averageScore = totalTests > 0
      ? completedAttempts.reduce((acc, a) => acc + (a.maxScore ? (Number(a.score) / a.maxScore) * 100 : 0), 0) / totalTests
      : 0;

    const progressData = completedAttempts.slice(0, 10).reverse().map((attempt) => ({
      date: attempt.completedAt ? new Date(attempt.completedAt).toLocaleDateString("ru-RU") : "",
      score: attempt.maxScore ? (Number(attempt.score) / attempt.maxScore) * 100 : 0,
    }));

    return {
      totalTests,
      completedTests: totalTests,
      averageScore,
      progressData,
    };
  }

  async getTeacherStats(teacherId: string): Promise<any> {
    const teacherTests = await db.select().from(tests).where(eq(tests.teacherId, teacherId));
    const testIds = teacherTests.map((t) => t.id);
    
    // Get teacher's students count
    const myStudents = await this.getTeacherStudents(teacherId);
    const myStudentIds = myStudents.map((s) => s.id);

    if (testIds.length === 0) {
      return {
        totalTests: 0,
        totalStudents: myStudents.length,
        totalAttempts: 0,
        averageScore: 0,
        testScores: [],
        questionTypeDistribution: [],
        progressOverTime: [],
        subjectDistribution: [],
        difficultyAnalysis: [],
      };
    }

    // Show all attempts on teacher's tests (not filtered by my students)
    const allAttempts = await db.select()
      .from(testAttempts)
      .where(inArray(testAttempts.testId, testIds));

    const completedAttempts = allAttempts.filter((a) => a.status === "completed");

    const averageScore = completedAttempts.length > 0
      ? completedAttempts.reduce((acc, a) => acc + (a.maxScore ? (Number(a.score) / a.maxScore) * 100 : 0), 0) / completedAttempts.length
      : 0;

    const testScores = await Promise.all(teacherTests.slice(0, 5).map(async (test) => {
      const attempts = completedAttempts.filter((a) => a.testId === test.id);
      const avgScore = attempts.length > 0
        ? attempts.reduce((acc, a) => acc + (a.maxScore ? (Number(a.score) / a.maxScore) * 100 : 0), 0) / attempts.length
        : 0;
      return { name: test.title.slice(0, 20), score: avgScore };
    }));

    const allQuestions = await db.select().from(questions).where(inArray(questions.testId, testIds));
    const questionTypeDistribution = [
      { type: "Один ответ", count: allQuestions.filter((q) => q.type === "single_choice").length },
      { type: "Множественный", count: allQuestions.filter((q) => q.type === "multiple_choice").length },
      { type: "Открытый", count: allQuestions.filter((q) => q.type === "open_answer").length },
    ].filter((d) => d.count > 0);

    // Progress over time (last 7 days)
    const now = new Date();
    const progressOverTime: { date: string; attempts: number; avgScore: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const dayAttempts = completedAttempts.filter((a) => {
        if (!a.completedAt) return false;
        const attemptDate = new Date(a.completedAt).toISOString().split('T')[0];
        return attemptDate === dateStr;
      });
      
      const dayAvgScore = dayAttempts.length > 0
        ? dayAttempts.reduce((acc, a) => acc + (a.maxScore ? (Number(a.score) / a.maxScore) * 100 : 0), 0) / dayAttempts.length
        : 0;
      
      progressOverTime.push({
        date: date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }),
        attempts: dayAttempts.length,
        avgScore: Math.round(dayAvgScore),
      });
    }

    // Subject distribution
    const subjectMap = new Map<string, number>();
    teacherTests.forEach((t) => {
      subjectMap.set(t.subject, (subjectMap.get(t.subject) || 0) + 1);
    });
    const subjectDistribution = Array.from(subjectMap.entries()).map(([subject, count]) => ({
      subject,
      count,
    }));

    // Difficulty analysis based on score distribution
    const difficultyAnalysis = teacherTests.slice(0, 8).map((test) => {
      const attempts = completedAttempts.filter((a) => a.testId === test.id);
      const scores = attempts.map((a) => a.maxScore ? (Number(a.score) / a.maxScore) * 100 : 0);
      const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
      const passRate = scores.length > 0 ? (scores.filter((s) => s >= 60).length / scores.length) * 100 : 0;
      
      return {
        name: test.title.slice(0, 15),
        avgScore: Math.round(avgScore),
        passRate: Math.round(passRate),
        attempts: attempts.length,
      };
    });

    return {
      totalTests: teacherTests.length,
      totalStudents: myStudents.length,
      totalAttempts: completedAttempts.length,
      averageScore,
      testScores,
      questionTypeDistribution,
      progressOverTime,
      subjectDistribution,
      difficultyAnalysis,
    };
  }

  async getStudentsStatsByTeacher(teacherId: string): Promise<any[]> {
    // Get teacher's students
    const myStudents = await this.getTeacherStudents(teacherId);
    const myStudentIds = myStudents.map((s) => s.id);

    if (myStudentIds.length === 0) return [];

    const teacherTests = await db.select().from(tests).where(eq(tests.teacherId, teacherId));
    const testIds = teacherTests.map((t) => t.id);

    if (testIds.length === 0) {
      return myStudents.map((student) => ({
        student: { id: student.id, fullName: student.fullName, username: student.username },
        testsCompleted: 0,
        averageScore: 0,
      }));
    }

    const completedAttempts = await db.select()
      .from(testAttempts)
      .where(and(
        inArray(testAttempts.testId, testIds),
        eq(testAttempts.status, "completed"),
        inArray(testAttempts.studentId, myStudentIds)
      ));
    
    return myStudents.map((student) => {
      const studentAttempts = completedAttempts.filter((a) => a.studentId === student.id);
      const averageScore = studentAttempts.length > 0
        ? studentAttempts.reduce((acc, a) => acc + (a.maxScore ? (Number(a.score) / a.maxScore) * 100 : 0), 0) / studentAttempts.length
        : 0;

      return {
        student: { id: student.id, fullName: student.fullName, username: student.username },
        testsCompleted: studentAttempts.length,
        averageScore,
      };
    });
  }

  async getTestAttempts(testId: string): Promise<TestAttempt[]> {
    return db.select()
      .from(testAttempts)
      .where(eq(testAttempts.testId, testId))
      .orderBy(desc(testAttempts.startedAt));
  }

  async getTestLeaderboard(testId: string): Promise<any[]> {
    const completedAttempts = await db.select()
      .from(testAttempts)
      .where(and(
        eq(testAttempts.testId, testId),
        eq(testAttempts.status, "completed")
      ))
      .orderBy(desc(testAttempts.score));

    const leaderboard = await Promise.all(
      completedAttempts.map(async (attempt, index) => {
        const [student] = await db.select().from(users).where(eq(users.id, attempt.studentId));
        const scorePercent = attempt.maxScore 
          ? (Number(attempt.score) / attempt.maxScore) * 100 
          : 0;
        const duration = attempt.completedAt && attempt.startedAt
          ? Math.floor((new Date(attempt.completedAt).getTime() - new Date(attempt.startedAt).getTime()) / 1000)
          : null;
        return {
          rank: index + 1,
          studentId: attempt.studentId,
          studentName: student?.fullName || "Неизвестен",
          score: Number(attempt.score),
          maxScore: attempt.maxScore,
          scorePercent,
          duration,
          completedAt: attempt.completedAt,
        };
      })
    );

    return leaderboard;
  }

  async getStudentWeakAreas(studentId: string): Promise<any> {
    const completedAttempts = await db.select()
      .from(testAttempts)
      .where(and(
        eq(testAttempts.studentId, studentId),
        eq(testAttempts.status, "completed")
      ));

    if (completedAttempts.length === 0) {
      return { weakAreas: [], recommendations: [], totalQuestions: 0 };
    }

    const allAnswers = await Promise.all(
      completedAttempts.map((attempt) => this.getAnswersByAttempt(attempt.id))
    );
    const flatAnswers = allAnswers.flat();

    const questionIds = [...new Set(flatAnswers.map((a) => a.questionId))];
    const questionsData = questionIds.length > 0 
      ? await db.select().from(questions).where(inArray(questions.id, questionIds))
      : [];

    const testIds = [...new Set(questionsData.map((q) => q.testId))];
    const testsData = testIds.length > 0 
      ? await db.select().from(tests).where(inArray(tests.id, testIds))
      : [];

    const incorrectBySubject: Record<string, { incorrect: number; total: number; questions: string[] }> = {};

    for (const answer of flatAnswers) {
      const question = questionsData.find((q) => q.id === answer.questionId);
      if (!question) continue;

      const test = testsData.find((t) => t.id === question.testId);
      const subject = test?.subject || "Другое";

      if (!incorrectBySubject[subject]) {
        incorrectBySubject[subject] = { incorrect: 0, total: 0, questions: [] };
      }

      incorrectBySubject[subject].total++;
      if (!answer.isCorrect) {
        incorrectBySubject[subject].incorrect++;
        if (!incorrectBySubject[subject].questions.includes(question.text)) {
          incorrectBySubject[subject].questions.push(question.text);
        }
      }
    }

    const weakAreas = Object.entries(incorrectBySubject)
      .map(([subject, data]) => ({
        subject,
        incorrectCount: data.incorrect,
        totalCount: data.total,
        errorRate: (data.incorrect / data.total) * 100,
        problemQuestions: data.questions.slice(0, 3),
      }))
      .filter((area) => area.errorRate > 30)
      .sort((a, b) => b.errorRate - a.errorRate);

    const recommendations = weakAreas.map((area) => ({
      subject: area.subject,
      message: `Рекомендуется повторить материал по теме "${area.subject}". Ошибок: ${area.incorrectCount} из ${area.totalCount} вопросов (${area.errorRate.toFixed(0)}%)`,
      priority: area.errorRate > 60 ? "high" : area.errorRate > 40 ? "medium" : "low",
    }));

    return {
      weakAreas,
      recommendations,
      totalQuestions: flatAnswers.length,
      totalIncorrect: flatAnswers.filter((a) => !a.isCorrect).length,
    };
  }

  // Teacher-Student management
  async addStudentToTeacher(teacherId: string, studentId: string): Promise<TeacherStudent> {
    // Check if relationship already exists
    const existing = await db.select()
      .from(teacherStudents)
      .where(and(
        eq(teacherStudents.teacherId, teacherId),
        eq(teacherStudents.studentId, studentId)
      ));
    
    if (existing.length > 0) {
      return existing[0];
    }

    const [newRelation] = await db.insert(teacherStudents)
      .values({ teacherId, studentId })
      .returning();
    return newRelation;
  }

  async removeStudentFromTeacher(teacherId: string, studentId: string): Promise<void> {
    await db.delete(teacherStudents)
      .where(and(
        eq(teacherStudents.teacherId, teacherId),
        eq(teacherStudents.studentId, studentId)
      ));
  }

  async getTeacherStudents(teacherId: string): Promise<User[]> {
    const relations = await db.select()
      .from(teacherStudents)
      .where(eq(teacherStudents.teacherId, teacherId));

    if (relations.length === 0) return [];

    const studentIds = relations.map((r) => r.studentId);
    const students = await db.select()
      .from(users)
      .where(inArray(users.id, studentIds));

    return students;
  }

  async getAllStudents(): Promise<User[]> {
    return db.select()
      .from(users)
      .where(eq(users.role, "student"))
      .orderBy(users.fullName);
  }

  async isStudentOfTeacher(teacherId: string, studentId: string): Promise<boolean> {
    const relations = await db.select()
      .from(teacherStudents)
      .where(and(
        eq(teacherStudents.teacherId, teacherId),
        eq(teacherStudents.studentId, studentId)
      ));
    return relations.length > 0;
  }

  async updateProfile(userId: string, data: { fullName?: string; photoUrl?: string | null; hobbies?: string | null; wishes?: string | null }): Promise<User> {
    const [user] = await db.update(users)
      .set(data)
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async getStudentResults(studentId: string): Promise<any[]> {
    const rows = await db.select({
      id: testAttempts.id,
      testId: testAttempts.testId,
      score: testAttempts.score,
      maxScore: testAttempts.maxScore,
      completedAt: testAttempts.completedAt,
      testTitle: tests.title,
      testSubject: tests.subject,
    })
      .from(testAttempts)
      .innerJoin(tests, eq(testAttempts.testId, tests.id))
      .where(and(eq(testAttempts.studentId, studentId), eq(testAttempts.status, "completed")))
      .orderBy(desc(testAttempts.completedAt));

    return rows.map((a) => ({
      ...a,
      percent: a.maxScore ? Math.round((Number(a.score) / a.maxScore) * 100) : 0,
    }));
  }
}

export const storage = new DatabaseStorage();
