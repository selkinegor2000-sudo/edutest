import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { Badge } from "@/components/ui/badge";

function TrendIcon({ results }: { results: any[] }) {
  if (results.length < 2) return <Minus className="h-5 w-5 text-muted-foreground" />;
  const first = results[0].percent;
  const last = results[results.length - 1].percent;
  if (last > first + 5) return <TrendingUp className="h-5 w-5 text-green-500" />;
  if (last < first - 5) return <TrendingDown className="h-5 w-5 text-red-500" />;
  return <Minus className="h-5 w-5 text-yellow-500" />;
}

export default function MyProgressPage() {
  const { data: results, isLoading } = useQuery<any[]>({
    queryKey: ["/api/student/results"],
  });

  // Хронологический порядок для графика
  const chartData = results
    ? [...results]
        .reverse()
        .map((r, i) => ({
          name: `${i + 1}`,
          label: r.testTitle.length > 18 ? r.testTitle.slice(0, 18) + "…" : r.testTitle,
          percent: r.percent,
          date: r.completedAt ? new Date(r.completedAt).toLocaleDateString("ru-RU") : "",
        }))
    : [];

  // Статистика по предметам
  const bySubject: Record<string, number[]> = {};
  results?.forEach((r) => {
    const subj = r.testSubject || "Другое";
    if (!bySubject[subj]) bySubject[subj] = [];
    bySubject[subj].push(r.percent);
  });
  const subjectStats = Object.entries(bySubject).map(([subj, scores]) => ({
    subject: subj,
    avg: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
    count: scores.length,
  })).sort((a, b) => b.avg - a.avg);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload;
      return (
        <div className="bg-background border rounded-lg p-3 shadow-lg text-sm">
          <p className="font-medium">{d.label}</p>
          <p className="text-muted-foreground">{d.date}</p>
          <p className="text-primary font-bold mt-1">{d.percent}%</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <TrendingUp className="h-6 w-6 text-primary" />
          Мой прогресс
        </h1>
        <p className="text-muted-foreground mt-1">Динамика успеваемости по всем тестам</p>
      </div>

      {/* График прогресса */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>График успеваемости</span>
            {!isLoading && results && results.length >= 2 && (
              <div className="flex items-center gap-2 text-sm font-normal">
                <TrendIcon results={chartData} />
                <span className="text-muted-foreground">
                  {chartData.length >= 2
                    ? chartData[chartData.length - 1].percent > chartData[0].percent
                      ? "Прогресс растёт"
                      : chartData[chartData.length - 1].percent < chartData[0].percent
                      ? "Снижение"
                      : "Стабильно"
                    : ""}
                </span>
              </div>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : chartData.length < 2 ? (
            <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
              Пройдите хотя бы 2 теста, чтобы увидеть динамику
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  label={{ value: "Тест №", position: "insideBottomRight", offset: -5, fontSize: 11 }}
                />
                <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 12 }} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={60} stroke="hsl(var(--destructive))" strokeDasharray="4 4" label={{ value: "60%", position: "right", fontSize: 11 }} />
                <ReferenceLine y={85} stroke="hsl(var(--primary))" strokeDasharray="4 4" label={{ value: "85%", position: "right", fontSize: 11 }} />
                <Line
                  type="monotone"
                  dataKey="percent"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ r: 5, fill: "hsl(var(--primary))" }}
                  activeDot={{ r: 7 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Статистика по предметам */}
      {subjectStats.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>По предметам</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {subjectStats.map((s) => (
                <div key={s.subject} className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">{s.subject}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{s.count} тест{s.count === 1 ? "" : s.count < 5 ? "а" : "ов"}</span>
                        <Badge
                          className={
                            s.avg >= 85
                              ? "bg-green-500 hover:bg-green-600"
                              : s.avg >= 60
                              ? "bg-yellow-500 hover:bg-yellow-600"
                              : "bg-red-500 hover:bg-red-600"
                          }
                        >
                          {s.avg}%
                        </Badge>
                      </div>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          s.avg >= 85 ? "bg-green-500" : s.avg >= 60 ? "bg-yellow-500" : "bg-red-500"
                        }`}
                        style={{ width: `${s.avg}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
