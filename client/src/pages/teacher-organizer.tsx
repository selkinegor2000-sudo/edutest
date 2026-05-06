import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { CopyPlus, Layers3, Search, Users, Send, CalendarClock, FileStack, Sparkles } from "lucide-react";

type TeacherTest = {
  id: string;
  title: string;
  subject: string;
  isPublished: boolean;
  questionCount: number;
};

type Template = {
  id: string;
  title: string;
  subject: string;
  questionCount: number;
  updatedAt: string;
};

type Student = {
  id: string;
  fullName: string;
  username: string;
};

type Group = {
  id: string;
  name: string;
  description: string | null;
  memberCount: number;
  members: Student[];
};

type Assignment = {
  id: string;
  dueAt: string | null;
  createdAt: string;
  test: { title: string; subject: string };
  student: Student | null;
};

type QuestionSearchResult = {
  id: string;
  text: string;
  type: string;
  testTitle: string;
  subject: string;
};

const defaultBatchPayload = JSON.stringify(
  {
    tests: [
      {
        title: "Практикум по SQL",
        description: "Набор вопросов по базовым запросам",
        subject: "Базы данных",
        timeLimitMinutes: 30,
        isPublished: false,
        isCompetitive: false,
        scheduledAt: null,
        questions: [
          {
            type: "single_choice",
            text: "Какой оператор выбирает данные?",
            points: 5,
            options: [
              { text: "SELECT", isCorrect: true },
              { text: "INSERT", isCorrect: false }
            ]
          }
        ]
      }
    ]
  },
  null,
  2,
);

