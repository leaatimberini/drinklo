"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type AuthUser = {
  id: string;
  email: string;
  name: string;
  companyId: string;
  role: string;
  permissions: string[];
};

type LoginResult = {
  ok: boolean;
  message?: string;
};

type AuthContextValue = {
  loading: boolean;
  initialized: boolean;
  token: string | null;
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  applyManualToken: (token: string) => Promise<void>;
  refreshMe: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const TOKEN_STORAGE_KEY = "admin_token";

function getApiUrl() {
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
}

function setCompatLocalStorage(user: AuthUser | null) {
  if (typeof window === "undefined") {
    return;
  }

  if (!user) {
    window.localStorage.removeItem("erp_role");
    return;
  }

  window.localStorage.setItem("erp_role", user.role);
}

async function fetchInstanceStatus() {
  const apiUrl = getApiUrl();

  const res = await fetch(`${apiUrl}/instance/status`).catch(() => null);
  if (res?.ok) {
    return (await res.json()) as { initialized: boolean };
  }

  const legacy = await fetch(`${apiUrl}/setup/status`).catch(() => null);
  if (legacy?.ok) {
    return (await legacy.json()) as { initialized: boolean };
  }

  return { initialized: false };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);

  const persistToken = useCallback((value: string | null) => {
    if (typeof window === "undefined") {
      return;
    }

    if (value) {
      window.localStorage.setItem(TOKEN_STORAGE_KEY, value);
      return;
    }

    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  }, []);

  const clearSession = useCallback(() => {
    setToken(null);
    setUser(null);
    persistToken(null);
    setCompatLocalStorage(null);
  }, [persistToken]);

  const refreshMe = useCallback(async () => {
    if (typeof window === "undefined") {
      return;
    }

    const currentToken = token ?? window.localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!currentToken) {
      clearSession();
      return;
    }

    const apiUrl = getApiUrl();
    const res = await fetch(`${apiUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${currentToken}` },
      cache: "no-store",
    }).catch(() => null);

    if (!res?.ok) {
      clearSession();
      return;
    }

    const payload = (await res.json()) as { user?: AuthUser };
    if (!payload.user) {
      clearSession();
      return;
    }

    setToken(currentToken);
    setUser(payload.user);
    persistToken(currentToken);
    setCompatLocalStorage(payload.user);
  }, [clearSession, persistToken, token]);

  const hydrate = useCallback(async () => {
    setLoading(true);
    const instance = await fetchInstanceStatus();
    setInitialized(Boolean(instance.initialized));

    if (!instance.initialized) {
      clearSession();
      setLoading(false);
      return;
    }

    await refreshMe();
    setLoading(false);
  }, [clearSession, refreshMe]);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const login = useCallback(async (email: string, password: string) => {
    const apiUrl = getApiUrl();
    const res = await fetch(`${apiUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const payload = (await res.json().catch(() => ({}))) as {
      accessToken?: string;
      user?: AuthUser;
      message?: string;
      mfaRequired?: boolean;
    };

    if (!res.ok) {
      return { ok: false, message: payload.message ?? "Login failed" };
    }

    if (payload.mfaRequired) {
      return { ok: false, message: payload.message ?? "MFA required" };
    }

    if (!payload.accessToken || !payload.user) {
      return { ok: false, message: "Invalid login response" };
    }

    setToken(payload.accessToken);
    setUser(payload.user);
    setInitialized(true);
    persistToken(payload.accessToken);
    setCompatLocalStorage(payload.user);
    return { ok: true };
  }, [persistToken]);

  const logout = useCallback(async () => {
    const apiUrl = getApiUrl();
    await fetch(`${apiUrl}/auth/logout`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    }).catch(() => undefined);
    clearSession();
  }, [clearSession, token]);

  const applyManualToken = useCallback(async (manualToken: string) => {
    setToken(manualToken);
    persistToken(manualToken);
    await refreshMe();
  }, [persistToken, refreshMe]);

  const value = useMemo<AuthContextValue>(() => ({
    loading,
    initialized,
    token,
    user,
    login,
    logout,
    hasPermission: (permission: string) => Boolean(user?.permissions?.includes(permission)),
    applyManualToken,
    refreshMe,
  }), [applyManualToken, initialized, loading, login, logout, refreshMe, token, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return ctx;
}
