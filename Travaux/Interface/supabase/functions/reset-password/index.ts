// Edge function: redefine senha de um usuário (apenas Proprietário ou Administrador)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function generatePassword(len = 10) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  const buf = new Uint8Array(len);
  crypto.getRandomValues(buf);
  for (let i = 0; i < len; i++) out += chars[buf[i] % chars.length];
  return out;
}

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

    const { user_id, password } = await req.json() ?? {};
    if (!user_id) return new Response(JSON.stringify({ error: "user_id obrigatório" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });

    const newPassword = (typeof password === "string" && password.length >= 6) ? password : generatePassword(10);

    const { error } = await admin.auth.admin.updateUserById(user_id, { password: newPassword });
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });

    return new Response(JSON.stringify({ ok: true, password: newPassword }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
