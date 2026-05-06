import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Bell, CheckCheck } from "lucide-react";

type NotificationItem = {
  id: string;
  title: string;
  body: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
};

export default function NotificationsPage() {
  const { data: notifications, isLoading } = useQuery<NotificationItem[]>({
    queryKey: ["/api/notifications"],
    refetchInterval: 15000,
  });

  const markReadMutation = useMutation({
    mutationFn: async (notificationId: string) => apiRequest("POST", `/api/notifications/${notificationId}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });

  const unreadCount = notifications?.filter((item) => !item.isRead).length || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Уведомления</h1>
          <p className="text-muted-foreground">Назначения, сообщения и системные события внутри платформы.</p>
        </div>
        <Badge variant="secondary">Непрочитанных: {unreadCount}</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5" />Лента уведомлений</CardTitle>
          <CardDescription>Список событий с ручным подтверждением прочтения.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? [...Array(5)].map((_, index) => <Skeleton key={index} className="h-20 w-full" />) : notifications?.length ? notifications.map((item) => (
            <div key={item.id} className={`rounded-xl border p-4 ${item.isRead ? "bg-muted/20" : "bg-primary/5 border-primary/20"}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{item.title}</p>
                  <p className="text-sm text-muted-foreground mt-1">{item.body}</p>
                  <p className="text-xs text-muted-foreground mt-3">{new Date(item.createdAt).toLocaleString("ru-RU")}</p>
                </div>
                {!item.isRead && (
                  <Button variant="outline" size="sm" onClick={() => markReadMutation.mutate(item.id)}>
                    <CheckCheck className="mr-2 h-4 w-4" />
                    Прочитано
                  </Button>
                )}
              </div>
            </div>
          )) : <p className="text-sm text-muted-foreground">Пока уведомлений нет.</p>}
        </CardContent>
      </Card>
    </div>
  );
}