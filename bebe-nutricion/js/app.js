import * as store from './store.js';
import {
  advise, suggestFoods, activePlan, allowedByPlan, ageOf, stageOf, foodStats, flatItems, streak, weekDays, startOfDay, DAY,
  UNITS, unitLabel, qtyText, MEALS, MEAL_NAMES, GROUPS, WEEKLY_GROUPS,
} from './engine.js';

const $ = (s, r = document) => r.querySelector(s);
const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const data = { foods: [], allergens: { intro: '', alergenos: [] }, tips: [], fuentes: { fuentes: [], progresionPorEtapa: [], cantidadesReferencia: {} } };
let foodsById = {};
const ui = { tipLimit: 8, tab: 'hoy', tipCat: 'todos', foodGroup: 'todos', dismissed: new Set() };

const ICON = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
  chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
  bulb: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z"/></svg>',
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
};

// ---------- Arranque ----------
async function boot() {
  store.load();
  const get = (f, d) => fetch(`data/${f}`).then((r) => (r.ok ? r.json() : d)).catch(() => d);
  const [foods, allergens, tips, fuentes] = await Promise.all([
    get('foods.json', []), get('alergenos.json', data.allergens), get('tips.json', []), get('fuentes.json', data.fuentes),
  ]);
  data.foods = foods; data.allergens = allergens; data.tips = tips; data.fuentes = fuentes;
  foodsById = Object.fromEntries(foods.map((f) => [f.id, f]));
  render();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
}

// ---------- Render raíz ----------
function render() {
  const app = $('#app');
  const u = store.me();
  if (!u) return (app.innerHTML = welcomeView());
  if (!u.baby) return (app.innerHTML = babyView(u));
  const views = { hoy: todayView, progreso: progressView, consejos: tipsView, perfil: profileView };
  app.innerHTML = `<div class="shell"><main class="view" id="view">${views[ui.tab](u)}</main>${tabbar()}</div>`;
}
function setTab(t) { ui.tab = t; render(); window.scrollTo(0, 0); }

function tabbar() {
  const t = (id, label, icon) => `<button class="tab" data-act="tab" data-id="${id}" ${ui.tab === id ? 'aria-current="page"' : ''}>${icon}<span>${label}</span></button>`;
  return `<div class="tabbar"><nav aria-label="Principal">
    ${t('hoy', 'Hoy', ICON.home)}${t('progreso', 'Progreso', ICON.chart)}
    <button class="fab" data-act="log" aria-label="Registrar comida">${ICON.plus}</button>
    ${t('consejos', 'Consejos', ICON.bulb)}${t('perfil', 'Perfil', ICON.user)}
  </nav></div>`;
}

// ---------- Bienvenida / perfil ----------
function welcomeView() {
  const us = store.users();
  return `<div class="welcome shell stagger">
    <div style="--i:0"><span class="hero" aria-hidden="true">🥄</span></div>
    <h1 class="display h1" style="--i:1;font-size:40px">Primeras<br>Cucharadas</h1>
    <p class="muted" style="--i:2;margin:12px 0 26px;font-size:17px">Anotá lo que come tu bebé, mordisco a mordisco, y recibí consejos para seguir.</p>
    ${us.length ? `<div class="col" style="--i:3;margin-bottom:22px"><span class="label">Volver a entrar</span>
      ${us.map((u) => `<button class="user-pill" data-act="signin" data-name="${esc(u.name)}"><span class="avatar">${esc(u.name[0].toUpperCase())}</span><span class="grow"><b>${esc(u.name)}</b><br><span class="small muted">${u.baby ? esc(u.baby.name) : 'Sin bebé cargado'}</span></span></button>`).join('')}</div>` : ''}
    <form class="col" data-form="signin" style="--i:4">
      <label class="field"><span class="label">${us.length ? 'O entrá con otro nombre' : '¿Cómo te llamás?'}</span>
        <input class="input" name="name" autocomplete="given-name" autocapitalize="words" placeholder="Tu nombre" maxlength="40" required></label>
      <button class="btn primary block" type="submit">Entrar</button>
      <p class="small muted" style="text-align:center">Sin contraseña. Todo queda guardado solo en este celular.</p>
    </form></div>`;
}

function babyView(u) {
  const sixMonthsAgo = new Date(Date.now() - 183 * DAY).toISOString().slice(0, 10);
  return `<div class="welcome shell stagger">
    <p class="eyebrow" style="--i:0">Hola, ${esc(u.name)}</p>
    <h1 class="display h1" style="--i:1;margin:6px 0 22px">Contame de tu bebé</h1>
    <form class="col" data-form="baby" style="--i:2">
      <label class="field"><span class="label">Nombre del bebé</span><input class="input" name="baby" placeholder="Nombre" maxlength="40" required></label>
      <label class="field"><span class="label">Fecha de nacimiento</span><input class="input" type="date" name="birth" value="${sixMonthsAgo}" max="${new Date().toISOString().slice(0, 10)}" required></label>
      <button class="btn primary block" type="submit">Empezar</button>
      <button class="btn ghost block" type="button" data-act="signout">Cambiar de usuario</button>
    </form></div>`;
}

// ---------- Hoy ----------
function adviceCard(a, i) {
  return `<div class="advice ${a.kind}" style="--i:${i}"><div class="ico" aria-hidden="true">${a.icon}</div>
    <div class="grow"><h3>${esc(a.title)}</h3><p>${esc(a.text)}</p>
    ${a.noPed || a.kind === 'tip' && a.id === 'tip' ? '' : '<p class="small ped">👩‍⚕️ Consultalo con tu pediatra antes de aplicarlo.</p>'}
    ${a.allergen ? `<button class="btn ghost sm" style="margin-top:10px" data-act="allergen" data-id="${esc(a.allergen)}">Ver cómo introducirlo</button>` : ''}${a.cta ? `<button class="btn primary sm" style="margin-top:10px" data-act="log"${a.food ? ` data-food="${esc(a.food)}"` : ''}>Registrar comida</button>` : ''}</div></div>`;
}

