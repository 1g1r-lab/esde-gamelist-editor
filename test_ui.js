// Integração (jsdom) do redesign "Pixel Lounge" (v1.3.1):
// sidebar de consoles, painel recolhível, marcação inline, tabs, plano, import, órfãos.
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const root = __dirname;
const html = fs.readFileSync(path.join(root, "frontend/index.html"), "utf8");
const appjs = fs.readFileSync(path.join(root, "frontend/js/app.js"), "utf8");

const SYS = [{ system: "snes", count: 1 }, { system: "nes", count: 2 }];
const GL = {
  snes: { system: "snes", count: 1, games: [
    { id: "./smw.sfc", fields: { path: "./smw.sfc", name: "Super Mario World", developer: "Nintendo", genre: "Platform", releasedate: "19901121" }, media: { covers: "smw.png" } },
  ] },
  nes: { system: "nes", count: 2, games: [
    { id: "./smb.nes", fields: { path: "./smb.nes", name: "Super Mario Bros." }, media: {} },
    { id: "./mm2.nes", fields: { path: "./mm2.nes", name: "Mega Man 2" }, media: {} },
  ] },
};

let prefsStore = { sort: "name:asc" };
const calls = [];
const api = {
  get_prefs: async () => ({ ...prefsStore }),
  set_prefs: async (p) => { prefsStore = { ...prefsStore, ...p }; calls.push(["set_prefs", p]); return { ok: true }; },
  get_config: async () => ({ loaded: true, gamelists_root: "/x", roms_root: "", media_root: "", hard_delete: false }),
  get_systems: async () => { calls.push(["get_systems"]); return SYS; },
  get_gamelist: async (s) => { calls.push(["get_gamelist", s]); return GL[s]; },
  get_media: async () => ({ src: "data:image/png;base64,AAAA" }),
  build_plan: async (p) => { calls.push(["build_plan", p]); return { summary: { entries_to_remove: Object.keys(p.removals).length, roms_to_delete: 0, media_files_to_delete: 0, entries_to_edit: Object.keys(p.edits).length }, operations: [], hard_delete: false }; },
  commit: async (p) => { calls.push(["commit", p]); return { ok: true, report: { removed_entries: Object.keys(p.removals).length, remaining_entries: 99, file_operations: [] } }; },
  pick_marks_file: async () => ({ path: "/x/marks.txt" }),
  read_marks_file: async () => ({ entries: [
    { system: "snes", path: "./smw.sfc", level: 3 },
    { system: "snes", path: "./ghost.sfc", level: 1 },
    { system: "nes", path: "./remote.zip", level: 2 },
  ], skipped: 1, total: 4 }),
  scan_orphans: async (p) => { calls.push(["scan_orphans", p]); return { results: [
    { system: "nes", orphan_entries: [{ path: "./Ghost.nes", name: "Ghost", reason: "sem ROM", abs: "/x/ROMS/nes/Ghost.nes" }],
      orphan_media: [{ abs: "/x/media/nes/covers/Zombie.webp", rel: "covers/Zombie.webp", type: "covers", stem: "Zombie", size: 2048 }],
      m3u_broken: [{ path: "./Broken.m3u", name: "Broken", missing: [".discs/x.chd"] }], media_bytes: 2048 },
  ], totals: { orphan_entries: 1, orphan_media: 1, m3u_broken: 1, media_bytes: 2048 } }; },
  clean_orphans: async (p) => { calls.push(["clean_orphans", p]); return { ok: true, report: {
    systems: [{ system: "nes", removed_entries: (p.entries.nes || []).length, remaining_entries: 42 }],
    summary: { entries_removed: (p.entries.nes || []).length, media_trashed: (p.media.nes || []).length, media_deleted: 0, media_errors: 0 } } }; },
};

const dom = new JSDOM(html, { url: "http://localhost/", runScripts: "outside-only", pretendToBeVisual: true });
const { window } = dom;
global.window = window; global.document = window.document;
window.pywebview = { api };
window.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0);
window.cancelAnimationFrame = (id) => clearTimeout(id);
window.eval(appjs);
const T = window.__t;

const $ = (s) => window.document.querySelector(s);
const $$ = (s) => [...window.document.querySelectorAll(s)];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const fire = (elm, type, opts) => elm.dispatchEvent(new window.Event(type, Object.assign({ bubbles: true }, opts)));

