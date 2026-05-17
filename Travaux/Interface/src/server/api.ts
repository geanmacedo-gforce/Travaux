import { createServerFn } from '@tanstack/react-start';

export const serverLogin = createServerFn({ method: 'POST' })(
  async (payload: { email: string; password: string }) => {
    const { loginUser } = await import('@/lib/auth');
    const result = await loginUser(payload.email, payload.password);
    if ('error' in result) {
      throw new Error(result.error);
    }
    return result;
  }
);

export const serverCreateUser = createServerFn({ method: 'POST' })(
  async (payload: { email: string; password: string; nome: string; role: string; funcionario_id?: string; tenantId?: string; tenantSlug?: string; tenantName?: string; tenantCode?: string }) => {
    const { createUser } = await import('@/lib/auth');
    const result = await createUser(payload.email, payload.password, payload.nome, payload.role, payload.funcionario_id, {
      tenantId: payload.tenantId,
      tenantSlug: payload.tenantSlug,
      tenantName: payload.tenantName,
      tenantCode: payload.tenantCode,
    });
    if ('error' in result) {
      throw new Error(result.error);
    }
    return result;
  }
);

export const serverChangeUserRole = createServerFn({ method: 'POST' })(
  async (payload: { userId: string; role: string; tenantId: string }) => {
    const { changeUserRole } = await import('@/lib/auth');
    const ok = await changeUserRole(payload.userId, payload.role, payload.tenantId);
    if (!ok) {
      throw new Error('Falha ao atualizar perfil do usuario');
    }
    return { success: true };
  }
);

function generateTempPassword(length = 10): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export const serverResetUserPassword = createServerFn({ method: 'POST' })(
  async (payload: { userId: string; tenantId: string }) => {
    const { updateUserPassword } = await import('@/lib/auth');
    const newPassword = generateTempPassword();
    const ok = await updateUserPassword(payload.userId, newPassword, payload.tenantId);
    if (!ok) {
      throw new Error('Falha ao redefinir senha');
    }
    return { password: newPassword };
  }
);

export const serverQuery = createServerFn({ method: 'POST' })(
  async (payload: { sql: string; values?: any[] }) => {
    const { query: dbQuery } = await import('@/lib/db');
    const [rows] = await dbQuery(payload.sql, payload.values);
    return rows;
  }
);

export const serverQueryOne = createServerFn({ method: 'POST' })(
  async (payload: { sql: string; values?: any[] }) => {
    const { getOne } = await import('@/lib/db');
    const result = await getOne(payload.sql, payload.values);
    return result;
  }
);
