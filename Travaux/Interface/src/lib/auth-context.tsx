import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { serverLogin, serverQueryOne } from "@/lib/server-api";

export type AppRole = "proprietario" | "admin" | "gerente" | "funcionario";

type Profile = {
  id: string;
  tenant_id: string;
  nome: string;
  email: string;
  endereco?: string | null;
  avatar_url?: string | null;
  funcionario_id: string | null;
  ativo: boolean;
  role?: AppRole | null;
};
type User = { id: string; email: string; tenant_id: string; must_change_password?: boolean };
type Session = { token: string };

const INACTIVITY_LIMIT_MS = 60 * 60 * 1000;
const ACTIVITY_STORAGE_KEY = "auth_last_activity_at";

type AuthCtx = {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string; mustChangePassword?: boolean }>;
  signUp: (email: string, password: string, nome: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const lastPersistedActivityRef = useRef(0);
  const inactivityToastShownRef = useRef(false);

  const clearStoredSession = () => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("user");
    localStorage.removeItem(ACTIVITY_STORAGE_KEY);
  };

  const resetSessionState = () => {
    setSession(null);
    setUser(null);
    setRole(null);
    setProfile(null);
  };

  const writeLastActivity = (force = false) => {
    if (!session || !user) return;
    const now = Date.now();
    if (!force && now - lastPersistedActivityRef.current < 15000) return;
    localStorage.setItem(ACTIVITY_STORAGE_KEY, String(now));
    lastPersistedActivityRef.current = now;
  };

  const getLastActivity = (): number => {
    const raw = localStorage.getItem(ACTIVITY_STORAGE_KEY);
    const parsed = raw ? Number(raw) : NaN;
    return Number.isFinite(parsed) ? parsed : Date.now();
  };

  const isInactivityExpired = () => Date.now() - getLastActivity() > INACTIVITY_LIMIT_MS;

  const forceReloginByInactivity = async () => {
    clearStoredSession();
    resetSessionState();
    if (inactivityToastShownRef.current) return;
    inactivityToastShownRef.current = true;
    try {
      const { toast } = await import("sonner");
      toast.error("Sessao expirada por inatividade. Faca login novamente.");
    } catch {
      // no-op
    }
  };

  const loadProfileRow = async (uid: string, tenantId: string): Promise<Profile | null> => {
    try {
      return await serverQueryOne<Profile>({
        sql: "SELECT id, tenant_id, nome, email, endereco, avatar_url, funcionario_id, ativo FROM profiles WHERE user_id = ? AND tenant_id = ? LIMIT 1",
        values: [uid, tenantId],
      });
    } catch {
      const legacy = await serverQueryOne<{
        id: string;
        tenant_id: string;
        nome: string;
        email: string;
        funcionario_id: string | null;
        ativo: boolean;
      }>({
        sql: "SELECT id, tenant_id, nome, email, funcionario_id, ativo FROM profiles WHERE user_id = ? AND tenant_id = ? LIMIT 1",
        values: [uid, tenantId],
      });

      if (!legacy) return null;
      return {
        ...legacy,
        endereco: null,
        avatar_url: null,
      };
    }
  };

  const loadRole = async (uid: string, tenantId: string) => {
    try {
      const [r, p] = await Promise.all([
        serverQueryOne<{ role: AppRole }>({
          sql: "SELECT role FROM user_roles WHERE user_id = ? AND tenant_id = ? LIMIT 1",
          values: [uid, tenantId],
        }),
        loadProfileRow(uid, tenantId),
      ]);

      if (p && p.ativo === false) {
        clearStoredSession();
        resetSessionState();
        const { toast } = await import("sonner");
        toast.error("Sua conta aguarda aprovação do administrador.");
        return;
      }

      setRole(r?.role ?? null);
      setProfile(p ?? null);
    } catch {
      setRole(null);
      setProfile(null);
    }
  };

  useEffect(() => {
    const safetyTimeout = window.setTimeout(() => {
      setLoading(false);
    }, 8000);

    const token = localStorage.getItem("auth_token");
    const storedUser = localStorage.getItem("user");

    if (!token || !storedUser) {
      clearTimeout(safetyTimeout);
      setLoading(false);
      return;
    }

    try {
      if (isInactivityExpired()) {
        clearStoredSession();
        clearTimeout(safetyTimeout);
        setLoading(false);
        void forceReloginByInactivity();
        return;
      }

      const parsed = JSON.parse(storedUser) as { id?: string; email?: string; tenant_id?: string; must_change_password?: boolean; profile?: Profile };
      if (!parsed.id || !parsed.email || !parsed.tenant_id) {
        throw new Error("Invalid user storage");
      }

      writeLastActivity(true);
      setSession({ token });
      setUser({ id: parsed.id, email: parsed.email, tenant_id: parsed.tenant_id, must_change_password: Boolean(parsed.must_change_password) });
      setProfile(parsed.profile ?? null);
      setRole(parsed.profile?.role ?? null);
      clearTimeout(safetyTimeout);
      setLoading(false);
      // Atualiza papel/perfil em background sem bloquear a UI.
      void loadRole(parsed.id, parsed.tenant_id);
    } catch {
      clearStoredSession();
      clearTimeout(safetyTimeout);
      setLoading(false);
    }

    return () => clearTimeout(safetyTimeout);
  }, []);

  useEffect(() => {
    if (!session || !user) {
      inactivityToastShownRef.current = false;
      return;
    }

    const validateOrRefreshActivity = () => {
      if (isInactivityExpired()) {
        void forceReloginByInactivity();
        return;
      }
      writeLastActivity();
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        validateOrRefreshActivity();
      }
    };

    const originalPushState = window.history.pushState.bind(window.history);
    const originalReplaceState = window.history.replaceState.bind(window.history);

    window.history.pushState = function (...args) {
      originalPushState(...args);
      validateOrRefreshActivity();
    };

    window.history.replaceState = function (...args) {
      originalReplaceState(...args);
      validateOrRefreshActivity();
    };

    const interval = window.setInterval(validateOrRefreshActivity, 60000);

    const events: Array<keyof WindowEventMap> = ["mousemove", "keydown", "touchstart", "scroll", "focus", "popstate", "hashchange"];
    for (const eventName of events) {
      window.addEventListener(eventName, validateOrRefreshActivity, { passive: true });
    }
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.clearInterval(interval);
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
      for (const eventName of events) {
        window.removeEventListener(eventName, validateOrRefreshActivity);
      }
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [session, user]);

  const signIn = async (email: string, password: string) => {
    try {
      const result = await serverLogin({ email, password });
      const token = (result as any)?.token as string | undefined;
      const userResult = (result as any)?.user as
        | { id?: string; email?: string; tenant_id?: string; must_change_password?: boolean; profile?: Profile | null }
        | undefined;

      if (!token || !userResult?.id || !userResult?.email || !userResult?.tenant_id) {
        return { error: "Falha ao autenticar. Verifique suas credenciais e tente novamente." };
      }

      localStorage.setItem("auth_token", token);
      localStorage.setItem("user", JSON.stringify({
        id: userResult.id,
        email: userResult.email,
        tenant_id: userResult.tenant_id,
        must_change_password: Boolean(userResult.must_change_password),
        profile: userResult.profile ?? null,
      }));
      localStorage.setItem(ACTIVITY_STORAGE_KEY, String(Date.now()));
      lastPersistedActivityRef.current = Date.now();
      inactivityToastShownRef.current = false;

      setSession({ token });
      const mustChangePassword = Boolean(userResult.must_change_password);
      setUser({ id: userResult.id, email: userResult.email, tenant_id: userResult.tenant_id, must_change_password: mustChangePassword });
      setProfile(userResult.profile ?? null);
      const roleValue = (userResult.profile?.role as AppRole | null) ?? null;
      setRole(roleValue);
      return { mustChangePassword };
    } catch (error) {
      return { error: (error as Error).message };
    }
  };

  const signUp = async (email: string, password: string, nome: string) => {
    return { error: "Use o cadastro inicial com empresa (tenant) na tela de login." };
  };

  const signOut = async () => {
    clearStoredSession();
    resetSessionState();
    inactivityToastShownRef.current = false;
  };

  const refresh = async () => { if (user) await loadRole(user.id, user.tenant_id); };

  return <Ctx.Provider value={{ user, session, role, profile, loading, signIn, signUp, signOut, refresh }}>{children}</Ctx.Provider>;
}

export const useAuth = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used inside AuthProvider");
  return c;
};
