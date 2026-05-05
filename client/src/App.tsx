import { useEffect } from "react";
import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Skeleton } from "@/components/ui/skeleton";

import LoginPage from "@/pages/login";
import RegisterPage from "@/pages/register";
import StudentDashboard from "@/pages/student-dashboard";
import TeacherDashboard from "@/pages/teacher-dashboard";
import TestCreatePage from "@/pages/test-create";
import TestEditPage from "@/pages/test-edit";
import TestPreviewPage from "@/pages/test-preview";
import TestTakePage from "@/pages/test-take";
import ResultsPage from "@/pages/results";
import TestResultsPage from "@/pages/test-results";
import TestLeaderboardPage from "@/pages/test-leaderboard";
import MyStudentsPage from "@/pages/my-students";
import ProfilePage from "@/pages/profile";
import MyResultsPage from "@/pages/my-results";
import MyProgressPage from "@/pages/my-progress";
import AiAnalysisPage from "@/pages/ai-analysis";
import NotFound from "@/pages/not-found";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !user) {
      setLocation("/login");
    }
  }, [isLoading, user, setLocation]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="space-y-4 w-full max-w-md p-8">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}

function AuthRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && user) {
      setLocation("/");
    }
  }, [isLoading, user, setLocation]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="space-y-4 w-full max-w-md p-8">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-full" />
        </div>
      </div>
    );
  }

  if (user) {
    return null;
  }

  return <>{children}</>;
}

function MainLayout({ children }: { children: React.ReactNode }) {
  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={sidebarStyle as React.CSSProperties}>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <SidebarInset className="flex flex-col flex-1">
          <header className="flex h-14 items-center gap-4 border-b bg-background px-4 lg:px-6">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <div className="flex-1" />
            <ThemeToggle />
          </header>
          <main className="flex-1 overflow-auto p-4 lg:p-6">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

function Dashboard() {
  const { user } = useAuth();
  
  if (user?.role === "teacher") {
    return <TeacherDashboard />;
  }
  
  return <StudentDashboard />;
}

function Router() {
  return (
    <Switch>
      <Route path="/login">
        <AuthRoute>
          <LoginPage />
        </AuthRoute>
      </Route>
      <Route path="/register">
        <AuthRoute>
          <RegisterPage />
        </AuthRoute>
      </Route>
      <Route path="/">
        <ProtectedRoute>
          <MainLayout>
            <Dashboard />
          </MainLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/my-students">
        <ProtectedRoute>
          <MainLayout>
            <MyStudentsPage />
          </MainLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/my-results">
        <ProtectedRoute>
          <MainLayout>
            <MyResultsPage />
          </MainLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/my-progress">
        <ProtectedRoute>
          <MainLayout>
            <MyProgressPage />
          </MainLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/ai-analysis">
        <ProtectedRoute>
          <MainLayout>
            <AiAnalysisPage />
          </MainLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/profile">
        <ProtectedRoute>
          <MainLayout>
            <ProfilePage />
          </MainLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/test/create">
        <ProtectedRoute>
          <MainLayout>
            <TestCreatePage />
          </MainLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/test/:id/edit">
        <ProtectedRoute>
          <MainLayout>
            <TestEditPage />
          </MainLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/test/:id/results">
        <ProtectedRoute>
          <MainLayout>
            <TestResultsPage />
          </MainLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/test/:id/leaderboard">
        <ProtectedRoute>
          <MainLayout>
            <TestLeaderboardPage />
          </MainLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/test/:id/take">
        <ProtectedRoute>
          <MainLayout>
            <TestTakePage />
          </MainLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/test/:id">
        <ProtectedRoute>
          <MainLayout>
            <TestPreviewPage />
          </MainLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/results/:id">
        <ProtectedRoute>
          <MainLayout>
            <ResultsPage />
          </MainLayout>
        </ProtectedRoute>
      </Route>
      <Route>
        <NotFound />
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light" storageKey="edutest-theme">
        <TooltipProvider>
          <AuthProvider>
            <Toaster />
            <Router />
          </AuthProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
