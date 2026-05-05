import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Users, UserPlus, UserMinus, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";

type Student = {
  id: string;
  fullName: string;
  username: string;
  isMyStudent?: boolean;
};

export default function MyStudents() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");

  const { data: myStudents, isLoading: loadingMyStudents } = useQuery<Student[]>({
    queryKey: ["/api/my-students"],
  });

  const { data: allStudents, isLoading: loadingAllStudents } = useQuery<Student[]>({
    queryKey: ["/api/all-students"],
  });

  const addStudentMutation = useMutation({
    mutationFn: async (studentId: string) => {
      return apiRequest("POST", `/api/my-students/${studentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/my-students"] });
      queryClient.invalidateQueries({ queryKey: ["/api/all-students"] });
      toast({ title: "Студент добавлен" });
    },
    onError: () => {
      toast({ title: "Ошибка добавления студента", variant: "destructive" });
    },
  });

  const removeStudentMutation = useMutation({
    mutationFn: async (studentId: string) => {
      return apiRequest("DELETE", `/api/my-students/${studentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/my-students"] });
      queryClient.invalidateQueries({ queryKey: ["/api/all-students"] });
      toast({ title: "Студент удален из списка" });
    },
    onError: () => {
      toast({ title: "Ошибка удаления студента", variant: "destructive" });
    },
  });

  const filteredAllStudents = allStudents?.filter(
    (s) =>
      s.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const availableStudents = filteredAllStudents?.filter((s) => !s.isMyStudent);

  if (loadingMyStudents || loadingAllStudents) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-page-title">Мои ученики</h1>
        <p className="text-muted-foreground">
          Выберите студентов для отслеживания их результатов
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Мои ученики ({myStudents?.length || 0})
            </CardTitle>
            <CardDescription>
              Студенты, чьи результаты вы отслеживаете
            </CardDescription>
          </CardHeader>
          <CardContent>
            {myStudents && myStudents.length > 0 ? (
              <div className="space-y-2">
                {myStudents.map((student) => (
                  <div
                    key={student.id}
                    className="flex items-center justify-between p-3 rounded-lg border"
                    data-testid={`student-item-${student.id}`}
                  >
                    <div>
                      <p className="font-medium">{student.fullName}</p>
                      <p className="text-sm text-muted-foreground">@{student.username}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeStudentMutation.mutate(student.id)}
                      disabled={removeStudentMutation.isPending}
                      data-testid={`button-remove-${student.id}`}
                    >
                      <UserMinus className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">
                Вы еще не добавили учеников. Выберите их из списка справа.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Доступные студенты
            </CardTitle>
            <CardDescription>
              Зарегистрированные студенты, которых можно добавить
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Поиск студентов..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search-students"
              />
            </div>

            {availableStudents && availableStudents.length > 0 ? (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {availableStudents.map((student) => (
                  <div
                    key={student.id}
                    className="flex items-center justify-between p-3 rounded-lg border"
                    data-testid={`available-student-${student.id}`}
                  >
                    <div>
                      <p className="font-medium">{student.fullName}</p>
                      <p className="text-sm text-muted-foreground">@{student.username}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => addStudentMutation.mutate(student.id)}
                      disabled={addStudentMutation.isPending}
                      data-testid={`button-add-${student.id}`}
                    >
                      <UserPlus className="h-4 w-4 mr-1" />
                      Добавить
                    </Button>
                  </div>
                ))}
              </div>
            ) : searchQuery ? (
              <p className="text-muted-foreground text-center py-8">
                Студенты не найдены
              </p>
            ) : (
              <p className="text-muted-foreground text-center py-8">
                {allStudents?.length === myStudents?.length
                  ? "Все студенты уже добавлены"
                  : "Нет доступных студентов для добавления"}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
