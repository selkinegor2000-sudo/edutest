import { 
  users, 
  tests, 
  questions, 
  questionOptions, 
  testAttempts, 
  answers,
  teacherStudents,
  studentGroups,
  groupMembers,
  testAssignments,
  messages,
  notifications,
  learningMaterials,
  proctorEvents,
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
  type StudentGroup,
  type InsertStudentGroup,
  type GroupMember,
  type InsertGroupMember,
  type TestAssignment,
  type InsertTestAssignment,
  type Message,
  type InsertMessage,
  type Notification,
  type InsertNotification,
  type LearningMaterial,
  type InsertLearningMaterial,
  type ProctorEvent,
  type InsertProctorEvent,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, inArray, sql } from "drizzle-orm";

function toStringArray(value: unknown): string[] | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : null;
}

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
  createGroup(group: InsertStudentGroup): Promise<StudentGroup>;
  getGroupsByTeacher(teacherId: string): Promise<any[]>;
  addStudentToGroup(groupId: string, studentId: string): Promise<GroupMember>;
  removeStudentFromGroup(groupId: string, studentId: string): Promise<void>;
  assignTestToStudents(data: Array<InsertTestAssignment>): Promise<TestAssignment[]>;
  getAssignmentsByStudent(studentId: string): Promise<any[]>;
  getAssignmentsByTeacher(teacherId: string): Promise<any[]>;
  searchQuestions(teacherId: string, search: string): Promise<any[]>;
  getTemplatesByTeacher(teacherId: string): Promise<any[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  getConversation(userId: string, otherUserId: string): Promise<any[]>;
  getChatContacts(userId: string): Promise<User[]>;
  markConversationRead(userId: string, otherUserId: string): Promise<void>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  getNotifications(userId: string): Promise<Notification[]>;
  markNotificationAsRead(notificationId: string, userId: string): Promise<void>;
  createLearningMaterial(material: InsertLearningMaterial): Promise<LearningMaterial>;
  updateLearningMaterial(id: string, data: Partial<InsertLearningMaterial>): Promise<LearningMaterial>;
  getLearningMaterials(userId: string, role: "student" | "teacher"): Promise<any[]>;
  getLearningMaterial(id: string): Promise<LearningMaterial | undefined>;
  createProctorEvents(events: InsertProctorEvent[]): Promise<ProctorEvent[]>;
  getProctorEventsByAttempt(attemptId: string): Promise<ProctorEvent[]>;
  getTeacherTestsInRange(teacherId: string, from?: Date, to?: Date): Promise<any[]>;
  getAdminSystemSummary(): Promise<any>;
  
  // Profile
  updateProfile(userId: string, data: { fullName?: string; photoUrl?: string | null; hobbies?: string | null; wishes?: string | null }): Promise<User>;

  // Student results for personal pages
  getStudentResults(studentId: string): Promise<any[]>;
  getPublishedTestsForStudent(studentId: string): Promise<any[]>;
}

export class DatabaseStorage implements IStorage {
  async getAdminSystemSummary(): Promise<any> {
    const countRows = async (table: any) => {
      const [result] = await db.select({ value: sql<number>`count(*)` }).from(table);
      return Number(result?.value ?? 0);
    };

    const [usersTotal, teachers, students, testsTotal, questionsTotal, attemptsTotal, completedAttempts, messagesTotal, notificationsTotal, materialsTotal, groupsTotal, assignmentsTotal] = await Promise.all([
      countRows(users),
      db.select({ value: sql<number>`count(*)` }).from(users).where(eq(users.role, "teacher")).then((rows) => Number(rows[0]?.value ?? 0)),
      db.select({ value: sql<number>`count(*)` }).from(users).where(eq(users.role, "student")).then((rows) => Number(rows[0]?.value ?? 0)),
      countRows(tests),
      countRows(questions),
      countRows(testAttempts),
      db.select({ value: sql<number>`count(*)` }).from(testAttempts).where(eq(testAttempts.status, "completed")).then((rows) => Number(rows[0]?.value ?? 0)),
      countRows(messages),
      countRows(notifications),
      countRows(learningMaterials),
      countRows(studentGroups),
      countRows(testAssignments),
    ]);

    return {
      usersTotal,
      teachers,
      students,
      testsTotal,
      questionsTotal,
      attemptsTotal,
      completedAttempts,
      messagesTotal,
      notificationsTotal,
      materialsTotal,
      groupsTotal,
      assignmentsTotal,
      generatedAt: new Date().toISOString(),
    };
  }

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

