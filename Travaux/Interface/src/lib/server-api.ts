import { createServerFn } from '@tanstack/react-start';

function toSerializable(value: any): any {
  if (value == null) return value;
  if (typeof value === 'bigint') {
    return Number.isSafeInteger(Number(value)) ? Number(value) : value.toString();
  }
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(toSerializable);
  if (typeof value === 'object') {
    const out: Record<string, any> = {};
    for (const [key, item] of Object.entries(value)) {
      out[key] = toSerializable(item);
    }
    return out;
  }
  return value;
}

const serverLoginFn = createServerFn({ method: 'POST' }).handler(
  async ({ data }: { data: { email: string; password: string } }) => {
    const { loginUser } = await import('@/lib/auth');
    const result = await loginUser(data.email, data.password);
    if ('error' in result) {
      throw new Error(result.error);
    }
    return result;
  }
);

const serverCreateUserFn = createServerFn({ method: 'POST' }).handler(
  async ({ data }: { data: { email: string; password: string; nome: string; role: string; funcionario_id?: string; tenantId?: string; tenantSlug?: string; tenantName?: string; tenantCode?: string } }) => {
    const { createUser } = await import('@/lib/auth');
    const result = await createUser(data.email, data.password, data.nome, data.role, data.funcionario_id, {
      tenantId: data.tenantId,
      tenantSlug: data.tenantSlug,
      tenantName: data.tenantName,
      tenantCode: data.tenantCode,
    });
    if ('error' in result) {
      throw new Error(result.error);
    }
    return result;
  }
);

const serverChangeUserRoleFn = createServerFn({ method: 'POST' }).handler(
  async ({ data }: { data: { userId: string; role: string; tenantId: string } }) => {
    const { changeUserRole } = await import('@/lib/auth');
    const ok = await changeUserRole(data.userId, data.role, data.tenantId);
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

const serverResetUserPasswordFn = createServerFn({ method: 'POST' }).handler(
  async ({ data }: { data: { userId: string; tenantId: string } }) => {
    const { updateUserPassword } = await import('@/lib/auth');
    const newPassword = generateTempPassword();
    const ok = await updateUserPassword(data.userId, newPassword, data.tenantId);
    if (!ok) {
      throw new Error('Falha ao redefinir senha');
    }
    return { password: newPassword };
  }
);

const serverChangeOwnPasswordFn = createServerFn({ method: 'POST' }).handler(
  async ({ data }: { data: { userId: string; tenantId: string; password: string } }) => {
    const { changeOwnPassword } = await import('@/lib/auth');
    const ok = await changeOwnPassword(data.userId, data.password, data.tenantId);
    if (!ok) {
      throw new Error('Falha ao alterar senha');
    }
    return { success: true };
  }
);

const serverQueryFn = createServerFn({ method: 'POST' }).handler(
  async ({ data }: { data: { sql: string; values?: any[] } }) => {
    const { query: dbQuery } = await import('@/lib/db');
    const [rows] = await dbQuery(data.sql, data.values);
    return toSerializable(rows);
  }
);

const serverQueryOneFn = createServerFn({ method: 'POST' }).handler(
  async ({ data }: { data: { sql: string; values?: any[] } }) => {
    const { getOne } = await import('@/lib/db');
    const result = await getOne(data.sql, data.values);
    return toSerializable(result);
  }
);

export async function serverLogin(payload: { email: string; password: string }) {
  return serverLoginFn({ data: payload });
}

export async function serverCreateUser(payload: {
  email: string;
  password: string;
  nome: string;
  role: string;
  funcionario_id?: string;
  tenantId?: string;
  tenantSlug?: string;
  tenantName?: string;
  tenantCode?: string;
}) {
  return serverCreateUserFn({ data: payload });
}

export async function serverChangeUserRole(payload: { userId: string; role: string; tenantId: string }) {
  return serverChangeUserRoleFn({ data: payload });
}

export async function serverResetUserPassword(payload: { userId: string; tenantId: string }) {
  return serverResetUserPasswordFn({ data: payload });
}

export async function serverChangeOwnPassword(payload: { userId: string; tenantId: string; password: string }) {
  return serverChangeOwnPasswordFn({ data: payload });
}

export async function serverQuery(payload: { sql: string; values?: any[] }) {
  return serverQueryFn({ data: payload });
}

export async function serverQueryOne<T = any>(payload: { sql: string; values?: any[] }) {
  return serverQueryOneFn({ data: payload }) as Promise<T | null>;
}
