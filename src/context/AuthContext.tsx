import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { UserProfile, UserRole, AuthResponse } from '../types/index.js';
import { api } from '../services/api.js';

interface ForbiddenNotice {
  isOpen: boolean;
  actionName: string;
  requiredRoles: string[];
}

interface AuthContextType {
  user: UserProfile | null;
  role: UserRole | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<AuthResponse>;
  signup: (payload: {
    name: string;
    email: string;
    password: string;
    role?: UserRole;
    title?: string;
  }) => Promise<AuthResponse>;
  logout: () => Promise<void>;
  quickLogin: (role: UserRole) => Promise<void>;
  isAdmin: boolean;
  isEngineer: boolean;
  isViewer: boolean;
  canRunAi: boolean;
  canMutateIncidents: boolean;
  canManageServices: boolean;
  canManageSettings: boolean;
  forbiddenNotice: ForbiddenNotice | null;
  showForbiddenNotice: (actionName: string, requiredRoles: string[]) => void;
  closeForbiddenNotice: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(() => api.getToken());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbiddenNotice, setForbiddenNotice] = useState<ForbiddenNotice | null>(null);

  const showForbiddenNotice = useCallback((actionName: string, requiredRoles: string[]) => {
    setForbiddenNotice({
      isOpen: true,
      actionName,
      requiredRoles,
    });
  }, []);

  const closeForbiddenNotice = useCallback(() => {
    setForbiddenNotice(null);
  }, []);

  // Initialize session verification on mount
  useEffect(() => {
    let isMounted = true;

    async function initAuth() {
      const storedToken = api.getToken();
      if (!storedToken) {
        // Fallback: auto-login as ADMIN for immediate seamless experience if no token exists
        // (the user can still switch or log out anytime to test other roles)
        try {
          const res = await api.login('admin@aegis.internal', 'AegisSec2026!');
          if (isMounted) {
            setUser(res.user);
            setToken(res.token);
          }
        } catch {
          if (isMounted) {
            setUser(null);
            setToken(null);
          }
        } finally {
          if (isMounted) setIsLoading(false);
        }
        return;
      }

      try {
        const userProfile = await api.getCurrentUser();
        if (isMounted) {
          setUser(userProfile);
          setToken(storedToken);
        }
      } catch {
        // Token invalid or expired
        api.setToken(null);
        if (isMounted) {
          setUser(null);
          setToken(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    initAuth();

    const handleAuthError = (event: Event) => {
      const customEvent = event as CustomEvent<{
        status: number;
        error: string;
        requiredRoles?: UserRole[];
        userRole?: UserRole;
      }>;
      const detail = customEvent.detail;
      if (detail.status === 403) {
        showForbiddenNotice(
          detail.error || 'Access Denied',
          detail.requiredRoles || ['ADMIN', 'ENGINEER']
        );
      } else if (detail.status === 401) {
        setUser(null);
        setToken(null);
      }
    };

    window.addEventListener('aegis:auth_error', handleAuthError);

    return () => {
      isMounted = false;
      window.removeEventListener('aegis:auth_error', handleAuthError);
    };
  }, [showForbiddenNotice]);

  const login = async (email: string, password: string): Promise<AuthResponse> => {
    setError(null);
    try {
      const response = await api.login(email, password);
      setUser(response.user);
      setToken(response.token);
      return response;
    } catch (err: unknown) {
      const msg = (err as Error).message || 'Authentication failed';
      setError(msg);
      throw err;
    }
  };

  const signup = async (payload: {
    name: string;
    email: string;
    password: string;
    role?: UserRole;
    title?: string;
  }): Promise<AuthResponse> => {
    setError(null);
    try {
      const response = await api.signup(payload);
      setUser(response.user);
      setToken(response.token);
      return response;
    } catch (err: unknown) {
      const msg = (err as Error).message || 'Registration failed';
      setError(msg);
      throw err;
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await api.logout();
    } finally {
      setUser(null);
      setToken(null);
    }
  };

  const quickLogin = async (role: UserRole): Promise<void> => {
    const credentials = {
      ADMIN: { email: 'admin@aegis.internal', password: 'AegisSec2026!' },
      ENGINEER: { email: 'engineer@aegis.internal', password: 'AegisSec2026!' },
      VIEWER: { email: 'viewer@aegis.internal', password: 'AegisSec2026!' },
    }[role];

    await login(credentials.email, credentials.password);
  };

  const role = user?.role || null;
  const isAdmin = role === 'ADMIN';
  const isEngineer = role === 'ENGINEER';
  const isViewer = role === 'VIEWER';

  // Role permissions:
  // - ADMIN: full access, manage users/settings/services/incidents
  // - ENGINEER: view services, create/update incidents, run AI analysis, add resolution notes
  // - VIEWER: read-only access to dashboards, services and incident history
  const canRunAi = isAdmin || isEngineer;
  const canMutateIncidents = isAdmin || isEngineer;
  const canManageServices = isAdmin;
  const canManageSettings = isAdmin;

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        token,
        isAuthenticated: !!user,
        isLoading,
        error,
        login,
        signup,
        logout,
        quickLogin,
        isAdmin,
        isEngineer,
        isViewer,
        canRunAi,
        canMutateIncidents,
        canManageServices,
        canManageSettings,
        forbiddenNotice,
        showForbiddenNotice,
        closeForbiddenNotice,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
