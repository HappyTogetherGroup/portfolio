// Motor de consejos: reglas simples y transparentes sobre el historial. Todo local.
export const DAY = 864e5;
export const startOfDay = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };

export const UNITS = {
  mordisco: { s: 'mordisco', p: 'mordiscos', w: 1 },
  trocito: { s: 'trocito', p: 'trocitos', w: 1 },
  cucharadita: { s: 'cucharadita', p: 'cucharaditas', w: 1.5 },
  cucharada: { s: 'cucharada', p: 'cucharadas', w: 3 },
};
export const unitLabel = (u, n) => (UNITS[u] ? (n === 1 ? UNITS[u].s : UNITS[u].p) : u);
export const qtyText = (it) => `${it.qty} ${unitLabel(it.unit, it.qty)}`;
export const weight = (it) => it.qty * (UNITS[it.unit]?.w || 1);

export const MEALS = { desayuno: '🌅', almuerzo: '🍽️', merienda: '🍪', cena: '🌙', colacion: '🍓' };
export const MEAL_NAMES = { desayuno: 'Desayuno', almuerzo: 'Almuerzo', merienda: 'Merienda', cena: 'Cena', colacion: 'Colación' };
export const GROUPS = {
  verduras: { n: 'Verduras', e: '🥦' }, frutas: { n: 'Frutas', e: '🍎' }, cereales: { n: 'Cereales', e: '🌾' },
  legumbres: { n: 'Legumbres', e: '🫘' }, carnes: { n: 'Carnes', e: '🥩' }, pescados: { n: 'Pescados', e: '🐟' },
  huevo: { n: 'Huevo', e: '🥚' }, lacteos: { n: 'Lácteos', e: '🧀' }, grasas: { n: 'Grasas y semillas', e: '🥑' },
};
export const WEEKLY_GROUPS = ['verduras', 'frutas', 'cereales', 'legumbres', 'carnes', 'lacteos', 'grasas'];

export function ageOf(birth, now = Date.now()) {
  const b = new Date(birth), n = new Date(now);
  let months = (n.getFullYear() - b.getFullYear()) * 12 + n.getMonth() - b.getMonth();
  if (n.getDate() < b.getDate()) months--;
  const anchor = new Date(b); anchor.setMonth(b.getMonth() + months);
  const days = Math.max(0, Math.floor((startOfDay(n) - startOfDay(anchor)) / DAY));
  return { months: Math.max(0, months), days };
}
export const stageOf = (months) => (months < 7 ? '6m' : months < 8 ? '7m' : months < 9 ? '8m' : months < 12 ? '9m' : '12m');

// Plan del pediatra: { groups: [...permitidos], until: 'YYYY-MM-DD'|'', note }
export function activePlan(user, now = Date.now()) {
  const p = user.plan;
  if (!p || (!p.groups?.length && !p.note)) return null;
  if (p.until && startOfDay(new Date(p.until + 'T12:00').getTime()) < startOfDay(now)) return null;
  return p;
}
export const allowedByPlan = (plan, food) => !plan || !plan.groups?.length || plan.groups.includes(food?.grupo);

export function flatItems(entries) {
  return entries.flatMap((e) => e.items.map((it) => ({ ...it, ts: e.ts, meal: e.meal, entryId: e.id, reaction: e.reaction })));
}

// Resumen por alimento: veces ofrecido, primera vez, gustos, reacciones
export function foodStats(entries, foodsById) {
  const stats = {};
  for (const it of flatItems(entries)) {
    const key = it.foodId || 'x:' + it.name.toLowerCase();
    const s = (stats[key] ||= { key, foodId: it.foodId, name: it.name, count: 0, first: it.ts, last: it.ts, likes: [], reaction: null, food: foodsById[it.foodId] });
    s.count++; s.first = Math.min(s.first, it.ts); s.last = Math.max(s.last, it.ts);
    if (it.like) s.likes.push(it.like);
    if (it.reaction && it.reaction.level && it.reaction.level !== 'none') s.reaction = it.reaction.level;
  }
  return stats;
}

export function streak(entries, now = Date.now()) {
  const days = new Set(entries.map((e) => startOfDay(e.ts)));
  let d = startOfDay(now), n = 0;
  if (!days.has(d)) d -= DAY; // si todavía no comió hoy, no corta la racha
  while (days.has(d)) { n++; d -= DAY; }
  return n;
}

