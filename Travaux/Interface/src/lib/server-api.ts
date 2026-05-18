import { createServerFn } from '@tanstack/react-start';

type RequestIpContext = {
  ip: string | null;
  ip_source: string | null;
  ip_forwarded_for: string | null;
  ip_real_ip: string | null;
  ip_cf_connecting_ip: string | null;
  ip_remote_address: string | null;
  ip_socket_address: string | null;
};

type AuditAction = 'create' | 'update' | 'delete' | 'login' | 'logout' | 'other';

type MutationAuditMeta = {
  actorUserId?: string | null;
  tenantId?: string | null;
  sourcePath?: string | null;
};

async function getClientIpContext(): Promise<RequestIpContext> {
  const { getRequest } = await import('@tanstack/react-start/server');
  const request = getRequest();

  const normalizeIp = (value: string | null | undefined) => {
    if (!value) return null;
    const trimmed = value.trim();
    if (!trimmed || trimmed.toLowerCase() === 'unknown') return null;
    const withoutMappedPrefix = trimmed.startsWith('::ffff:') ? trimmed.slice(7) : trimmed;
    return withoutMappedPrefix || null;
  };

  const forwardedForRaw = request?.headers.get('x-forwarded-for') ?? null;
  const realIpRaw = request?.headers.get('x-real-ip') ?? null;
  const cfIpRaw = request?.headers.get('cf-connecting-ip') ?? null;
  const remoteIpRaw = request?.headers.get('x-remote-address') ?? null;
  const socketAddressRaw = request?.headers.get('x-socket-address') ?? null;

  const forwardedFor = forwardedForRaw ? normalizeIp(forwardedForRaw.split(',')[0]?.trim()) : null;
  if (forwardedFor) {
    return {
      ip: forwardedFor,
      ip_source: 'x-forwarded-for',
      ip_forwarded_for: forwardedForRaw,
      ip_real_ip: realIpRaw,
      ip_cf_connecting_ip: cfIpRaw,
      ip_remote_address: remoteIpRaw,
      ip_socket_address: socketAddressRaw,
    };
  }

  const realIp = normalizeIp(realIpRaw);
  if (realIp) {
    return {
      ip: realIp,
      ip_source: 'x-real-ip',
      ip_forwarded_for: forwardedForRaw,
      ip_real_ip: realIpRaw,
      ip_cf_connecting_ip: cfIpRaw,
      ip_remote_address: remoteIpRaw,
      ip_socket_address: socketAddressRaw,
    };
  }

  const cfIp = normalizeIp(cfIpRaw);
  if (cfIp) {
    return {
      ip: cfIp,
      ip_source: 'cf-connecting-ip',
      ip_forwarded_for: forwardedForRaw,
      ip_real_ip: realIpRaw,
      ip_cf_connecting_ip: cfIpRaw,
      ip_remote_address: remoteIpRaw,
      ip_socket_address: socketAddressRaw,
    };
  }

  const remoteIp = normalizeIp(remoteIpRaw);
  if (remoteIp) {
    return {
      ip: remoteIp,
      ip_source: 'x-remote-address',
      ip_forwarded_for: forwardedForRaw,
      ip_real_ip: realIpRaw,
      ip_cf_connecting_ip: cfIpRaw,
      ip_remote_address: remoteIpRaw,
      ip_socket_address: socketAddressRaw,
    };
  }

  const socketIp = normalizeIp(socketAddressRaw);
  if (socketIp) {
    return {
      ip: socketIp,
      ip_source: 'x-socket-address',
      ip_forwarded_for: forwardedForRaw,
      ip_real_ip: realIpRaw,
      ip_cf_connecting_ip: cfIpRaw,
      ip_remote_address: remoteIpRaw,
      ip_socket_address: socketAddressRaw,
    };
  }

  return {
    ip: null,
    ip_source: null,
    ip_forwarded_for: forwardedForRaw,
    ip_real_ip: realIpRaw,
    ip_cf_connecting_ip: cfIpRaw,
    ip_remote_address: remoteIpRaw,
    ip_socket_address: socketAddressRaw,
  };
}

