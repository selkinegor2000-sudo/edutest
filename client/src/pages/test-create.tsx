import { useState } from "react";
import { useLocation } from "wouter";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Plus, 
  Trash2, 
  ArrowLeft, 
  Save, 
  BookOpen,
  ListChecks,
  CheckSquare,
  MessageSquare,
  GripVertical,
  Loader2,
  Image,
  Video
} from "lucide-react";
import { Link } from "wouter";
import { Checkbox } from "@/components/ui/checkbox";

const questionSchema = z.object({
  type: z.enum(["single_choice", "multiple_choice", "open_answer"]),
  text: z.string().min(1, "Введите текст вопроса"),
  points: z.number().min(1).default(1),
  topic: z.string().optional(),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
  correctAnswer: z.string().optional(),
  rubricCriteria: z.array(z.string()).optional(),
  imageUrl: z.string().optional(),
  videoUrl: z.string().optional(),
  options: z.array(z.object({
    text: z.string().min(1, "Введите текст варианта"),
    isCorrect: z.boolean().default(false),
  })).optional(),
});

const testSchema = z.object({
  title: z.string().min(1, "Введите название теста"),
  description: z.string().optional(),
  subject: z.string().min(1, "Введите предмет"),
  timeLimitMinutes: z.number().min(1).max(180).default(30),
  isPublished: z.boolean().default(false),
  isCompetitive: z.boolean().default(false),
  isAdaptive: z.boolean().default(false),
  isTemplate: z.boolean().default(false),
  templateCategory: z.string().optional(),
  scheduledAt: z.string().optional(),
  questions: z.array(questionSchema).min(1, "Добавьте хотя бы один вопрос"),
});

type TestFormData = z.infer<typeof testSchema>;

