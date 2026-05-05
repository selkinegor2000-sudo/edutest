import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation, Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { 
  Clock, 
  BookOpen, 
  ArrowLeft, 
  PlayCircle,
  Loader2,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { Test } from "@shared/schema";

type TestWithDetails = Test & { 
  questionCount: number;
  teacher: { fullName: string };
};

export default function TestPreviewPage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: test, isLoading } = useQuery<TestWithDetails>({
    queryKey: ["/api/tests", id],
  });

  const startAttemptMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/tests/${id}/start`);
      return response.json();
    },
    onSuccess: (data) => {
      setLocation(`/test/${id}/take?attempt=${data.id}`);
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось начать тест",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!test) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Тест не найден</h2>
        <p className="text-muted-foreground mb-4">
          Возможно, тест был удален или недоступен
        </p>
        <Link href="/">
          <Button>Вернуться на главную</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{test.title}</h1>
          <p className="text-muted-foreground">{test.subject}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Информация о тесте</CardTitle>
          <CardDescription>
            Перед началом ознакомьтесь с условиями прохождения теста
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {test.description && (
            <div>
              <h4 className="font-medium mb-2">Описание</h4>
              <p className="text-muted-foreground">{test.description}</p>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
              <Clock className="h-8 w-8 text-primary" />
              <div>
                <p className="font-medium">{test.timeLimitMinutes} минут</p>
                <p className="text-sm text-muted-foreground">Время на тест</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
              <BookOpen className="h-8 w-8 text-primary" />
              <div>
                <p className="font-medium">{test.questionCount} вопросов</p>
                <p className="text-sm text-muted-foreground">В тесте</p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="font-medium">Правила прохождения</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                Ваши ответы сохраняются автоматически каждые 30 секунд
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                Вы можете переключаться между вопросами в любом порядке
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                После истечения времени тест будет автоматически завершен
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                Открытые ответы будут проверены с помощью AI
              </li>
            </ul>
          </div>

          <div className="pt-4">
            <Button
              className="w-full"
              size="lg"
              onClick={() => startAttemptMutation.mutate()}
              disabled={startAttemptMutation.isPending}
              data-testid="button-start-test"
            >
              {startAttemptMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Подготовка теста...
                </>
              ) : (
                <>
                  <PlayCircle className="mr-2 h-4 w-4" />
                  Начать тест
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
