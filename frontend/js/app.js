/* =========================================================================
   ES-DE Gamelist Editor — lógica do cliente (vanilla JS, sem build step)
   ========================================================================= */
"use strict";

const ROW_H = 46;
const BUFFER = 8;

const BOOL_FIELDS = new Set(["favorite", "completed", "kidgame", "hidden", "broken", "nogamecount"]);
const MONO_FIELDS = new Set(["path", "image", "video", "marquee", "thumbnail", "fanart", "titlescreen", "manual"]);
const TEXTAREA_FIELDS = new Set(["desc"]);
const FIELD_ORDER = ["path", "name", "sortname", "desc", "rating", "releasedate",
  "developer", "publisher", "genre", "players", "favorite", "completed", "kidgame",
  "hidden", "broken", "nogamecount", "playcount", "lastplayed"];
// mídias mostradas na prévia, em ordem de preferência
const MEDIA_PREVIEW = ["miximages", "covers", "3dboxes", "screenshots", "titlescreens", "marquees"];

const REMOVAL_LABELS = { 1: "REMOVER ENTRADA", 2: "+ ROM", 3: "+ ROM + MÍDIA" };

// pastas padrão do diálogo "Abrir" (fallback caso o backend não envie).
// Vazias por padrão — o usuário escolhe via "Procurar…"; o backend pode
// pré-preencher a partir das variáveis de ambiente ESDE_*_ROOT.
const DEFAULTS = {
  gamelists_root: "",
  media_root: "",
  roms_root: "",
  backup_root: "",
};

const state = {
  system: null,
  systems: [],
  games: [],            // array original
  gamesById: new Map(), // id -> game
  filtered: [],         // array de índices na fonte ativa (games ou markedList)
  selectedIdx: -1,      // índice em state.filtered
  removals: new Map(),  // espelho do console atual: id -> level (derivado de marks)
  marks: new Map(),     // GLOBAL: "system\u0000path" -> {system, path, level, name}
  edits: new Map(),     // id -> { field: value } (apenas console atual, edição manual)
  importEdits: new Map(), // GLOBAL: "system\u0000path" -> { field: value } (importadas)
  filterMode: "all",    // "all" | "marked"
  markedList: [],       // itens marcados (modo "marked")
  query: "",
  config: {},
  theme: "dark",
  commitSnapshot: null,
  commitCompleted: false,
  sort: { key: "name", dir: "asc" },
};

const $ = (s) => document.querySelector(s);
const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };

/* ============================== API (pywebview) ==============================
   A interface conversa com o Python diretamente por window.pywebview.api.*
   Cada método devolve um objeto; se contiver `error`, lançamos exceção. */
function pyReady() {
  return new Promise((resolve) => {
    if (window.pywebview && window.pywebview.api) return resolve();
    window.addEventListener("pywebviewready", () => resolve(), { once: true });
  });
}

async function call(method, ...args) {
  await pyReady();
  const fn = window.pywebview.api[method];
  if (!fn) throw new Error(`método indisponível: ${method}`);
  const data = await fn(...args);
  if (data && data.error) throw new Error(data.error);
  return data;
}

/* ============================== TOAST ============================== */
let toastTimer;
function toast(msg, kind) {
  const t = $("#toast");
  t.textContent = msg; t.className = "toast" + (kind ? " " + kind : ""); t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 3200);
}

/* ============================== TEMA (claro/escuro) ============================== */
function applyTheme(theme) {
  const t = theme === "light" ? "light" : "dark";
  document.documentElement.dataset.theme = t;
  const btn = $("#themeBtn");
  if (btn) {
    btn.textContent = t === "light" ? "☀" : "☾";
    btn.title = t === "light" ? "Mudar para tema escuro" : "Mudar para tema claro";
  }
  state.theme = t;
}

async function toggleTheme() {
  applyTheme(state.theme === "light" ? "dark" : "light");
  savePrefs();
}

function sortValue() { return `${state.sort.key}:${state.sort.dir}`; }
function savePrefs() {
  try { call("set_prefs", { theme: state.theme, sort: sortValue() }); } catch (_) {}
}

/* ============================== CARREGAMENTO (progresso) ============================== */
let loadDepth = 0;
function showLoading(text) {
  loadDepth++;
  $("#loadText").textContent = text || "Carregando…";
  $("#loadOverlay").hidden = false;
  $("#topProgress").hidden = false;
}
function hideLoading() {
  loadDepth = Math.max(0, loadDepth - 1);
  if (loadDepth === 0) {
    $("#loadOverlay").hidden = true;
    $("#topProgress").hidden = true;
  }
}

/* ============================== CONFIRMAÇÃO (modal próprio) ==============================
   Substitui o confirm() nativo, que não é suportado de forma confiável no pywebview. */
function askConfirm(msg, opts) {
  opts = opts || {};
  return new Promise((resolve) => {
    const modal = $("#confirmModal");
    $("#confirmTitle").textContent = opts.title || "Confirmar";
    $("#confirmMsg").textContent = msg;
    $("#confirmYes").textContent = opts.yes || "Continuar";
    $("#confirmNo").textContent = opts.no || "Cancelar";
    modal.hidden = false;
    const yes = $("#confirmYes"), no = $("#confirmNo");
    const cleanup = () => {
      yes.removeEventListener("click", onYes);
      no.removeEventListener("click", onNo);
      document.removeEventListener("keydown", onKey, true);
      modal.hidden = true;
    };
    const onYes = () => { cleanup(); resolve(true); };
    const onNo = () => { cleanup(); resolve(false); };
    const onKey = (ev) => {
      if (ev.key === "Escape") { ev.preventDefault(); ev.stopPropagation(); onNo(); }
      else if (ev.key === "Enter") { ev.preventDefault(); ev.stopPropagation(); onYes(); }
    };
    yes.addEventListener("click", onYes);
    no.addEventListener("click", onNo);
    document.addEventListener("keydown", onKey, true);
    setTimeout(() => yes.focus(), 30);
  });
}

/* ============================== OPEN FLOW ============================== */
function openModal(show) {
  $("#openModal").hidden = !show;
  if (show) {
    const c = state.config;
    $("#in_gamelists_root").value = c.gamelists_root || DEFAULTS.gamelists_root;
    $("#in_roms_root").value = c.roms_root || DEFAULTS.roms_root;
    $("#in_media_root").value = c.media_root || DEFAULTS.media_root;
    $("#in_backup_root").value = c.backup_root || DEFAULTS.backup_root;
    $("#in_trash_root").value = c.trash_root || "";
    setTimeout(() => $("#in_gamelists_root").focus(), 50);
  }
}

function activeTab() { return $(".tab.active")?.dataset.tab || "root"; }