function mealCard(e) {
  const time = new Date(e.ts).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  const faces = ['', '😖', '😕', '😐', '🙂', '😍'];
  const react = e.reaction && e.reaction.level !== 'none' ? `<span class="chip tag warn">Reacción ${esc(e.reaction.level)}</span>` : '';
  return `<article class="card meal"><div class="meal-head"><span style="font-size:22px">${MEALS[e.meal] || '🍴'}</span>
    <span class="when grow">${MEAL_NAMES[e.meal] || 'Comida'} <span class="time">${time}${e.by ? ' · ' + esc(e.by) : ''}</span></span>${react}
    <button class="icon-btn" style="width:36px;height:36px" data-act="del-entry" data-id="${e.id}" aria-label="Borrar comida">${ICON.trash}</button></div>
    ${e.items.map((it) => `<div class="item"><span class="emoji">${esc(it.emoji || foodsById[it.foodId]?.emoji || '🍽️')}</span><span class="grow"><b>${esc(it.name)}</b></span><span class="qty num">${esc(qtyText(it))}</span><span class="like">${faces[it.like] || ''}</span></div>`).join('')}
    ${e.note ? `<p class="small muted" style="margin-top:8px">“${esc(e.note)}”</p>` : ''}</article>`;
}

const backupDue = (u) => u.entries.length >= 3 && Date.now() - (u.lastBackup || Math.min(...u.entries.map((e) => e.ts))) > 7 * DAY;

function todayView(u) {
  const now = Date.now(), today = startOfDay(now);
  const age = ageOf(u.baby.birth, now);
  const todays = u.entries.filter((e) => startOfDay(e.ts) === today).sort((a, b) => a.ts - b.ts);
  const stats = foodStats(u.entries, foodsById);
  const tried = Object.keys(stats).length;
  const advice = advise({ entries: u.entries, foods: data.foods, allergens: data.allergens, tips: data.tips, user: u }).filter((a) => !ui.dismissed.has(a.id));
  const hour = new Date().getHours();
  const hello = hour < 6 ? 'Buenas noches' : hour < 13 ? 'Buen día' : hour < 20 ? 'Buenas tardes' : 'Buenas noches';
  const ageText = age.months >= 12 ? `${Math.floor(age.months / 12)} año${age.months >= 24 ? 's' : ''}${age.months % 12 ? ` y ${age.months % 12} m` : ''}` : `${age.months} meses${age.days ? ` y ${age.days} d` : ''}`;
  const week = weekDays(u.entries, now);
  return `<div class="stagger">
    <header class="topbar" style="--i:0"><div><p class="eyebrow">${hello}, ${esc(u.name)}</p><h1 class="display h1">${esc(u.baby.name)}</h1></div><span class="age-badge">🌱 ${ageText}</span></header>
    <div class="stats" style="--i:1">
      <div class="stat"><b class="num">${tried}</b><span>alimentos probados</span></div>
      <div class="stat"><b class="num">${streak(u.entries)}</b><span>${streak(u.entries) === 1 ? 'día seguido' : 'días seguidos'}</span></div>
      <div class="stat"><b class="num">${todays.length}</b><span>comidas hoy</span></div></div>
    <div class="week" style="--i:2;margin-top:16px">${week.map((d) => `<div class="day ${d.on ? 'on' : ''} ${d.today ? 'today' : ''}">${d.label}<i>${d.on ? '✓' : ''}</i></div>`).join('')}</div>
    ${backupDue(u) ? `<div class="advice tip" style="margin-top:20px"><div class="ico">💾</div><div class="grow"><h3>Hacé una copia de seguridad</h3><p>Pasó más de una semana. Si cambiás de celular o borrás los datos del navegador, se pierde todo.</p><button class="btn primary sm" style="margin-top:10px" data-act="backup">Guardar copia</button></div></div>` : ''}
    <section class="section"><div class="section-head"><h2 class="h2">Para hoy</h2></div><div class="col stagger">${advice.slice(0, 4).map((a, i) => adviceCard(a, i + 3)).join('')}</div></section>
    <section class="section"><div class="section-head"><h2 class="h2">Comidas de hoy</h2></div>
      ${todays.length ? todays.map(mealCard).join('') : `<div class="card empty"><div class="big">🍌</div><p><b>Todavía no hay comidas hoy</b></p><p class="small muted" style="margin:4px 0 14px">Anotá lo que le des, aunque sea un solo mordisco.</p><button class="btn primary" data-act="log">Registrar comida</button></div>`}</section>
    <p class="disclaimer" style="margin-top:24px">Los consejos son orientativos y no reemplazan la consulta con el pediatra.</p></div>`;
}

