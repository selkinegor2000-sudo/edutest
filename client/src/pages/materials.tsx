import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { BookOpen, FileText, BrainCircuit, Download, WandSparkles } from "lucide-react";

type Material = {
  id: string;
  title: string;
  description: string | null;
  materialType: "book" | "manual" | "trainer_test" | "test_import";
  fileName: string;
  aiSummary: string | null;
  aiKeywords: string[] | null;
  aiDifficulty: string | null;
  linkedTestId: string | null;
  linkedTest?: { id: string; title: string } | null;
  teacher?: { fullName: string; username: string } | null;
};

export default function MaterialsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isTeacher = user?.role === "teacher";
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [materialType, setMaterialType] = useState<Material["materialType"]>("manual");

  const materialTypeLabels: Record<Material["materialType"], string> = {
    manual: "Методичка",
    book: "Книга",
    trainer_test: "Тренажёр",
    test_import: "Импорт теста",
  };

  const { data: materials, isLoading } = useQuery<Material[]>({
    queryKey: ["/api/materials"],
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Файл не выбран");
      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", title);
      formData.append("description", description);
      formData.append("materialType", materialType);
      const response = await fetch("/api/materials/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/materials"] });
      toast({ title: "Материал загружен" });
      setFile(null);
      setTitle("");
      setDescription("");
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  const analyzeMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("POST", `/api/materials/${id}/analyze`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/materials"] });
      toast({ title: "Материал проанализирован" });
    },
  });

  const createTrainerMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("POST", `/api/materials/${id}/create-trainer`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/materials"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tests/my"] });
      toast({ title: "Тренажёр создан" });
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Методические пособия</h1>
        <p className="text-muted-foreground">Электронные книги, методички и тренажёры с AI-анализом содержимого.</p>
      </div>

      {isTeacher && (
        <Card>
          <CardHeader>
            <CardTitle>Загрузить материал</CardTitle>
            <CardDescription>Поддерживаются PDF, DOCX, TXT и JSON.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label>Название</Label>
              <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Методичка по SQL" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Описание</Label>
              <Textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Краткое описание материала" />
            </div>
            <div className="space-y-2">
              <Label>Тип</Label>
              <Select value={materialType} onValueChange={(value) => setMaterialType(value as Material["materialType"])}>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите тип" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Методичка</SelectItem>
                  <SelectItem value="book">Книга</SelectItem>
                  <SelectItem value="trainer_test">Тренажёр</SelectItem>
                  <SelectItem value="test_import">Импорт теста</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Файл</Label>
              <Input type="file" accept=".pdf,.docx,.txt,.json" onChange={(event) => setFile(event.target.files?.[0] || null)} />
            </div>
            <div className="md:col-span-2 flex justify-end">
              <Button onClick={() => uploadMutation.mutate()} disabled={!file || !title.trim() || uploadMutation.isPending}>
                <FileText className="mr-2 h-4 w-4" />
                Загрузить
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {isLoading ? [...Array(4)].map((_, index) => <Skeleton key={index} className="h-60 w-full" />) : materials?.map((material) => (
          <Card key={material.id}>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5" />{material.title}</CardTitle>
                  <CardDescription>{material.description || "Без описания"}</CardDescription>
                </div>
                <Badge variant="secondary">{materialTypeLabels[material.materialType]}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {material.teacher && !isTeacher && (
                <p className="text-sm text-muted-foreground">Автор: {material.teacher.fullName}</p>
              )}

              {material.aiSummary && (
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-sm font-medium">AI-анализ</p>
                  <p className="mt-2 text-sm text-muted-foreground">{material.aiSummary}</p>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {material.aiDifficulty && <Badge>{material.aiDifficulty}</Badge>}
                {material.aiKeywords?.map((keyword) => <Badge key={keyword} variant="outline">{keyword}</Badge>)}
              </div>

              <div className="flex flex-wrap gap-2">
                <a href={`/api/materials/${material.id}/file`}>
                  <Button variant="outline" size="sm"><Download className="mr-2 h-4 w-4" />Скачать</Button>
                </a>
                {isTeacher && (
                  <Button variant="outline" size="sm" onClick={() => analyzeMutation.mutate(material.id)}>
                    <BrainCircuit className="mr-2 h-4 w-4" />Переанализировать
                  </Button>
                )}
                {isTeacher && !material.linkedTestId && (
                  <Button size="sm" onClick={() => createTrainerMutation.mutate(material.id)}>
                    <WandSparkles className="mr-2 h-4 w-4" />Создать тренажёр
                  </Button>
                )}
              </div>

              {material.linkedTest && (
                <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-3 text-sm">
                  Связанный тренажёр: {material.linkedTest.title}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}