async function doOpen() {
  const tab = activeTab();
  const payload = {
    roms_root: $("#in_roms_root").value.trim(),
    media_root: $("#in_media_root").value.trim(),
    backup_root: $("#in_backup_root").value.trim(),
    trash_root: $("#in_trash_root").value.trim(),
    hard_delete: $("#in_hard_delete").checked,
  };
  if (tab === "root") {
    payload.mode = "system_root";
    payload.gamelists_root = $("#in_gamelists_root").value.trim();
  } else {
    payload.mode = "single_file";
    payload.gamelist_file = $("#in_gamelist_file").value.trim();
    payload.system = $("#in_system").value.trim();
  }
  try {
    showLoading("Abrindo coleção…");
    const r = await call("open_target", payload);
    state.config = await call("get_config");
    $("#openError").hidden = true;
    openModal(false);
    document.body.dataset.screen = "editor";
    await loadSystems();
  } catch (e) {
    const box = $("#openError"); box.textContent = e.message; box.hidden = false;
  } finally {
    hideLoading();
  }
}

/* ============================== SYSTEMS ============================== */
async function loadSystems() {
  state.systems = await call("get_systems");
  const sel = $("#systemSelect");
  sel.innerHTML = "";
  state.systems.forEach((s) => {
    const o = el("option"); o.value = s.system;
    o.textContent = `${s.system}  (${s.count})`;
    sel.appendChild(o);
  });
  if (state.systems.length) {
    sel.value = state.systems[0].system;
    await loadGamelist(state.systems[0].system);
  }
}