// ---------- Progreso ----------
function progressView(u) {
  const now = Date.now();
  const stats = foodStats(u.entries, foodsById);
  const all = Object.values(stats);
  const weekItems = flatItems(u.entries.filter((e) => e.ts >= startOfDay(now) - 6 * DAY));
  const byGroup = {};
  weekItems.forEach((i) => { const g = foodsById[i.foodId]?.grupo; if (g) byGroup[g] = (byGroup[g] || 0) + 1; });
  const ironDays = new Set(weekItems.filter((i) => foodsById[i.foodId]?.ricoEnHierro).map((i) => startOfDay(i.ts))).size;
  const colorsTried = all.length;
  const introduced = Object.fromEntries(all.filter((s) => s.food?.alergeno).map((s) => [s.food.alergeno, s]));
  const reacted = (id) => all.some((s) => s.food?.alergeno === id && s.reaction);
  const top = [...all].sort((a, b) => b.count - a.count);
  const covered = WEEKLY_GROUPS.filter((g) => byGroup[g]).length;
  return `<div class="stagger">
    <header class="topbar" style="--i:0"><div><p class="eyebrow">Esta semana</p><h1 class="display h1">Progreso</h1></div></header>
    <div class="card sage" style="--i:1"><div class="row between"><b>Variedad de grupos</b><span class="num"><b>${covered}</b> de ${WEEKLY_GROUPS.length}</span></div>
      <div class="bar sage" style="margin:10px 0 4px"><i style="width:${(covered / WEEKLY_GROUPS.length) * 100}%"></i></div><p class="small muted">Cuantos más grupos distintos, mejor cubrís los nutrientes.</p></div>
    <div class="card" style="--i:2;margin-top:12px">
      ${WEEKLY_GROUPS.map((g) => `<div class="group-row"><span class="emoji" style="width:auto">${GROUPS[g].e}</span><div><b class="small">${GROUPS[g].n}</b><div class="bar" style="margin-top:6px"><i style="width:${Math.min(100, (byGroup[g] || 0) * 25)}%"></i></div></div><span class="small muted num">${byGroup[g] || 0}</span></div>`).join('')}</div>
    <div class="card ${ironDays >= 3 ? 'sage' : 'soft'}" style="--i:3;margin-top:12px"><div class="row"><span style="font-size:28px">🩸</span><div class="grow"><b>Hierro: ${ironDays} día${ironDays === 1 ? '' : 's'} esta semana</b><p class="small muted">${ironDays >= 3 ? '¡Muy bien! Seguí ofreciendo alimentos ricos en hierro todos los días que puedas.' : 'Intentá ofrecer carne, legumbres o yema de huevo casi todos los días.'}</p></div></div></div>
    <section class="section" style="--i:4"><div class="section-head"><h2 class="h2">Alérgenos</h2></div>
      <div class="card" style="padding:6px 18px">${(data.allergens.alergenos || []).map((a) => {
        const s = introduced[a.id], bad = reacted(a.id);
        const st = bad ? 'warn' : s ? 'ok' : '';
        return `<button class="allergen" data-act="allergen" data-id="${a.id}"><span class="emoji">${a.emoji || '🧪'}</span><span class="grow"><b>${esc(a.nombre)}</b><br><span class="small muted">${bad ? 'Hubo reacción' : s ? `Probado ${s.count} ${s.count === 1 ? 'vez' : 'veces'} · desde el ${new Date(s.first).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}` : 'Todavía no probado'}</span></span><span class="status-dot ${st}"></span></button>`;
      }).join('')}</div></section>
    <section class="section" style="--i:5"><div class="section-head"><h2 class="h2">Alimentos probados</h2><span class="muted small num">${all.length} de ${data.foods.length || '—'}</span></div>
      ${all.length ? `<div class="card" style="padding:6px 18px">${top.slice(0, 40).map((s) => {
        const avg = s.likes.length ? Math.round(s.likes.reduce((a, b) => a + b, 0) / s.likes.length) : 0;
        return `<div class="food-tile"><span class="emoji">${esc(s.food?.emoji || '🍽️')}</span><span class="grow"><b>${esc(s.name)}</b><br><span class="small muted">${s.count} ${s.count === 1 ? 'vez' : 'veces'}${s.reaction ? ' · con reacción' : ''}</span></span><span class="like">${['', '😖', '😕', '😐', '🙂', '😍'][avg] || ''}</span></div>`;
      }).join('')}</div>` : '<div class="card empty"><p class="muted">Cuando registres comidas, vas a ver acá cada alimento.</p></div>'}</section></div>`;
}

// ---------- Consejos ----------
const TIP_CATS = { todos: 'Todos', cantidad: 'Cantidad', texturas: 'Texturas', hierro: 'Hierro', seguridad: 'Seguridad', saciedad: 'Saciedad', rechazo: 'Rechazo', rutina: 'Rutina', alergenos: 'Alérgenos', agua: 'Agua', recetas: 'Recetas' };
function tipsView(u) {
  const stage = stageOf(ageOf(u.baby.birth).months);
  const fuentes = data.fuentes;
  const prog = (fuentes.progresionPorEtapa || []).find((p) => p.etapa === stage);
  const tips = data.tips.filter((t) => (ui.tipCat === 'todos' || t.categoria === ui.tipCat) && (t.etapa === 'todas' || t.etapa === stage || ui.tipCat !== 'todos'));
  const src = Object.fromEntries((fuentes.fuentes || []).map((f) => [f.id, f]));
  const cats = ['todos', ...new Set(data.tips.map((t) => t.categoria))];
  return `<div class="stagger">
    <header class="topbar" style="--i:0"><div><p class="eyebrow">Para ${esc(u.baby.name)}</p><h1 class="display h1">Consejos</h1></div></header>
    <div class="card sun" style="--i:1"><b>👩‍⚕️ Tu pediatra manda</b><p class="small muted" style="margin-top:4px">Estos consejos son generales. Si tu pediatra te dio otras indicaciones, seguí las suyas y cargalas en Perfil.</p></div>
    ${prog ? `<div class="card soft" style="--i:1;margin-top:12px"><p class="eyebrow">Etapa ${esc(prog.etapa)}</p><dl class="stage" style="margin:8px 0 0">
      <div><dt>🍽️ Comidas</dt><dd>${esc(prog.comidasPorDia)}</dd></div><div><dt>🥄 Cantidad</dt><dd>${esc(prog.cantidadInicial)}</dd></div>
      <div><dt>🥣 Texturas</dt><dd>${esc(prog.texturas)}</dd></div><div><dt>🎯 Foco</dt><dd>${esc(prog.foco)}</dd></div></dl></div>` : ''}
    ${fuentes.cantidadesReferencia?.mordiscoCucharada ? `<div class="card sun" style="--i:2;margin-top:12px"><b>¿Cuánto es “un mordisco”?</b><p class="small muted" style="margin-top:4px">${esc(fuentes.cantidadesReferencia.mordiscoCucharada)}</p></div>` : ''}
    <div class="chips scroll" style="--i:3;margin-top:18px">${cats.map((c) => `<button class="chip" data-act="tipcat" data-id="${c}" aria-pressed="${ui.tipCat === c}">${TIP_CATS[c] || c}</button>`).join('')}</div>
    <div style="margin-top:14px" class="stagger">${tips.slice(0, ui.tipLimit).map((t, i) => `<article class="card tip-card" style="--i:${Math.min(i, 8) + 4}"><span class="chip tag ${t.categoria === 'seguridad' ? 'warn' : ''}">${TIP_CATS[t.categoria] || t.categoria}</span><h3>${esc(t.titulo)}</h3><p>${esc(t.texto)}</p>${src[t.fuente] ? `<p class="small" style="margin-top:8px;color:var(--ink-3)">Fuente: ${src[t.fuente].url ? `<a href="${esc(src[t.fuente].url)}" target="_blank" rel="noopener">${esc(src[t.fuente].nombre)}</a>` : esc(src[t.fuente].nombre)}</p>` : ''}</article>`).join('') || '<div class="card empty"><p class="muted">No hay consejos en esta categoría todavía.</p></div>'}</div>
    ${tips.length > ui.tipLimit ? `<button class="btn ghost block" style="margin-top:14px" data-act="more-tips">Ver más consejos (${tips.length - ui.tipLimit})</button>` : ''}
    ${(fuentes.fuentes || []).length ? `<section class="section"><h2 class="h2" style="margin-bottom:10px">Dónde investigamos</h2><div class="list">${fuentes.fuentes.map((f) => `<div class="li"><div class="grow"><b>${f.url ? `<a href="${esc(f.url)}" target="_blank" rel="noopener">${esc(f.nombre)}</a>` : esc(f.nombre)}</b><p class="small muted">${esc(f.resumen || '')}</p></div><span class="chip tag ${f.tipo === 'divulgador' ? 'sage' : ''}">${esc(f.tipo)}</span></div>`).join('')}</div></section>` : ''}
    <p class="disclaimer" style="margin-top:20px">Información orientativa. No reemplaza la consulta con el pediatra.</p></div>`;
}

