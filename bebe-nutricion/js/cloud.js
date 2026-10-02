// Sincronización opcional con Supabase (cuenta con email + contraseña, hogar compartido por código).
// La clave "publishable" es pública por diseño: los datos los protege RLS (solo miembros del hogar).
const URL = 'https://apuzvzckhdxjbbkimayp.supabase.co';
const KEY = 'sb_publishable_C2wURyHqHErvkxCTIemlQA_g1bcAOw3';

let sb = null, channel = null;
const loadScript = (src) => new Promise((ok, err) => { if (window.supabase) return ok(); const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = err; document.head.append(s); });

async function client() {
  if (sb) return sb;
  await loadScript('vendor/supabase.js');
  sb = window.supabase.createClient(URL, KEY, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'cucharadas:auth' } });
  return sb;
}

const MSG = { 'Invalid login credentials': 'Email o contraseña incorrectos', 'Failed to fetch': 'No hay conexión con internet' };
const fail = (e) => { throw new Error(MSG[e?.message] || e?.message || 'Algo salió mal'); };

export async function session() { try { return (await (await client()).auth.getSession()).data.session; } catch { return null; } }

export async function signUp({ email, password, name }) {
  const r = await fetch(`${URL}/functions/v1/signup`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: KEY, Authorization: `Bearer ${KEY}` }, body: JSON.stringify({ email, password, name }) }).catch(() => null);
  if (!r) fail({ message: 'Failed to fetch' });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) fail({ message: j.error });
  return signIn({ email, password });
}
export async function signIn({ email, password }) {
  const { data, error } = await (await client()).auth.signInWithPassword({ email: email.trim().toLowerCase(), password }).catch((e) => ({ error: e }));
  if (error) fail(error);
  return data.user;
}
export async function signOut() { unsubscribe(); try { await (await client()).auth.signOut(); } catch { /* sin conexión */ } }

// Hogar al que pertenece el usuario (o null) + miembros
export async function myHousehold() {
  const c = await client();
  const { data: ms, error } = await c.from('members').select('household_id, display_name').limit(1);
  if (error) fail(error);
  if (!ms.length) return null;
  const hid = ms[0].household_id;
  const [h, all] = await Promise.all([c.from('households').select('*').eq('id', hid).single(), c.from('members').select('display_name, user_id').eq('household_id', hid)]);
  if (h.error) fail(h.error);
  return { household: h.data, members: all.data || [], displayName: ms[0].display_name };
}
export async function createHousehold(displayName, baby, plan) {
  const { data, error } = await (await client()).rpc('create_household', { p_display_name: displayName, p_baby_name: baby.name, p_baby_birth: baby.birth, p_plan: plan || null });
  if (error) fail(error);
  return data;
}
export async function joinHousehold(code, displayName) {
  const { data, error } = await (await client()).rpc('join_household', { p_code: code, p_display_name: displayName });
  if (error) fail({ message: /inv/i.test(error.message) ? 'Ese código no existe' : error.message });
  return data;
}
export async function updateHousehold(hid, { baby, plan }) {
  const patch = {}; if (baby) { patch.baby_name = baby.name; patch.baby_birth = baby.birth; } if (plan !== undefined) patch.plan = plan;
  const { error } = await (await client()).from('households').update(patch).eq('id', hid); if (error) fail(error);
}

export async function pull(hid, since) {
  const c = await client();
  let q = c.from('entries').select('id, data, deleted, updated_at').eq('household_id', hid).order('updated_at', { ascending: true }).limit(1000);
  if (since) q = q.gt('updated_at', since);
  const { data, error } = await q; if (error) fail(error);
  return data;
}
export async function push(hid, entries, tombs) {
  const c = await client();
  const rows = [...entries.map((e) => ({ id: e.id, household_id: hid, ts: new Date(e.ts).toISOString(), data: e, deleted: false })), ...tombs.map((t) => ({ id: t.id, household_id: hid, ts: new Date(t.u).toISOString(), data: {}, deleted: true }))];
  for (let i = 0; i < rows.length; i += 200) { const { error } = await c.from('entries').upsert(rows.slice(i, i + 200)); if (error) fail(error); }
}

export async function subscribe(hid, onChange) {
  unsubscribe();
  const c = await client();
  channel = c.channel('hogar-' + hid)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'entries', filter: `household_id=eq.${hid}` }, onChange)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'households', filter: `id=eq.${hid}` }, onChange)
    .subscribe();
}
export function unsubscribe() { if (channel && sb) sb.removeChannel(channel); channel = null; }
