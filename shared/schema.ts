import { relations } from "drizzle-orm";
import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = sqliteTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("full_name").notNull(),
  role: text("role", { enum: ["student", "teacher"] }).notNull().default("student"),
  photoUrl: text("photo_url"),
  hobbies: text("hobbies"),
  wishes: text("wishes"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const tests = sqliteTable("tests", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  title: text("title").notNull(),
  description: text("description"),
  subject: text("subject").notNull(),
  teacherId: text("teacher_id").notNull().references(() => users.id),
  timeLimitMinutes: integer("time_limit_minutes").notNull().default(30),
  isPublished: integer("is_published", { mode: "boolean" }).notNull().default(false),
  isCompetitive: integer("is_competitive", { mode: "boolean" }).notNull().default(false),
  isAdaptive: integer("is_adaptive", { mode: "boolean" }).default(false),
  isTemplate: integer("is_template", { mode: "boolean" }).default(false),
  templateCategory: text("template_category"),
  scheduledAt: integer("scheduled_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const questions = sqliteTable("questions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  testId: text("test_id").notNull().references(() => tests.id, { onDelete: "cascade" }),
  type: text("type", { enum: ["single_choice", "multiple_choice", "open_answer"] }).notNull(),
  text: text("text").notNull(),
  points: integer("points").notNull().default(1),
  topic: text("topic"),
  difficulty: text("difficulty", { enum: ["easy", "medium", "hard"] }).default("medium"),
  correctAnswer: text("correct_answer"),
  rubricCriteria: text("rubric_criteria", { mode: "json" }).$type<string[] | null>(),
  orderIndex: integer("order_index").notNull().default(0),
  imageUrl: text("image_url"),
  videoUrl: text("video_url"),
});

export const questionOptions = sqliteTable("question_options", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  questionId: text("question_id").notNull().references(() => questions.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  isCorrect: integer("is_correct", { mode: "boolean" }).notNull().default(false),
  orderIndex: integer("order_index").notNull().default(0),
});

export const testAttempts = sqliteTable("test_attempts", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  testId: text("test_id").notNull().references(() => tests.id),
  studentId: text("student_id").notNull().references(() => users.id),
  status: text("status", { enum: ["in_progress", "completed", "expired"] }).notNull().default("in_progress"),
  startedAt: integer("started_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  completedAt: integer("completed_at", { mode: "timestamp" }),
  score: real("score"),
  maxScore: integer("max_score"),
  proctorScore: real("proctor_score"),
  suspiciousEventsCount: integer("suspicious_events_count").default(0),
  proctorSummary: text("proctor_summary"),
  savedAnswers: text("saved_answers", { mode: "json" }),
});

export const answers = sqliteTable("answers", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  attemptId: text("attempt_id").notNull().references(() => testAttempts.id, { onDelete: "cascade" }),
  questionId: text("question_id").notNull().references(() => questions.id),
  answerText: text("answer_text"),
  selectedOptionIds: text("selected_option_ids", { mode: "json" }).$type<string[]>(),
  isCorrect: integer("is_correct", { mode: "boolean" }),
  pointsAwarded: real("points_awarded"),
  aiEvaluation: text("ai_evaluation"),
  aiFeedback: text("ai_feedback"),
});