// ---------- Perfil ----------
function profileView(u) {
  const first = u.entries.length ? new Date(Math.min(...u.entries.map((e) => e.ts))).toLocaleDateString('es-AR') : '—';
  return `<div class="stagger">
    <header class="topbar" style="--i:0"><div><p class="eyebrow">Cuenta local</p><h1 class="display h1">${esc(u.name)}</h1></div><span class="avatar" style="width:52px;height:52px">${esc(u.name[0].toUpperCase())}</span></header>
    <div class="card" style="--i:1"><div class="row"><span style="font-size:34px">👶</span><div class="grow"><b>${esc(u.baby.name)}</b><p class="small muted">Nació el ${new Date(u.baby.birth + 'T12:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}</p></div><button class="btn ghost sm" data-act="edit-baby">Editar</button></div>
      <p class="small muted" style="margin-top:10px">${u.entries.length} comidas registradas desde el ${first}.</p></div>
    <section class="section" style="--i:2"><h2 class="h2" style="margin-bottom:10px">Tu pediatra</h2><div class="list"><button data-act="edit-plan"><span>👩‍⚕️</span><span class="grow"><b>Indicaciones del pediatra</b><br><span class="small muted">${activePlan(u) ? 'Plan activo · tocá para editar' : 'Cargá qué alimentos te permitió y hasta cuándo'}</span></span></button></div></section>
    <section class="section" style="--i:2"><h2 class="h2" style="margin-bottom:10px">Tus datos</h2><div class="list">
      <button data-act="export-summary"><span>📋</span><span class="grow"><b>Resumen para el pediatra</b><br><span class="small muted">Compartir o copiar texto</span></span></button>
      <button data-act="backup"><span>💾</span><span class="grow"><b>Guardar copia (Drive, WhatsApp…)</b><br><span class="small muted">${u.lastBackup ? 'Última: ' + new Date(u.lastBackup).toLocaleDateString('es-AR') : 'Todavía no hiciste una copia'}</span></span></button>
      <button data-act="qr-menu"><span>📲</span><span class="grow"><b>Pasar o compartir con otro celular</b><br><span class="small muted">Con códigos QR, sin internet</span></span></button>
      <button data-act="import-json"><span>📥</span><span class="grow"><b>Restaurar o combinar copia</b><br><span class="small muted">Cargar un archivo guardado</span></span></button></div>
      <input type="file" id="file-in" accept="application/json,.json" hidden></section>
    <section class="section" style="--i:3"><div class="list">
      <button data-act="signout"><span>🔄</span><span class="grow"><b>Cambiar de usuario</b></span></button>
      <button data-act="delete-profile" style="color:var(--danger)"><span>🗑️</span><span class="grow"><b>Borrar mis datos</b></span></button></div></section>
    <p class="disclaimer" style="margin-top:24px">Todo se guarda solo en este celular. Si borrás los datos del navegador, se pierden: hacé copias de seguridad.</p></div>`;
}

// ---------- Hojas (bottom sheets) ----------
function openSheet({ title, body, foot = '', onMount }) {
  closeSheet(true);
  const root = $('#sheet-root');
  root.innerHTML = `<div class="scrim" data-act="close-sheet"></div><section class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="sheet-grip"></div><div class="sheet-head"><h2 class="h2">${esc(title)}</h2><button class="icon-btn" data-act="close-sheet" aria-label="Cerrar">${ICON.close}</button></div>
    <div class="sheet-body">${body}</div>${foot ? `<div class="sheet-foot">${foot}</div>` : ''}</section>`;
  document.body.style.overflow = 'hidden';
  onMount?.(root);
}
function closeSheet(instant) {
  stopQr();
  const root = $('#sheet-root');
  if (!root.firstChild) return;
  const done = () => { root.innerHTML = ''; document.body.style.overflow = ''; };
  if (instant) return done();
  root.querySelector('.scrim')?.classList.add('out');
  root.querySelector('.sheet')?.classList.add('out');
  setTimeout(done, 230);
}

function toast(msg) {
  const root = $('#toast-root');
  const el = document.createElement('div'); el.className = 'toast'; el.textContent = msg; root.replaceChildren(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 220); }, 2200);
}
function celebrate() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const el = document.createElement('div'); el.className = 'confetti';
  const set = ['🥑', '🍌', '🍎', '🥕', '🍐', '✨', '🥄'];
  el.innerHTML = Array.from({ length: 14 }, (_, i) => {
    const a = (Math.PI * 2 * i) / 14 + Math.random() * .4, d = 90 + Math.random() * 120;
    return `<i style="--x:${Math.cos(a) * d}px;--y:${Math.sin(a) * d - 140}px;--r:${Math.random() * 160 - 80}deg;--d:${i * 12}">${set[i % set.length]}</i>`;
  }).join('');
  document.body.append(el); setTimeout(() => el.remove(), 1500);
}