export default function TestCreatePage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState(1);

  const form = useForm<TestFormData>({
    resolver: zodResolver(testSchema),
    defaultValues: {
      title: "",
      description: "",
      subject: "",
      timeLimitMinutes: 30,
      isPublished: false,
      isCompetitive: false,
      isAdaptive: false,
      isTemplate: false,
      templateCategory: "",
      scheduledAt: "",
      questions: [],
    },
  });

  const { fields, append, remove, move } = useFieldArray({
    control: form.control,
    name: "questions",
  });

  const createTestMutation = useMutation({
    mutationFn: async (data: TestFormData) => {
      const response = await apiRequest("POST", "/api/tests", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tests/my"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats/teacher"] });
      toast({
        title: "Тест создан",
        description: "Тест успешно сохранен",
      });
      setLocation("/");
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось создать тест",
        variant: "destructive",
      });
    },
  });

  function addQuestion(type: "single_choice" | "multiple_choice" | "open_answer") {
    const baseQuestion = {
      type,
      text: "",
      points: 1,
      topic: "",
      difficulty: "medium" as const,
      correctAnswer: "",
      rubricCriteria: [],
      imageUrl: "",
      videoUrl: "",
      options: type !== "open_answer" 
        ? [
            { text: "", isCorrect: false },
            { text: "", isCorrect: false },
          ]
        : undefined,
    };
    append(baseQuestion);
  }

  function onSubmit(data: TestFormData) {
    createTestMutation.mutate(data);
  }

  const getQuestionTypeIcon = (type: string) => {
    switch (type) {
      case "single_choice":
        return <ListChecks className="h-4 w-4" />;
      case "multiple_choice":
        return <CheckSquare className="h-4 w-4" />;
      case "open_answer":
        return <MessageSquare className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getQuestionTypeLabel = (type: string) => {
    switch (type) {
      case "single_choice":
        return "Один ответ";
      case "multiple_choice":
        return "Несколько ответов";
      case "open_answer":
        return "Открытый ответ";
      default:
        return type;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Создание теста</h1>
          <p className="text-muted-foreground">
            Заполните информацию о тесте и добавьте вопросы
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-6">
        <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${step >= 1 ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
          <span className="font-medium">1</span>
          <span className="hidden sm:inline">Основные данные</span>
        </div>
        <div className="h-px w-8 bg-muted" />
        <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${step >= 2 ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
          <span className="font-medium">2</span>
          <span className="hidden sm:inline">Вопросы</span>
        </div>
        <div className="h-px w-8 bg-muted" />
        <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${step >= 3 ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
          <span className="font-medium">3</span>
          <span className="hidden sm:inline">Публикация</span>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {step === 1 && (
            <Card>
              <CardHeader>
                <CardTitle>Основная информация</CardTitle>
                <CardDescription>
                  Укажите название, предмет и время на тест
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Название теста</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Например: Контрольная работа №1"
                          data-testid="input-test-title"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="subject"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Предмет</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Например: Программирование"
                          data-testid="input-test-subject"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Описание (необязательно)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Опишите тест для студентов"
                          data-testid="input-test-description"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="timeLimitMinutes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Время на тест (минут)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          max={180}
                          data-testid="input-test-time"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                        />
                      </FormControl>
                      <FormDescription>
                        От 1 до 180 минут
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end pt-4">
                  <Button type="button" onClick={() => setStep(2)} data-testid="button-next-step">
                    Далее: Вопросы
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {step === 2 && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Вопросы теста</CardTitle>
                  <CardDescription>
                    Добавьте вопросы разных типов
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2 mb-6">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => addQuestion("single_choice")}
                      data-testid="button-add-single-choice"
                    >
                      <ListChecks className="mr-2 h-4 w-4" />
                      Один ответ
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => addQuestion("multiple_choice")}
                      data-testid="button-add-multiple-choice"
                    >
                      <CheckSquare className="mr-2 h-4 w-4" />
                      Несколько ответов
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => addQuestion("open_answer")}
                      data-testid="button-add-open-answer"
                    >
                      <MessageSquare className="mr-2 h-4 w-4" />
                      Открытый ответ
                    </Button>
                  </div>

                  {fields.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed rounded-lg">
                      <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
                      <h3 className="font-medium text-lg">Нет вопросов</h3>
                      <p className="text-muted-foreground">
                        Добавьте вопросы с помощью кнопок выше
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {fields.map((field, index) => (
                        <Card key={field.id} className="relative">
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between gap-4">
                              <div className="flex items-center gap-2">
                                <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab" />
                                <Badge variant="secondary">
                                  {getQuestionTypeIcon(field.type)}
                                  <span className="ml-1">{getQuestionTypeLabel(field.type)}</span>
                                </Badge>
                                <span className="text-sm text-muted-foreground">
                                  Вопрос {index + 1}
                                </span>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => remove(index)}
                                data-testid={`button-remove-question-${index}`}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <FormField
                              control={form.control}
                              name={`questions.${index}.text`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Текст вопроса</FormLabel>
                                  <FormControl>
                                    <Textarea
                                      placeholder="Введите вопрос"
                                      data-testid={`input-question-text-${index}`}
                                      {...field}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name={`questions.${index}.points`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Баллы за вопрос</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      min={1}
                                      className="w-24"
                                      data-testid={`input-question-points-${index}`}
                                      {...field}
                                      onChange={(e) => field.onChange(parseInt(e.target.value))}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <div className="grid gap-4 sm:grid-cols-2">
                              <FormField
                                control={form.control}
                                name={`questions.${index}.topic`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Тема вопроса</FormLabel>
                                    <FormControl>
                                      <Input placeholder="Например: JOIN, Производные, Циклы" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name={`questions.${index}.difficulty`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Сложность</FormLabel>
                                    <Select value={field.value} onValueChange={field.onChange}>
                                      <FormControl>
                                        <SelectTrigger>
                                          <SelectValue />
                                        </SelectTrigger>
                                      </FormControl>
                                      <SelectContent>
                                        <SelectItem value="easy">Лёгкий</SelectItem>
                                        <SelectItem value="medium">Средний</SelectItem>
                                        <SelectItem value="hard">Сложный</SelectItem>
                                      </SelectContent>
                                    </Select>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2">
                              <FormField
                                control={form.control}
                                name={`questions.${index}.imageUrl`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="flex items-center gap-2">
                                      <Image className="h-4 w-4" />
                                      URL изображения
                                    </FormLabel>
                                    <FormControl>
                                      <Input
                                        placeholder="https://example.com/image.jpg"
                                        data-testid={`input-question-image-${index}`}
                                        {...field}
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name={`questions.${index}.videoUrl`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="flex items-center gap-2">
                                      <Video className="h-4 w-4" />
                                      URL видео (YouTube/Vimeo)
                                    </FormLabel>
                                    <FormControl>
                                      <Input
                                        placeholder="https://youtube.com/watch?v=..."
                                        data-testid={`input-question-video-${index}`}
                                        {...field}
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>

                            {(form.watch(`questions.${index}.type`) === "single_choice" ||
                              form.watch(`questions.${index}.type`) === "multiple_choice") && (
                              <QuestionOptionsEditor
                                control={form.control}
                                questionIndex={index}
                                questionType={form.watch(`questions.${index}.type`)}
                              />
                            )}

                            {form.watch(`questions.${index}.type`) === "open_answer" && (
                              <div className="space-y-4">
                                <FormField
                                  control={form.control}
                                  name={`questions.${index}.correctAnswer`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Эталонный ответ (для AI-проверки)</FormLabel>
                                      <FormControl>
                                        <Textarea
                                          placeholder="Введите эталонный ответ, который будет использован AI для оценки"
                                          data-testid={`input-question-correct-answer-${index}`}
                                          {...field}
                                        />
                                      </FormControl>
                                      <FormDescription>
                                        AI будет сравнивать ответ студента с этим эталоном
                                      </FormDescription>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                                <FormField
                                  control={form.control}
                                  name={`questions.${index}.rubricCriteria`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Рубрика оценивания</FormLabel>
                                      <FormControl>
                                        <Textarea
                                          value={(field.value || []).join("\n")}
                                          onChange={(event) => field.onChange(event.target.value.split("\n").map((item) => item.trim()).filter(Boolean))}
                                          placeholder="Каждый критерий с новой строки: полнота, терминология, аргументация"
                                        />
                                      </FormControl>
                                      <FormDescription>
                                        Эти критерии будут использоваться AI при проверке открытого ответа.
                                      </FormDescription>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="flex justify-between">
                <Button type="button" variant="outline" onClick={() => setStep(1)}>
                  Назад
                </Button>
                <Button 
                  type="button" 
                  onClick={() => setStep(3)}
                  disabled={fields.length === 0}
                  data-testid="button-next-to-publish"
                >
                  Далее: Публикация
                </Button>
              </div>
            </>
          )}

          {step === 3 && (
            <Card>
              <CardHeader>
                <CardTitle>Публикация теста</CardTitle>
                <CardDescription>
                  Проверьте данные и опубликуйте тест
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Название</p>
                    <p className="text-muted-foreground">{form.watch("title") || "Не указано"}</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Предмет</p>
                    <p className="text-muted-foreground">{form.watch("subject") || "Не указано"}</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Время</p>
                    <p className="text-muted-foreground">{form.watch("timeLimitMinutes")} минут</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Вопросов</p>
                    <p className="text-muted-foreground">{fields.length}</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Расписание</p>
                    <p className="text-muted-foreground">
                      {form.watch("scheduledAt") ? new Date(form.watch("scheduledAt") as string).toLocaleString("ru-RU") : "Сразу после публикации"}
                    </p>
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="isPublished"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">
                          Опубликовать тест
                        </FormLabel>
                        <FormDescription>
                          Опубликованный тест будет доступен студентам для прохождения
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-publish"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="isCompetitive"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">
                          Соревновательный режим
                        </FormLabel>
                        <FormDescription>
                          Показывать рейтинг студентов после завершения теста
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-competitive"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="isAdaptive"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">
                          Адаптивный режим
                        </FormLabel>
                        <FormDescription>
                          Следующий вопрос будет подбираться по текущему уровню ответа студента.
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="isTemplate"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">
                          Сохранить как шаблон
                        </FormLabel>
                        <FormDescription>
                          Такой тест не появится у студентов, но будет доступен в органайзере преподавателя.
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {form.watch("isTemplate") && (
                  <FormField
                    control={form.control}
                    name="templateCategory"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Категория шаблона</FormLabel>
                        <FormControl>
                          <Input placeholder="Например: Контрольные, Практика, Экзамен" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name="scheduledAt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Дата и время публикации</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} />
                      </FormControl>
                      <FormDescription>
                        Оставьте пустым, чтобы тест был доступен сразу после публикации.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-between pt-4">
                  <Button type="button" variant="outline" onClick={() => setStep(2)}>
                    Назад
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createTestMutation.isPending}
                    data-testid="button-save-test"
                  >
                    {createTestMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Сохранение...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Сохранить тест
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </form>
      </Form>
    </div>
  );
}

function QuestionOptionsEditor({ 
  control, 
  questionIndex,
  questionType
}: { 
  control: any; 
  questionIndex: number;
  questionType: string;
}) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: `questions.${questionIndex}.options`,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <FormLabel>Варианты ответов</FormLabel>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => append({ text: "", isCorrect: false })}
          data-testid={`button-add-option-${questionIndex}`}
        >
          <Plus className="mr-2 h-4 w-4" />
          Добавить вариант
        </Button>
      </div>

      <div className="space-y-3">
        {fields.map((field, optionIndex) => (
          <div key={field.id} className="flex items-center gap-3">
            <FormField
              control={control}
              name={`questions.${questionIndex}.options.${optionIndex}.isCorrect`}
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-testid={`checkbox-option-correct-${questionIndex}-${optionIndex}`}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name={`questions.${questionIndex}.options.${optionIndex}.text`}
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormControl>
                    <Input
                      placeholder={`Вариант ${optionIndex + 1}`}
                      data-testid={`input-option-text-${questionIndex}-${optionIndex}`}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {fields.length > 2 && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => remove(optionIndex)}
                data-testid={`button-remove-option-${questionIndex}-${optionIndex}`}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </div>
        ))}
      </div>
      
      <p className="text-xs text-muted-foreground">
        {questionType === "single_choice" 
          ? "Отметьте один правильный вариант"
          : "Отметьте все правильные варианты"}
      </p>
    </div>
  );
}
