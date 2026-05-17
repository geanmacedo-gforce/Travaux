// Edge function: cria um novo usuário (apenas Proprietário ou Administrador)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const auth = req.headers.get("Authorization") ?? "";

    const userClient = createClient(url, anon, { global: { headers: { Authorization: auth } } });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) return new Response(JSON.stringify({ error: "Não autenticado" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });

    const admin = createClient(url, service);
    const { data: roleRow } = await admin.from("user_roles").select("role").eq("user_id", u.user.id).maybeSingle();
    const role = roleRow?.role;
    if (role !== "proprietario" && role !== "admin") {
      return new Response(JSON.stringify({ error: "Sem permissão" }), { status: 403, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const body = await req.json();
    const { email, password, nome, role: newRole, funcionario_id } = body ?? {};
    if (!email || !password || !nome || !newRole) {
      return new Response(JSON.stringify({ error: "Campos obrigatórios faltando" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email, password, email_confirm: true, user_metadata: { nome, role: newRole },
    });
    if (cErr || !created.user) return new Response(JSON.stringify({ error: cErr?.message ?? "Falha ao criar" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });

    // Garante o papel correto e o vínculo (handle_new_user já cria profile/role)
    await admin.from("user_roles").delete().eq("user_id", created.user.id);
    await admin.from("user_roles").insert({ user_id: created.user.id, role: newRole });
    if (funcionario_id) await admin.from("profiles").update({ funcionario_id }).eq("id", created.user.id);

    return new Response(JSON.stringify({ ok: true, user_id: created.user.id }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