export default function TeacherOrganizerPage() {
  const { toast } = useToast();
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [selectedStudentByGroup, setSelectedStudentByGroup] = useState<Record<string, string>>({});
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [selectedTestId, setSelectedTestId] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [batchPayload, setBatchPayload] = useState(defaultBatchPayload);

  const { data: tests, isLoading: testsLoading } = useQuery<TeacherTest[]>({
    queryKey: ["/api/tests/my"],
  });

  const { data: templates, isLoading: templatesLoading } = useQuery<Template[]>({
    queryKey: ["/api/tests/templates"],
  });

  const { data: students } = useQuery<Student[]>({
    queryKey: ["/api/my-students"],
  });

  const { data: groups, isLoading: groupsLoading } = useQuery<Group[]>({
    queryKey: ["/api/groups"],
  });

  const { data: assignments } = useQuery<Assignment[]>({
    queryKey: ["/api/assignments/teacher"],
  });

  const { data: searchResults, isFetching: searchLoading } = useQuery<QuestionSearchResult[]>({
    queryKey: ["/api/questions/search", searchQuery],
    enabled: searchQuery.trim().length >= 2,
    queryFn: async () => {
      const response = await fetch(`/api/questions/search?q=${encodeURIComponent(searchQuery)}`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Ошибка поиска вопросов");
      }
      return response.json();
    },
  });

  const createGroupMutation = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/groups", { name: groupName, description: groupDescription || null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
      setGroupName("");
      setGroupDescription("");
      toast({ title: "Группа создана" });
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  const addMemberMutation = useMutation({
    mutationFn: async ({ groupId, studentId }: { groupId: string; studentId: string }) =>
      apiRequest("POST", `/api/groups/${groupId}/members`, { studentId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
      toast({ title: "Студент добавлен в группу" });
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  const saveTemplateMutation = useMutation({
    mutationFn: async (testId: string) => apiRequest("POST", `/api/tests/${testId}/save-template`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tests/templates"] });
      toast({ title: "Шаблон сохранён" });
    },
  });

  const cloneTemplateMutation = useMutation({
    mutationFn: async (template: Template) => apiRequest("POST", `/api/tests/from-template/${template.id}`, {
      title: `${template.title} — копия`,
      isPublished: false,
      scheduledAt: null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tests/my"] });
      toast({ title: "Тест создан из шаблона" });
    },
  });

  const bulkAssignMutation = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/tests/bulk-assign", {
      testId: selectedTestId,
      studentIds: selectedStudentIds,
      groupIds: selectedGroupIds,
      dueAt: dueAt ? new Date(dueAt).toISOString() : null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assignments/teacher"] });
      toast({ title: "Назначения созданы" });
      setSelectedStudentIds([]);
      setSelectedGroupIds([]);
      setDueAt("");
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  const batchCreateMutation = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/tests/batch", JSON.parse(batchPayload)),
    onSuccess: async (response) => {
      const data = await response.json();
      queryClient.invalidateQueries({ queryKey: ["/api/tests/my"] });
      toast({ title: "Пакет создан", description: `Создано тестов: ${data.createdCount}` });
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка пакетного создания", description: error.message, variant: "destructive" });
    },
  });

  const toggleStudent = (studentId: string) => {
    setSelectedStudentIds((prev) => prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId]);
  };

  const toggleGroup = (groupId: string) => {
    setSelectedGroupIds((prev) => prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId]);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Органайзер преподавателя</h1>
        <p className="text-muted-foreground">Шаблоны, пакетные операции, поиск вопросов, группы и массовые назначения в одном месте.</p>
      </div>

      <Tabs defaultValue="templates" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-5">
          <TabsTrigger value="templates">Шаблоны</TabsTrigger>
          <TabsTrigger value="batch">Пакетно</TabsTrigger>
          <TabsTrigger value="search">Поиск</TabsTrigger>
          <TabsTrigger value="groups">Группы</TabsTrigger>
          <TabsTrigger value="assign">Назначения</TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Layers3 className="h-5 w-5" />Мои тесты</CardTitle>
              <CardDescription>Любой существующий тест можно сохранить как шаблон для повторного использования.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {testsLoading ? [...Array(3)].map((_, index) => <Skeleton key={index} className="h-16 w-full" />) : tests?.map((test) => (
                <div key={test.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                  <div>
                    <p className="font-medium">{test.title}</p>
                    <p className="text-sm text-muted-foreground">{test.subject} · {test.questionCount} вопросов</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => saveTemplateMutation.mutate(test.id)}>
                    <FileStack className="mr-2 h-4 w-4" />
                    В шаблон
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><CopyPlus className="h-5 w-5" />Библиотека шаблонов</CardTitle>
              <CardDescription>Создавайте новые тесты на основе уже выверенных шаблонов.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {templatesLoading ? [...Array(3)].map((_, index) => <Skeleton key={index} className="h-16 w-full" />) : templates?.length ? templates.map((template) => (
                <div key={template.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                  <div>
                    <p className="font-medium">{template.title}</p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{template.subject}</span>
                      <Badge variant="secondary">{template.questionCount} вопросов</Badge>
                    </div>
                  </div>
                  <Button size="sm" onClick={() => cloneTemplateMutation.mutate(template)}>
                    Использовать
                  </Button>
                </div>
              )) : <p className="text-sm text-muted-foreground">Шаблонов пока нет.</p>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="batch">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5" />Пакетное создание тестов</CardTitle>
              <CardDescription>Вставьте JSON-массив тестов и создайте сразу несколько наборов вопросов.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea value={batchPayload} onChange={(event) => setBatchPayload(event.target.value)} className="min-h-[360px] font-mono text-xs" />
              <div className="flex justify-end">
                <Button onClick={() => batchCreateMutation.mutate()} disabled={batchCreateMutation.isPending}>
                  <Send className="mr-2 h-4 w-4" />
                  Создать пакет
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="search">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Search className="h-5 w-5" />Поиск по вопросам</CardTitle>
              <CardDescription>Быстрый поиск по текстам вопросов всех ваших тестов.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input placeholder="Например: JOIN, цикл, производная" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} />
              {searchLoading ? <Skeleton className="h-16 w-full" /> : searchQuery.trim().length < 2 ? (
                <p className="text-sm text-muted-foreground">Введите минимум 2 символа.</p>
              ) : (
                <div className="space-y-3">
                  {searchResults?.length ? searchResults.map((item) => (
                    <div key={item.id} className="rounded-lg border p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline">{item.subject}</Badge>
                        <Badge variant="secondary">{item.type}</Badge>
                      </div>
                      <p className="font-medium">{item.text}</p>
                      <p className="text-sm text-muted-foreground mt-1">Тест: {item.testTitle}</p>
                    </div>
                  )) : <p className="text-sm text-muted-foreground">Совпадений не найдено.</p>}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="groups" className="grid gap-4 xl:grid-cols-[360px,1fr]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />Новая группа</CardTitle>
              <CardDescription>Собирайте студентов в учебные группы для массовых назначений.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input placeholder="Название группы" value={groupName} onChange={(event) => setGroupName(event.target.value)} />
              <Textarea placeholder="Краткое описание" value={groupDescription} onChange={(event) => setGroupDescription(event.target.value)} />
              <Button className="w-full" onClick={() => createGroupMutation.mutate()} disabled={!groupName.trim()}>
                Создать группу
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Существующие группы</CardTitle>
              <CardDescription>Добавляйте студентов из списка ваших учеников.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {groupsLoading ? [...Array(2)].map((_, index) => <Skeleton key={index} className="h-24 w-full" />) : groups?.length ? groups.map((group) => (
                <div key={group.id} className="rounded-xl border p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{group.name}</p>
                      <p className="text-sm text-muted-foreground">{group.description || "Без описания"}</p>
                    </div>
                    <Badge>{group.memberCount} участников</Badge>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {group.members.map((member) => (
                      <Badge key={member.id} variant="secondary">{member.fullName}</Badge>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <Select
                      value={selectedStudentByGroup[group.id] || ""}
                      onValueChange={(value) => setSelectedStudentByGroup((prev) => ({ ...prev, [group.id]: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Добавить студента" />
                      </SelectTrigger>
                      <SelectContent>
                        {students?.map((student) => (
                          <SelectItem key={student.id} value={student.id}>{student.fullName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      onClick={() => {
                        const studentId = selectedStudentByGroup[group.id];
                        if (studentId) {
                          addMemberMutation.mutate({ groupId: group.id, studentId });
                        }
                      }}
                    >
                      Добавить
                    </Button>
                  </div>
                </div>
              )) : <p className="text-sm text-muted-foreground">Группы пока не созданы.</p>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assign" className="grid gap-4 xl:grid-cols-[1fr,420px]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Send className="h-5 w-5" />Массовое назначение тестов</CardTitle>
              <CardDescription>Назначайте тест сразу выбранным студентам и группам.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-sm font-medium">Тест</p>
                  <Select value={selectedTestId} onValueChange={setSelectedTestId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите тест" />
                    </SelectTrigger>
                    <SelectContent>
                      {tests?.map((test) => (
                        <SelectItem key={test.id} value={test.id}>{test.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Срок сдачи</p>
                  <Input type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border p-3">
                  <p className="font-medium mb-3">Студенты</p>
                  <div className="space-y-2 max-h-64 overflow-auto pr-1">
                    {students?.map((student) => (
                      <label key={student.id} className="flex items-center gap-3 text-sm">
                        <Checkbox checked={selectedStudentIds.includes(student.id)} onCheckedChange={() => toggleStudent(student.id)} />
                        <span>{student.fullName}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="font-medium mb-3">Группы</p>
                  <div className="space-y-2 max-h-64 overflow-auto pr-1">
                    {groups?.map((group) => (
                      <label key={group.id} className="flex items-center gap-3 text-sm">
                        <Checkbox checked={selectedGroupIds.includes(group.id)} onCheckedChange={() => toggleGroup(group.id)} />
                        <span>{group.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={() => bulkAssignMutation.mutate()} disabled={!selectedTestId || bulkAssignMutation.isPending}>
                  <CalendarClock className="mr-2 h-4 w-4" />
                  Назначить тест
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Последние назначения</CardTitle>
              <CardDescription>Журнал уже выданных тестов.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {assignments?.length ? assignments.slice(0, 8).map((assignment) => (
                <div key={assignment.id} className="rounded-lg border p-3">
                  <p className="font-medium">{assignment.test.title}</p>
                  <p className="text-sm text-muted-foreground">{assignment.student?.fullName || "Студент"}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {assignment.dueAt ? `Сдать до ${new Date(assignment.dueAt).toLocaleString("ru-RU")}` : "Без срока сдачи"}
                  </p>
                </div>
              )) : <p className="text-sm text-muted-foreground">Назначений пока нет.</p>}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}