import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart2, Trophy, CheckCircle, Clock, ChevronRight } from "lucide-react";

function ScoreBadge({ percent }: { percent: number }) {
  if (percent >= 85) return <Badge className="bg-green-500 hover:bg-green-600">{percent}%</Badge>;
  if (percent >= 60) return <Badge className="bg-yellow-500 hover:bg-yellow-600">{percent}%</Badge>;
  return <Badge variant="destructive">{percent}%</Badge>;
}

export default function MyResultsPage() {
  const { data: results, isLoading } = useQuery<any[]>({
    queryKey: ["/api/student/results"],
  });

  const avg = results && results.length > 0
    ? Math.round(results.reduce((s, r) => s + r.percent, 0) / results.length)
    : 0;

  const best = results && results.length > 0
    ? Math.max(...results.map((r) => r.percent))
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BarChart2 className="h-6 w-6 text-primary" />
          Мои результаты
        </h1>
        <p className="text-muted-foreground mt-1">История всех пройденных тестов</p>
      </div>

      {/* Карточки статистики */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Пройдено тестов</p>
                <p className="text-2xl font-bold">{isLoading ? "—" : results?.length ?? 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <BarChart2 className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Средний балл</p>
                <p className="text-2xl font-bold">{isLoading ? "—" : `${avg}%`}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Trophy className="h-8 w-8 text-yellow-500" />
              <div>
                <p className="text-sm text-muted-foreground">Лучший результат</p>
                <p className="text-2xl font-bold">{isLoading ? "—" : `${best}%`}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Таблица результатов */}
      <Card>
        <CardHeader>
          <CardTitle>История прохождений</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : !results || results.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <BarChart2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Вы ещё не прошли ни одного теста</p>
              <Button asChild className="mt-4">
                <Link href="/">Перейти к тестам</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {results.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{r.testTitle}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {r.testSubject && (
                        <Badge variant="outline" className="text-xs">{r.testSubject}</Badge>
                      )}
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {r.completedAt ? new Date(r.completedAt).toLocaleDateString("ru-RU") : "—"}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 ml-4">
                    <ScoreBadge percent={r.percent} />
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/results/${r.id}`}>
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
