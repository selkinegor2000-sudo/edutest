import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Upload, FileText, Loader2, CheckCircle2, AlertCircle, ArrowLeft } from "lucide-react";
import { Link } from "wouter";

type GenerateTestPayload = {
  content: string;
  title: string;
  subject: string;
  difficulty: "easy" | "medium" | "hard";
  questionCount: number;
};

type GeneratedTest = {
  title: string;
  description: string;
  subject?: string;
  isAdaptive?: boolean;
  questions: Array<{
    text: string;
    type: "single_choice" | "multiple_choice" | "open_answer";
    points: number;
    topic?: string;
    difficulty?: "easy" | "medium" | "hard";
    rubricCriteria?: string[];
    correctAnswer?: string;
    options?: Array<{ text: string; isCorrect: boolean }>;
  }>;
};

export default function TestGeneratePage() {
  const { toast } = useToast();
  const [mode, setMode] = useState<"generate" | "import" | "url">("generate");
  const [step, setStep] = useState<"upload" | "preview" | "confirm">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const [extractedText, setExtractedText] = useState<string>("");
  const [testConfig, setTestConfig] = useState<Omit<GenerateTestPayload, "content">>({
    title: "",
    subject: "",
    difficulty: "medium",
    questionCount: 5,
  });
  const [generatedTest, setGeneratedTest] = useState<GeneratedTest | null>(null);
  const [importedTest, setImportedTest] = useState<GeneratedTest | null>(null);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) throw new Error("Ошибка загрузки файла");
      return response.json() as Promise<{ content: string }>;
    },
    onSuccess: (data) => {
      setExtractedText(data.content);
      setStep("preview");
      toast({ title: "Документ загружен", description: "Текст успешно извлечен" });
    },
    onError: () => {
      toast({ title: "Ошибка", description: "Не удалось обработать документ", variant: "destructive" });
    },
  });

  const generateMutation = useMutation({
    mutationFn: async (payload: GenerateTestPayload) => {
      const response = await apiRequest("POST", "/api/documents/generate-test", payload);
      return response.json() as Promise<GeneratedTest>;
    },
    onSuccess: (data) => {
      setGeneratedTest(data);
      setStep("confirm");
      toast({ title: "Тест создан", description: "Ии создал тест на основе документа" });
    },
    onError: () => {
      toast({ title: "Ошибка", description: "Не удалось создать тест", variant: "destructive" });
    },
  });

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", testConfig.title);
      formData.append("subject", testConfig.subject);
      const response = await fetch("/api/tests/import-ready", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!response.ok) throw new Error("Ошибка импорта теста");
      return response.json() as Promise<GeneratedTest>;
    },
    onSuccess: (data) => {
      setImportedTest(data);
      setGeneratedTest(null);
      setStep("confirm");
      toast({ title: "Тест импортирован", description: "Готовый тест переведен в веб-структуру" });
    },
    onError: () => {
      toast({ title: "Ошибка", description: "Не удалось импортировать тест", variant: "destructive" });
    },
  });

  const generateFromUrlMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/documents/generate-test-from-url", {
        url: sourceUrl,
        title: testConfig.title,
        subject: testConfig.subject,
        difficulty: testConfig.difficulty,
        questionCount: testConfig.questionCount,
      });
      return response.json() as Promise<GeneratedTest>;
    },
    onSuccess: (data) => {
      setGeneratedTest(data);
      setImportedTest(null);
      setStep("confirm");
      toast({ title: "Тест создан", description: "ИИ сгенерировал тест по содержимому страницы" });
    },
    onError: () => {
      toast({ title: "Ошибка", description: "Не удалось создать тест по ссылке", variant: "destructive" });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const sourceTest = generatedTest || importedTest;
      if (!sourceTest) throw new Error("Нет теста для сохранения");
      const testData = {
        title: testConfig.title,
        description: sourceTest.description,
        subject: testConfig.subject,
        timeLimitMinutes: testConfig.questionCount * 2,
        isPublished: false,
        isAdaptive: Boolean(sourceTest.isAdaptive),
        questions: sourceTest.questions.map((q) => ({
          type: q.type,
          text: q.text,
          points: q.points,
          topic: q.topic,
          difficulty: q.difficulty,
          rubricCriteria: q.rubricCriteria,
          correctAnswer: q.correctAnswer,
          options: q.options,
        })),
      };
      const response = await apiRequest("POST", "/api/tests", testData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tests/my"] });
      toast({ title: "Тест сохранён", description: "Тест добавлен в ваш список" });
      setStep("upload");
      setFile(null);
      setExtractedText("");
      setGeneratedTest(null);
      setImportedTest(null);
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const generateTypes = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain"];
      const importTypes = [...generateTypes, "application/json"];
      const allowedTypes = mode === "generate" ? generateTypes : importTypes;
      if (!allowedTypes.includes(selectedFile.type)) {
        toast({ title: "Ошибка", description: mode === "generate" ? "Поддерживаются только PDF, DOCX и TXT файлы" : "Поддерживаются PDF, DOCX, TXT и JSON файлы", variant: "destructive" });
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleUpload = () => {
    if (file) {
      if (mode === "generate") {
        uploadMutation.mutate(file);
      } else {
        importMutation.mutate(file);
      }
    }
  };

  const previewTest = generatedTest || importedTest;

  const handleGenerate = () => {
    if (!testConfig.title || !testConfig.subject) {
      toast({ title: "Ошибка", description: "Заполните название и предмет теста", variant: "destructive" });
      return;
    }
    generateMutation.mutate({
      ...testConfig,
      content: extractedText,
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div>
          <h1 className="text-2xl font-bold">Генерация тестов из документов</h1>
          <p className="text-muted-foreground">Загрузите материалы для AI-генерации или импортируйте уже готовый тест в веб-интерфейс</p>
        </div>
      </div>

      <div className="flex gap-2">
        <Button variant={mode === "generate" ? "default" : "outline"} onClick={() => setMode("generate")}>AI-генерация</Button>
        <Button variant={mode === "import" ? "default" : "outline"} onClick={() => setMode("import")}>Импорт теста</Button>
        <Button variant={mode === "url" ? "default" : "outline"} onClick={() => setMode("url")}>По ссылке</Button>
      </div>

      {/* Step 1: Upload */}
      {step === "upload" && (
        <Card>
          <CardHeader>
            <CardTitle>{mode === "url" ? "Шаг 1: Укажите ссылку" : "Шаг 1: Загрузите документ"}</CardTitle>
            <CardDescription>{mode === "generate" ? "Поддерживаются PDF, DOCX и текстовые файлы" : mode === "import" ? "Поддерживаются PDF, DOCX, TXT и JSON с готовыми вопросами" : "ИИ прочитает страницу и сформирует тест"}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {mode !== "url" ? (
              <>
                <div className="border-2 border-dashed rounded-lg p-8 text-center">
                  <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <Label htmlFor="file-input" className="cursor-pointer">
                    <span className="text-lg font-medium">Нажмите или перетащите файл</span>
                    <p className="text-sm text-muted-foreground mt-1">{mode === "generate" ? "PDF, DOCX или TXT, размер до 10 МБ" : "PDF, DOCX, TXT или JSON с готовым тестом"}</p>
                  </Label>
                  <Input
                    id="file-input"
                    type="file"
                    accept={mode === "generate" ? ".pdf,.docx,.txt" : ".pdf,.docx,.txt,.json"}
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </div>
                {file && (
                  <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/50">
                    <FileText className="h-5 w-5 text-blue-500" />
                    <span className="text-sm font-medium flex-1">{file.name}</span>
                    <Badge>{(file.size / 1024).toFixed(0)} КБ</Badge>
                  </div>
                )}
              </>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label>Ссылка на страницу</Label>
                  <Input
                    value={sourceUrl}
                    onChange={(e) => setSourceUrl(e.target.value)}
                    placeholder="https://example.com/article"
                  />
                </div>
                <div>
                  <Label>Название теста</Label>
                  <Input
                    value={testConfig.title}
                    onChange={(e) => setTestConfig({ ...testConfig, title: e.target.value })}
                    placeholder="Тест по статье"
                  />
                </div>
                <div>
                  <Label>Предмет</Label>
                  <Input
                    value={testConfig.subject}
                    onChange={(e) => setTestConfig({ ...testConfig, subject: e.target.value })}
                    placeholder="Информатика"
                  />
                </div>
                <div>
                  <Label>Сложность</Label>
                  <select
                    value={testConfig.difficulty}
                    onChange={(e) => setTestConfig({ ...testConfig, difficulty: e.target.value as any })}
                    className="w-full px-3 py-2 border rounded-md text-sm"
                  >
                    <option value="easy">Легко</option>
                    <option value="medium">Средне</option>
                    <option value="hard">Сложно</option>
                  </select>
                </div>
                <div>
                  <Label>Количество вопросов</Label>
                  <Input
                    type="number"
                    min={3}
                    max={20}
                    value={testConfig.questionCount}
                    onChange={(e) => setTestConfig({ ...testConfig, questionCount: parseInt(e.target.value) })}
                  />
                </div>
              </div>
            )}
            <Button
              onClick={mode === "url" ? () => generateFromUrlMutation.mutate() : handleUpload}
              disabled={mode === "url" ? !sourceUrl || !testConfig.title || !testConfig.subject || generateFromUrlMutation.isPending : !file || uploadMutation.isPending || importMutation.isPending}
              className="w-full"
            >
              {uploadMutation.isPending || importMutation.isPending || generateFromUrlMutation.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Обработка...</>
              ) : (
                <>{mode === "generate" ? "Загрузить и извлечь текст" : mode === "import" ? "Импортировать тест" : "Сгенерировать по ссылке"}</>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Preview & Configure */}
      {step === "preview" && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Шаг 2: Предпросмотр текста</CardTitle>
              <CardDescription>Проверьте извлеченный текст</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg p-4 bg-muted/30 max-h-64 overflow-auto text-sm leading-relaxed">
                {extractedText}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Настройки теста</CardTitle>
              <CardDescription>Укажите параметры генерируемого теста</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Название теста</Label>
                  <Input
                    value={testConfig.title}
                    onChange={(e) => setTestConfig({ ...testConfig, title: e.target.value })}
                    placeholder="Контрольная работа №1"
                  />
                </div>
                <div>
                  <Label>Предмет</Label>
                  <Input
                    value={testConfig.subject}
                    onChange={(e) => setTestConfig({ ...testConfig, subject: e.target.value })}
                    placeholder="Математика"
                  />
                </div>
                <div>
                  <Label>Сложность</Label>
                  <select
                    value={testConfig.difficulty}
                    onChange={(e) => setTestConfig({ ...testConfig, difficulty: e.target.value as any })}
                    className="w-full px-3 py-2 border rounded-md text-sm"
                  >
                    <option value="easy">Легко</option>
                    <option value="medium">Средне</option>
                    <option value="hard">Сложно</option>
                  </select>
                </div>
                <div>
                  <Label>Количество вопросов</Label>
                  <Input
                    type="number"
                    min={3}
                    max={20}
                    value={testConfig.questionCount}
                    onChange={(e) => setTestConfig({ ...testConfig, questionCount: parseInt(e.target.value) })}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep("upload")} className="flex-1">
                  Назад
                </Button>
                <Button onClick={handleGenerate} disabled={generateMutation.isPending} className="flex-1">
                  {generateMutation.isPending ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Создание теста...</>
                  ) : (
                    <>Создать тест ИИ</>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Step 3: Confirm & Save */}
      {step === "confirm" && previewTest && (
        <>
          <Alert>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <AlertDescription>{mode === "generate" ? "Тест создан! Проверьте вопросы перед сохранением" : "Тест импортирован. Проверьте структуру перед сохранением"}</AlertDescription>
          </Alert>

          <Card>
            <CardHeader>
              <CardTitle>Созданный тест</CardTitle>
              <CardDescription>{testConfig.title} — {testConfig.subject}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {previewTest.questions.map((q, idx) => (
                <div key={idx} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <h4 className="font-medium">Вопрос {idx + 1}</h4>
                    <Badge>{q.type === "single_choice" ? "Один ответ" : q.type === "multiple_choice" ? "Несколько" : "Открытый"}</Badge>
                  </div>
                  <p className="text-sm mb-3">{q.text}</p>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {q.topic && <Badge variant="outline">{q.topic}</Badge>}
                    {q.difficulty && <Badge variant="secondary">{q.difficulty}</Badge>}
                  </div>
                  {q.options && (
                    <div className="space-y-2">
                      {q.options.map((opt, oi) => (
                        <div key={oi} className={`p-2 rounded text-sm ${opt.isCorrect ? "bg-green-500/10 border border-green-500/30" : "bg-muted"}`}>
                          {opt.text}
                        </div>
                      ))}
                    </div>
                  )}
                  {q.rubricCriteria && q.rubricCriteria.length > 0 && (
                    <div className="mt-3 rounded-lg border bg-muted/30 p-3 text-sm">
                      <p className="font-medium mb-2">Рубрика</p>
                      <ul className="list-disc pl-5 space-y-1">
                        {q.rubricCriteria.map((criterion, criterionIndex) => <li key={criterionIndex}>{criterion}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(mode === "url" ? "upload" : "preview")} className="flex-1">
              Назад
            </Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="flex-1">
              {saveMutation.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Сохранение...</>
              ) : (
                <>Сохранить тест</>
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