// ---------- Registro de comida ----------
let draft = null;
const defaultMeal = () => { const h = new Date().getHours(); return h < 10 ? 'desayuno' : h < 15 ? 'almuerzo' : h < 19 ? 'merienda' : 'cena'; };
const localDT = (t) => { const d = new Date(t - new Date(t).getTimezoneOffset() * 6e4); return d.toISOString().slice(0, 16); };
const faceSet = [['😖', 1], ['😕', 2], ['😐', 3], ['🙂', 4], ['😍', 5]];

function openLogger(presetFood) {
  const u = store.me();
  draft = { meal: defaultMeal(), ts: Date.now(), items: [], texture: '', note: '', reaction: 'none' };
  if (presetFood && foodsById[presetFood]) addItem(foodsById[presetFood], true);
  const sugg = suggestFoods({ entries: u.entries, foods: data.foods, user: u, n: 8 });
  openSheet({
    title: 'Registrar comida',
    body: `<div class="col" style="gap:18px">
      <div class="seg" role="group" aria-label="Momento">${Object.keys(MEAL_NAMES).map((m) => `<button data-act="meal" data-id="${m}" aria-pressed="${draft.meal === m}">${MEALS[m]}</button>`).join('')}</div>
      <p class="small muted" id="meal-label" style="margin-top:-10px;text-align:center">${MEAL_NAMES[draft.meal]}</p>
      <div class="field"><span class="label">¿Qué comió?</span>
        <input class="input" id="food-q" placeholder="Buscá un alimento… palta, banana, zapallo" autocomplete="off" enterkeyhint="search">
        <div id="suggest"></div></div>
      <div id="plan-warn"></div><div id="items"></div>
      <p class="small ped" id="qty-note" hidden>👩‍⚕️ Las cantidades son orientativas: consultá con tu pediatra cuánto darle.</p>
      ${sugg.length ? `<div class="field"><span class="label">Ideas (consultá con tu pediatra)</span><div class="chips scroll" id="ideas">${sugg.map((f) => `<button class="chip" data-act="add-food" data-id="${f.id}">${esc(f.emoji)} ${esc(f.nombre)}</button>`).join('')}</div></div>` : ''}
      <div class="field"><span class="label">Textura</span><div class="seg" role="group">${[['pure', 'Puré'], ['aplastado', 'Aplastado'], ['trozos', 'Trozos'], ['dedos', 'Con las manos']].map(([k, l]) => `<button data-act="texture" data-id="${k}" aria-pressed="false" style="font-size:12.5px">${l}</button>`).join('')}</div></div>
      <div class="field"><span class="label">¿Hubo alguna reacción?</span><div class="seg" role="group">${[['none', 'Ninguna'], ['leve', 'Leve'], ['importante', 'Importante']].map(([k, l]) => `<button data-act="reaction" data-id="${k}" aria-pressed="${k === 'none'}">${l}</button>`).join('')}</div>
        <p class="small muted" id="react-help" hidden>Leve: algo de enrojecimiento o picazón alrededor de la boca. Importante: urticaria, hinchazón, vómitos repetidos o dificultad para respirar.</p></div>
      <label class="field"><span class="label">Hora</span><input class="input" type="datetime-local" id="when" value="${localDT(draft.ts)}" max="${localDT(Date.now() + 6e4)}"></label>
      <label class="field"><span class="label">Nota (opcional)</span><textarea class="input" id="note" placeholder="Cómo fue la comida, qué le gustó…" maxlength="300"></textarea></label></div>`,
    foot: '<button class="btn primary block" data-act="save-entry" id="save-btn" disabled>Guardar comida</button>',
    onMount: (root) => {
      paintItems();
      const q = $('#food-q', root);
      q.addEventListener('input', () => paintSuggest(q.value));
      q.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); const f = matchFoods(q.value)[0]; if (f) addItem(f); else if (q.value.trim()) addItem({ id: null, nombre: q.value.trim(), emoji: '🍽️' }); } });
    },
  });
}

function matchFoods(q) {
  const n = norm(q.trim());
  if (!n) return [];
  return data.foods.filter((f) => norm(f.nombre).includes(n)).sort((a, b) => (norm(a.nombre).startsWith(n) ? 0 : 1) - (norm(b.nombre).startsWith(n) ? 0 : 1)).slice(0, 6);
}
function paintSuggest(q) {
  const box = $('#suggest'); if (!box) return;
  const m = matchFoods(q), t = q.trim();
  const custom = t && !m.some((f) => norm(f.nombre) === norm(t));
  box.innerHTML = m.length || custom ? `<div class="suggest">${m.map((f) => `<button data-act="add-food" data-id="${f.id}"><span class="emoji">${esc(f.emoji)}</span><span class="grow"><b>${esc(f.nombre)}</b>${f.alergeno ? ' <span class="chip tag warn">alérgeno</span>' : ''}${f.ricoEnHierro ? ' <span class="chip tag">hierro</span>' : ''}</span></button>`).join('')}${custom ? `<button data-act="add-custom" data-name="${esc(t)}"><span class="emoji">➕</span><span class="grow">Agregar “<b>${esc(t)}</b>”</span></button>` : ''}</div>` : '';
}
function addItem(food, silent) {
  draft.items.push({ foodId: food.id, name: food.nombre, emoji: food.emoji, qty: 2, unit: 'mordisco', like: 0 });
  if (silent) return;
  const q = $('#food-q'); if (q) { q.value = ''; q.focus({ preventScroll: true }); }
  paintSuggest(''); paintItems();
  const last = $('#items .entry-item:last-child'); last?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}
