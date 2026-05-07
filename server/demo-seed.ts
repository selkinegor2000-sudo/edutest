import bcrypt from "bcrypt";
import { db } from "./db";
import { storage } from "./storage";
import {
  answers,
  groupMembers,
  learningMaterials,
  messages,
  notifications,
  proctorEvents,
  questionOptions,
  questions,
  studentGroups,
  teacherStudents,
  testAssignments,
  testAttempts,
  tests,
  users,
  type Test,
  type User,
} from "@shared/schema";

type SeedOption = {
  text: string;
  isCorrect: boolean;
};

type SeedQuestion = {
  type: "single_choice" | "multiple_choice" | "open_answer";
  text: string;
  points: number;
  correctAnswer: string | null;
  orderIndex: number;
  difficulty?: "easy" | "medium" | "hard";
  options: SeedOption[];
};

type DemoSeedContext = {
  teachers: Record<string, User>;
  students: Record<string, User>;
  tests: Record<string, Test>;
  counts: {
    usersCreated: number;
    testsCreated: number;
    questionsCreated: number;
  };
};

async function hash(password: string) {
  return bcrypt.hash(password, 10);
}

async function createTestWithQuestions(params: {
  title: string;
  description: string;
  subject: string;
  teacherId: string;
  timeLimitMinutes: number;
  isPublished: boolean;
  isCompetitive: boolean;
  questions: SeedQuestion[];
}) {
  const [createdTest] = await db.insert(tests).values({
    title: params.title,
    description: params.description,
    subject: params.subject,
    teacherId: params.teacherId,
    timeLimitMinutes: params.timeLimitMinutes,
    isPublished: params.isPublished,
    isCompetitive: params.isCompetitive,
  }).returning();

  for (const seedQuestion of params.questions) {
    const [createdQuestion] = await db.insert(questions).values({
      testId: createdTest.id,
      type: seedQuestion.type,
      text: seedQuestion.text,
      points: seedQuestion.points,
      correctAnswer: seedQuestion.correctAnswer,
      orderIndex: seedQuestion.orderIndex,
      difficulty: seedQuestion.difficulty || (seedQuestion.points >= 3 ? "hard" : seedQuestion.points >= 2 ? "medium" : "easy"),
    }).returning();

    for (let index = 0; index < seedQuestion.options.length; index++) {
      const option = seedQuestion.options[index];
      await db.insert(questionOptions).values({
        questionId: createdQuestion.id,
        text: option.text,
        isCorrect: option.isCorrect,
        orderIndex: index,
      });
    }
  }

  return createdTest;
}

export async function clearDemoDatabase() {
  await db.delete(proctorEvents);
  await db.delete(answers);
  await db.delete(messages);
  await db.delete(notifications);
  await db.delete(testAssignments);
  await db.delete(groupMembers);
  await db.delete(studentGroups);
  await db.delete(learningMaterials);
  await db.delete(testAttempts);
  await db.delete(questionOptions);
  await db.delete(questions);
  await db.delete(teacherStudents);
  await db.delete(tests);
  await db.delete(users);
}

