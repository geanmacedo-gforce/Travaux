import { ReactNode } from "react";
import { useAuth, type AppRole } from "@/lib/auth-context";
import { Navigate } from "@tanstack/react-router";

export function RequireAuth({ children, roles }: { children: ReactNode; roles?: AppRole[] }) {
  const { user, role, loading } = useAuth();
  if (loading) return <div className="p-8 text-muted-foreground">Carregando…</div>;
  if (!user) return <Navigate to="/login" />;
  if (user.must_change_password) return <Navigate to="/reset-password" />;
  if (roles && role && !roles.includes(role)) return <Navigate to="/app" />;
  return <>{children}</>;
}