function getMutationInfo(sql: string): { action: AuditAction; table: string } | null {
  const normalized = sql.replace(/\s+/g, ' ').trim().toLowerCase();

  const insertMatch = normalized.match(/^insert\s+into\s+`?([a-z0-9_]+)`?/i);
  if (insertMatch) return { action: 'create', table: insertMatch[1] };

  const updateMatch = normalized.match(/^update\s+`?([a-z0-9_]+)`?/i);
  if (updateMatch) return { action: 'update', table: updateMatch[1] };

  const deleteMatch = normalized.match(/^delete\s+from\s+`?([a-z0-9_]+)`?/i);
  if (deleteMatch) return { action: 'delete', table: deleteMatch[1] };

  return null;
}

async function writeAuditLog(input: {
  tenantId: string;
  actorUserId?: string | null;
  tabela: string;
  registroId?: string | null;
  acao: AuditAction;
  detalhes?: Record<string, any>;
}) {
  try {
    const { query: dbQuery } = await import('@/lib/db');
    await dbQuery(
      `INSERT INTO audit_log (id, tenant_id, actor_user_id, tabela, registro_id, acao, detalhes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        crypto.randomUUID(),
        input.tenantId,
        input.actorUserId ?? null,
        input.tabela,
        input.registroId ?? null,
        input.acao,
        JSON.stringify(input.detalhes ?? {}),
      ],
    );
  } catch {
    // Audit logging must never block business flows.
  }
}

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
    const ipContext = await getClientIpContext();
    const { loginUser } = await import('@/lib/auth');
    const result = await loginUser(data.email, data.password);
    if ('error' in result) {
      throw new Error(result.error);
    }

    await writeAuditLog({
      tenantId: result.user.tenant_id,
      actorUserId: result.user.id,
      tabela: 'users',
      registroId: result.user.id,
      acao: 'login',
      detalhes: {
        event_type: 'login',
        email: result.user.email,
        must_change_password: Boolean(result.user.must_change_password),
        ...ipContext,
      },
    });

    return result;
  }
);

const serverCreateUserFn = createServerFn({ method: 'POST' }).handler(
  async ({ data }: { data: { email: string; password: string; nome: string; role: string; funcionario_id?: string; tenantId?: string; tenantSlug?: string; tenantName?: string; tenantCode?: string; actorUserId?: string | null } }) => {
    const ipContext = await getClientIpContext();
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

    await writeAuditLog({
      tenantId: result.user.tenant_id,
      actorUserId: data.actorUserId ?? null,
      tabela: 'users',
      registroId: result.user.id,
      acao: 'create',
      detalhes: {
        event_type: 'create_user',
        email: result.user.email,
        role: data.role,
        funcionario_id: data.funcionario_id ?? null,
        ...ipContext,
      },
    });

    return result;
  }
);

const serverChangeUserRoleFn = createServerFn({ method: 'POST' }).handler(
  async ({ data }: { data: { userId: string; role: string; tenantId: string; actorUserId?: string | null } }) => {
    const ipContext = await getClientIpContext();
    const { changeUserRole } = await import('@/lib/auth');
    const ok = await changeUserRole(data.userId, data.role, data.tenantId);
    if (!ok) {
      throw new Error('Falha ao atualizar perfil do usuario');
    }

    await writeAuditLog({
      tenantId: data.tenantId,
      actorUserId: data.actorUserId ?? null,
      tabela: 'user_roles',
      registroId: data.userId,
      acao: 'update',
      detalhes: {
        event_type: 'change_user_role',
        new_role: data.role,
        ...ipContext,
      },
    });

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
  async ({ data }: { data: { userId: string; tenantId: string; actorUserId: string; actorPassword: string } }) => {
    const ipContext = await getClientIpContext();
    const { findUserById, verifyPassword, updateUserPassword } = await import('@/lib/auth');
    const actor = await findUserById(data.actorUserId, data.tenantId);
    if (!actor) {
      throw new Error('Usuario autenticado nao encontrado');
    }

    const actorPasswordOk = await verifyPassword(data.actorPassword, actor.password_hash);
    if (!actorPasswordOk) {
      throw new Error('Senha atual invalida');
    }

    const newPassword = generateTempPassword();
    const ok = await updateUserPassword(data.userId, newPassword, data.tenantId);
    if (!ok) {
      throw new Error('Falha ao redefinir senha');
    }

    await writeAuditLog({
      tenantId: data.tenantId,
      actorUserId: data.actorUserId,
      tabela: 'users',
      registroId: data.userId,
      acao: 'update',
      detalhes: {
        event_type: 'reset_user_password',
        ...ipContext,
      },
    });

    return { password: newPassword };
  }
);

const serverChangeOwnPasswordFn = createServerFn({ method: 'POST' }).handler(
  async ({ data }: { data: { userId: string; tenantId: string; password: string } }) => {
    const ipContext = await getClientIpContext();
    const { changeOwnPassword } = await import('@/lib/auth');
    const ok = await changeOwnPassword(data.userId, data.password, data.tenantId);
    if (!ok) {
      throw new Error('Falha ao alterar senha');
    }

    await writeAuditLog({
      tenantId: data.tenantId,
      actorUserId: data.userId,
      tabela: 'users',
      registroId: data.userId,
      acao: 'update',
      detalhes: {
        event_type: 'change_own_password',
        ...ipContext,
      },
    });

    return { success: true };
  }
);

const serverLogoutFn = createServerFn({ method: 'POST' }).handler(
  async ({ data }: { data: { userId: string; tenantId: string; reason?: string } }) => {
    const ipContext = await getClientIpContext();
    await writeAuditLog({
      tenantId: data.tenantId,
      actorUserId: data.userId,
      tabela: 'users',
      registroId: data.userId,
      acao: 'logout',
      detalhes: {
        event_type: 'logout',
        reason: data.reason ?? 'manual',
        ...ipContext,
      },
    });
    return { success: true };
  }
);

const serverLogPageAccessFn = createServerFn({ method: 'POST' }).handler(
  async ({ data }: { data: { userId: string; tenantId: string; path: string } }) => {
    const ipContext = await getClientIpContext();
    await writeAuditLog({
      tenantId: data.tenantId,
      actorUserId: data.userId,
      tabela: 'pages',
      registroId: null,
      acao: 'other',
      detalhes: {
        event_type: 'page_access',
        path: data.path,
        ...ipContext,
      },
    });
    return { success: true };
  }
);

const serverQueryFn = createServerFn({ method: 'POST' }).handler(
  async ({ data }: { data: { sql: string; values?: any[]; audit?: MutationAuditMeta } }) => {
    const ipContext = await getClientIpContext();
    const { query: dbQuery } = await import('@/lib/db');
    const [rows] = await dbQuery(data.sql, data.values);

    const mutation = getMutationInfo(data.sql);
    if (mutation && data.audit?.tenantId) {
      await writeAuditLog({
        tenantId: data.audit.tenantId,
        actorUserId: data.audit.actorUserId ?? null,
        tabela: mutation.table,
        registroId: null,
        acao: mutation.action,
        detalhes: {
          event_type: 'db_mutation',
          source_path: data.audit.sourcePath ?? null,
          sql: data.sql,
          values_count: Array.isArray(data.values) ? data.values.length : 0,
          ...ipContext,
        },
      });
    }

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
  actorUserId?: string | null;
}) {
  return serverCreateUserFn({ data: payload });
}

export async function serverChangeUserRole(payload: { userId: string; role: string; tenantId: string; actorUserId?: string | null }) {
  return serverChangeUserRoleFn({ data: payload });
}

export async function serverResetUserPassword(payload: { userId: string; tenantId: string; actorUserId: string; actorPassword: string }) {
  return serverResetUserPasswordFn({ data: payload });
}

export async function serverChangeOwnPassword(payload: { userId: string; tenantId: string; password: string }) {
  return serverChangeOwnPasswordFn({ data: payload });
}

export async function serverQuery(payload: { sql: string; values?: any[] }) {
  let audit: MutationAuditMeta | undefined;
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem('user');
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed?.tenant_id) {
        audit = {
          actorUserId: parsed?.id ?? null,
          tenantId: parsed.tenant_id,
          sourcePath: window.location?.pathname ?? null,
        };
      }
    } catch {
      // no-op
    }
  }

  return serverQueryFn({ data: { ...payload, audit } });
}

export async function serverQueryOne<T = any>(payload: { sql: string; values?: any[] }) {
  return serverQueryOneFn({ data: payload }) as Promise<T | null>;
}

export async function serverLogout(payload: { userId: string; tenantId: string; reason?: string }) {
  return serverLogoutFn({ data: payload });
}

export async function serverLogPageAccess(payload: { userId: string; tenantId: string; path: string }) {
  return serverLogPageAccessFn({ data: payload });
}
