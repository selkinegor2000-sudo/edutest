import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { ShieldCheck, Loader2, ArrowLeftRight } from "lucide-react";

const adminLoginSchema = z.object({
  login: z.string().min(3, "Введите логин администратора"),
  password: z.string().min(6, "Введите пароль администратора"),
});

type AdminLoginFormData = z.infer<typeof adminLoginSchema>;

export default function AdminLoginPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<AdminLoginFormData>({
    resolver: zodResolver(adminLoginSchema),
    defaultValues: {
      login: "admin",
      password: "",
    },
  });

  async function onSubmit(data: AdminLoginFormData) {
    setIsLoading(true);
    try {
      await apiRequest("POST", "/api/admin/login", data);
      toast({
        title: "Вход выполнен",
        description: "Открыт отдельный административный контур EduTest.",
      });
      setLocation("/admin-panel");
    } catch (error: any) {
      toast({
        title: "Ошибка входа",
        description: error.message || "Неверный логин или пароль администратора",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(15,76,129,0.18),_transparent_30%),linear-gradient(180deg,_#f8fafc,_#eef2f7)] px-4 py-10 dark:bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.18),_transparent_30%),linear-gradient(180deg,_#020617,_#0f172a)]">
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-stretch">
        <section className="flex h-full flex-col gap-6">
          <div className="inline-flex items-center gap-2 rounded-full border bg-background/80 px-4 py-2 text-sm backdrop-blur">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Отдельный контур административного доступа
          </div>
          <div className="space-y-4">
            <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-balance lg:text-5xl">
              Панель демонстрации, контроля и печатной отчетности EduTest
            </h1>
            <p className="max-w-2xl text-base leading-7 text-muted-foreground lg:text-lg">
              Используется для показа руководителю, приемочной комиссии и ответственным сотрудникам.
              Вход отделен от ролей преподавателя и студента и ведет в самостоятельный административный интерфейс.
            </p>
          </div>
          <div className="mt-auto grid gap-4 sm:grid-cols-2">
            <div className="flex h-full flex-col rounded-2xl border bg-background/80 p-5 backdrop-blur">
              <div className="text-sm text-muted-foreground mb-2">Внутри admin-контура</div>
              <ul className="space-y-2 text-sm leading-6">
                <li>Реестр всего функционала системы</li>
                <li>Сценарии эксплуатации и демонстрации</li>
                <li>Чек-лист приемки и печатные материалы</li>
              </ul>
            </div>
            <div className="flex h-full flex-col rounded-2xl border bg-background/80 p-5 backdrop-blur">
              <div className="text-sm text-muted-foreground mb-2">Назначение</div>
              <p className="text-sm leading-6">
                Подготовка наглядного представления системы для государственного учреждения и формирование документов для печати.
              </p>
            </div>
          </div>
        </section>

        <Card className="flex h-full flex-col border-primary/20 shadow-xl shadow-primary/5">
          <CardHeader className="space-y-2">
            <CardTitle className="text-2xl">Вход администратора</CardTitle>
            <CardDescription>
              Используйте отдельный логин и пароль. Этот вход не связан с ролями преподавателя и студента.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="login"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Логин администратора</FormLabel>
                      <FormControl>
                        <Input placeholder="admin" data-testid="input-admin-login" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Пароль администратора</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Введите пароль" data-testid="input-admin-password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={isLoading} data-testid="button-admin-login">
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Вход...
                    </>
                  ) : (
                    "Открыть admin-панель"
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
          <CardFooter className="flex flex-col items-start gap-3 text-sm text-muted-foreground">
            <div>Реквизиты входа можно изменить через переменные `ADMIN_PANEL_LOGIN` и `ADMIN_PANEL_PASSWORD`.</div>
            <Button variant="ghost" className="h-auto p-0" onClick={() => setLocation("/login")}>
              <ArrowLeftRight className="mr-2 h-4 w-4" />
              Вернуться к обычному входу пользователей
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}