export async function seedBaseDemoData(): Promise<DemoSeedContext> {
  const teachersData = [
    { username: "ivanova_t", password: "teacher123", fullName: "Иванова Татьяна Сергеевна", role: "teacher" as const },
    { username: "petrov_a", password: "teacher456", fullName: "Петров Андрей Викторович", role: "teacher" as const },
    { username: "teacher", password: "123456", fullName: "Демо Преподаватель", role: "teacher" as const },
  ];

  const studentsData = [
    { username: "sidorov_ivan", password: "student111", fullName: "Сидоров Иван Петрович" },
    { username: "kuznetsova_m", password: "student222", fullName: "Кузнецова Мария Алексеевна" },
    { username: "morozov_denis", password: "student333", fullName: "Морозов Денис Игоревич" },
    { username: "volkova_anna", password: "student444", fullName: "Волкова Анна Дмитриевна" },
    { username: "lebedev_k", password: "student555", fullName: "Лебедев Константин Юрьевич" },
    { username: "sokolova_e", password: "student666", fullName: "Соколова Екатерина Олеговна" },
    { username: "novikov_n", password: "student777", fullName: "Новиков Никита Романович" },
    { username: "student", password: "123456", fullName: "Демо Студент" },
  ];

  const teacherMap: Record<string, User> = {};
  for (const teacherSeed of teachersData) {
    const [teacher] = await db.insert(users).values({
      username: teacherSeed.username,
      password: await hash(teacherSeed.password),
      fullName: teacherSeed.fullName,
      role: teacherSeed.role,
    }).returning();
    teacherMap[teacherSeed.username] = teacher;
  }

  const studentMap: Record<string, User> = {};
  for (const studentSeed of studentsData) {
    const [student] = await db.insert(users).values({
      username: studentSeed.username,
      password: await hash(studentSeed.password),
      fullName: studentSeed.fullName,
      role: "student",
    }).returning();
    studentMap[studentSeed.username] = student;
  }

  const teacher1 = teacherMap.ivanova_t;
  const teacher2 = teacherMap.petrov_a;
  const teacher3 = teacherMap.teacher;
  const studentValues = Object.values(studentMap);

  for (const student of studentValues.slice(0, 4)) {
    await db.insert(teacherStudents).values({ teacherId: teacher1.id, studentId: student.id });
  }
  for (const student of studentValues.slice(3, 7)) {
    await db.insert(teacherStudents).values({ teacherId: teacher2.id, studentId: student.id });
  }
  for (const student of studentValues) {
    await db.insert(teacherStudents).values({ teacherId: teacher3.id, studentId: student.id }).catch(() => undefined);
  }

  const testsMap: Record<string, Test> = {};
  let questionsCreated = 0;

  const test1Questions: SeedQuestion[] = [
    {
      type: "single_choice",
      text: "Какой тип данных используется для хранения целых чисел в Python?",
      points: 1,
      correctAnswer: null,
      orderIndex: 0,
      options: [
        { text: "int", isCorrect: true },
        { text: "float", isCorrect: false },
        { text: "str", isCorrect: false },
        { text: "bool", isCorrect: false },
      ],
    },
    {
      type: "single_choice",
      text: "Что выведет команда print(type(3.14))?",
      points: 1,
      correctAnswer: null,
      orderIndex: 1,
      options: [
        { text: "<class 'int'>", isCorrect: false },
        { text: "<class 'float'>", isCorrect: true },
        { text: "<class 'str'>", isCorrect: false },
        { text: "<class 'number'>", isCorrect: false },
      ],
    },
    {
      type: "multiple_choice",
      text: "Какие из перечисленных являются встроенными типами данных Python?",
      points: 2,
      correctAnswer: null,
      orderIndex: 2,
      options: [
        { text: "list", isCorrect: true },
        { text: "tuple", isCorrect: true },
        { text: "array", isCorrect: false },
        { text: "dict", isCorrect: true },
      ],
    },
    {
      type: "single_choice",
      text: "Какой оператор используется для целочисленного деления в Python?",
      points: 1,
      correctAnswer: null,
      orderIndex: 3,
      options: [
        { text: "/", isCorrect: false },
        { text: "//", isCorrect: true },
        { text: "%", isCorrect: false },
        { text: "**", isCorrect: false },
      ],
    },
    {
      type: "open_answer",
      text: "Объясните разницу между списком (list) и кортежем (tuple) в Python.",
      points: 3,
      correctAnswer: "Список изменяем, а кортеж неизменяем после создания.",
      orderIndex: 4,
      options: [],
    },
  ];
  testsMap.python = await createTestWithQuestions({
    title: "Основы программирования на Python",
    description: "Тест проверяет знание базовых концепций языка Python: типы данных, циклы, функции.",
    subject: "Информатика",
    teacherId: teacher1.id,
    timeLimitMinutes: 20,
    isPublished: true,
    isCompetitive: false,
    questions: test1Questions,
  });
  questionsCreated += test1Questions.length;

  const test2Questions: SeedQuestion[] = [
    {
      type: "single_choice",
      text: "Матрица называется квадратной, если...",
      points: 1,
      correctAnswer: null,
      orderIndex: 0,
      options: [
        { text: "число строк равно числу столбцов", isCorrect: true },
        { text: "все элементы равны нулю", isCorrect: false },
        { text: "она симметрична относительно главной диагонали", isCorrect: false },
        { text: "определитель равен 1", isCorrect: false },
      ],
    },
    {
      type: "single_choice",
      text: "Чему равен определитель единичной матрицы любого порядка?",
      points: 1,
      correctAnswer: null,
      orderIndex: 1,
      options: [
        { text: "0", isCorrect: false },
        { text: "1", isCorrect: true },
        { text: "-1", isCorrect: false },
        { text: "n (порядок матрицы)", isCorrect: false },
      ],
    },
    {
      type: "multiple_choice",
      text: "Какие свойства справедливы для умножения матриц?",
      points: 2,
      correctAnswer: null,
      orderIndex: 2,
      options: [
        { text: "Ассоциативность: (AB)C = A(BC)", isCorrect: true },
        { text: "Коммутативность: AB = BA", isCorrect: false },
        { text: "Дистрибутивность: A(B+C) = AB+AC", isCorrect: true },
        { text: "Существование нейтрального элемента", isCorrect: true },
      ],
    },
    {
      type: "open_answer",
      text: "Что такое собственное значение матрицы? Запишите определение.",
      points: 3,
      correctAnswer: "Это число λ, при котором существует ненулевой вектор x такой, что Ax = λx.",
      orderIndex: 3,
      options: [],
    },
  ];
  testsMap.linearAlgebra = await createTestWithQuestions({
    title: "Линейная алгебра: матрицы и векторы",
    description: "Проверка знаний по операциям с матрицами, определителям и собственным значениям.",
    subject: "Математика",
    teacherId: teacher1.id,
    timeLimitMinutes: 30,
    isPublished: true,
    isCompetitive: true,
    questions: test2Questions,
  });
  questionsCreated += test2Questions.length;

  const test3Questions: SeedQuestion[] = [
    {
      type: "single_choice",
      text: "Какой SQL-оператор используется для выборки данных из таблицы?",
      points: 1,
      correctAnswer: null,
      orderIndex: 0,
      options: [
        { text: "SELECT", isCorrect: true },
        { text: "GET", isCorrect: false },
        { text: "FETCH", isCorrect: false },
        { text: "READ", isCorrect: false },
      ],
    },
    {
      type: "single_choice",
      text: "Что такое первичный ключ (PRIMARY KEY)?",
      points: 1,
      correctAnswer: null,
      orderIndex: 1,
      options: [
        { text: "Столбец или набор столбцов, однозначно идентифицирующий строку", isCorrect: true },
        { text: "Внешняя ссылка на другую таблицу", isCorrect: false },
        { text: "Индекс для ускорения поиска", isCorrect: false },
        { text: "Обязательное поле таблицы", isCorrect: false },
      ],
    },
    {
      type: "multiple_choice",
      text: "Какие из перечисленных являются агрегатными функциями SQL?",
      points: 2,
      correctAnswer: null,
      orderIndex: 2,
      options: [
        { text: "COUNT()", isCorrect: true },
        { text: "SUM()", isCorrect: true },
        { text: "UPPER()", isCorrect: false },
        { text: "AVG()", isCorrect: true },
      ],
    },
    {
      type: "single_choice",
      text: "В какой нормальной форме таблица, если каждый неключевой атрибут зависит от всего первичного ключа?",
      points: 1,
      correctAnswer: null,
      orderIndex: 3,
      options: [
        { text: "1НФ", isCorrect: false },
        { text: "2НФ", isCorrect: true },
        { text: "3НФ", isCorrect: false },
        { text: "НФБК", isCorrect: false },
      ],
    },
    {
      type: "open_answer",
      text: "Объясните разницу между операторами INNER JOIN и LEFT JOIN.",
      points: 3,
      correctAnswer: "INNER JOIN возвращает только совпавшие строки, LEFT JOIN — все строки слева и совпавшие справа.",
      orderIndex: 4,
      options: [],
    },
  ];
  testsMap.sql = await createTestWithQuestions({
    title: "Реляционные базы данных и SQL",
    description: "Тест на знание основ реляционных БД, SQL-запросов и нормализации.",
    subject: "Базы данных",
    teacherId: teacher2.id,
    timeLimitMinutes: 25,
    isPublished: true,
    isCompetitive: false,
    questions: test3Questions,
  });
  questionsCreated += test3Questions.length;

  const test4Questions: SeedQuestion[] = [
    {
      type: "single_choice",
      text: "Сколько уровней содержит модель OSI?",
      points: 1,
      correctAnswer: null,
      orderIndex: 0,
      options: [
        { text: "4", isCorrect: false },
        { text: "5", isCorrect: false },
        { text: "7", isCorrect: true },
        { text: "10", isCorrect: false },
      ],
    },
    {
      type: "single_choice",
      text: "Какой протокол обеспечивает надежную передачу данных с установлением соединения?",
      points: 1,
      correctAnswer: null,
      orderIndex: 1,
      options: [
        { text: "UDP", isCorrect: false },
        { text: "TCP", isCorrect: true },
        { text: "IP", isCorrect: false },
        { text: "ICMP", isCorrect: false },
      ],
    },
    {
      type: "multiple_choice",
      text: "Какие протоколы работают на прикладном уровне модели OSI?",
      points: 2,
      correctAnswer: null,
      orderIndex: 2,
      options: [
        { text: "HTTP", isCorrect: true },
        { text: "FTP", isCorrect: true },
        { text: "IP", isCorrect: false },
        { text: "SMTP", isCorrect: true },
      ],
    },
    {
      type: "open_answer",
      text: "Что такое IP-адрес и для чего он используется в компьютерных сетях?",
      points: 3,
      correctAnswer: "IP-адрес — это уникальный числовой идентификатор устройства в сети для адресации и маршрутизации пакетов.",
      orderIndex: 3,
      options: [],
    },
  ];
  testsMap.networks = await createTestWithQuestions({
    title: "Компьютерные сети и протоколы",
    description: "Проверка знаний сетевых моделей OSI/TCP-IP, протоколов и адресации.",
    subject: "Компьютерные сети",
    teacherId: teacher2.id,
    timeLimitMinutes: 20,
    isPublished: true,
    isCompetitive: true,
    questions: test4Questions,
  });
  questionsCreated += test4Questions.length;

  return {
    teachers: teacherMap,
    students: studentMap,
    tests: testsMap,
    counts: {
      usersCreated: Object.keys(teacherMap).length + Object.keys(studentMap).length,
      testsCreated: Object.keys(testsMap).length,
      questionsCreated,
    },
  };
}

