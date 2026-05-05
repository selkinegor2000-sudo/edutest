import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { User } from "@shared/schema";
import { apiRequest, queryClient } from "./queryClient";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, fullName: string, role: "student" | "teacher") => Promise<void>;
  logout: () => Promise<void>;
  refetchUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const response = await fetch("/api/auth/me", {
        credentials: "include",
      });
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      }
    } catch (error) {
      console.error("Auth check failed:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function login(username: string, password: string) {
    const response = await apiRequest("POST", "/api/auth/login", { username, password });
    const userData = await response.json();
    setUser(userData);
    queryClient.invalidateQueries();
  }

  async function register(username: string, password: string, fullName: string, role: "student" | "teacher") {
    const response = await apiRequest("POST", "/api/auth/register", { username, password, fullName, role });
    const userData = await response.json();
    setUser(userData);
    queryClient.invalidateQueries();
  }

  async function logout() {
    await apiRequest("POST", "/api/auth/logout", {});
    setUser(null);
    queryClient.clear();
  }

  async function refetchUser() {
    await checkAuth();
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout, refetchUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
