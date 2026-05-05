import bcrypt from "bcrypt";
import { db } from "../server/db";
import {
  users, tests, questions, questionOptions, teacherStudents
} from "../shared/schema";

async function hash(password: string) {
  return bcrypt.hash(password, 10);
}

async function seed() {
  console.log("🌱 Начинаю заполнение базы данных...");

  // ── Учителя ───────────────────────────────────────────────
  const teachersData = [
    { username: "ivanova_t", password: "teacher123", fullName: "Иванова Татьяна Сергеевна", role: "teacher" as const },
    { username: "petrov_a",  password: "teacher456", fullName: "Петров Андрей Викторович",  role: "teacher" as const },
    { username: "teacher",   password: "123456",     fullName: "Демо Преподаватель",         role: "teacher" as const },
  ];

  const createdTeachers = [];
  for (const t of teachersData) {
    const [teacher] = await db.insert(users).values({
      username: t.username,
      password: await hash(t.password),
      fullName: t.fullName,
      role: t.role,
    }).returning();
    createdTeachers.push(teacher);
    console.log(`  ✓ Учитель: ${t.fullName} (${t.username})`);
  }

  // ── Ученики ───────────────────────────────────────────────
  const studentsData = [
    { username: "sidorov_ivan",  password: "student111", fullName: "Сидоров Иван Петрович" },
    { username: "kuznetsova_m",  password: "student222", fullName: "Кузнецова Мария Алексеевна" },
    { username: "morozov_denis", password: "student333", fullName: "Морозов Денис Игоревич" },
    { username: "volkova_anna",  password: "student444", fullName: "Волкова Анна Дмитриевна" },
    { username: "lebedev_k",     password: "student555", fullName: "Лебедев Константин Юрьевич" },
    { username: "sokolova_e",    password: "student666", fullName: "Соколова Екатерина Олеговна" },
    { username: "novikov_n",     password: "student777", fullName: "Новиков Никита Романович" },
    { username: "student",       password: "123456",     fullName: "Демо Студент" },
  ];

  const createdStudents = [];
  for (const s of studentsData) {
    const [student] = await db.insert(users).values({
      username: s.username,
      password: await hash(s.password),
      fullName: s.fullName,
      role: "student",
    }).returning();
    createdStudents.push(student);
    console.log(`  ✓ Ученик: ${s.fullName} (${s.username})`);
  }

  // ── Привязка учеников к учителям ─────────────────────────
  const [teacher1, teacher2, teacher3] = createdTeachers;
  // Иванова: 4 ученика
  for (const s of createdStudents.slice(0, 4)) {
    await db.insert(teacherStudents).values({ teacherId: teacher1.id, studentId: s.id });
  }
  // Петров: 4 ученика (с перекрытием)
  for (const s of createdStudents.slice(3, 7)) {
    await db.insert(teacherStudents).values({ teacherId: teacher2.id, studentId: s.id });
  }
  // Демо-учитель: все
  for (const s of createdStudents) {
    await db.insert(teacherStudents).values({ teacherId: teacher3.id, studentId: s.id }).catch(() => {});
  }
  console.log("  ✓ Ученики привязаны к учителям");

  // ── Тест 1: Информатика — Основы программирования ─────────
  const [test1] = await db.insert(tests).values({
    title: "Основы программирования на Python",
    description: "Тест проверяет знание базовых концепций языка Python: типы данных, циклы, функции.",
    subject: "Информатика",
    teacherId: teacher1.id,
    timeLimitMinutes: 20,
    isPublished: true,
    isCompetitive: false,
  }).returning();

  const t1questions = [
    {
      type: "single_choice" as const,
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
      type: "single_choice" as const,
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
      type: "multiple_choice" as const,
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
      type: "single_choice" as const,
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
      type: "open_answer" as const,
      text: "Объясните разницу между списком (list) и кортежем (tuple) в Python.",
      points: 3,
      correctAnswer: "Список (list) — изменяемый (mutable) упорядоченный набор элементов, элементы можно добавлять, удалять и изменять. Кортеж (tuple) — неизменяемый (immutable) упорядоченный набор, после создания его нельзя изменить.",
      orderIndex: 4,
      options: [],
    },
  ];

  for (const q of t1questions) {
    const [newQ] = await db.insert(questions).values({
      testId: test1.id, type: q.type, text: q.text,
      points: q.points, correctAnswer: q.correctAnswer, orderIndex: q.orderIndex,
    }).returning();
    for (let i = 0; i < q.options.length; i++) {
      await db.insert(questionOptions).values({ questionId: newQ.id, text: q.options[i].text, isCorrect: q.options[i].isCorrect, orderIndex: i });
    }
  }
  console.log(`  ✓ Тест 1: "${test1.title}"`);

  // ── Тест 2: Математика — Линейная алгебра ─────────────────
  const [test2] = await db.insert(tests).values({
    title: "Линейная алгебра: матрицы и векторы",
    description: "Проверка знаний по операциям с матрицами, определителям и собственным значениям.",
    subject: "Математика",
    teacherId: teacher1.id,
    timeLimitMinutes: 30,
    isPublished: true,
    isCompetitive: true,
  }).returning();

  const t2questions = [
    {
      type: "single_choice" as const,
      text: "Матрица называется квадратной, если...",
      points: 1, correctAnswer: null, orderIndex: 0,
      options: [
        { text: "число строк равно числу столбцов", isCorrect: true },
        { text: "все элементы равны нулю", isCorrect: false },
        { text: "она симметрична относительно главной диагонали", isCorrect: false },
        { text: "определитель равен 1", isCorrect: false },
      ],
    },
    {
      type: "single_choice" as const,
      text: "Чему равен определитель единичной матрицы любого порядка?",
      points: 1, correctAnswer: null, orderIndex: 1,
      options: [
        { text: "0", isCorrect: false },
        { text: "1", isCorrect: true },
        { text: "-1", isCorrect: false },
        { text: "n (порядок матрицы)", isCorrect: false },
      ],
    },
    {
      type: "multiple_choice" as const,
      text: "Какие свойства справедливы для умножения матриц?",
      points: 2, correctAnswer: null, orderIndex: 2,
      options: [
        { text: "Ассоциативность: (AB)C = A(BC)", isCorrect: true },
        { text: "Коммутативность: AB = BA", isCorrect: false },
        { text: "Дистрибутивность: A(B+C) = AB+AC", isCorrect: true },
        { text: "Существование нейтрального элемента (единичная матрица)", isCorrect: true },
      ],
    },
    {
      type: "open_answer" as const,
      text: "Что такое собственное значение матрицы? Запишите определение.",
      points: 3,
      correctAnswer: "Число λ называется собственным значением матрицы A, если существует ненулевой вектор x такой, что Ax = λx. Такой вектор x называется собственным вектором матрицы A, соответствующим собственному значению λ.",
      orderIndex: 3, options: [],
    },
  ];

  for (const q of t2questions) {
    const [newQ] = await db.insert(questions).values({
      testId: test2.id, type: q.type, text: q.text,
      points: q.points, correctAnswer: q.correctAnswer, orderIndex: q.orderIndex,
    }).returning();
    for (let i = 0; i < q.options.length; i++) {
      await db.insert(questionOptions).values({ questionId: newQ.id, text: q.options[i].text, isCorrect: q.options[i].isCorrect, orderIndex: i });
    }
  }
  console.log(`  ✓ Тест 2: "${test2.title}"`);

  // ── Тест 3: Базы данных ────────────────────────────────────
  const [test3] = await db.insert(tests).values({
    title: "Реляционные базы данных и SQL",
    description: "Тест на знание основ реляционных БД, SQL-запросов и нормализации.",
    subject: "Базы данных",
    teacherId: teacher2.id,
    timeLimitMinutes: 25,
    isPublished: true,
    isCompetitive: false,
  }).returning();

  const t3questions = [
    {
      type: "single_choice" as const,
      text: "Какой SQL-оператор используется для выборки данных из таблицы?",
      points: 1, correctAnswer: null, orderIndex: 0,
      options: [
        { text: "SELECT", isCorrect: true },
        { text: "GET", isCorrect: false },
        { text: "FETCH", isCorrect: false },
        { text: "READ", isCorrect: false },
      ],
    },
    {
      type: "single_choice" as const,
      text: "Что такое первичный ключ (PRIMARY KEY)?",
      points: 1, correctAnswer: null, orderIndex: 1,
      options: [
        { text: "Столбец или набор столбцов, однозначно идентифицирующий каждую строку таблицы", isCorrect: true },
        { text: "Внешняя ссылка на другую таблицу", isCorrect: false },
        { text: "Индекс для ускорения поиска", isCorrect: false },
        { text: "Обязательное поле таблицы", isCorrect: false },
      ],
    },
    {
      type: "multiple_choice" as const,
      text: "Какие из перечисленных являются агрегатными функциями SQL?",
      points: 2, correctAnswer: null, orderIndex: 2,
      options: [
        { text: "COUNT()", isCorrect: true },
        { text: "SUM()", isCorrect: true },
        { text: "UPPER()", isCorrect: false },
        { text: "AVG()", isCorrect: true },
      ],
    },
    {
      type: "single_choice" as const,
      text: "В какой нормальной форме таблица, если каждый неключевой атрибут функционально зависит от всего первичного ключа?",
      points: 1, correctAnswer: null, orderIndex: 3,
      options: [
        { text: "1НФ", isCorrect: false },
        { text: "2НФ", isCorrect: true },
        { text: "3НФ", isCorrect: false },
        { text: "НФБК", isCorrect: false },
      ],
    },
    {
      type: "open_answer" as const,
      text: "Объясните разницу между операторами INNER JOIN и LEFT JOIN.",
      points: 3,
      correctAnswer: "INNER JOIN возвращает только те строки, для которых есть совпадения в обеих таблицах. LEFT JOIN возвращает все строки из левой таблицы и совпадающие строки из правой; если совпадений нет — правая часть заполняется NULL.",
      orderIndex: 4, options: [],
    },
  ];

  for (const q of t3questions) {
    const [newQ] = await db.insert(questions).values({
      testId: test3.id, type: q.type, text: q.text,
      points: q.points, correctAnswer: q.correctAnswer, orderIndex: q.orderIndex,
    }).returning();
    for (let i = 0; i < q.options.length; i++) {
      await db.insert(questionOptions).values({ questionId: newQ.id, text: q.options[i].text, isCorrect: q.options[i].isCorrect, orderIndex: i });
    }
  }
  console.log(`  ✓ Тест 3: "${test3.title}"`);

  // ── Тест 4: Сети (учитель2) ────────────────────────────────
  const [test4] = await db.insert(tests).values({
    title: "Компьютерные сети и протоколы",
    description: "Проверка знаний сетевых моделей OSI/TCP-IP, протоколов и адресации.",
    subject: "Компьютерные сети",
    teacherId: teacher2.id,
    timeLimitMinutes: 20,
    isPublished: true,
    isCompetitive: true,
  }).returning();

  const t4questions = [
    {
      type: "single_choice" as const,
      text: "Сколько уровней содержит модель OSI?",
      points: 1, correctAnswer: null, orderIndex: 0,
      options: [
        { text: "4", isCorrect: false },
        { text: "5", isCorrect: false },
        { text: "7", isCorrect: true },
        { text: "10", isCorrect: false },
      ],
    },
    {
      type: "single_choice" as const,
      text: "Какой протокол обеспечивает надёжную передачу данных с установлением соединения?",
      points: 1, correctAnswer: null, orderIndex: 1,
      options: [
        { text: "UDP", isCorrect: false },
        { text: "TCP", isCorrect: true },
        { text: "IP", isCorrect: false },
        { text: "ICMP", isCorrect: false },
      ],
    },
    {
      type: "multiple_choice" as const,
      text: "Какие протоколы работают на прикладном уровне модели OSI?",
      points: 2, correctAnswer: null, orderIndex: 2,
      options: [
        { text: "HTTP", isCorrect: true },
        { text: "FTP", isCorrect: true },
        { text: "IP", isCorrect: false },
        { text: "SMTP", isCorrect: true },
      ],
    },
    {
      type: "open_answer" as const,
      text: "Что такое IP-адрес и для чего он используется в компьютерных сетях?",
      points: 3,
      correctAnswer: "IP-адрес (Internet Protocol address) — уникальный числовой идентификатор устройства в компьютерной сети. Используется для адресации и маршрутизации пакетов данных между устройствами. IPv4-адрес состоит из 32 бит (4 октета), IPv6 — из 128 бит.",
      orderIndex: 3, options: [],
    },
  ];

  for (const q of t4questions) {
    const [newQ] = await db.insert(questions).values({
      testId: test4.id, type: q.type, text: q.text,
      points: q.points, correctAnswer: q.correctAnswer, orderIndex: q.orderIndex,
    }).returning();
    for (let i = 0; i < q.options.length; i++) {
      await db.insert(questionOptions).values({ questionId: newQ.id, text: q.options[i].text, isCorrect: q.options[i].isCorrect, orderIndex: i });
    }
  }
  console.log(`  ✓ Тест 4: "${test4.title}"`);

  console.log("\n✅ База данных успешно заполнена!");
}

seed().catch((e) => { console.error(e); process.exit(1); });