function paintItems() {
  const box = $('#items'); if (!box) return;
  box.innerHTML = draft.items.map((it, i) => {
    const f = foodsById[it.foodId];
    return `<div class="entry-item" data-i="${i}">
      <div class="row"><span class="emoji">${esc(it.emoji)}</span><div class="grow"><b>${esc(it.name)}</b>${f?.seguridad ? `<p class="small muted">⚠️ ${esc(f.seguridad)}</p>` : ''}</div><button class="icon-btn" style="width:36px;height:36px" data-act="rm-item" data-i="${i}" aria-label="Quitar">${ICON.close}</button></div>
      <div class="row between" style="margin-top:12px;gap:10px">
        <div class="stepper"><button data-act="qty" data-i="${i}" data-d="-1" aria-label="Menos">−</button><output class="num">${it.qty}</output><button data-act="qty" data-i="${i}" data-d="1" aria-label="Más">+</button></div>
        <div class="seg" style="flex:1;min-width:0">${Object.keys(UNITS).map((u) => `<button data-act="unit" data-i="${i}" data-id="${u}" aria-pressed="${it.unit === u}" style="font-size:11.5px;padding:0 2px">${u === 'cucharadita' ? 'cdita' : u === 'cucharada' ? 'cda' : u === 'mordisco' ? 'mordisco' : 'trocito'}</button>`).join('')}</div></div>
      <div class="row between" style="margin-top:12px"><span class="small muted">¿Le gustó?</span><div class="faces">${faceSet.map(([e, v]) => `<button class="face" data-act="like" data-i="${i}" data-v="${v}" aria-pressed="${it.like === v}" aria-label="Gusto ${v} de 5">${e}</button>`).join('')}</div></div></div>`;
  }).join('');
  const b = $('#save-btn'); if (b) b.disabled = !draft.items.length;
  const qn = $('#qty-note'); if (qn) qn.hidden = !draft.items.length;
  const plan = activePlan(store.me());
  const off = draft.items.filter((it) => plan?.groups?.length && foodsById[it.foodId] && !allowedByPlan(plan, foodsById[it.foodId]));
  const risky = draft.items.filter((it) => foodsById[it.foodId]?.alergeno && !Object.values(foodStats(store.me().entries, foodsById)).some((s) => s.food?.alergeno === foodsById[it.foodId].alergeno));
  const w = $('#plan-warn');
  if (w) w.innerHTML = [off.length && `<div class="advice warn" style="margin-bottom:10px"><div class="ico">👩‍⚕️</div><div><h3>Fuera de lo que indicó tu pediatra</h3><p>${off.map((i) => esc(i.name)).join(', ')} no está en tu plan actual. Consultá antes de ofrecerlo.</p></div></div>`, risky.length && `<div class="advice tip" style="margin-bottom:10px"><div class="ico">🧪</div><div><h3>Alérgeno nuevo</h3><p>${risky.map((i) => esc(i.name)).join(', ')}: consultá con tu pediatra cuándo y cómo introducirlo.</p></div></div>`].filter(Boolean).join('');
}
function saveEntry() {
  if (!draft?.items.length) return;
  const when = $('#when')?.value ? new Date($('#when').value).getTime() : Date.now();
  const entry = {
    ts: Math.min(when, Date.now()), meal: draft.meal, texture: draft.texture, note: ($('#note')?.value || '').trim(),
    reaction: { level: draft.reaction }, items: draft.items.map((i) => ({ ...i, like: i.like || 0 })),
  };
  const before = Object.keys(foodStats(store.me().entries, foodsById)).length;
  store.addEntry(entry);
  const after = Object.keys(foodStats(store.me().entries, foodsById)).length;
  closeSheet(); render(); celebrate();
  toast(after > before ? `¡${after - before === 1 ? 'Alimento nuevo' : after - before + ' alimentos nuevos'}! 🎉` : 'Comida guardada');
}

// ---------- Otras hojas ----------
function openAllergen(id) {
  const a = data.allergens.alergenos.find((x) => x.id === id); if (!a) return;
  const ex = (a.alimentoEjemplo || []).map((i) => foodsById[i]).filter(Boolean);
  openSheet({
    title: `${a.emoji || ''} ${a.nombre}`,
    body: `<div class="col" style="gap:14px"><p>${esc(a.porQue)}</p>
      <div class="card sage"><b>Cómo introducirlo</b><p class="small" style="margin-top:4px">${esc(a.comoIntroducir)}</p></div>
      <div class="card sun"><b>Frecuencia</b><p class="small" style="margin-top:4px">${esc(a.frecuencia)}</p></div>
      <div class="card alert"><b>Señales a vigilar</b><p class="small" style="margin-top:4px">${esc(a['señales'] || a.senales || '')}</p></div>
      ${ex.length ? `<div><span class="label">Alimentos con ${esc(a.nombre.toLowerCase())}</span><div class="chips" style="margin-top:8px">${ex.map((f) => `<button class="chip" data-act="log-food" data-id="${f.id}">${esc(f.emoji)} ${esc(f.nombre)}</button>`).join('')}</div></div>` : ''}
      <p class="disclaimer">Consultá con el pediatra, sobre todo si hay eccema severo o antecedentes de alergia.</p></div>`,
  });
}

function openBabyEditor() {
  const u = store.me();
  openSheet({ title: 'Datos del bebé', body: `<form class="col" data-form="baby-edit"><label class="field"><span class="label">Nombre</span><input class="input" name="baby" value="${esc(u.baby.name)}" maxlength="40" required></label>
    <label class="field"><span class="label">Fecha de nacimiento</span><input class="input" type="date" name="birth" value="${esc(u.baby.birth)}" max="${new Date().toISOString().slice(0, 10)}" required></label>
    <button class="btn primary block" type="submit">Guardar</button></form>` });
}

function openPlanEditor() {
  const u = store.me(), p = u.plan || { groups: [], until: '', note: '' };
  openSheet({ title: 'Indicaciones del pediatra', body: `<form class="col" data-form="plan" style="gap:18px">
    <p class="muted small">Cargá lo que te indicó. Mientras esté activo, la app no te sugiere alimentos fuera de este plan.</p>
    <div class="field"><span class="label">Grupos permitidos por ahora (vacío = sin restricción)</span><div class="chips">${Object.entries(GROUPS).map(([k, g]) => `<button type="button" class="chip" data-act="plan-group" data-id="${k}" aria-pressed="${p.groups.includes(k)}">${g.e} ${g.n}</button>`).join('')}</div></div>
    <label class="field"><span class="label">Hasta el próximo control</span><input class="input" type="date" name="until" value="${esc(p.until || '')}"></label>
    <label class="field"><span class="label">Qué te dijo (opcional)</span><textarea class="input" name="note" maxlength="300" placeholder="Ej: dos semanas de verdura y fruta; en el control vemos si sumamos carne">${esc(p.note || '')}</textarea></label>
    <button class="btn primary block" type="submit">Guardar plan</button>
    ${u.plan ? '<button class="btn danger block" type="button" data-act="clear-plan">Quitar plan</button>' : ''}</form>` });
}

