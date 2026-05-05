import { useAuth } from "@/lib/auth";
import { Link, useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Home,
  GraduationCap,
  Plus,
  LogOut,
  Users,
  User,
  BarChart2,
  TrendingUp,
  BrainCircuit,
} from "lucide-react";

export function AppSidebar() {
  const { user, logout } = useAuth();
  const [location] = useLocation();

  const isTeacher = user?.role === "teacher";

  const studentMenuItems = [
    {
      title: "Главная",
      url: "/",
      icon: Home,
    },
    {
      title: "Мои результаты",
      url: "/my-results",
      icon: BarChart2,
    },
    {
      title: "Мой прогресс",
      url: "/my-progress",
      icon: TrendingUp,
    },
    {
      title: "AI-анализ",
      url: "/ai-analysis",
      icon: BrainCircuit,
    },
  ];

  const teacherMenuItems = [
    {
      title: "Главная",
      url: "/",
      icon: Home,
    },
    {
      title: "Мои ученики",
      url: "/my-students",
      icon: Users,
    },
    {
      title: "Создать тест",
      url: "/test/create",
      icon: Plus,
    },
  ];

  const menuItems = isTeacher ? teacherMenuItems : studentMenuItems;

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary">
            <GraduationCap className="w-6 h-6 text-primary-foreground" />
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-sidebar-foreground">EduTest</span>
            <span className="text-xs text-muted-foreground">Система тестирования</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Навигация</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild 
                    isActive={location === item.url}
                    data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center gap-3 px-2 py-2">
              <Avatar className="h-8 w-8">
                <AvatarImage src={user?.photoUrl || undefined} />
                <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                  {user ? getInitials(user.fullName) : "?"}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight min-w-0">
                <span className="truncate font-semibold">{user?.fullName}</span>
                <span className="truncate text-xs text-muted-foreground">
                  @{user?.username}
                </span>
              </div>
              <Badge variant="secondary" className="text-xs shrink-0">
                {isTeacher ? "Преподаватель" : "Студент"}
              </Badge>
            </div>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={location === "/profile"}
              data-testid="button-profile"
            >
              <Link href="/profile">
                <User className="h-4 w-4" />
                <span>Личный кабинет</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => logout()}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              data-testid="button-logout"
            >
              <LogOut className="h-4 w-4" />
              <span>Выйти</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