    const regularTests = teacherTests.filter((test) => !test.isTemplate);

    return Promise.all(regularTests.map(async (test) => {
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

    const availableTests = publishedTests.filter((test) => !test.isTemplate && (!test.scheduledAt || new Date(test.scheduledAt) <= new Date()));

    return Promise.all(availableTests.map(async (test) => {
      const questionsData = await db.select().from(questions).where(eq(questions.testId, test.id));
      return {
        ...test,
        questionCount: questionsData.length,
      };
    }));
  }

  async getPublishedTestsForStudent(studentId: string): Promise<any[]> {
    const availableTests = await this.getPublishedTests();
    const assignmentsData = await db.select()
      .from(testAssignments)
      .where(eq(testAssignments.studentId, studentId));

    const assignmentMap = new Map(assignmentsData.map((assignment) => [assignment.testId, assignment]));

    return availableTests.map((test) => ({
      ...test,
      assignment: assignmentMap.get(test.id) || null,
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
    const normalizedQuestion = {
      ...question,
      rubricCriteria: toStringArray(question.rubricCriteria),
    };
    const [newQuestion] = await db.insert(questions).values(normalizedQuestion).returning();
    return newQuestion;
  }

  async getQuestionsByTest(testId: string): Promise<Question[]> {
    return db.select()
      .from(questions)
      .where(eq(questions.testId, testId))
      .orderBy(questions.orderIndex);
  }

  async updateQuestion(id: string, data: Partial<InsertQuestion>): Promise<Question> {
    const normalizedData = {
      ...data,
      rubricCriteria: toStringArray(data.rubricCriteria),
    };
    const [updated] = await db.update(questions)
      .set(normalizedData)
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
    const proctorTimeline = await db.select().from(proctorEvents).where(eq(proctorEvents.attemptId, id)).orderBy(proctorEvents.createdAt);

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
      proctorEvents: proctorTimeline,
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
    const payload = {
      ...answer,
      selectedOptionIds: Array.isArray(answer.selectedOptionIds) ? [...answer.selectedOptionIds] : answer.selectedOptionIds ?? null,
    };
    const [newAnswer] = await db.insert(answers).values(payload).returning();
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
    const teacherTests = (await db.select().from(tests).where(eq(tests.teacherId, teacherId))).filter((test) => !test.isTemplate);
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

    const questionIds = Array.from(new Set(flatAnswers.map((a) => a.questionId)));
    const questionsData = questionIds.length > 0 
      ? await db.select().from(questions).where(inArray(questions.id, questionIds))
      : [];

    const testIds = Array.from(new Set(questionsData.map((q) => q.testId)));
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

  async createGroup(group: InsertStudentGroup): Promise<StudentGroup> {
    const [createdGroup] = await db.insert(studentGroups).values(group).returning();
    return createdGroup;
  }

  async getGroupsByTeacher(teacherId: string): Promise<any[]> {
    const groups = await db.select()
      .from(studentGroups)
      .where(eq(studentGroups.teacherId, teacherId))
      .orderBy(desc(studentGroups.createdAt));

    return Promise.all(groups.map(async (group) => {
      const members = await db.select().from(groupMembers).where(eq(groupMembers.groupId, group.id));
      const studentIds = members.map((member) => member.studentId);
      const students = studentIds.length > 0
        ? await db.select().from(users).where(inArray(users.id, studentIds))
        : [];

      return {
        ...group,
        memberCount: members.length,
        members: students.map((student) => ({
          id: student.id,
          fullName: student.fullName,
          username: student.username,
        })),
      };
    }));
  }

  async addStudentToGroup(groupId: string, studentId: string): Promise<GroupMember> {
    const existing = await db.select()
      .from(groupMembers)
      .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.studentId, studentId)));

    if (existing.length > 0) {
      return existing[0];
    }

    const [member] = await db.insert(groupMembers)
      .values({ groupId, studentId })
      .returning();
    return member;
  }

  async removeStudentFromGroup(groupId: string, studentId: string): Promise<void> {
    await db.delete(groupMembers)
      .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.studentId, studentId)));
  }