function summaryText(u) {
  const age = ageOf(u.baby.birth);
  const stats = Object.values(foodStats(u.entries, foodsById)).sort((a, b) => a.first - b.first);
  const fmt = (t) => new Date(t).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
  const reacts = u.entries.filter((e) => e.reaction?.level && e.reaction.level !== 'none');
  const lines = [`Alimentación complementaria de ${u.baby.name}`, `Edad: ${age.months} meses y ${age.days} días · ${u.entries.length} comidas registradas`, '', 'Alimentos introducidos (fecha de primera vez · veces):'];
  stats.forEach((s) => lines.push(`• ${s.name}${s.food?.alergeno ? ' [alérgeno]' : ''} — ${fmt(s.first)} · ${s.count}`));
  lines.push('', reacts.length ? 'Reacciones anotadas:' : 'Sin reacciones anotadas.');
  reacts.forEach((e) => lines.push(`• ${fmt(e.ts)} (${e.reaction.level}): ${e.items.map((i) => i.name).join(', ')}${e.note ? ' — ' + e.note : ''}`));
  return lines.join('\n');
}

function download(name, text, type = 'application/json') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// ---------- Eventos ----------
document.addEventListener('click', async (ev) => {
  const el = ev.target.closest('[data-act]'); if (!el) return;
  const { act, id, i, d, v, name, food } = el.dataset;
  const u = store.me();
  const item = draft?.items[+i];
  switch (act) {
    case 'tab': return setTab(id);
    case 'log': return openLogger(food);
    case 'log-food': closeSheet(true); return openLogger(id);
    case 'close-sheet': return closeSheet();
    case 'signin': store.signIn(name); ui.tab = 'hoy'; return render();
    case 'signout': store.signOut(); return render();
    case 'tipcat': ui.tipCat = id; ui.tipLimit = 8; return render();
    case 'more-tips': ui.tipLimit += 10; return render();
    case 'allergen': return openAllergen(id);
    case 'edit-baby': return openBabyEditor();
    case 'edit-plan': return openPlanEditor();
    case 'plan-group': return el.setAttribute('aria-pressed', el.getAttribute('aria-pressed') !== 'true');
    case 'clear-plan': store.setPlan(null); closeSheet(); render(); return toast('Plan quitado');
    case 'meal': draft.meal = id; el.parentElement.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', b === el)); $('#meal-label').textContent = MEAL_NAMES[id]; return;
    case 'texture': { const on = draft.texture === id; draft.texture = on ? '' : id; el.parentElement.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', !on && b === el)); return; }
    case 'reaction': draft.reaction = id; el.parentElement.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', b === el)); $('#react-help').hidden = id === 'none'; return;
    case 'add-food': return addItem(foodsById[id]);
    case 'add-custom': return addItem({ id: null, nombre: name, emoji: '🍽️' });
    case 'rm-item': draft.items.splice(+i, 1); return paintItems();
    case 'qty': item.qty = Math.max(1, Math.min(30, item.qty + +d)); el.parentElement.querySelector('output').textContent = item.qty; return;
    case 'unit': item.unit = id; el.parentElement.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', b === el)); return;
    case 'like': item.like = item.like === +v ? 0 : +v; el.parentElement.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', +b.dataset.v === item.like)); return;
    case 'save-entry': return saveEntry();
    case 'del-entry': if (confirm('¿Borrar esta comida?')) { store.removeEntry(id); render(); toast('Comida borrada'); } return;
    case 'export-summary': {
      const text = summaryText(u);
      if (navigator.share) { try { await navigator.share({ title: 'Resumen de alimentación', text }); return; } catch { return; } }
      try { await navigator.clipboard.writeText(text); toast('Resumen copiado'); } catch { download('resumen.txt', text, 'text/plain'); }
      return;
    }
    case 'backup': return backup();
    case 'qr-menu': return openQrMenu();
    case 'qr-show': return showQr();
    case 'qr-scan': return scanQr();
    case 'import-json': return $('#file-in').click();
    case 'delete-profile': if (confirm('Se borran todos los datos de este perfil en este celular. ¿Seguro?')) { store.deleteProfile(); render(); } return;
  }
});

document.addEventListener('change', async (ev) => {
  if (ev.target.id !== 'file-in') return;
  const f = ev.target.files[0]; if (!f) return;
  try { const n = store.mergeInto(JSON.parse(await f.text())); render(); toast(n ? `Se sumaron ${n} comidas` : 'No había comidas nuevas'); } catch { toast('No pude leer ese archivo'); }
  ev.target.value = '';
});

document.addEventListener('submit', (ev) => {
  const form = ev.target.closest('[data-form]'); if (!form) return;
  ev.preventDefault();
  const fd = new FormData(form);
  switch (form.dataset.form) {
    case 'signin': store.signIn(fd.get('name')); ui.tab = 'hoy'; return render();
    case 'baby': store.setBaby({ name: fd.get('baby').trim(), birth: fd.get('birth') }); return render();
    case 'plan': store.setPlan({ groups: [...form.querySelectorAll('[data-act=plan-group][aria-pressed=true]')].map((b) => b.dataset.id), until: fd.get('until') || '', note: (fd.get('note') || '').trim() }); closeSheet(); render(); return toast('Plan guardado');
    case 'baby-edit': store.setBaby({ name: fd.get('baby').trim(), birth: fd.get('birth') }); closeSheet(); render(); return toast('Guardado');
  }
});

// ---------- Copia de seguridad y traspaso por QR ----------
async function backup() {
  const u = store.me(), name = `cucharadas-${u.id.replace(/\W+/g, '-')}-${new Date().toISOString().slice(0, 10)}.json`;
  const file = new File([store.exportJSON()], name, { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'Copia de Primeras Cucharadas' }); store.markBackup(); render(); return toast('Copia guardada'); }
    catch (e) { if (e.name === 'AbortError') return; }
  }
  download(name, store.exportJSON()); store.markBackup(); render(); toast('Copia descargada');
}

