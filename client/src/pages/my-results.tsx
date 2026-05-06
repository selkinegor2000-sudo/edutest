import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart2, Trophy, CheckCircle, Clock, ChevronRight, Trophy as TrophyIcon, Flame, Star, Target, Zap, Sparkles } from "lucide-react";

type StudentResults = {
  results: Array<{
    testTitle: string;
    testSubject: string;
    percent: number;
    completedAt: string;
  }>;
  avgScore: number;
  totalTests: number;
  perfectScores: number;
  passedTests: number;
  achievements: Array<{
    id: string;
    label: string;
    description: string;
    icon: string;
  }>;
};

function ScoreBadge({ percent }: { percent: number }) {
  if (percent >= 85) return <Badge className="bg-green-500 hover:bg-green-600">{percent}%</Badge>;
  if (percent >= 60) return <Badge className="bg-yellow-500 hover:bg-yellow-600">{percent}%</Badge>;
  return <Badge variant="destructive">{percent}%</Badge>;
}

function AchievementIcon({ name }: { name: string }) {
  const icons: Record<string, React.ReactNode> = {
    Trophy: <TrophyIcon className="h-5 w-5" />,
    Flame: <Flame className="h-5 w-5" />,
    Star: <Star className="h-5 w-5" />,
    Target: <Target className="h-5 w-5" />,
    Zap: <Zap className="h-5 w-5" />,
    Sparkles: <Sparkles className="h-5 w-5" />,
  };
  return <>{icons[name] || null}</>;
}

export default function MyResultsPage() {
  const [filterSubject, setFilterSubject] = useState<string>("");
  const { data, isLoading } = useQuery<StudentResults>({
    queryKey: ["/api/student/results"],
  });

  const filteredResults = data?.results.filter((r) => !filterSubject || r.testSubject === filterSubject) || [];
  const subjects = Array.from(new Set(data?.results.map((r) => r.testSubject) || []));

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full rounded-lg" />
        <div className="grid gap-4 sm:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BarChart2 className="h-6 w-6 text-primary" />
          Мои результаты
        </h1>
        <p className="text-muted-foreground mt-1">История всех пройденных тестов и ваши достижения</p>
      </div>

      {/* Карточки статистики */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Пройдено</p>
                <p className="text-2xl font-bold">{data?.totalTests ?? 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Trophy className="h-8 w-8 text-yellow-500" />
              <div>
                <p className="text-sm text-muted-foreground">Средний балл</p>
                <p className="text-2xl font-bold">{data?.avgScore ?? 0}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Zap className="h-8 w-8 text-orange-500" />
              <div>
                <p className="text-sm text-muted-foreground">Идеальные</p>
                <p className="text-2xl font-bold">{data?.perfectScores ?? 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Sparkles className="h-8 w-8 text-purple-500" />
              <div>
                <p className="text-sm text-muted-foreground">Достижений</p>
                <p className="text-2xl font-bold">{data?.achievements.length ?? 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Достижения */}
      {data?.achievements && data.achievements.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrophyIcon className="h-5 w-5 text-yellow-500" />
              Ваши достижения
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {data.achievements.map((achievement) => (
                <div
                  key={achievement.id}
                  className="p-4 rounded-lg border bg-gradient-to-br from-primary/5 to-primary/10 flex items-start gap-3"
                >
                  <div className="text-2xl">
                    <AchievementIcon name={achievement.icon} />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{achievement.label}</p>
                    <p className="text-xs text-muted-foreground">{achievement.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Фильтры и таблица результатов */}
      <Card>
        <CardHeader>
          <CardTitle>История тестов</CardTitle>
          {subjects.length > 1 && (
            <div className="flex gap-2 mt-4 flex-wrap">
              <Button
                variant={filterSubject === "" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterSubject("")}
              >
                Все предметы
              </Button>
              {subjects.map((subject) => (
                <Button
                  key={subject}
                  variant={filterSubject === subject ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilterSubject(subject)}
                >
                  {subject}
                </Button>
              ))}
            </div>
          )}
        </CardHeader>
        <CardContent>
          {filteredResults.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Нет результатов</p>
          ) : (
            <div className="space-y-3">
              {filteredResults.map((result, idx) => (
                <div key={idx} className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors">
                  <div className="flex-1">
                    <p className="font-medium">{result.testTitle}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary">{result.testSubject}</Badge>
                      {result.completedAt && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(result.completedAt).toLocaleDateString("ru-RU")}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <ScoreBadge percent={result.percent} />
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
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
