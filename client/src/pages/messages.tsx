import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, Send } from "lucide-react";

type Contact = {
  id: string;
  fullName: string;
  username: string;
  role: "student" | "teacher";
};

type ChatMessage = {
  id: string;
  content: string;
  createdAt: string;
  fromUserId: string;
  toUserId: string;
  fromUser: { id: string; fullName: string; username: string } | null;
};

export default function MessagesPage() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [activeUserId, setActiveUserId] = useState("");
  const [messageText, setMessageText] = useState("");

  const { data: contacts, isLoading: contactsLoading } = useQuery<Contact[]>({
    queryKey: ["/api/messages/contacts"],
    refetchInterval: 20000,
  });

  useEffect(() => {
    if (!activeUserId && contacts?.length) {
      setActiveUserId(contacts[0].id);
    }
  }, [activeUserId, contacts]);

  const { data: messages, isLoading: messagesLoading } = useQuery<ChatMessage[]>({
    queryKey: ["/api/messages", activeUserId],
    enabled: Boolean(activeUserId),
    refetchInterval: 5000,
  });

  const sendMessageMutation = useMutation({
    mutationFn: async () => apiRequest("POST", `/api/messages/${activeUserId}`, { content: messageText }),
    onSuccess: () => {
      setMessageText("");
      queryClient.invalidateQueries({ queryKey: ["/api/messages", activeUserId] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка отправки", description: error.message, variant: "destructive" });
    },
  });

  const filteredContacts = useMemo(() => {
    return contacts?.filter((contact) => {
      const normalized = search.trim().toLowerCase();
      return !normalized || contact.fullName.toLowerCase().includes(normalized) || contact.username.toLowerCase().includes(normalized);
    }) || [];
  }, [contacts, search]);

  const activeContact = contacts?.find((contact) => contact.id === activeUserId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Сообщения</h1>
        <p className="text-muted-foreground">Чат преподавателя и студента с обновлением по polling.</p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[320px,1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><MessageSquare className="h-5 w-5" />Контакты</CardTitle>
            <CardDescription>Доступные собеседники</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input placeholder="Поиск контакта" value={search} onChange={(event) => setSearch(event.target.value)} />
            <div className="space-y-2 max-h-[560px] overflow-auto pr-1">
              {contactsLoading ? [...Array(4)].map((_, index) => <Skeleton key={index} className="h-14 w-full" />) : filteredContacts.map((contact) => (
                <button
                  key={contact.id}
                  type="button"
                  onClick={() => setActiveUserId(contact.id)}
                  className={`w-full rounded-lg border p-3 text-left transition-colors ${activeUserId === contact.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">{contact.fullName}</p>
                    <Badge variant="secondary">{contact.role === "teacher" ? "Преподаватель" : "Студент"}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">@{contact.username}</p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{activeContact ? activeContact.fullName : "Выберите диалог"}</CardTitle>
            <CardDescription>{activeContact ? `@${activeContact.username}` : "Слева появятся доступные контакты"}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="min-h-[420px] rounded-xl border bg-muted/20 p-4 space-y-3">
              {messagesLoading ? [...Array(5)].map((_, index) => <Skeleton key={index} className="h-12 w-2/3" />) : messages?.length ? messages.map((message) => {
                const ownMessage = message.fromUserId !== activeUserId;
                return (
                  <div key={message.id} className={`flex ${ownMessage ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${ownMessage ? "bg-primary text-primary-foreground" : "bg-background border"}`}>
                      <p>{message.content}</p>
                      <p className={`mt-2 text-xs ${ownMessage ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                        {new Date(message.createdAt).toLocaleString("ru-RU")}
                      </p>
                    </div>
                  </div>
                );
              }) : <p className="text-sm text-muted-foreground">Сообщений пока нет.</p>}
            </div>

            <div className="space-y-3">
              <Textarea
                value={messageText}
                onChange={(event) => setMessageText(event.target.value)}
                placeholder="Напишите сообщение"
                className="min-h-[120px]"
              />
              <div className="flex justify-end">
                <Button onClick={() => sendMessageMutation.mutate()} disabled={!activeUserId || !messageText.trim() || sendMessageMutation.isPending}>
                  <Send className="mr-2 h-4 w-4" />
                  Отправить
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}