export async function seedDemoSupportData(context: DemoSeedContext) {
  const groupTeacher = context.teachers.ivanova_t;
  const groupStudentsList = [context.students.sidorov_ivan, context.students.kuznetsova_m, context.students.morozov_denis];

  const [createdGroup] = await db.insert(studentGroups).values({
    teacherId: groupTeacher.id,
    name: "ИВТ-101",
    description: "Демонстрационная учебная группа для приемки и показа руководителю.",
  }).returning();

  for (const student of groupStudentsList) {
    await db.insert(groupMembers).values({
      groupId: createdGroup.id,
      studentId: student.id,
    });
  }

  const assignments = [
    {
      testId: context.tests.python.id,
      studentId: context.students.sidorov_ivan.id,
      assignedByTeacherId: context.teachers.ivanova_t.id,
      dueAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    },
    {
      testId: context.tests.python.id,
      studentId: context.students.kuznetsova_m.id,
      assignedByTeacherId: context.teachers.ivanova_t.id,
      dueAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    },
    {
      testId: context.tests.linearAlgebra.id,
      studentId: context.students.sidorov_ivan.id,
      groupId: createdGroup.id,
      assignedByTeacherId: context.teachers.ivanova_t.id,
      dueAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    },
    {
      testId: context.tests.sql.id,
      studentId: context.students.lebedev_k.id,
      assignedByTeacherId: context.teachers.petrov_a.id,
      dueAt: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
    },
    {
      testId: context.tests.networks.id,
      studentId: context.students.sokolova_e.id,
      assignedByTeacherId: context.teachers.petrov_a.id,
      dueAt: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
    },
  ];
  await db.insert(testAssignments).values(assignments);

  await db.insert(learningMaterials).values([
    {
      teacherId: context.teachers.ivanova_t.id,
      title: "Памятка по основам Python",
      description: "Краткий материал для повторения типов данных, циклов и функций.",
      materialType: "manual",
      fileName: "python_basics_manual.txt",
      filePath: null,
      mimeType: "text/plain",
      extractedContent: "Типы данных Python, условные конструкции, циклы, функции.",
      aiSummary: "Материал помогает быстро повторить базовые конструкции языка Python.",
      aiKeywords: ["python", "типы данных", "циклы", "функции"],
      aiDifficulty: "easy",
      linkedTestId: context.tests.python.id,
    },
    {
      teacherId: context.teachers.petrov_a.id,
      title: "Мини-конспект по SQL и JOIN",
      description: "Демонстрационный материал для работы с SELECT, JOIN и агрегатными функциями.",
      materialType: "book",
      fileName: "sql_join_guide.txt",
      filePath: null,
      mimeType: "text/plain",
      extractedContent: "SELECT, JOIN, WHERE, GROUP BY, COUNT, SUM, AVG.",
      aiSummary: "Пособие закрепляет базовые запросы к реляционным базам данных.",
      aiKeywords: ["sql", "join", "select", "aggregate"],
      aiDifficulty: "medium",
      linkedTestId: context.tests.sql.id,
    },
  ]);

  await db.insert(messages).values([
    {
      fromUserId: context.teachers.ivanova_t.id,
      toUserId: context.students.sidorov_ivan.id,
      content: "Проверь результаты по Python и обрати внимание на блок с функциями.",
    },
    {
      fromUserId: context.students.sidorov_ivan.id,
      toUserId: context.teachers.ivanova_t.id,
      content: "Хорошо, повторю материал и попробую пройти тест повторно.",
    },
    {
      fromUserId: context.teachers.petrov_a.id,
      toUserId: context.students.lebedev_k.id,
      content: "На следующей неделе будет повторный контроль по SQL и сетям.",
    },
  ]);

  await db.insert(notifications).values([
    {
      userId: context.students.sidorov_ivan.id,
      title: "Назначен тест по Python",
      body: "Открой тест " + '"Основы программирования на Python"' + " и завершите попытку до конца недели.",
      link: "/student/tests",
      type: "info",
      isRead: false,
    },
    {
      userId: context.students.lebedev_k.id,
      title: "Назначен тест по SQL",
      body: "Вам назначен контроль по базам данных. Проверьте также методические материалы.",
      link: "/student/tests",
      type: "info",
      isRead: false,
    },
    {
      userId: context.teachers.ivanova_t.id,
      title: "Демо-контур восстановлен",
      body: "Учебный контур заново наполнен тестами, материалами и демонстрационной активностью.",
      link: "/teacher/analytics",
      type: "info",
      isRead: false,
    },
  ]);

  return {
    createdGroups: 1,
    createdAssignments: assignments.length,
    createdMaterials: 2,
    createdMessages: 3,
    createdNotifications: 3,
  };
}

