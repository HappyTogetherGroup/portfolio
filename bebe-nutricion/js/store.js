// Almacenamiento 100% local (localStorage). Sin servidor, sin contraseña: un perfil por nombre.
const KEY = 'cucharadas:v1';

const blank = () => ({ users: {}, current: null });
let db = blank();

export function load() {
  try { db = JSON.parse(localStorage.getItem(KEY)) || blank(); } catch { db = blank(); }
  if (!db.users) db = blank();
  return db;
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { /* modo privado o lleno */ }
}
const slug = (n) => n.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ');

export const users = () => Object.values(db.users).sort((a, b) => b.lastSeen - a.lastSeen);
export const me = () => (db.current && db.users[db.current]) || null;

export function signIn(name) {
  const clean = name.trim().replace(/\s+/g, ' ');
  if (!clean) return null;
  const id = slug(clean);
  db.users[id] ||= { id, name: clean, baby: null, entries: [], allergens: {}, created: Date.now(), lastSeen: 0 };
  db.users[id].lastSeen = Date.now();
  db.current = id;
  save();
  return db.users[id];
}
export function signOut() { db.current = null; save(); }
export function setBaby(baby) { me().baby = baby; save(); }

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
export function addEntry(entry) {
  const e = { id: uid(), ...entry };
  me().entries.push(e);
  save();
  return e;
}
export function updateEntry(id, patch) {
  const u = me(); const i = u.entries.findIndex((e) => e.id === id);
  if (i >= 0) { u.entries[i] = { ...u.entries[i], ...patch }; save(); }
}
export function removeEntry(id) {
  const u = me(); u.entries = u.entries.filter((e) => e.id !== id); save();
}

export function exportJSON() { return JSON.stringify(me(), null, 2); }
export function importJSON(text) {
  const data = JSON.parse(text);
  if (!data || !Array.isArray(data.entries) || !data.name) throw new Error('Archivo inválido');
  const id = slug(data.name);
  db.users[id] = { ...data, id, lastSeen: Date.now() };
  db.current = id;
  save();
}
export function deleteProfile() { delete db.users[db.current]; db.current = null; save(); }
