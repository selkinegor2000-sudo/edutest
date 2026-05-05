import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation, useSearch } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { 
  Clock, 
  ChevronLeft, 
  ChevronRight, 
  Send,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Save
} from "lucide-react";
import { TestWithQuestions, TestAttempt } from "@shared/schema";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type SavedAnswers = {
  [questionId: string]: {
    text?: string;
    selectedOptions?: string[];
  };
};

export default function TestTakePage() {
  const { id } = useParams<{ id: string }>();
  const search = useSearch();
  const attemptId = new URLSearchParams(search).get("attempt");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<SavedAnswers>({});
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const autoSaveRef = useRef<NodeJS.Timeout | null>(null);

  const { data: test, isLoading: testLoading } = useQuery<TestWithQuestions>({
    queryKey: ["/api/tests", id, "full"],
  });

  const { data: attempt, isLoading: attemptLoading } = useQuery<TestAttempt>({
    queryKey: ["/api/attempts", attemptId],
    enabled: !!attemptId,
  });

  const saveProgressMutation = useMutation({
    mutationFn: async (savedAnswers: SavedAnswers) => {
      await apiRequest("PUT", `/api/attempts/${attemptId}/save`, { answers: savedAnswers });
    },
    onSuccess: () => {
      setLastSaved(new Date());
    },
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/attempts/${attemptId}/submit`, { answers });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attempts/my"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats/student"] });
      toast({
        title: "Тест завершен",
        description: "Ваши ответы отправлены на проверку",
      });
      setLocation(`/results/${attemptId}`);
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось завершить тест",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (attempt?.savedAnswers && Object.keys(answers).length === 0) {
      setAnswers(attempt.savedAnswers as SavedAnswers || {});
    }
  }, [attempt]);

  useEffect(() => {
    if (test && attempt) {
      const startTime = new Date(attempt.startedAt).getTime();
      const endTime = startTime + test.timeLimitMinutes * 60 * 1000;
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((endTime - now) / 1000));
      setTimeLeft(remaining);
    }
  }, [test, attempt]);

  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(timer);
          if (prev === 1) {
            submitMutation.mutate();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft]);

  useEffect(() => {
    autoSaveRef.current = setInterval(() => {
      if (Object.keys(answers).length > 0) {
        saveProgressMutation.mutate(answers);
      }
    }, 30000);

    return () => {
      if (autoSaveRef.current) {
        clearInterval(autoSaveRef.current);
      }
    };
  }, [answers]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleAnswerChange = useCallback((questionId: string, value: { text?: string; selectedOptions?: string[] }) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: value,
    }));
  }, []);

  const handleSubmit = () => {
    setShowSubmitDialog(true);
  };

  const confirmSubmit = () => {
    setShowSubmitDialog(false);
    submitMutation.mutate();
  };

  if (testLoading || attemptLoading) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!test || !attempt) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Тест не найден</h2>
        <p className="text-muted-foreground">Возможно, попытка была завершена или недоступна</p>
      </div>
    );
  }

  const currentQuestion = test.questions[currentQuestionIndex];
  const answeredCount = Object.keys(answers).filter((id) => {
    const answer = answers[id];
    return answer.text?.trim() || (answer.selectedOptions && answer.selectedOptions.length > 0);
  }).length;
  const progress = (answeredCount / test.questions.length) * 100;
  const isTimeWarning = timeLeft !== null && timeLeft < 300;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 pb-4">
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-4">
                <div className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-lg ${
                  isTimeWarning ? "bg-destructive/10 text-destructive" : "bg-muted"
                }`}>
                  <Clock className="h-5 w-5" />
                  {timeLeft !== null ? formatTime(timeLeft) : "--:--"}
                </div>
                {lastSaved && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Save className="h-3 w-3" />
                    Сохранено
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {answeredCount} из {test.questions.length}
                </span>
                <Progress value={progress} className="w-32 h-2" />
              </div>
            </div>
          </CardContent>
        </Card>
        <div className="px-1 pt-1 pb-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground font-medium">
              Вопрос {currentQuestionIndex + 1} из {test.questions.length}
            </span>
            <span className="text-xs text-muted-foreground">
              Отвечено: {answeredCount} / {test.questions.length}
            </span>
          </div>
          <Progress value={(currentQuestionIndex / (test.questions.length - 1)) * 100} className="h-1.5" />
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {test.questions.map((q, index) => {
          const answer = answers[q.id];
          const isAnswered = answer?.text?.trim() || (answer?.selectedOptions && answer.selectedOptions.length > 0);
          return (
            <Button
              key={q.id}
              variant={currentQuestionIndex === index ? "default" : "outline"}
              size="sm"
              className={`w-10 h-10 relative ${
                currentQuestionIndex === index
                  ? ""
                  : isAnswered
                  ? "border-green-500 text-green-600 dark:text-green-400 bg-green-500/10"
                  : ""
              }`}
              onClick={() => setCurrentQuestionIndex(index)}
              data-testid={`button-question-${index}`}
            >
              {index + 1}
            </Button>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="text-lg">Вопрос {currentQuestionIndex + 1}</CardTitle>
            <Badge variant="secondary">
              {currentQuestion.points} {currentQuestion.points === 1 ? "балл" : "баллов"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-lg" data-testid="text-question">{currentQuestion.text}</p>

          {currentQuestion.imageUrl && (
            <div className="rounded-lg overflow-hidden border">
              <img 
                src={currentQuestion.imageUrl} 
                alt="Изображение к вопросу" 
                className="w-full max-h-80 object-contain bg-muted"
                data-testid="question-image"
              />
            </div>
          )}

          {currentQuestion.videoUrl && (
            <div className="rounded-lg overflow-hidden border aspect-video">
              <iframe
                src={currentQuestion.videoUrl.replace("watch?v=", "embed/").replace("youtu.be/", "youtube.com/embed/")}
                title="Видео к вопросу"
                className="w-full h-full"
                allowFullScreen
                data-testid="question-video"
              />
            </div>
          )}

          {currentQuestion.type === "single_choice" && (
            <RadioGroup
              value={answers[currentQuestion.id]?.selectedOptions?.[0] || ""}
              onValueChange={(value) => handleAnswerChange(currentQuestion.id, { selectedOptions: [value] })}
              className="space-y-3"
            >
              {currentQuestion.options.map((option) => (
                <div key={option.id} className="flex items-center space-x-3 p-3 rounded-lg border hover-elevate">
                  <RadioGroupItem 
                    value={option.id} 
                    id={option.id}
                    data-testid={`radio-option-${option.id}`}
                  />
                  <label 
                    htmlFor={option.id} 
                    className="flex-1 cursor-pointer"
                    data-testid={`label-option-${option.id}`}
                  >
                    {option.text}
                  </label>
                </div>
              ))}
            </RadioGroup>
          )}

          {currentQuestion.type === "multiple_choice" && (
            <div className="space-y-3">
              {currentQuestion.options.map((option) => {
                const selected = answers[currentQuestion.id]?.selectedOptions || [];
                const isChecked = selected.includes(option.id);
                return (
                  <div key={option.id} className="flex items-center space-x-3 p-3 rounded-lg border hover-elevate">
                    <Checkbox
                      id={option.id}
                      checked={isChecked}
                      onCheckedChange={(checked) => {
                        const newSelected = checked
                          ? [...selected, option.id]
                          : selected.filter((id) => id !== option.id);
                        handleAnswerChange(currentQuestion.id, { selectedOptions: newSelected });
                      }}
                      data-testid={`checkbox-option-${option.id}`}
                    />
                    <label 
                      htmlFor={option.id} 
                      className="flex-1 cursor-pointer"
                      data-testid={`label-option-${option.id}`}
                    >
                      {option.text}
                    </label>
                  </div>
                );
              })}
            </div>
          )}

          {currentQuestion.type === "open_answer" && (
            <Textarea
              value={answers[currentQuestion.id]?.text || ""}
              onChange={(e) => handleAnswerChange(currentQuestion.id, { text: e.target.value })}
              placeholder="Введите ваш ответ..."
              className="min-h-[150px]"
              data-testid="textarea-answer"
            />
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-4">
        <Button
          variant="outline"
          onClick={() => setCurrentQuestionIndex((prev) => Math.max(0, prev - 1))}
          disabled={currentQuestionIndex === 0}
          data-testid="button-prev-question"
        >
          <ChevronLeft className="mr-2 h-4 w-4" />
          Назад
        </Button>

        {currentQuestionIndex < test.questions.length - 1 ? (
          <Button
            onClick={() => setCurrentQuestionIndex((prev) => Math.min(test.questions.length - 1, prev + 1))}
            data-testid="button-next-question"
          >
            Далее
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={submitMutation.isPending}
            data-testid="button-submit-test"
          >
            {submitMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Отправка...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Завершить тест
              </>
            )}
          </Button>
        )}
      </div>

      <Dialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Завершить тест?</DialogTitle>
            <DialogDescription>
              {answeredCount === test.questions.length ? (
                <span className="flex items-center gap-2 text-green-600 dark:text-green-400">
                  <CheckCircle2 className="h-4 w-4" />
                  Вы ответили на все вопросы
                </span>
              ) : (
                <span className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
                  <AlertCircle className="h-4 w-4" />
                  Вы ответили на {answeredCount} из {test.questions.length} вопросов
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSubmitDialog(false)}>
              Продолжить тест
            </Button>
            <Button onClick={confirmSubmit}>
              Завершить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
