// Resolves a username to its account server-side and signs in, so private emails never reach the client.
// Deploy: supabase functions deploy username-login --no-verify-jwt
import { createClient } from 'jsr:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const GENERIC = { error: "That email or username and password don't match." };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  let body: { username?: string; password?: string };
  try { body = await req.json(); } catch { return json(GENERIC, 400); }
  const username = String(body.username || '').trim();
  const password = String(body.password || '');
  if (!/^[A-Za-z0-9._]{3,20}$/.test(username) || password.length < 8) return json(GENERIC, 400);

  const url = Deno.env.get('SUPABASE_URL')!;
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const { data: prof } = await admin.from('profiles').select('id').eq('username', username).maybeSingle();
  if (!prof) { await new Promise((r) => setTimeout(r, 400)); return json(GENERIC, 400); }
  const { data: u } = await admin.auth.admin.getUserById(prof.id);
  const email = u?.user?.email;
  if (!email) return json(GENERIC, 400);

  const anon = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { auth: { persistSession: false } });
  const { data, error } = await anon.auth.signInWithPassword({ email, password });
  if (error) {
    if (/confirm/i.test(error.message)) return json({ unverified: true }, 400);
    return json(GENERIC, error.status === 429 ? 429 : 400);
  }
  return json({ access_token: data.session!.access_token, refresh_token: data.session!.refresh_token });
});