  async assignTestToStudents(data: Array<InsertTestAssignment>): Promise<TestAssignment[]> {
    const createdAssignments: TestAssignment[] = [];

    for (const assignment of data) {
      const existing = await db.select()
        .from(testAssignments)
        .where(and(eq(testAssignments.testId, assignment.testId), eq(testAssignments.studentId, assignment.studentId)));

      if (existing.length > 0) {
        createdAssignments.push(existing[0]);
        continue;
      }

      const [created] = await db.insert(testAssignments).values(assignment).returning();
      createdAssignments.push(created);
    }

    return createdAssignments;
  }

  async getAssignmentsByStudent(studentId: string): Promise<any[]> {
    const items = await db.select()
      .from(testAssignments)
      .where(eq(testAssignments.studentId, studentId))
      .orderBy(desc(testAssignments.createdAt));

    return Promise.all(items.map(async (item) => {
      const [test] = await db.select().from(tests).where(eq(tests.id, item.testId));
      const [teacher] = await db.select().from(users).where(eq(users.id, item.assignedByTeacherId));
      return {
        ...item,
        test,
        teacher: teacher ? { id: teacher.id, fullName: teacher.fullName, username: teacher.username } : null,
      };
    }));
  }

  async getAssignmentsByTeacher(teacherId: string): Promise<any[]> {
    const items = await db.select()
      .from(testAssignments)
      .where(eq(testAssignments.assignedByTeacherId, teacherId))
      .orderBy(desc(testAssignments.createdAt));

    return Promise.all(items.map(async (item) => {
      const [test] = await db.select().from(tests).where(eq(tests.id, item.testId));
      const [student] = await db.select().from(users).where(eq(users.id, item.studentId));
      const [group] = item.groupId
        ? await db.select().from(studentGroups).where(eq(studentGroups.id, item.groupId))
        : [null];

      return {
        ...item,
        test,
        student: student ? { id: student.id, fullName: student.fullName, username: student.username } : null,
        group,
      };
    }));
  }

  async searchQuestions(teacherId: string, search: string): Promise<any[]> {
    const teacherTests = await db.select()
      .from(tests)
      .where(eq(tests.teacherId, teacherId));

    if (teacherTests.length === 0) {
      return [];
    }

    const teacherTestIds = teacherTests.map((test) => test.id);
    const teacherQuestions = await db.select()
      .from(questions)
      .where(inArray(questions.testId, teacherTestIds));

    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) {
      return [];
    }

