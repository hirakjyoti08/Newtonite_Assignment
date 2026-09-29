import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useLogin, useCurrentUser, useLogout } from '../api/queries/auth';
import type { UserResponse } from '@shared/types';

interface AuthContextType {
  user: UserResponse | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const loginMutation = useLogin();
  const { data: currentUser } = useCurrentUser();
  const logoutMutation = useLogout();

  useEffect(() => {
    if (currentUser) {
      setUser(currentUser);
    }
    setIsLoading(false);
  }, [currentUser]);

  const login = async (email: string, password: string) => {
    await loginMutation.mutateAsync({ email, password });
  };

  const logout = () => {
    logoutMutation.mutate();
    setUser(null);
    localStorage.removeItem('token');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}