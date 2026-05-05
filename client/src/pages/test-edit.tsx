import { useState, useEffect } from "react";
import { useParams, useLocation, Link } from "wouter";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
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
import { TestWithQuestions } from "@shared/schema";

const questionSchema = z.object({
  id: z.string().optional(),
  type: z.enum(["single_choice", "multiple_choice", "open_answer"]),
  text: z.string().min(1, "Введите текст вопроса"),
  points: z.number().min(1).default(1),
  correctAnswer: z.string().optional(),
  imageUrl: z.string().optional(),
  videoUrl: z.string().optional(),
  options: z.array(z.object({
    id: z.string().optional(),
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
  questions: z.array(questionSchema).min(1, "Добавьте хотя бы один вопрос"),
});

type TestFormData = z.infer<typeof testSchema>;

export default function TestEditPage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: test, isLoading } = useQuery<TestWithQuestions>({
    queryKey: ["/api/tests", id, "full"],
  });

  const form = useForm<TestFormData>({
    resolver: zodResolver(testSchema),
    defaultValues: {
      title: "",
      description: "",
      subject: "",
      timeLimitMinutes: 30,
      isPublished: false,
      isCompetitive: false,
      questions: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "questions",
  });

  useEffect(() => {
    if (test) {
      form.reset({
        title: test.title,
        description: test.description || "",
        subject: test.subject,
        timeLimitMinutes: test.timeLimitMinutes,
        isPublished: test.isPublished,
        isCompetitive: test.isCompetitive || false,
        questions: test.questions.map((q) => ({
          id: q.id,
          type: q.type,
          text: q.text,
          points: q.points,
          correctAnswer: q.correctAnswer || "",
          imageUrl: q.imageUrl || "",
          videoUrl: q.videoUrl || "",
          options: q.options?.map((o) => ({
            id: o.id,
            text: o.text,
            isCorrect: o.isCorrect,
          })),
        })),
      });
    }
  }, [test]);

  const updateTestMutation = useMutation({
    mutationFn: async (data: TestFormData) => {
      const response = await apiRequest("PUT", `/api/tests/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tests/my"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tests", id] });
      toast({
        title: "Тест обновлен",
        description: "Изменения успешно сохранены",
      });
      setLocation("/");
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось обновить тест",
        variant: "destructive",
      });
    },
  });

  function addQuestion(type: "single_choice" | "multiple_choice" | "open_answer") {
    const baseQuestion = {
      type,
      text: "",
      points: 1,
      correctAnswer: "",
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
    updateTestMutation.mutate(data);
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

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!test) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <h2 className="text-xl font-semibold mb-2">Тест не найден</h2>
        <Link href="/">
          <Button>Вернуться на главную</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Редактирование теста</h1>
          <p className="text-muted-foreground">{test.title}</p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Основная информация</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Название теста</FormLabel>
                    <FormControl>
                      <Input data-testid="input-edit-title" {...field} />
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
                      <Input data-testid="input-edit-subject" {...field} />
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
                    <FormLabel>Описание</FormLabel>
                    <FormControl>
                      <Textarea data-testid="input-edit-description" {...field} />
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
                        data-testid="input-edit-time"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isPublished"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Опубликован</FormLabel>
                      <FormDescription>
                        Опубликованный тест доступен студентам
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-edit-publish"
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
                      <FormLabel className="text-base">Соревновательный режим</FormLabel>
                      <FormDescription>
                        Показывать рейтинг студентов после завершения теста
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-edit-competitive"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Вопросы</CardTitle>
              <CardDescription>Добавьте и отредактируйте вопросы теста</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2 mb-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => addQuestion("single_choice")}
                  data-testid="button-edit-add-single"
                >
                  <ListChecks className="mr-2 h-4 w-4" />
                  Один ответ
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => addQuestion("multiple_choice")}
                  data-testid="button-edit-add-multiple"
                >
                  <CheckSquare className="mr-2 h-4 w-4" />
                  Несколько ответов
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => addQuestion("open_answer")}
                  data-testid="button-edit-add-open"
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
                    <Card key={field.id}>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-2">
                            <GripVertical className="h-5 w-5 text-muted-foreground" />
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
                            data-testid={`button-edit-remove-${index}`}
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
                                  data-testid={`input-edit-question-${index}`}
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
                              <FormLabel>Баллы</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min={1}
                                  className="w-24"
                                  data-testid={`input-edit-points-${index}`}
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
                                    data-testid={`input-edit-image-${index}`}
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
                                  URL видео
                                </FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="https://youtube.com/watch?v=..."
                                    data-testid={`input-edit-video-${index}`}
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
                          <FormField
                            control={form.control}
                            name={`questions.${index}.correctAnswer`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Эталонный ответ</FormLabel>
                                <FormControl>
                                  <Textarea
                                    data-testid={`input-edit-correct-${index}`}
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
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-end gap-4">
            <Link href="/">
              <Button type="button" variant="outline">
                Отмена
              </Button>
            </Link>
            <Button 
              type="submit" 
              disabled={updateTestMutation.isPending}
              data-testid="button-save-changes"
            >
              {updateTestMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Сохранение...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Сохранить изменения
                </>
              )}
            </Button>
          </div>
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
          data-testid={`button-edit-add-option-${questionIndex}`}
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
                      data-testid={`checkbox-edit-option-${questionIndex}-${optionIndex}`}
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
                      data-testid={`input-edit-option-${questionIndex}-${optionIndex}`}
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
                data-testid={`button-edit-remove-option-${questionIndex}-${optionIndex}`}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