/* ============================== IMPORTAR MARCAÇÕES ============================== */
function _normPath(p) {
  return (p || "").replace(/^\.\//, "").replace(/\\/g, "/").trim().toLowerCase();
}

async function doImport() {
  let f;
  try { f = await call("pick_marks_file"); } catch (e) { toast(e.message, "err"); return; }
  if (!f || !f.path) return;
  showLoading("Importando…");
  try {
    const res = await call("read_marks_file", f.path);
    const entries = res.entries || [];
    const byNorm = new Map();
    state.games.forEach((g) => byNorm.set(_normPath(g.id), g));
    const resolveKey = (sys, path) => {
      // no console atual, resolve para o id canônico do jogo (tolera ./ e caixa)
      if (sys === state.system) {
        const g = state.gamesById.get(path) || byNorm.get(_normPath(path));
        if (g) return g.id;
      }
      return path;
    };

    let nMarks = 0, nEdits = 0, noConsole = 0;
    const sysSet = new Set();
    entries.forEach((en) => {
      const sys = en.system || state.system;
      if (!sys) { noConsole++; return; }
      const key = resolveKey(sys, en.path);
      if (en.kind === "edit") {
        const gkey = mkKey(sys, key);
        const obj = state.importEdits.get(gkey) || {};
        obj[en.field] = en.value;
        state.importEdits.set(gkey, obj);
        nEdits++;
      } else {
        let name = key;
        if (sys === state.system) { const g = state.gamesById.get(key); if (g) name = g.fields.name || key; }
        setMark(sys, key, en.level, name);
        nMarks++;
      }
      sysSet.add(sys);
    });

    applyFilter();
    renderList(true);
    renderDetail();
    updatePending();

    const parts = [];
    if (nMarks) parts.push(`${nMarks} marcações`);
    if (nEdits) parts.push(`${nEdits} edições de campo`);
    parts.push(`${sysSet.size} console(s)`);
    if (noConsole) parts.push(`${noConsole} sem console`);
    if (res.skipped) parts.push(`${res.skipped} ignoradas`);
    toast(`Importação: ${parts.join(" · ")}`, (nMarks + nEdits) ? "ok" : "err");
  } catch (e) {
    toast(e.message, "err");
  } finally {
    hideLoading();
  }
}

// no modo "marcados", abre o item no seu console (troca se necessário)
async function jumpToMark(m) {
  if (!m) return;
  setFilterMode("all", true);
  if (m.system !== state.system) {
    const sel = $("#systemSelect"); if (sel) sel.value = m.system;
    await loadGamelist(m.system);
  }
  const gi = state.games.findIndex((g) => g.id === m.path);
  if (gi >= 0) {
    const fi = state.filtered.indexOf(gi);
    selectIndex(fi >= 0 ? fi : 0);
  } else {
    toast("Item não encontrado na gamelist atual (pode ter sido removido)", "err");
  }
}

async function loadGamelist(system) {
  showLoading(`Carregando ${system}…`);
  try {
    const data = await call("get_gamelist", system);
    state.system = system;
    state.games = data.games;
    // índice de busca pré-computado (acelera o filtro em listas grandes)
    state.games.forEach((g) => {
      g._s = ((g.fields && g.fields.name || "") + " " + (g.id || "")).toLowerCase();
    });
    state.gamesById = new Map(data.games.map((g) => [g.id, g]));
    syncRemovalsFromMarks(system);  // marcas são globais: não some ao trocar de console
    // preenche o nome das marcas deste console agora que temos os jogos
    state.games.forEach((g) => {
      const m = state.marks.get(mkKey(system, g.id));
      if (m) m.name = g.fields.name || g.id;
    });
    state.edits.clear();
    state.query = "";
    $("#searchInput").value = "";
    updateListHead();
    $("#systemSelect").value = system;
    applyFilter();
    state.selectedIdx = state.filtered.length ? 0 : -1;
    $("#listScroll").scrollTop = 0;
    renderList(true);
    renderDetail();
    updatePending();
    toast(`Console: ${system} — ${data.count} jogos carregados`, "ok");
  } catch (e) {
    toast(e.message, "err");
  } finally {
    hideLoading();
  }
}

/* ============================== MARKS (GLOBAIS) ============================== */
const MARK_SEP = "\u0000";
function mkKey(system, path) { return system + MARK_SEP + path; }

// define/remove uma marca no store global; espelha em state.removals se for o console atual
function setMark(system, path, level, name) {
  const key = mkKey(system, path);
  if (!level) {
    state.marks.delete(key);
    if (system === state.system) state.removals.delete(path);
    return;
  }
  const prev = state.marks.get(key);
  state.marks.set(key, { system, path, level, name: name || (prev && prev.name) || path });
  if (system === state.system) state.removals.set(path, level);
}

// reconstrói o espelho do console atual a partir do store global
function syncRemovalsFromMarks(system) {
  state.removals = new Map();
  state.marks.forEach((m) => { if (m.system === system) state.removals.set(m.path, m.level); });
}

/* ============================== FILTER + SORT ============================== */
const _collator = new Intl.Collator("pt", { numeric: true, sensitivity: "base" });

function nameOf(g) { return g.fields.name || g.id || ""; }

// valor de data comparável a partir de releasedate (YYYYMMDD, ISO, ou ano)
function dateValue(g) {
  const r = (g.fields.releasedate || "").replace(/\D/g, "");
  if (!r) return null;
  if (r.length <= 4) return parseInt(r.padEnd(4, "0").slice(0, 4), 10) * 10000;
  return parseInt((r.slice(0, 8)).padEnd(8, "0"), 10);
}

function sortFiltered() {
  const { key, dir } = state.sort;
  const mul = dir === "desc" ? -1 : 1;
  if (state.filterMode === "marked") {
    const ml = state.markedList;
    state.filtered.sort((ia, ib) => {
      const a = ml[ia], b = ml[ib];
      // agrupa por console, depois por nome
      if (a.system !== b.system) return _collator.compare(a.system, b.system);
      return _collator.compare(a.name || a.path, b.name || b.path);
    });
    return;
  }
  const games = state.games;
  state.filtered.sort((ia, ib) => {
    const ga = games[ia], gb = games[ib];
    if (key === "date") {
      const va = dateValue(ga), vb = dateValue(gb);
      if (va == null && vb == null) return _collator.compare(nameOf(ga), nameOf(gb));
      if (va == null) return 1;          // sem data: sempre por último
      if (vb == null) return -1;
      if (va !== vb) return (va - vb) * mul;
      return _collator.compare(nameOf(ga), nameOf(gb));
    }
    const va = key === "path" ? (ga.id || "") : nameOf(ga);
    const vb = key === "path" ? (gb.id || "") : nameOf(gb);
    return _collator.compare(va, vb) * mul;
  });
}

function rebuildMarkedList() {
  state.markedList = Array.from(state.marks.values());
}

function applyFilter() {
  const q = state.query.toLowerCase();
  const filtered = [];
  if (state.filterMode === "marked") {
    rebuildMarkedList();
    const ml = state.markedList;
    for (let i = 0; i < ml.length; i++) {
      const s = ((ml[i].name || "") + " " + ml[i].path + " " + ml[i].system).toLowerCase();
      if (!q || s.includes(q)) filtered.push(i);
    }
    state.filtered = filtered;
    sortFiltered();
    $("#searchCount").textContent = q ? `${filtered.length}/${ml.length}` : `${ml.length}`;
    $("#listMeta").textContent = `${filtered.length} marcados`;
    return;
  }
  const games = state.games;
  if (!q) {
    for (let i = 0; i < games.length; i++) filtered.push(i);
  } else {
    for (let i = 0; i < games.length; i++) {
      const s = games[i]._s || "";
      if (s.includes(q)) filtered.push(i);
    }
  }
  state.filtered = filtered;
  sortFiltered();
  $("#searchCount").textContent = q ? `${filtered.length}/${games.length}` : `${games.length}`;
  $("#listMeta").textContent = `${filtered.length} entradas`;
}

function updateListHead() {
  $("#listSystemName").textContent = state.filterMode === "marked"
    ? "★ Marcados — todos os consoles" : (state.system || "");
}

// alterna entre "Todos" e "Marcados"; em marcados a coluna de console aparece
function setFilterMode(mode, silent) {
  state.filterMode = (mode === "marked") ? "marked" : "all";
  const sel = $("#filterMode"); if (sel) sel.value = state.filterMode;
  document.body.classList.toggle("marked-mode", state.filterMode === "marked");
  state.query = ""; $("#searchInput").value = "";
  applyFilter();
  updateListHead();
  state.selectedIdx = state.filtered.length ? 0 : -1;
  $("#listScroll").scrollTop = 0;
  lastStart = lastEnd = -1;
  renderList(true);
  renderDetail();
  if (!silent && state.filterMode === "marked" && state.filtered.length === 0) {
    toast("Nenhum item marcado ainda", "ok");
  }
}

/* ============================== VIRTUAL LIST ============================== */
let rafPending = false;
let lastStart = -1, lastEnd = -1;
function renderList(force) {
  const scroll = $("#listScroll");
  const total = state.filtered.length;
  const scrollTop = scroll.scrollTop;
  const viewH = scroll.clientHeight || 600;
  let start = Math.floor(scrollTop / ROW_H) - BUFFER;
  let end = Math.ceil((scrollTop + viewH) / ROW_H) + BUFFER;
  start = Math.max(0, start);
  end = Math.min(total, end);

  // pula re-render se a janela visível não mudou (ganho durante o scroll)
  if (!force && start === lastStart && end === lastEnd) return;
  lastStart = start; lastEnd = end;

  $("#listSpacerTop").style.height = start * ROW_H + "px";
  $("#listSpacerBottom").style.height = (total - end) * ROW_H + "px";

  const frag = document.createDocumentFragment();
  const marked = state.filterMode === "marked";
  for (let i = start; i < end; i++) {
    const idx = state.filtered[i];
    const item = marked ? state.markedList[idx] : state.games[idx];
    if (item) frag.appendChild(buildRow(item, i, marked));
  }
  const rows = $("#listRows");
  rows.innerHTML = "";
  rows.appendChild(frag);
}

function buildRow(item, filteredIdx, marked) {
  const row = el("div", "row");
  row.style.height = ROW_H + "px";
  row.dataset.i = filteredIdx;

  if (marked) {
    // item = marca {system, path, level, name}
    const lvl = item.level;
    row.classList.add("r" + lvl, "row-marked");
    if (filteredIdx === state.selectedIdx) row.classList.add("selected");
    row.appendChild(el("div", "row-mark"));
    row.appendChild(el("div", "row-console", item.system));
    row.appendChild(el("div", "row-name", item.name || item.path));
    const badge = el("div", "row-badge", lvl === 1 ? "ENTRADA" : lvl === 2 ? "+ROM" : "+MÍDIA");
    row.appendChild(badge);
    return row;
  }

  // item = jogo
  const g = item;
  const lvl = state.removals.get(g.id);
  if (lvl) row.classList.add("r" + lvl);
  if (isEdited(g.id)) row.classList.add("edited");
  if (filteredIdx === state.selectedIdx) row.classList.add("selected");

  row.appendChild(el("div", "row-mark"));
  const name = el("div", "row-name", g.fields.name || g.id || "(sem nome)");
  row.appendChild(name);
  if (lvl) {
    const badge = el("div", "row-badge", lvl === 1 ? "ENTRADA" : lvl === 2 ? "+ROM" : "+MÍDIA");
    row.appendChild(badge);
  }
  return row;
}

/* ============================== SELECTION ============================== */
function selectIndex(idx) {
  if (idx < 0 || idx >= state.filtered.length) return;
  const prev = state.selectedIdx;
  state.selectedIdx = idx;
  const scrolled = ensureVisible(idx);
  if (scrolled) {
    renderList(true);          // a janela mudou: redesenha
  } else {
    updateSelectedRow(prev, idx);  // só move o destaque (rápido)
  }
  scheduleDetail();
}

// move a classe .selected sem reconstruir a lista
function updateSelectedRow(prev, cur) {
  const rows = $("#listRows");
  if (prev !== cur) {
    const p = rows.querySelector(`.row[data-i="${prev}"]`);
    if (p) p.classList.remove("selected");
  }
  const c = rows.querySelector(`.row[data-i="${cur}"]`);
  if (c) c.classList.add("selected");
}

// renderiza o detalhe com pequeno atraso, p/ navegação rápida não travar
let detailTimer;
function scheduleDetail() {
  clearTimeout(detailTimer);
  detailTimer = setTimeout(renderDetail, 55);
}

function ensureVisible(idx) {
  const scroll = $("#listScroll");
  const before = scroll.scrollTop;
  const total = state.filtered.length;
  const maxScroll = Math.max(0, total * ROW_H - scroll.clientHeight);
  const top = idx * ROW_H;
  const bottom = top + ROW_H;
  let target = before;
  if (top < before) target = top;
  else if (bottom > before + scroll.clientHeight) target = bottom - scroll.clientHeight;
  // nunca rola além do conteúdo (evita rolagem "infinita")
  target = Math.min(Math.max(0, target), maxScroll);
  if (target !== before) scroll.scrollTop = target;
  return scroll.scrollTop !== before;
}

function currentGame() {
  if (state.selectedIdx < 0) return null;
  if (state.filterMode === "marked") return null;  // modo marcados: sem detalhe direto
  const gi = state.filtered[state.selectedIdx];
  return state.games[gi] || null;
}

// marca atualmente destacada (somente no modo "marked")
function currentMark() {
  if (state.filterMode !== "marked" || state.selectedIdx < 0) return null;
  return state.markedList[state.filtered[state.selectedIdx]] || null;
}

/* ============================== DETAIL ============================== */
function origVal(id, key) {
  const g = state.gamesById.get(id);
  return (g && g.fields[key] != null) ? g.fields[key] : "";
}
// valor efetivo: edição manual > edição importada (do console atual) > original
function val(id, key) {
  const e = state.edits.get(id);
  if (e && key in e) return e[key];
  const ie = state.importEdits.get(mkKey(state.system, id));
  if (ie && key in ie) return ie[key];
  return origVal(id, key);
}
function isChanged(id, key) {
  return (val(id, key) || "") !== (origVal(id, key) || "");
}
function isEdited(id) {
  const e = state.edits.get(id);
  const ie = state.importEdits.get(mkKey(state.system, id));
  if (!e && !ie) return false;
  const keys = new Set([...(e ? Object.keys(e) : []), ...(ie ? Object.keys(ie) : [])]);
  for (const k of keys) if (isChanged(id, k)) return true;
  return false;
}

function setEdit(id, key, value) {
  let e = state.edits.get(id);
  if (!e) { e = {}; state.edits.set(id, e); }
  e[key] = value;
  // se voltou ao original, limpa
  if ((value || "") === (origVal(id, key) || "")) delete e[key];
  if (Object.keys(e).length === 0) state.edits.delete(id);
}

function renderDetail() {
  const g = currentGame();
  const empty = $("#detailEmpty"), body = $("#detailBody");
  if (!g) {
    empty.hidden = false; body.hidden = true;
    empty.textContent = state.filterMode === "marked"
      ? "Modo “Marcados”: clique em um item (ou Enter) para abri-lo no seu console. Use “Salvar & Commit” para aplicar todas as marcações."
      : "Selecione um jogo na lista.";
    return;
  }
  empty.hidden = true; body.hidden = false;

  // mídia (com token p/ ignorar requisições obsoletas durante navegação rápida)
  const strip = $("#mediaStrip"); strip.innerHTML = "";
  const token = (state._mediaToken = (state._mediaToken || 0) + 1);
  const mediaTypes = Object.keys(g.media || {});
  const shown = MEDIA_PREVIEW.filter((t) => mediaTypes.includes(t)).slice(0, 3);
  if (shown.length === 0) {
    strip.appendChild(el("div", "media-none", mediaTypes.length ? "" : "sem mídia indexada"));
  }
  shown.forEach((t) => {
    const card = el("div", "media-card");
    const img = el("img");
    img.loading = "lazy";
    img.onerror = () => card.remove();
    call("get_media", state.system, t, g.media[t])
      .then((r) => {
        if (token !== state._mediaToken) return;     // seleção mudou: descarta
        if (r && r.src) img.src = r.src; else card.remove();
      })
      .catch(() => card.remove());
    card.appendChild(img);
    card.appendChild(el("div", "mtype", t));
    strip.appendChild(card);
  });

  $("#detailName").textContent = val(g.id, "name") || g.id;
  $("#detailPath").textContent = val(g.id, "path") || g.id;

  // marca de remoção
  const mark = $("#detailMark"); mark.innerHTML = "";
  const lvl = state.removals.get(g.id);
  if (lvl) { const tag = el("span", "tag r" + lvl, REMOVAL_LABELS[lvl]); mark.appendChild(tag); }

  // botões de marcação
  document.querySelectorAll(".markbtn").forEach((b) => {
    b.classList.toggle("active", Number(b.dataset.level) === (lvl || 0) && Number(b.dataset.level) !== 0);
  });

  // campos
  const wrap = $("#fieldsWrap"); wrap.innerHTML = "";
  const keys = fieldKeys(g);
  keys.forEach((key) => wrap.appendChild(buildFieldRow(g.id, key)));
}

function fieldKeys(g) {
  const set = new Set(Object.keys(g.fields));
  const e = state.edits.get(g.id);
  if (e) Object.keys(e).forEach((k) => set.add(k));
  const ordered = FIELD_ORDER.filter((k) => set.has(k));
  const extra = [...set].filter((k) => !FIELD_ORDER.includes(k)).sort();
  return [...ordered, ...extra];
}

function buildFieldRow(id, key) {
  const row = el("div", "field-row");
  if (isChanged(id, key)) row.classList.add("changed");

  const keyEl = el("div", "field-key", key);
  if (isChanged(id, key)) { const d = el("span", "changed-dot", "●"); keyEl.appendChild(d); }
  row.appendChild(keyEl);

  let input;
  const value = val(id, key);
  if (BOOL_FIELDS.has(key)) {
    input = el("div", "field-bool");
    const on = el("button", value === "true" ? "on" : "", "true");
    const off = el("button", value !== "true" ? "" : "", "false");
    off.classList.toggle("on", value !== "true");
    on.addEventListener("click", () => { setEdit(id, key, "true"); renderDetail(); refreshRow(id); updatePending(); });
    off.addEventListener("click", () => { setEdit(id, key, "false"); renderDetail(); refreshRow(id); updatePending(); });
    input.appendChild(on); input.appendChild(off);
  } else if (TEXTAREA_FIELDS.has(key)) {
    input = el("textarea", "field-textarea");
    input.value = value;
    input.addEventListener("input", () => { setEdit(id, key, input.value); liveDirty(row, id, key); });
  } else {
    input = el("input", "field-input" + (MONO_FIELDS.has(key) ? " mono" : ""));
    input.type = "text"; input.value = value;
    input.addEventListener("input", () => { setEdit(id, key, input.value); liveDirty(row, id, key); });
  }
  row.appendChild(input);

  const del = el("button", "field-del", "✕");
  del.title = "Esvaziar/remover campo";
  del.addEventListener("click", () => { setEdit(id, key, ""); renderDetail(); refreshRow(id); updatePending(); });
  row.appendChild(del);

  return row;
}

// feedback ao vivo durante digitação, sem re-render (preserva foco do campo)
let pendingDirtyTimer;
function liveDirty(row, id, key) {
  const changed = isChanged(id, key);
  row.classList.toggle("changed", changed);
  const keyEl = row.querySelector(".field-key");
  let dot = keyEl.querySelector(".changed-dot");
  if (changed && !dot) { dot = el("span", "changed-dot", "●"); keyEl.appendChild(dot); }
  else if (!changed && dot) { dot.remove(); }
  clearTimeout(pendingDirtyTimer);
  pendingDirtyTimer = setTimeout(() => { renderList(true); updatePending(); }, 150);
}
function refreshRow() { renderList(true); }

/* ============================== MARKING ============================== */
function setRemoval(level) {
  if (state.filterMode === "marked") {
    const m = currentMark(); if (!m) return;
    setMark(m.system, m.path, level, m.name);
    const keep = state.selectedIdx;
    applyFilter();
    state.selectedIdx = state.filtered.length ? Math.min(keep, state.filtered.length - 1) : -1;
    renderList(true); renderDetail(); updatePending();
    return;
  }
  const g = currentGame(); if (!g) return;
  setMark(state.system, g.id, level, g.fields.name || g.id);
  renderDetail(); renderList(true); updatePending();
}

/* ============================== PENDING ============================== */
// conjunto de chaves (system\u0000path) com edição efetiva, fora as marcadas p/ remoção
function editKeys() {
  const set = new Set();
  state.importEdits.forEach((_v, key) => { if (!state.marks.has(key)) set.add(key); });
  state.edits.forEach((_e, id) => {
    if (isEdited(id)) { const key = mkKey(state.system, id); if (!state.marks.has(key)) set.add(key); }
  });
  return set;
}

function updatePending() {
  let r1 = 0, r2 = 0, r3 = 0;
  state.marks.forEach((m) => { if (m.level === 1) r1++; else if (m.level === 2) r2++; else if (m.level === 3) r3++; });
  $("#pCntEdit").textContent = editKeys().size;
  $("#pCntR1").textContent = r1;
  $("#pCntR2").textContent = r2;
  $("#pCntR3").textContent = r3;
}

// agrupa marcas + edições (importadas e manuais) por console → 1 payload por sistema
function buildAllPayloads() {
  const bySys = new Map();
  const ensure = (sys) => {
    if (!bySys.has(sys)) bySys.set(sys, { system: sys, removals: {}, edits: {} });
    return bySys.get(sys);
  };
  // remoções
  state.marks.forEach((m) => { ensure(m.system).removals[m.path] = m.level; });
  // edições importadas (todos os consoles)
  state.importEdits.forEach((fields, key) => {
    if (state.marks.has(key)) return;                 // remoção tem prioridade
    const sep = key.indexOf(MARK_SEP);
    const sys = key.slice(0, sep), path = key.slice(sep + 1);
    const tgt = ensure(sys).edits;
    tgt[path] = Object.assign({}, tgt[path] || {}, fields);
  });
  // edições manuais do console atual (sobrepõem as importadas)
  state.edits.forEach((e, id) => {
    if (state.marks.has(mkKey(state.system, id))) return;
    const changed = {};
    Object.keys(e).forEach((k) => { if (isChanged(id, k)) changed[k] = e[k]; });
    if (Object.keys(changed).length) {
      const tgt = ensure(state.system).edits;
      tgt[id] = Object.assign({}, tgt[id] || {}, changed);
    }
  });
  // descarta consoles que ficaram sem nada
  for (const [sys, p] of [...bySys]) {
    if (!Object.keys(p.removals).length && !Object.keys(p.edits).length) bySys.delete(sys);
  }
  return Array.from(bySys.values());
}

/* ============================== COMMIT ============================== */
async function openCommit() {
  const payloads = buildAllPayloads();
  const totalChanges = payloads.reduce(
    (n, p) => n + Object.keys(p.removals).length + Object.keys(p.edits).length, 0);
  if (totalChanges === 0) { toast("Nada pendente para salvar", "err"); return; }
  try {
    showLoading("Calculando alterações…");
    const plans = [];
    for (const p of payloads) {
      const plan = await call("build_plan", p);
      plans.push({ system: p.system, plan });
    }
    state.commitSnapshot = payloads;     // congela exatamente o que foi pré-visualizado
    state.commitCompleted = false;
    renderPlanMulti(plans);
    $("#commitResult").hidden = true;
    $("#commitExecute").disabled = false;
    $("#commitExecute").textContent = payloads.length > 1
      ? `Executar commit (${payloads.length} consoles)` : "Executar commit";
    $("#commitModal").hidden = false;
  } catch (e) { toast(e.message, "err"); }
  finally { hideLoading(); }
}

function renderPlanMulti(plans) {
  const hardDelete = plans.some((x) => x.plan.hard_delete);
  $("#commitMode").textContent = hardDelete ? "HARD DELETE" : "→ lixeira";
  const tot = { entries_to_remove: 0, roms_to_delete: 0, media_files_to_delete: 0, entries_to_edit: 0 };
  plans.forEach(({ plan }) => {
    tot.entries_to_remove += plan.summary.entries_to_remove;
    tot.roms_to_delete += plan.summary.roms_to_delete;
    tot.media_files_to_delete += plan.summary.media_files_to_delete;
    tot.entries_to_edit += plan.summary.entries_to_edit;
  });
  const sum = $("#planSummary"); sum.innerHTML = "";
  const stat = (cls, num, lbl) => {
    const d = el("div", "plan-stat " + cls);
    d.appendChild(el("div", "num", String(num)));
    d.appendChild(el("div", "lbl", lbl));
    return d;
  };
  sum.appendChild(stat("s-rm", tot.entries_to_remove, "entradas removidas"));
  sum.appendChild(stat("s-rom", tot.roms_to_delete, "ROMs apagados"));
  sum.appendChild(stat("s-media", tot.media_files_to_delete, "mídias apagadas"));
  sum.appendChild(stat("s-edit", tot.entries_to_edit, "entradas editadas"));

  const list = $("#planList"); list.innerHTML = "";
  let shown = 0;
  const CAP = 500;
  outer:
  for (const { system, plan } of plans) {
    if (plans.length > 1) {
      const hdr = el("div", "plan-sys", `${system} — ${plan.operations.length} operações`);
      list.appendChild(hdr);
    }
    for (const op of plan.operations) {
      if (shown >= CAP) { list.appendChild(el("div", "plan-op", "… (lista truncada na prévia)")); break outer; }
      const row = el("div", "plan-op");
      row.appendChild(el("div", "op-kind " + op.kind, op.kind.replace("_", " ")));
      row.appendChild(el("div", "op-name", op.name));
      const det = el("div", "op-detail" + (op.exists ? "" : " missing"), op.error || op.detail);
      row.appendChild(det);
      list.appendChild(row);
      shown++;
    }
  }
}

function closeCommitModal() {
  $("#commitModal").hidden = true;
  state.commitSnapshot = null;
  state.commitCompleted = false;
}

async function executeCommit() {
  // se o commit já foi concluído, o botão "Concluído" apenas fecha o modal
  if (state.commitCompleted) { closeCommitModal(); return; }
  const payloads = state.commitSnapshot;
  if (!payloads || !payloads.length) { toast("Pré-visualização expirada — reabra o commit.", "err"); return; }
  $("#commitExecute").disabled = true;
  $("#commitExecute").textContent = "Executando…";
  showLoading(`Aplicando alterações…`);
  try {
    let totRemoved = 0, totTrashed = 0, totDeleted = 0, totErr = 0;
    const lines = [];
    for (const payload of payloads) {
      const r = await call("commit", payload);
      const rep = r.report;
      const fileOps = rep.file_operations || [];
      const trashed = fileOps.filter((o) => o.action === "trashed").length;
      const deleted = fileOps.filter((o) => o.action === "deleted").length;
      const errors = fileOps.filter((o) => o.action === "error");
      totRemoved += rep.removed_entries; totTrashed += trashed; totDeleted += deleted; totErr += errors.length;
      lines.push(`• ${payload.system}: ${rep.removed_entries} removidas · ${trashed} p/ lixeira · restam ${rep.remaining_entries}`);
      updateSystemCount(payload.system, rep.remaining_entries);
      // remove do store global as marcas e edições já aplicadas deste console
      Object.keys(payload.removals).forEach((path) => state.marks.delete(mkKey(payload.system, path)));
      Object.keys(payload.edits).forEach((path) => state.importEdits.delete(mkKey(payload.system, path)));
    }
    let txt = `✓ Commit concluído — ${payloads.length} console(s)\n`;
    txt += lines.join("\n") + "\n";
    txt += `Totais: ${totRemoved} entradas · ${totTrashed} p/ lixeira · ${totDeleted} apagados`;
    if (totErr) txt += `\n⚠ ${totErr} erro(s) — verifique os logs`;
    const box = $("#commitResult"); box.textContent = txt; box.hidden = false;
    state.commitSnapshot = null;
    state.commitCompleted = true;
    state.edits.clear();
    $("#commitExecute").disabled = false;
    $("#commitExecute").textContent = "Concluído";
    toast(`Commit aplicado (${payloads.length} console(s))`, "ok");
    // volta para o modo normal e recarrega o console atual
    setFilterMode("all", true);
    await loadGamelist(state.system);
  } catch (e) {
    $("#commitExecute").disabled = false;
    $("#commitExecute").textContent = "Executar commit";
    toast(e.message, "err");
  } finally {
    hideLoading();
  }
}

/* ============================== ORPHAN CLEANER ============================== */
const orph = { results: [], scanned: false, cleaning: false };

function fmtBytes(n) {
  if (!n) return "0 B";
  const u = ["B", "KB", "MB", "GB", "TB"];
  let i = 0; let v = n;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${u[i]}`;
}

function openOrphan(show) {
  $("#orphanModal").hidden = !show;
  if (show) {
    $("#orphanMode").textContent = state.config.hard_delete ? "HARD DELETE" : "→ lixeira";
    $("#orphanResults").hidden = !orph.scanned;
    $("#orphanResult").hidden = true;
    updateOrphanCleanBtn();
  }
}

function orphSelectedCounts() {
  const boxes = [...document.querySelectorAll("#orphanResults .orphan-item input:checked")];
  let entries = 0, media = 0;
  boxes.forEach((b) => { if (b.dataset.kind === "entry") entries++; else media++; });
  return { entries, media, total: boxes.length };
}

function updateOrphanCleanBtn() {
  const { total } = orphSelectedCounts();
  const btn = $("#orphanCleanBtn");
  btn.disabled = orph.cleaning || total === 0;
  btn.textContent = total ? `Limpar selecionados (${total})` : "Limpar selecionados";
}

function orphItem(kind, sys, name, detail, extra) {
  const row = el("div", "orphan-item");
  const cb = document.createElement("input");
  cb.type = "checkbox"; cb.checked = true;
  cb.dataset.kind = kind; cb.dataset.sys = sys; cb.dataset.key = detail;
  row.appendChild(cb);
  const s = el("div", "oi-sys", sys); row.appendChild(s);
  row.appendChild(el("div", "oi-name", name));
  row.appendChild(el("div", "oi-detail", detail));
  if (extra) row.appendChild(el("div", "oi-size", extra));
  return row;
}

function renderOrphans() {
  const res = orph.results;
  const totE = res.reduce((n, r) => n + (r.orphan_entries || []).length, 0);
  const totM = res.reduce((n, r) => n + (r.orphan_media || []).length, 0);
  const totB = res.reduce((n, r) => n + (r.media_bytes || 0), 0);
  const totU = res.reduce((n, r) => n + (r.m3u_broken || []).length, 0);

  const sum = $("#orphanSummary"); sum.innerHTML = "";
  const stat = (cls, num, lbl) => {
    const d = el("div", "plan-stat " + cls);
    d.appendChild(el("div", "num", String(num)));
    d.appendChild(el("div", "lbl", lbl));
    return d;
  };
  sum.appendChild(stat("s-rm", totE, "entradas órfãs"));
  sum.appendChild(stat("s-media", totM, "mídias órfãs"));
  sum.appendChild(stat("s-rom", fmtBytes(totB), "espaço recuperável"));
  sum.appendChild(stat("s-edit", totU, "m3u quebrados"));

  const le = $("#orphListEntries"); le.innerHTML = "";
  let nE = 0;
  res.forEach((r) => (r.orphan_entries || []).forEach((e) => {
    le.appendChild(orphItem("entry", r.system, e.name, e.path));
    nE++;
  }));
  if (!nE) le.appendChild(el("div", "orphan-empty", "Nenhuma entrada órfã encontrada 🎉"));
  $("#orphMetaEntries").textContent = `${nE} itens`;

  const lm = $("#orphListMedia"); lm.innerHTML = "";
  let nM = 0;
  res.forEach((r) => (r.orphan_media || []).forEach((m) => {
    const row = orphItem("media", r.system, m.rel, m.abs, fmtBytes(m.size));
    lm.appendChild(row);
    nM++;
  }));
  if (!nM) lm.appendChild(el("div", "orphan-empty", "Nenhuma mídia órfã encontrada 🎉"));
  $("#orphMetaMedia").textContent = `${nM} itens · ${fmtBytes(totB)}`;

  const lu = $("#orphListM3u"); lu.innerHTML = "";
  res.forEach((r) => (r.m3u_broken || []).forEach((u) => {
    const row = el("div", "orphan-item");
    row.appendChild(el("div", "oi-sys", r.system));
    row.appendChild(el("div", "oi-name", u.name));
    row.appendChild(el("div", "oi-detail", `faltam: ${u.missing.join(", ")}`));
    lu.appendChild(row);
  }));
  $("#orphSecM3u").hidden = totU === 0;

  $("#orphChkAllEntries").checked = true;
  $("#orphChkAllMedia").checked = true;
  $("#orphanResults").hidden = false;
  updateOrphanCleanBtn();
}

async function doOrphanScan(keepResult) {
  const scope = $("#orphanScope").value;
  const payload = scope === "all" ? { all: true } : { systems: [state.system] };
  if (scope !== "all" && !state.system) { toast("Abra um console primeiro", "err"); return; }
  showLoading(scope === "all" ? "Varredura de órfãos em todos os consoles…" : `Varredura de órfãos em ${state.system}…`);
  try {
    const r = await call("scan_orphans", payload);
    orph.results = r.results || [];
    orph.scanned = true;
    if (!keepResult) $("#orphanResult").hidden = true;
    renderOrphans();
    const t = r.totals || {};
    toast(`Varredura: ${t.orphan_entries || 0} entradas · ${t.orphan_media || 0} mídias órfãs`, "ok");
  } catch (e) {
    toast(e.message, "err");
  } finally {
    hideLoading();
  }
}

async function doOrphanClean() {
  const boxes = [...document.querySelectorAll("#orphanResults .orphan-item input:checked")];
  if (!boxes.length) return;
  const entries = {}, media = {};
  boxes.forEach((b) => {
    const tgt = b.dataset.kind === "entry" ? entries : media;
    (tgt[b.dataset.sys] = tgt[b.dataset.sys] || []).push(b.dataset.key);
  });
  const nE = Object.values(entries).reduce((n, a) => n + a.length, 0);
  const nM = Object.values(media).reduce((n, a) => n + a.length, 0);
  const mode = state.config.hard_delete ? "APAGADAS DE VEZ (hard delete)" : "movidas para a lixeira";
  const okGo = await askConfirm(
    `Remover ${nE} entrada(s) órfã(s) da gamelist e ${nM} mídia(s) órfã(s)?\n` +
    `As gamelists recebem backup antes; as mídias serão ${mode}.`,
    { title: "ES-DE Orphan Cleaner", yes: "Limpar agora", no: "Cancelar" });
  if (!okGo) return;

  orph.cleaning = true; updateOrphanCleanBtn();
  showLoading("Aplicando limpeza…");
  try {
    const r = await call("clean_orphans", { entries, media });
    const rep = r.report; const s = rep.summary;
    let txt = `✓ Limpeza concluída\n`;
    txt += `Entradas removidas: ${s.entries_removed}\n`;
    txt += `Mídias p/ lixeira: ${s.media_trashed}  ·  apagadas: ${s.media_deleted}\n`;
    rep.systems.forEach((x) => { txt += `• ${x.system}: -${x.removed_entries} entradas (backup ok)\n`; });
    if (s.media_errors) txt += `⚠ ${s.media_errors} erro(s) — verifique permissões/caminhos\n`;
    const box = $("#orphanResult"); box.textContent = txt.trimEnd(); box.hidden = false;
    toast("Limpeza de órfãos concluída", "ok");
    // atualiza contagens e recarrega o console atual se foi afetado
    rep.systems.forEach((x) => updateSystemCount(x.system, x.remaining_entries));
    if (rep.systems.some((x) => x.system === state.system)) await loadGamelist(state.system);
    // re-escaneia mantendo o relatório na tela: remove itens limpos das listas
    await doOrphanScan(true);
  } catch (e) {
    toast(e.message, "err");
  } finally {
    orph.cleaning = false;
    hideLoading();
    updateOrphanCleanBtn();
  }
}

// atualiza o rótulo/contagem de um único sistema no seletor
function updateSystemCount(system, count) {
  const s = (state.systems || []).find((x) => x.system === system);
  if (s && typeof count === "number") s.count = count;
  const sel = $("#systemSelect");
  const opt = Array.from(sel.options).find((o) => o.value === system);
  if (opt && typeof count === "number") opt.textContent = `${system}  (${count})`;
}

/* ============================== KEYBOARD ============================== */
function inField() {
  const a = document.activeElement;
  return a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA" || a.tagName === "SELECT");
}

document.addEventListener("keydown", (ev) => {
  // shortcuts globais que funcionam mesmo dentro de campos
  if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "s") {
    ev.preventDefault(); openCommit(); return;
  }
  if (ev.key === "Escape") {
    if (!$("#commitModal").hidden) { closeCommitModal(); return; }
    if (!$("#orphanModal").hidden) { openOrphan(false); return; }
    if (!$("#helpModal").hidden) { $("#helpModal").hidden = true; return; }
    if (!$("#openModal").hidden) { openModal(false); return; }
    if (inField()) { document.activeElement.blur(); return; }
  }

  if (inField()) return;                    // demais atalhos só fora de campos
  if (document.body.dataset.screen !== "editor") return;
  if (!$("#openModal").hidden || !$("#commitModal").hidden
      || !$("#confirmModal").hidden || !$("#helpModal").hidden
      || !$("#orphanModal").hidden) return;

  const k = ev.key.toLowerCase();
  switch (true) {
    case ev.key === "ArrowDown" || k === "j":
      ev.preventDefault(); selectIndex(Math.min(state.selectedIdx + 1, state.filtered.length - 1)); break;
    case ev.key === "ArrowUp" || k === "k":
      ev.preventDefault(); selectIndex(Math.max(state.selectedIdx - 1, 0)); break;
    case ev.key === "PageDown":
      ev.preventDefault(); selectIndex(Math.min(state.selectedIdx + 12, state.filtered.length - 1)); break;
    case ev.key === "PageUp":
      ev.preventDefault(); selectIndex(Math.max(state.selectedIdx - 12, 0)); break;
    case ev.key === "Home":
      ev.preventDefault(); selectIndex(0); break;
    case ev.key === "End":
      ev.preventDefault(); selectIndex(state.filtered.length - 1); break;
    case ev.key === "Delete" && ev.altKey:
    case k === "3":
      ev.preventDefault(); setRemoval(3); break;
    case ev.key === "Delete" && ev.shiftKey:
    case k === "2":
      ev.preventDefault(); setRemoval(2); break;
    case ev.key === "Delete":
    case k === "x":
    case k === "1":
      ev.preventDefault(); setRemoval(1); break;
    case k === "u":
      ev.preventDefault(); setRemoval(0); break;
    case ev.key === "/":
      ev.preventDefault(); $("#searchInput").focus(); break;
    case ev.key === "?":
      ev.preventDefault(); $("#helpModal").hidden = false; break;
    case ev.key === "Enter":
      ev.preventDefault();
      if (state.filterMode === "marked") { jumpToMark(currentMark()); break; }
      { const first = $("#fieldsWrap .field-input, #fieldsWrap .field-textarea"); if (first) first.focus(); }
      break;
  }
});

/* ============================== HELP ============================== */
const HELP = [
  [["↑", "↓", "J", "K"], "Navegar pela lista"],
  [["PgUp", "PgDn", "Home", "End"], "Pular várias entradas"],
  [["Enter"], "Editar campos do jogo selecionado"],
  [["Del", "X", "1"], "Marcar remoção — só a entrada"],
  [["Shift+Del", "2"], "Marcar remoção — entrada + ROM"],
  [["Alt+Del", "3"], "Marcar remoção — entrada + ROM + mídia"],
  [["U"], "Desmarcar remoção"],
  [["/"], "Focar busca/filtro"],
  [["Enter"], "No filtro “Somente marcados”: abrir item no seu console"],
  [["Ctrl+S"], "Salvar / Commit (com dry-run, agrega todos os consoles)"],
  [["Esc"], "Fechar diálogo / sair do campo"],
  [["?"], "Esta ajuda"],
];
function renderHelp() {
  const grid = $("#kbdGrid"); grid.innerHTML = "";
  HELP.forEach(([keys, desc]) => {
    const kc = el("div", "keys");
    keys.forEach((k) => { const kbd = document.createElement("kbd"); kbd.textContent = k; kc.appendChild(kbd); });
    grid.appendChild(kc);
    grid.appendChild(el("div", "desc", desc));
  });
}

/* ============================== WIRING ============================== */
function wire() {
  $("#openBtn").addEventListener("click", () => openModal(true));
  $("#importBtn").addEventListener("click", doImport);
  $("#orphanBtn").addEventListener("click", () => openOrphan(true));
  $("#orphanClose").addEventListener("click", () => openOrphan(false));
  $("#orphanScanBtn").addEventListener("click", doOrphanScan);
  $("#orphanCleanBtn").addEventListener("click", doOrphanClean);
  $("#orphChkAllEntries").addEventListener("change", (e) => {
    document.querySelectorAll('#orphListEntries input[type="checkbox"]').forEach((b) => { b.checked = e.target.checked; });
    updateOrphanCleanBtn();
  });
  $("#orphChkAllMedia").addEventListener("change", (e) => {
    document.querySelectorAll('#orphListMedia input[type="checkbox"]').forEach((b) => { b.checked = e.target.checked; });
    updateOrphanCleanBtn();
  });
  $("#orphanResults").addEventListener("change", (e) => {
    if (e.target.matches('.orphan-item input[type="checkbox"]')) updateOrphanCleanBtn();
  });
  $("#openCancel").addEventListener("click", () => openModal(false));
  $("#openConfirm").addEventListener("click", doOpen);
  document.querySelectorAll(".pick").forEach((b) => b.addEventListener("click", async () => {
    const target = b.dataset.target;
    try {
      const r = b.dataset.pick === "file"
        ? await call("pick_file")
        : await call("pick_folder");
      if (r && r.path) {
        $("#" + target).value = r.path;
        // se escolheu o gamelist.xml, tenta preencher o nome do sistema
        if (target === "in_gamelist_file" && !$("#in_system").value) {
          const parts = r.path.replace(/\\/g, "/").split("/");
          if (parts.length >= 2) $("#in_system").value = parts[parts.length - 2];
        }
      }
    } catch (e) { toast(e.message, "err"); }
  }));
  document.querySelectorAll(".tab").forEach((t) => t.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((x) => x.classList.remove("active"));
    t.classList.add("active");
    document.querySelectorAll(".tabpanel").forEach((p) => { p.hidden = p.dataset.panel !== t.dataset.tab; });
  }));

  $("#systemSelect").addEventListener("change", async (e) => {
    const target = e.target.value;
    if (target === state.system) return;
    if (!$("#commitModal").hidden) {
      e.target.value = state.system;
      toast("Feche a janela de commit antes de trocar de console", "err");
      return;
    }
    if (state.edits.size) {
      const ok = await askConfirm(
        "Há edições de campos não salvas neste console. Trocar vai descartá-las. Continuar? (As marcações de remoção são mantidas.)",
        { title: "Trocar de console", yes: "Descartar edições e trocar", no: "Cancelar" });
      if (!ok) { e.target.value = state.system; return; }
    }
    await loadGamelist(target);
    e.target.blur();   // tira o foco do select p/ as setas navegarem a lista
  });

  let searchTimer;
  $("#searchInput").addEventListener("input", (e) => {
    const v = e.target.value.trim();
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.query = v;
      applyFilter();
      state.selectedIdx = state.filtered.length ? 0 : -1;
      $("#listScroll").scrollTop = 0;
      renderList(true); renderDetail();
    }, 120);
  });

  // clique nas linhas via delegação (evita um listener por linha)
  $("#listRows").addEventListener("click", (e) => {
    const row = e.target.closest(".row");
    if (!row || row.dataset.i === undefined) return;
    if (inField()) document.activeElement.blur();
    const idx = Number(row.dataset.i);
    if (state.filterMode === "marked") {
      state.selectedIdx = idx;
      jumpToMark(state.markedList[state.filtered[idx]]);
      return;
    }
    selectIndex(idx);
  });

  $("#listScroll").addEventListener("scroll", () => {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => { rafPending = false; renderList(false); });
  });

  document.querySelectorAll(".markbtn").forEach((b) =>
    b.addEventListener("click", () => setRemoval(Number(b.dataset.level))));

  $("#addFieldBtn").addEventListener("click", () => {
    const g = currentGame(); if (!g) return;
    const name = $("#newFieldName").value.trim();
    if (!name) return;
    if (!g.fields[name]) g.fields[name] = "";   // aparece no editor
    $("#newFieldName").value = "";
    renderDetail();
    setTimeout(() => {
      const rows = document.querySelectorAll("#fieldsWrap .field-row");
      const last = rows[rows.length - 1]?.querySelector("input,textarea");
      last && last.focus();
    }, 30);
  });

  $("#commitBtn").addEventListener("click", openCommit);
  $("#commitCancel").addEventListener("click", () => { closeCommitModal(); });
  $("#commitExecute").addEventListener("click", executeCommit);

  $("#helpBtn").addEventListener("click", () => { $("#helpModal").hidden = false; });
  $("#helpClose").addEventListener("click", () => { $("#helpModal").hidden = true; });

  $("#themeBtn").addEventListener("click", toggleTheme);

  $("#sortSelect").addEventListener("change", (e) => {
    const [key, dir] = e.target.value.split(":");
    state.sort = { key, dir: dir || "asc" };
    savePrefs();
    applyFilter();
    state.selectedIdx = state.filtered.length ? 0 : -1;
    $("#listScroll").scrollTop = 0;
    renderList(true); renderDetail();
    e.target.blur();   // tira o foco do select p/ as setas navegarem a lista
  });

  $("#filterMode").addEventListener("change", (e) => {
    setFilterMode(e.target.value);
    e.target.blur();
  });

  window.addEventListener("resize", () => renderList(true));
}

/* ============================== BOOT ============================== */
async function boot() {
  wire();
  renderHelp();
  try {
    const prefs = await call("get_prefs");
    applyTheme(prefs && prefs.theme ? prefs.theme : "dark");
    if (prefs && typeof prefs.sort === "string" && prefs.sort.includes(":")) {
      const [key, dir] = prefs.sort.split(":");
      state.sort = { key, dir: dir || "asc" };
      const sel = $("#sortSelect");
      if (sel) sel.value = prefs.sort;
    }
  } catch (_) { applyTheme("dark"); }
  try {
    state.config = await call("get_config");
    if (state.config.loaded) {
      document.body.dataset.screen = "editor";
      await loadSystems();
    } else {
      openModal(true);
    }
  } catch (e) {
    openModal(true);
  }
}
document.addEventListener("DOMContentLoaded", boot);