    return teacherQuestions
      .filter((question) => question.text.toLowerCase().includes(normalizedSearch))
      .slice(0, 30)
      .map((question) => {
        const parentTest = teacherTests.find((test) => test.id === question.testId);
        return {
          ...question,
          testTitle: parentTest?.title || "Без названия",
          subject: parentTest?.subject || "Без предмета",
        };
      });
  }

  async getTemplatesByTeacher(teacherId: string): Promise<any[]> {
    const templates = (await db.select()
      .from(tests)
      .where(eq(tests.teacherId, teacherId))
      .orderBy(desc(tests.updatedAt)))
      .filter((test) => Boolean(test.isTemplate));

    return Promise.all(templates.map(async (template) => {
      const templateQuestions = await this.getQuestionsByTest(template.id);
      return {
        ...template,
        questionCount: templateQuestions.length,
      };
    }));
  }

  async createMessage(message: InsertMessage): Promise<Message> {
    const [created] = await db.insert(messages).values(message).returning();
    return created;
  }

  async getConversation(userId: string, otherUserId: string): Promise<any[]> {
    const conversationItems = await db.select()
      .from(messages)
      .orderBy(messages.createdAt);

    const filtered = conversationItems.filter((item) => (
      (item.fromUserId === userId && item.toUserId === otherUserId) ||
      (item.fromUserId === otherUserId && item.toUserId === userId)
    ));

    return Promise.all(filtered.map(async (item) => {
      const [fromUser] = await db.select().from(users).where(eq(users.id, item.fromUserId));
      const [toUser] = await db.select().from(users).where(eq(users.id, item.toUserId));
      return {
        ...item,
        fromUser: fromUser ? { id: fromUser.id, fullName: fromUser.fullName, username: fromUser.username } : null,
        toUser: toUser ? { id: toUser.id, fullName: toUser.fullName, username: toUser.username } : null,
      };
    }));
  }

  async getChatContacts(userId: string): Promise<User[]> {
    const currentUser = await this.getUser(userId);
    if (!currentUser) {
      return [];
    }

    if (currentUser.role === "teacher") {
      return this.getTeacherStudents(userId);
    }

    const relations = await db.select().from(teacherStudents).where(eq(teacherStudents.studentId, userId));
    if (relations.length === 0) {
      return [];
    }

    const teacherIds = relations.map((relation) => relation.teacherId);
    return db.select().from(users).where(inArray(users.id, teacherIds));
  }

  async markConversationRead(userId: string, otherUserId: string): Promise<void> {
    const unreadMessages = await db.select()
      .from(messages)
      .where(and(eq(messages.fromUserId, otherUserId), eq(messages.toUserId, userId)));

    for (const message of unreadMessages.filter((item) => !item.readAt)) {
      await db.update(messages)
        .set({ readAt: new Date() })
        .where(eq(messages.id, message.id));
    }
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    const [created] = await db.insert(notifications).values(notification).returning();
    return created;
  }

  async getNotifications(userId: string): Promise<Notification[]> {
    return db.select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt));
  }

  async markNotificationAsRead(notificationId: string, userId: string): Promise<void> {
    await db.update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)));
  }

  async createLearningMaterial(material: InsertLearningMaterial): Promise<LearningMaterial> {
    const normalizedMaterial = {
      ...material,
      aiKeywords: toStringArray(material.aiKeywords),
    };
    const [created] = await db.insert(learningMaterials).values(normalizedMaterial).returning();
    return created;
  }

  async updateLearningMaterial(id: string, data: Partial<InsertLearningMaterial>): Promise<LearningMaterial> {
    const normalizedData = {
      ...data,
      aiKeywords: toStringArray(data.aiKeywords),
      updatedAt: new Date(),
    };
    const [updated] = await db.update(learningMaterials)
      .set(normalizedData)
      .where(eq(learningMaterials.id, id))
      .returning();
    return updated;
  }

  async getLearningMaterial(id: string): Promise<LearningMaterial | undefined> {
    const [material] = await db.select().from(learningMaterials).where(eq(learningMaterials.id, id));
    return material || undefined;
  }

  async getLearningMaterials(userId: string, role: "student" | "teacher"): Promise<any[]> {
    const items = role === "teacher"
      ? await db.select().from(learningMaterials).where(eq(learningMaterials.teacherId, userId)).orderBy(desc(learningMaterials.createdAt))
      : await db.select().from(learningMaterials).orderBy(desc(learningMaterials.createdAt));

    return Promise.all(items.map(async (item) => {
      const [teacher] = await db.select().from(users).where(eq(users.id, item.teacherId));
      const linkedTest = item.linkedTestId ? await this.getTest(item.linkedTestId) : null;
      return {
        ...item,
        teacher: teacher ? { id: teacher.id, fullName: teacher.fullName, username: teacher.username } : null,
        linkedTest,
      };
    }));
  }

  async createProctorEvents(eventsData: InsertProctorEvent[]): Promise<ProctorEvent[]> {
    if (eventsData.length === 0) {
      return [];
    }
    return db.insert(proctorEvents).values(eventsData).returning();
  }

  async getProctorEventsByAttempt(attemptId: string): Promise<ProctorEvent[]> {
    return db.select().from(proctorEvents).where(eq(proctorEvents.attemptId, attemptId)).orderBy(proctorEvents.createdAt);
  }

  async getTeacherTestsInRange(teacherId: string, from?: Date, to?: Date): Promise<any[]> {
    const teacherTests = await this.getTestsByTeacher(teacherId);
    if (!from && !to) {
      return teacherTests;
    }

    return teacherTests.filter((test) => {
      const createdAt = test.createdAt ? new Date(test.createdAt) : null;
      if (!createdAt) {
        return false;
      }
      if (from && createdAt < from) {
        return false;
      }
      if (to && createdAt > to) {
        return false;
      }
      return true;
    });
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
