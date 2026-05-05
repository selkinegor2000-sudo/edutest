import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { useEffect } from "react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { User, Save, Camera } from "lucide-react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const profileSchema = z.object({
  fullName: z.string().min(2, "ФИО должно содержать минимум 2 символа"),
  photoUrl: z.string().nullable().optional(),
  hobbies: z.string().nullable().optional(),
  wishes: z.string().nullable().optional(),
});

type ProfileFormData = z.infer<typeof profileSchema>;

export default function Profile() {
  const { user, refetchUser } = useAuth();
  const { toast } = useToast();

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: user?.fullName || "",
      photoUrl: user?.photoUrl || "",
      hobbies: user?.hobbies || "",
      wishes: user?.wishes || "",
    },
  });

  useEffect(() => {
    if (user) {
      form.reset({
        fullName: user.fullName || "",
        photoUrl: user.photoUrl || "",
        hobbies: user.hobbies || "",
        wishes: user.wishes || "",
      });
    }
  }, [user, form]);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: ProfileFormData) => {
      return apiRequest("PUT", "/api/profile", data);
    },
    onSuccess: () => {
      refetchUser();
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "Профиль успешно обновлен" });
    },
    onError: () => {
      toast({ title: "Ошибка обновления профиля", variant: "destructive" });
    },
  });

  const onSubmit = (data: ProfileFormData) => {
    updateProfileMutation.mutate(data);
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-page-title">Личный кабинет</h1>
        <p className="text-muted-foreground">Управление вашим профилем</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Информация о себе
          </CardTitle>
          <CardDescription>
            Расскажите о себе другим пользователям
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="flex items-center gap-6">
                <Avatar className="h-24 w-24">
                  <AvatarImage src={form.watch("photoUrl") || undefined} />
                  <AvatarFallback className="text-2xl">
                    {getInitials(form.watch("fullName") || user?.fullName || "U")}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <FormField
                    control={form.control}
                    name="photoUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>URL фотографии</FormLabel>
                        <FormControl>
                          <div className="flex gap-2">
                            <Input
                              placeholder="https://example.com/photo.jpg"
                              {...field}
                              value={field.value || ""}
                              data-testid="input-photo-url"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ФИО</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Иванов Иван Иванович"
                        {...field}
                        data-testid="input-fullname"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4">
                <div>
                  <Label className="text-sm text-muted-foreground">Логин</Label>
                  <p className="font-medium" data-testid="text-username">@{user?.username}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Роль</Label>
                  <p className="font-medium" data-testid="text-role">
                    {user?.role === "teacher" ? "Преподаватель" : "Студент"}
                  </p>
                </div>
              </div>

              <FormField
                control={form.control}
                name="hobbies"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Увлечения и хобби</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Расскажите о своих увлечениях..."
                        className="min-h-24 resize-none"
                        {...field}
                        value={field.value || ""}
                        data-testid="input-hobbies"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="wishes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Пожелания и цели</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Ваши цели и пожелания..."
                        className="min-h-24 resize-none"
                        {...field}
                        value={field.value || ""}
                        data-testid="input-wishes"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                disabled={updateProfileMutation.isPending}
                className="w-full"
                data-testid="button-save-profile"
              >
                <Save className="h-4 w-4 mr-2" />
                {updateProfileMutation.isPending ? "Сохранение..." : "Сохранить изменения"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