(async () => {
  let pass = 0, fail = 0;
  const ok = (c, m) => { if (c) { pass++; console.log("  ✓", m); } else { fail++; console.log("  ✗", m); } };

  window.document.dispatchEvent(new window.Event("DOMContentLoaded"));
  window.dispatchEvent(new window.Event("pywebviewready"));
  await wait(80);

  console.log("\n[1] Boot + sidebar de consoles");
  ok(window.document.body.dataset.screen === "editor", "entra na tela do editor (config carregada)");
  ok($("#sideCount").textContent === "CONSOLES·2", "cabeçalho da sidebar: 2 consoles");
  ok($$("#sideList .console").length === 2, "2 consoles listados na sidebar");
  ok($("#sideList .console.active").dataset.system === "snes", "console inicial ativo = snes");
  ok($$("#listRows .row").length === 1, "lista renderiza 1 jogo de snes");
  ok($("#loadOverlay").hidden === true, "overlay some após carregar");

  console.log("\n[2] Painel recolhível (Ctrl+B / caixinhas)");
  fire($("#segPills"), "click"); await wait(10);
  ok($("#app").dataset.panel === "closed", "segPills recolhe o painel");
  ok($$("#pillsBar .pill").length === 2, "caixinhas mostram 2 consoles");
  T.togglePanel(); await wait(10);
  ok($("#app").dataset.panel === "open", "togglePanel reabre o painel");

  console.log("\n[3] Troca de console (clique na sidebar)");
  fire($$("#sideList .console")[1], "click"); await wait(60);
  ok(T.state.system === "nes", "clicar no console troca para nes");
  ok(calls.some((c) => c[0] === "get_gamelist" && c[1] === "nes"), "get_gamelist('nes') chamado");
  ok($$("#listRows .row").length === 2, "lista mostra 2 jogos de nes");
  ok($("#sideList .console.active").dataset.system === "nes", "sidebar destaca nes");

  console.log("\n[4] Troca por atalho [ ]");
  await T.switchConsole(-1); await wait(60);
  ok(T.state.system === "snes", "switchConsole(-1) volta para snes");

  console.log("\n[5] Marcação inline (botões 1/2/3 na linha)");
  ok($$("#listRows .row .mbtn").length === 3, "cada linha tem os botões 1/2/3 no hover");
  T.markRowAt(0, 2); await wait(20);   // o que o botão inline invoca
  ok(T.state.marks.size === 1, "marca criada");
  ok($("#pCntR2").textContent === "1", "contador de +ROM = 1 na barra");
  ok($("#sideList .console.active").classList.contains("has-marks"), "sidebar marca o console com ponto");
  ok(Number($("#planTotal").textContent) === 1, "total do plano = 1");
  T.markRowAt(0, 2); await wait(20); // toggle off
  ok(T.state.marks.size === 0, "clicar de novo desmarca (toggle)");

  console.log("\n[6] Detalhe: seleção + carrossel + marcação");
  T.selectIndex(0); await wait(60);
  ok($("#detailBody").hidden === false, "painel de detalhe visível");
  ok($("#detailTitle").textContent === "Super Mario World", "título do jogo no detalhe");
  ok(T.state.media.length === 1, "carrossel indexou 1 mídia (covers)");
  T.setRemoval(3); await wait(10);
  ok(T.state.removals.get("./smw.sfc") === 3, "setRemoval(3) marca nível 3");
  ok($(".mark-row .markbtn.r3").classList.contains("active"), "botão nível 3 fica ativo");
  ok($("#pCntR3").textContent === "1", "contador de mídia = 1");

  console.log("\n[7] Tabs Todos / Marcados");
  fire($("#tabMarked"), "click"); await wait(20);
  ok(window.document.body.classList.contains("marked-mode"), "modo marcados ativo");
  ok($("#tabMarked").classList.contains("active"), "tab MARCADOS destacada");
  ok($$("#listRows .row").length === 1, "lista mostra o item marcado");
  fire($("#tabAll"), "click"); await wait(20);
  ok(window.document.body.classList.contains("marked-mode") === false, "voltar para Todos");

  console.log("\n[8] Plano agregado por console");
  T.setMark("nes", "./smb.nes", 1, "Super Mario Bros.");
  const payloads = T.buildAllPayloads();
  ok(payloads.length === 2, "buildAllPayloads: 2 consoles");
  const snesP = payloads.find((p) => p.system === "snes");
  ok(snesP && snesP.removals["./smw.sfc"] === 3, "payload snes tem a remoção nível 3");

  console.log("\n[9] Importar com prévia validada");
  T.openImport(true);
  await T.loadImportPreview("/x/marks.txt"); await wait(20);
  ok($("#importPreview").hidden === false, "prévia de import exibida");
  ok($$("#importList .import-item").length === 3, "3 linhas na prévia");
  ok($("#importList .import-item.ok") && $("#importList .import-item.bad"), "há linhas OK e NÃO ENCONTRADAS");
  ok($("#importApply").disabled === false, "botão aplicar habilitado");
  const before = T.state.marks.size;
  T.applyImport(); await wait(20);
  ok(T.state.marks.size > before, "aplicar importação adiciona marcações");
  ok($("#importModal").hidden === true, "modal de import fecha ao aplicar");

  console.log("\n[10] Limpeza de órfãos");
  T.openImport && ($("#importModal").hidden = true);
  await T.doOrphanScan(false); await wait(30);
  ok($("#orphanResults").hidden === false, "resultados de órfãos visíveis");
  ok($$("#orphListEntries .orphan-item").length === 1, "1 entrada órfã listada");
  ok($$("#orphListMedia .orphan-item").length === 1, "1 mídia órfã listada");
  ok($("#orphSecM3u").hidden === false, "seção de m3u quebrado visível");

  console.log("\n[11] Revisão do plano + aplicar");
  await T.openCommit(); await wait(40);
  ok($("#commitModal").hidden === false, "modal de revisão do plano abre");
  ok($$("#planSummary .plan-stat").length === 4, "resumo com 4 métricas");
  await T.executeCommit(); await wait(60);
  ok(calls.some((c) => c[0] === "commit"), "commit chamado ao aplicar o plano");

  console.log(`\nRESULTADO: ${pass} passaram, ${fail} falharam`);
  if (fail > 0) process.exit(1);
})().catch((e) => { console.error(e); process.exit(1); });