export function weekDays(entries, now = Date.now()) {
  const today = startOfDay(now);
  const days = new Set(entries.map((e) => startOfDay(e.ts)));
  const dow = (new Date(today).getDay() + 6) % 7; // lunes = 0
  return Array.from({ length: 7 }, (_, i) => {
    const t = today - (dow - i) * DAY;
    return { t, label: 'LMMJVSD'[i], on: days.has(t), today: t === today, future: t > today };
  });
}

// ---- Consejos del día ----
export function advise({ entries, foods, allergens, tips, user, now = Date.now() }) {
  const out = [];
  if (!user.baby) return out;
  const foodsById = Object.fromEntries(foods.map((f) => [f.id, f]));
  const age = ageOf(user.baby.birth, now);
  const stats = foodStats(entries, foodsById);
  const today = startOfDay(now);
  const recent = entries.filter((e) => e.ts >= today - 2 * DAY);
  const recentFoods = new Set(flatItems(recent).map((i) => i.foodId));
  const todayEntries = entries.filter((e) => startOfDay(e.ts) === today);
  const name = user.baby.name || 'tu bebé';

  // 1) Reacciones recientes → prioridad máxima
  const lastReact = [...entries].reverse().find((e) => e.reaction && e.reaction.level && e.reaction.level !== 'none' && now - e.ts < 3 * DAY);
  if (lastReact) {
    const important = lastReact.reaction.level === 'importante';
    out.push({
      kind: 'warn', icon: '🩺', id: 'reaction',
      title: important ? 'Hablá con el pediatra' : 'Anotaste una reacción',
      text: important
        ? `Registraste una reacción importante. Si hay dificultad para respirar, hinchazón de labios o cara, o vómitos repetidos, andá a urgencias. Antes de volver a ofrecer ese alimento, consultá.`
        : `Observá a ${name} unos días y no sumes alimentos nuevos hasta que se calme. Si empeora, consultá al pediatra.`,
    });
  }

  // 1b) Indicaciones del pediatra: mandan sobre cualquier sugerencia automática
  const plan = activePlan(user, now);
  if (plan) {
    const gs = (plan.groups || []).map((g) => GROUPS[g]?.n.toLowerCase()).filter(Boolean).join(', ');
    out.push({ kind: 'good', icon: '👩‍⚕️', id: 'plan', title: 'Indicaciones de tu pediatra',
      text: [gs && `Por ahora: ${gs}.`, plan.note && plan.note.replace(/[.\s]+$/, '') + '.', plan.until && `Hasta el control (${new Date(plan.until + 'T12:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })}).`].filter(Boolean).join(' ') + ' Las sugerencias de abajo respetan este plan.', noPed: true });
  }

  // 2) Primer día
  if (!entries.length) {
    out.push({ kind: 'info', icon: '🥄', id: 'first', title: 'Empezá con poquito', text: `Consultá con tu pediatra por dónde empezar. En general, un par de cucharaditas o mordiscos alcanzan. La leche sigue siendo el alimento principal; ahora ${name} explora sabores y texturas.`, cta: true });
    return out;
  }

  // 3) Hierro
  const lastIron = flatItems(entries).filter((i) => foodsById[i.foodId]?.ricoEnHierro).sort((a, b) => b.ts - a.ts)[0];
  if ((!lastIron || now - lastIron.ts > 2 * DAY) && !(plan && plan.groups?.length)) {
    const ideas = foods.filter((f) => f.ricoEnHierro && !(stats[f.id]?.reaction) && !f.alergeno && !/higado|hígado/i.test(f.id + f.nombre)).slice(0, 40);
    const pick = ideas.length ? ideas[Math.floor((today / DAY) % ideas.length)] : null;
    out.push({ kind: 'info', icon: '🩸', id: 'iron', title: 'Sumá hierro', text: `A partir de los 6 meses las reservas de hierro bajan. ${pick ? `Una opción para charlar con tu pediatra: ${pick.emoji} ${pick.nombre.toLowerCase()}.` : 'Probá carne, legumbres bien cocidas o yema de huevo.'}`, food: pick?.id, cta: true });
  }

  // 4) Alérgenos pendientes (de a uno, con 2-3 días de espacio)
  if (!lastReact && !(plan && plan.groups?.length)) {
    const introduced = new Set(Object.values(stats).map((s) => s.food?.alergeno).filter(Boolean));
    const newestAllergen = Object.values(stats).filter((s) => s.food?.alergeno).sort((a, b) => b.first - a.first)[0];
    const waited = !newestAllergen || now - newestAllergen.first >= 2 * DAY;
    const pending = (allergens?.alergenos || []).filter((a) => !introduced.has(a.id));
    if (pending.length && waited && age.months >= 6) {
      const next = pending[0];
      out.push({ kind: 'good', icon: next.emoji || '🧪', id: 'allergen-next', title: `Alérgeno a consultar: ${next.nombre.toLowerCase()}`, text: 'Preguntale a tu pediatra cuándo y cómo empezar. Si te da el visto bueno, ofrecelo solo, en poca cantidad y temprano en el día, así podés observar cómo le cae.', allergen: next.id });
    }
  }

  // 5) Mantener alérgenos introducidos
  for (const s of Object.values(stats)) {
    if (s.food?.alergeno && !s.reaction && now - s.last > 7 * DAY && s.count < 8) {
      out.push({ kind: 'tip', icon: '🔁', id: 'keep-' + s.key, title: `Volvé a ofrecer ${s.name.toLowerCase()}`, text: 'Mantener los alérgenos en la dieta, un par de veces por semana, ayuda a sostener la tolerancia.' });
      break;
    }
  }

  // 6) Gustos: re-ofrecer lo rechazado
  const rejected = Object.values(stats).filter((s) => s.likes.length && s.likes.slice(-2).every((l) => l <= 2) && s.count < 10 && !s.reaction && now - s.last > DAY);
  if (rejected.length) {
    const s = rejected[0];
    out.push({ kind: 'tip', icon: '😝', id: 'reoffer-' + s.key, title: `${s.name} todavía no le convence`, text: `Van ${s.count} intento${s.count > 1 ? 's' : ''}. Es normal: pueden hacer falta 8 a 15 exposiciones. Probalo de otra forma (otra textura, mezclado con algo que ya le gusta).` });
  }

  // 7) Variedad semanal
  const week = flatItems(entries.filter((e) => e.ts >= today - 6 * DAY));
  const covered = new Set(week.map((i) => foodsById[i.foodId]?.grupo).filter(Boolean));
  const missing = WEEKLY_GROUPS.filter((g) => !covered.has(g));
  if (entries.length >= 4 && missing.length && !(plan && plan.groups?.length)) {
    const g = missing[0];
    out.push({ kind: 'info', icon: GROUPS[g].e, id: 'group-' + g, title: `Falta ${GROUPS[g].n.toLowerCase()} esta semana`, text: `Sumar ${GROUPS[g].n.toLowerCase()} da variedad de nutrientes. Consultá con tu pediatra cuándo incorporarlo.`, cta: true });
  }

  // 8) Textura
  const bigAge = age.months >= 8;
  const textures = new Set(entries.slice(-6).map((e) => e.texture).filter(Boolean));
  if (bigAge && textures.size === 1 && textures.has('pure')) {
    out.push({ kind: 'tip', icon: '🧑‍🍳', id: 'texture', title: 'Hora de sumar texturas', text: 'A esta edad conviene ir pasando de puré liso a aplastado y trocitos blandos para que mastique y explore.' });
  }

  // 9) Hoy
  if (!todayEntries.length) {
    out.push({ kind: 'info', icon: '🍴', id: 'today', title: 'Todavía no registraste nada hoy', text: 'Cuando le des de comer, anotalo en dos toques.', cta: true });
  }

  // 10) Tip del día
  const stageTips = (tips || []).filter((t) => t.etapa === 'todas' || t.etapa === stageOf(age.months));
  if (stageTips.length) {
    const t = stageTips[Math.floor(today / DAY) % stageTips.length];
    out.push({ kind: 'tip', icon: '💡', id: 'tip', title: t.titulo, text: t.texto, tipId: t.id });
  }
  return out;
}

// Sugerencias de alimentos para la próxima comida (pantalla de registro)
export function suggestFoods({ entries, foods, user, now = Date.now(), n = 6 }) {
  const foodsById = Object.fromEntries(foods.map((f) => [f.id, f]));
  const stats = foodStats(entries, foodsById);
  const recent = new Set(flatItems(entries.filter((e) => e.ts > now - DAY)).map((i) => i.foodId));
  const score = (f) => {
    const s = stats[f.id];
    let p = 0;
    if (f.ricoEnHierro && !plan?.groups?.length) p += 3;
    if (!s) p += 2; else p -= Math.min(s.count, 4) * 0.4;
    if (s?.reaction) p -= 10;
    if (recent.has(f.id)) p -= 2;
    if (f.alergeno && !s) p -= 1; // los alérgenos se sugieren aparte
    return p + Math.random() * 0.8;
  };
  const plan = activePlan(user, now);
  return foods.filter((f) => !stats[f.id]?.reaction && allowedByPlan(plan, f)).map((f) => [f, score(f)]).sort((a, b) => b[1] - a[1]).slice(0, n).map((x) => x[0]);
}