const loadScript = (src) => new Promise((ok, err) => { if (document.querySelector(`script[src="${src}"]`)) return ok(); const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = err; document.head.append(s); });
const b64 = { enc: (u8) => btoa(String.fromCharCode(...u8)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''), dec: (t) => Uint8Array.from(atob(t.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)) };
async function pack(text) {
  const raw = new TextEncoder().encode(text);
  if (!window.CompressionStream) return 'r' + b64.enc(raw);
  const buf = await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer();
  const out = new Uint8Array(buf), parts = [];
  for (let i = 0; i < out.length; i += 8000) parts.push(String.fromCharCode(...out.subarray(i, i + 8000)));
  return 'z' + btoa(parts.join('')).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
async function unpack(t) {
  const u8 = b64.dec(t.slice(1));
  if (t[0] === 'r') return new TextDecoder().decode(u8);
  return new Response(new Blob([u8]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
}

let qrTimer = null, camStream = null;
function stopQr() { clearInterval(qrTimer); qrTimer = null; camStream?.getTracks().forEach((t) => t.stop()); camStream = null; }
function openQrMenu() {
  openSheet({ title: 'Pasar a otro celular', body: `<div class="col" style="gap:14px">
    <p class="muted">Sirve para cambiar de celular o para que dos personas usen los mismos datos. Todo viaja de un teléfono a otro, sin internet ni cuentas.</p>
    <button class="btn primary block" data-act="qr-show">📤 Mostrar mi código</button>
    <button class="btn ghost block" data-act="qr-scan">📷 Escanear el código del otro celular</button>
    <div class="card soft small"><b>Para compartir entre dos personas</b><p class="muted" style="margin-top:4px">Cada una entra con su nombre en su celular. Una muestra su código, la otra lo escanea y se suman las comidas nuevas. Después lo hacen al revés. Cada comida queda con el nombre de quien la anotó. Hoy no se sincroniza solo: hay que repetirlo cada tanto, y una comida borrada no se borra en el otro celular.</p></div></div>` });
}
async function showQr() {
  const u = store.me();
  openSheet({ title: 'Mi código', body: `<div class="col" style="align-items:center;gap:14px"><canvas id="qr" style="width:100%;max-width:340px;aspect-ratio:1;background:#fff;border-radius:18px;padding:10px"></canvas><p class="small muted" id="qr-info" style="text-align:center">Preparando…</p><p class="small muted" style="text-align:center">En el otro celular tocá “Escanear” y apuntá la cámara. Mantené esta pantalla encendida hasta que termine.</p></div>` });
  try {
    await loadScript('vendor/qrcode.js');
    const data = await pack(store.exportJSON()), size = 450, total = Math.ceil(data.length / size), id = Math.random().toString(36).slice(2, 6);
    const frames = Array.from({ length: total }, (_, i) => `CUC1|${id}|${i + 1}|${total}|${data.slice(i * size, (i + 1) * size)}`);
    const cv = $('#qr'); if (!cv) return;
    let k = 0;
    const draw = () => {
      const q = qrcode(0, 'L'); q.addData(frames[k % total]); q.make();
      const n = q.getModuleCount(), cell = Math.floor(800 / (n + 2)), px = cell * (n + 2);
      cv.width = cv.height = px; const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, px, px); g.fillStyle = '#000';
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) g.fillRect((c + 1) * cell, (r + 1) * cell, cell, cell);
      const info = $('#qr-info'); if (info) info.textContent = total > 1 ? `Parte ${(k % total) + 1} de ${total} · pasan solas` : 'Código listo';
      k++;
    };
    draw(); if (total > 1) qrTimer = setInterval(draw, 650);
    store.markBackup();
  } catch { const i = $('#qr-info'); if (i) i.textContent = 'No pude generar el código.'; }
}
async function scanQr() {
  openSheet({ title: 'Escanear código', body: `<div class="col" style="align-items:center;gap:12px"><video id="cam" playsinline muted style="width:100%;border-radius:18px;background:#000;aspect-ratio:1;object-fit:cover"></video><div class="bar" style="width:100%"><i id="scan-bar" style="width:0"></i></div><p class="small muted" id="scan-info" style="text-align:center">Apuntá a la pantalla del otro celular…</p></div>` });
  try {
    await loadScript('vendor/jsQR.js');
    camStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
    const v = $('#cam'); v.srcObject = camStream; await v.play();
    const cv = document.createElement('canvas'), g = cv.getContext('2d', { willReadFrequently: true });
    const got = new Map(); let sid = null, total = 0;
    qrTimer = setInterval(async () => {
      if (!v.videoWidth) return;
      cv.width = v.videoWidth; cv.height = v.videoHeight; g.drawImage(v, 0, 0);
      const code = jsQR(g.getImageData(0, 0, cv.width, cv.height).data, cv.width, cv.height);
      const m = code?.data.match(/^CUC1\|(\w+)\|(\d+)\|(\d+)\|(.+)$/s); if (!m) return;
      if (sid !== m[1]) { sid = m[1]; got.clear(); }
      total = +m[3]; got.set(+m[2], m[4]);
      $('#scan-bar').style.width = `${(got.size / total) * 100}%`;
      $('#scan-info').textContent = `Recibidas ${got.size} de ${total}`;
      if (got.size === total) {
        stopQr();
        try {
          const text = await unpack(Array.from({ length: total }, (_, i) => got.get(i + 1)).join(''));
          const n = store.mergeInto(JSON.parse(text)); closeSheet(); render(); celebrate(); toast(n ? `Se sumaron ${n} comidas` : 'Ya tenías todo');
        } catch { toast('El código no se pudo leer'); closeSheet(); }
      }
    }, 150);
  } catch { const i = $('#scan-info'); if (i) i.textContent = 'No pude usar la cámara. Revisá el permiso en el navegador.'; }
}

document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });

boot();
