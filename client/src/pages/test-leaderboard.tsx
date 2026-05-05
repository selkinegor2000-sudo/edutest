import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Trophy, 
  Medal, 
  ArrowLeft, 
  Clock,
  Crown,
  User
} from "lucide-react";

type LeaderboardEntry = {
  rank: number;
  studentId: string;
  studentName: string;
  score: number;
  maxScore: number;
  scorePercent: number;
  duration: number | null;
  completedAt: string;
};

type LeaderboardData = {
  testId: string;
  testTitle: string;
  isCompetitive: boolean;
  leaderboard: LeaderboardEntry[];
};

export default function TestLeaderboardPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();

  const { data, isLoading } = useQuery<LeaderboardData>({
    queryKey: ["/api/tests", id, "leaderboard"],
  });

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Crown className="h-5 w-5 text-yellow-500" />;
    if (rank === 2) return <Medal className="h-5 w-5 text-gray-400" />;
    if (rank === 3) return <Medal className="h-5 w-5 text-amber-600" />;
    return <span className="text-muted-foreground font-mono">{rank}</span>;
  };

  const getRankColor = (rank: number) => {
    if (rank === 1) return "bg-yellow-500/10 border-yellow-500/20";
    if (rank === 2) return "bg-gray-400/10 border-gray-400/20";
    if (rank === 3) return "bg-amber-600/10 border-amber-600/20";
    return "";
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-48" />
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Trophy className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Рейтинг недоступен</h2>
        <p className="text-muted-foreground">Тест не найден</p>
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
          <h1 className="text-2xl font-bold tracking-tight">Рейтинг теста</h1>
          <p className="text-muted-foreground">{data.testTitle}</p>
        </div>
      </div>

      {data.isCompetitive && (
        <Badge className="bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20">
          <Trophy className="mr-1 h-3 w-3" />
          Соревновательный режим
        </Badge>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Таблица лидеров
          </CardTitle>
          <CardDescription>
            Рейтинг студентов по результатам теста
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.leaderboard.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <User className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-medium text-lg">Пока нет результатов</h3>
              <p className="text-muted-foreground">
                Никто еще не завершил этот тест
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {data.leaderboard.map((entry) => {
                const isCurrentUser = entry.studentId === user?.id;
                return (
                  <div
                    key={entry.studentId}
                    className={`flex items-center gap-4 p-4 rounded-lg border ${getRankColor(entry.rank)} ${isCurrentUser ? "ring-2 ring-primary" : ""}`}
                    data-testid={`leaderboard-entry-${entry.rank}`}
                  >
                    <div className="flex items-center justify-center w-10 h-10">
                      {getRankIcon(entry.rank)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium truncate">
                          {entry.studentName}
                        </h4>
                        {isCurrentUser && (
                          <Badge variant="secondary" className="shrink-0">Вы</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                        <span>
                          {new Date(entry.completedAt).toLocaleDateString("ru-RU")}
                        </span>
                        {entry.duration && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDuration(entry.duration)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold">
                        {entry.scorePercent.toFixed(0)}%
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {entry.score} / {entry.maxScore}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
