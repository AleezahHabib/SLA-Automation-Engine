"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/api";
import { User } from "@/types/api";
import { Role } from "@/types/enums";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<User>;
  registerStaff: (data: {
    email: string;
    password: string;
    full_name: string;
  }) => Promise<User>;
  registerCustomer: (data: {
    email: string;
    password: string;
    full_name: string;
    company?: string;
  }) => Promise<User>;
  logout: () => void;
  refreshUser: () => Promise<User | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const router = useRouter();

  const refreshUser = useCallback(async (): Promise<User | null> => {
    const token = localStorage.getItem("sla_access_token");
    if (!token) {
      setUser(null);
      setIsLoading(false);
      return null;
    }

    try {
      const me = await authApi.getMe();
      setUser(me);
      setIsLoading(false);
      return me;
    } catch (error) {
      // Clear token if invalid or expired
      localStorage.removeItem("sla_access_token");
      setUser(null);
      setIsLoading(false);
      return null;
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = async (email: string, password: string): Promise<User> => {
    setIsLoading(true);
    try {
      const res = await authApi.login({ email, password });
      localStorage.setItem("sla_access_token", res.access_token);
      setUser(res.user);
      setIsLoading(false);
      return res.user;
    } catch (err) {
      setIsLoading(false);
      throw err;
    }
  };

  const registerStaff = async (data: {
    email: string;
    password: string;
    full_name: string;
  }): Promise<User> => {
    setIsLoading(true);
    try {
      const res = await authApi.registerStaff(data);
      localStorage.setItem("sla_access_token", res.access_token);
      setUser(res.user);
      setIsLoading(false);
      return res.user;
    } catch (err) {
      setIsLoading(false);
      throw err;
    }
  };

  const registerCustomer = async (data: {
    email: string;
    password: string;
    full_name: string;
    company?: string;
  }): Promise<User> => {
    setIsLoading(true);
    try {
      const res = await authApi.registerCustomer(data);
      localStorage.setItem("sla_access_token", res.access_token);
      setUser(res.user);
      setIsLoading(false);
      return res.user;
    } catch (err) {
      setIsLoading(false);
      throw err;
    }
  };

  const logout = () => {
    localStorage.removeItem("sla_access_token");
    setUser(null);
    router.push("/login");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        registerStaff,
        registerCustomer,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