export async function seedDemoAttemptsForTeacher(teacherId: string, options?: { testId?: string; studentsPerTest?: number; maxTests?: number }) {
  const teacherTests = await storage.getTestsByTeacher(teacherId);
  const candidateTests = options?.testId
    ? teacherTests.filter((test) => test.id === options.testId)
    : teacherTests.slice(0, options?.maxTests ?? 3);

  if (candidateTests.length === 0) {
    return { createdAttempts: 0 };
  }

  const students = await storage.getTeacherStudents(teacherId);
  if (students.length === 0) {
    return { createdAttempts: 0 };
  }

  const demoStudents = students.slice(0, options?.studentsPerTest ?? 5);
  let createdAttempts = 0;

  for (const test of candidateTests) {
    const testWithQuestions = await storage.getTestWithQuestions(test.id);
    if (!testWithQuestions?.questions?.length) {
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

      const suspiciousEventsCount = Math.random() < 0.35 ? 1 : 0;
      await storage.updateTestAttempt(attempt.id, {
        status: "completed",
        completedAt: new Date(),
        score: totalScore,
        maxScore,
        proctorScore: 88 + Math.floor(Math.random() * 12),
        suspiciousEventsCount,
        proctorSummary: suspiciousEventsCount > 0
          ? "Демо-прохождение с единичным событием потери фокуса"
          : "Демо-прохождение для витрины аналитики",
      });

      if (suspiciousEventsCount > 0) {
        await storage.createProctorEvents([
          {
            attemptId: attempt.id,
            eventType: "tab_switch",
            details: "Демо: кратковременное переключение вкладки",
            idleSeconds: 0,
          },
        ]);
      }

      createdAttempts++;
    }
  }

  return { createdAttempts };
}

export async function rebuildDemoContour() {
  await clearDemoDatabase();
  const context = await seedBaseDemoData();
  const support = await seedDemoSupportData(context);
  const ivanovaAttempts = await seedDemoAttemptsForTeacher(context.teachers.ivanova_t.id, { studentsPerTest: 3, maxTests: 2 });
  const petrovAttempts = await seedDemoAttemptsForTeacher(context.teachers.petrov_a.id, { studentsPerTest: 2, maxTests: 2 });

  return {
    ...context.counts,
    ...support,
    createdAttempts: ivanovaAttempts.createdAttempts + petrovAttempts.createdAttempts,
  };
}