export const teacherStudents = sqliteTable("teacher_students", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  teacherId: text("teacher_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  studentId: text("student_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  addedAt: integer("added_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const studentGroups = sqliteTable("student_groups", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  teacherId: text("teacher_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const groupMembers = sqliteTable("group_members", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  groupId: text("group_id").notNull().references(() => studentGroups.id, { onDelete: "cascade" }),
  studentId: text("student_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  addedAt: integer("added_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const testAssignments = sqliteTable("test_assignments", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  testId: text("test_id").notNull().references(() => tests.id, { onDelete: "cascade" }),
  studentId: text("student_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  groupId: text("group_id").references(() => studentGroups.id, { onDelete: "set null" }),
  assignedByTeacherId: text("assigned_by_teacher_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  dueAt: integer("due_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const messages = sqliteTable("messages", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  fromUserId: text("from_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  toUserId: text("to_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  readAt: integer("read_at", { mode: "timestamp" }),
});

export const notifications = sqliteTable("notifications", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  body: text("body").notNull(),
  link: text("link"),
  type: text("type").notNull().default("info"),
  isRead: integer("is_read", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const learningMaterials = sqliteTable("learning_materials", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  teacherId: text("teacher_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  materialType: text("material_type", { enum: ["book", "manual", "trainer_test", "test_import"] }).notNull().default("manual"),
  fileName: text("file_name").notNull(),
  filePath: text("file_path"),
  mimeType: text("mime_type"),
  extractedContent: text("extracted_content"),
  aiSummary: text("ai_summary"),
  aiKeywords: text("ai_keywords", { mode: "json" }).$type<string[] | null>(),
  aiDifficulty: text("ai_difficulty"),
  linkedTestId: text("linked_test_id").references(() => tests.id, { onDelete: "set null" }),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const proctorEvents = sqliteTable("proctor_events", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  attemptId: text("attempt_id").notNull().references(() => testAttempts.id, { onDelete: "cascade" }),
  eventType: text("event_type").notNull(),
  details: text("details"),
  idleSeconds: integer("idle_seconds"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const teacherStudentsRelations = relations(teacherStudents, ({ one }) => ({
  teacher: one(users, {
    fields: [teacherStudents.teacherId],
    references: [users.id],
  }),
  student: one(users, {
    fields: [teacherStudents.studentId],
    references: [users.id],
  }),
}));

export const studentGroupsRelations = relations(studentGroups, ({ one, many }) => ({
  teacher: one(users, {
    fields: [studentGroups.teacherId],
    references: [users.id],
  }),
  members: many(groupMembers),
  assignments: many(testAssignments),
}));

export const groupMembersRelations = relations(groupMembers, ({ one }) => ({
  group: one(studentGroups, {
    fields: [groupMembers.groupId],
    references: [studentGroups.id],
  }),
  student: one(users, {
    fields: [groupMembers.studentId],
    references: [users.id],
  }),
}));

export const testAssignmentsRelations = relations(testAssignments, ({ one }) => ({
  test: one(tests, {
    fields: [testAssignments.testId],
    references: [tests.id],
  }),
  student: one(users, {
    fields: [testAssignments.studentId],
    references: [users.id],
  }),
  group: one(studentGroups, {
    fields: [testAssignments.groupId],
    references: [studentGroups.id],
  }),
  teacher: one(users, {
    fields: [testAssignments.assignedByTeacherId],
    references: [users.id],
  }),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  fromUser: one(users, {
    fields: [messages.fromUserId],
    references: [users.id],
  }),
  toUser: one(users, {
    fields: [messages.toUserId],
    references: [users.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));

export const learningMaterialsRelations = relations(learningMaterials, ({ one }) => ({
  teacher: one(users, {
    fields: [learningMaterials.teacherId],
    references: [users.id],
  }),
  linkedTest: one(tests, {
    fields: [learningMaterials.linkedTestId],
    references: [tests.id],
  }),
}));

export const proctorEventsRelations = relations(proctorEvents, ({ one }) => ({
  attempt: one(testAttempts, {
    fields: [proctorEvents.attemptId],
    references: [testAttempts.id],
  }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  createdTests: many(tests),
  testAttempts: many(testAttempts),
  studentsAsTeacher: many(teacherStudents),
  groups: many(studentGroups),
  messagesSent: many(messages),
  notifications: many(notifications),
  learningMaterials: many(learningMaterials),
}));

export const testsRelations = relations(tests, ({ one, many }) => ({
  teacher: one(users, {
    fields: [tests.teacherId],
    references: [users.id],
  }),
  questions: many(questions),
  attempts: many(testAttempts),
  assignments: many(testAssignments),
  materials: many(learningMaterials),
}));

export const questionsRelations = relations(questions, ({ one, many }) => ({
  test: one(tests, {
    fields: [questions.testId],
    references: [tests.id],
  }),
  options: many(questionOptions),
  answers: many(answers),
}));

export const questionOptionsRelations = relations(questionOptions, ({ one }) => ({
  question: one(questions, {
    fields: [questionOptions.questionId],
    references: [questions.id],
  }),
}));

export const testAttemptsRelations = relations(testAttempts, ({ one, many }) => ({
  test: one(tests, {
    fields: [testAttempts.testId],
    references: [tests.id],
  }),
  student: one(users, {
    fields: [testAttempts.studentId],
    references: [users.id],
  }),
  answers: many(answers),
  proctorEvents: many(proctorEvents),
}));

export const answersRelations = relations(answers, ({ one }) => ({
  attempt: one(testAttempts, {
    fields: [answers.attemptId],
    references: [testAttempts.id],
  }),
  question: one(questions, {
    fields: [answers.questionId],
    references: [questions.id],
  }),
}));

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertTestSchema = createInsertSchema(tests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertQuestionSchema = createInsertSchema(questions).omit({
  id: true,
});

export const insertQuestionOptionSchema = createInsertSchema(questionOptions).omit({
  id: true,
});

export const insertTestAttemptSchema = createInsertSchema(testAttempts).omit({
  id: true,
  startedAt: true,
  completedAt: true,
  score: true,
  maxScore: true,
});

export const insertAnswerSchema = createInsertSchema(answers).omit({
  id: true,
});

export const insertTeacherStudentSchema = createInsertSchema(teacherStudents).omit({
  id: true,
  addedAt: true,
});

export const insertStudentGroupSchema = createInsertSchema(studentGroups).omit({
  id: true,
  createdAt: true,
});

export const insertGroupMemberSchema = createInsertSchema(groupMembers).omit({
  id: true,
  addedAt: true,
});

export const insertTestAssignmentSchema = createInsertSchema(testAssignments).omit({
  id: true,
  createdAt: true,
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
  readAt: true,
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
});

export const insertLearningMaterialSchema = createInsertSchema(learningMaterials).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProctorEventSchema = createInsertSchema(proctorEvents).omit({
  id: true,
  createdAt: true,
});

export const loginSchema = z.object({
  username: z.string().min(3, "Логин должен содержать минимум 3 символа"),
  password: z.string().min(6, "Пароль должен содержать минимум 6 символов"),
});

export const registerSchema = insertUserSchema.extend({
  username: z.string().min(3, "Логин должен содержать минимум 3 символа"),
  password: z.string().min(6, "Пароль должен содержать минимум 6 символов"),
  fullName: z.string().min(2, "ФИО должно содержать минимум 2 символа"),
  role: z.enum(["student", "teacher"]),
});

export const updateProfileSchema = z.object({
  fullName: z.string().min(2, "ФИО должно содержать минимум 2 символа").optional(),
  photoUrl: z.string().nullable().optional(),
  hobbies: z.string().nullable().optional(),
  wishes: z.string().nullable().optional(),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertTest = z.infer<typeof insertTestSchema>;
export type Test = typeof tests.$inferSelect;
export type InsertQuestion = z.infer<typeof insertQuestionSchema>;
export type Question = typeof questions.$inferSelect;
export type InsertQuestionOption = z.infer<typeof insertQuestionOptionSchema>;
export type QuestionOption = typeof questionOptions.$inferSelect;
export type InsertTestAttempt = z.infer<typeof insertTestAttemptSchema>;
export type TestAttempt = typeof testAttempts.$inferSelect;
export type InsertAnswer = z.infer<typeof insertAnswerSchema>;
export type Answer = typeof answers.$inferSelect;
export type InsertTeacherStudent = z.infer<typeof insertTeacherStudentSchema>;
export type TeacherStudent = typeof teacherStudents.$inferSelect;
export type InsertStudentGroup = z.infer<typeof insertStudentGroupSchema>;
export type StudentGroup = typeof studentGroups.$inferSelect;
export type InsertGroupMember = z.infer<typeof insertGroupMemberSchema>;
export type GroupMember = typeof groupMembers.$inferSelect;
export type InsertTestAssignment = z.infer<typeof insertTestAssignmentSchema>;
export type TestAssignment = typeof testAssignments.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;
export type InsertLearningMaterial = z.infer<typeof insertLearningMaterialSchema>;
export type LearningMaterial = typeof learningMaterials.$inferSelect;
export type InsertProctorEvent = z.infer<typeof insertProctorEventSchema>;
export type ProctorEvent = typeof proctorEvents.$inferSelect;

export type TestWithQuestions = Test & {
  questions: (Question & { options: QuestionOption[] })[];
  teacher?: User;
};

export type AttemptWithDetails = TestAttempt & {
  test: Test;
  answers: Answer[];
};

export type QuestionWithOptions = Question & {
  options: QuestionOption[];
};
