// Integração (jsdom): exercita tema, overlay de carregamento, confirmação e troca de console.
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const root = __dirname;
const html = fs.readFileSync(path.join(root, "frontend/index.html"), "utf8");
const appjs = fs.readFileSync(path.join(root, "frontend/js/app.js"), "utf8");

// dados de fixture
const SYS = [{ system: "snes", count: 1 }, { system: "nes", count: 2 }];
const GL = {
  snes: { system: "snes", count: 1, games: [{ id: "./smw.sfc", tag: "game", index: 0, fields: { path: "./smw.sfc", name: "Super Mario World" }, media: {}, stem: "smw" }] },
  nes: { system: "nes", count: 2, games: [
    { id: "./smb.nes", tag: "game", index: 0, fields: { path: "./smb.nes", name: "Super Mario Bros." }, media: {}, stem: "smb" },
    { id: "./mm2.nes", tag: "game", index: 1, fields: { path: "./mm2.nes", name: "Mega Man 2" }, media: {}, stem: "mm2" },
  ] },
};

let prefsStore = { theme: "light" };       // simula tema salvo = light
const calls = [];
const api = {
  get_prefs: async () => ({ ...prefsStore }),
  set_prefs: async (p) => { prefsStore = { ...p }; calls.push(["set_prefs", p]); return { ok: true }; },
  get_config: async () => ({ loaded: true, gamelists_root: "/x", roms_root: "", media_root: "", trash_root: "", trash_default: "/x/_T" }),
  get_systems: async () => { calls.push(["get_systems"]); return SYS; },
  get_gamelist: async (s) => { calls.push(["get_gamelist", s]); return GL[s]; },
  build_plan: async (p) => { calls.push(["build_plan", p]); const n = Object.keys(p.removals).length; return { summary: { entries_to_remove: n, roms_to_delete: 0, media_files_to_delete: 0, entries_to_edit: Object.keys(p.edits).length }, operations: [], trash_root: "/x/_T", hard_delete: false }; },
  commit: async (p) => { calls.push(["commit", p]); return { ok: true, report: { removed_entries: Object.keys(p.removals).length, remaining_entries: 99, backup: "/x/" + p.system + "/gamelist.xml.bak", file_operations: [] } }; },
  get_media: async () => ({ error: "n/a" }),
  pick_marks_file: async () => ({ path: "/x/marks.txt" }),
  scan_orphans: async (p) => { calls.push(["scan_orphans", p]); return {
    results: [
      { system: "nes", roms_dir_ok: true, gamelist_entries: 2,
        orphan_entries: [{ path: "./Ghost.nes", name: "Ghost", reason: "arquivo não existe na pasta de ROMs", abs: "/x/ROMS/nes/Ghost.nes" }],
        orphan_media: [
          { abs: "/x/media/nes/covers/Zombie.webp", rel: "covers/Zombie.webp", type: "covers", stem: "Zombie", size: 2048 },
          { abs: "/x/media/nes/videos/Zombie.mp4", rel: "videos/Zombie.mp4", type: "videos", stem: "Zombie", size: 4096 },
        ],
        m3u_broken: [{ path: "./Broken.m3u", name: "Broken", missing: [".discs/x.chd"] }],
        media_bytes: 6144 },
    ],
    totals: { orphan_entries: 1, orphan_media: 2, m3u_broken: 1, media_bytes: 6144 },
  }; },
  clean_orphans: async (p) => { calls.push(["clean_orphans", p]); return { ok: true, report: {
    systems: [{ system: "nes", removed_entries: (p.entries.nes || []).length, remaining_entries: 42, backup: "/bkp/nes/gamelist.xml.bak" }],
    media_ops: (p.media.nes || []).map((f) => ({ path: f, action: "trashed", to: "/trash/" + f })),
    errors: [],
    summary: { entries_removed: (p.entries.nes || []).length, media_trashed: (p.media.nes || []).length, media_deleted: 0, media_errors: 0 },
  } }; },
  read_marks_file: async () => ({
    entries: [
      { system: "snes", path: "./A.zip", level: 3 },
      { system: "snes", path: "./B.zip", level: 1 },
      { system: "nes", path: "./remote.zip", level: 2 },
    ], skipped: 1, total: 4,
  }),
};

const dom = new JSDOM(html, { runScripts: "outside-only", pretendToBeVisual: true });
const { window } = dom;
global.window = window; global.document = window.document;
window.pywebview = { api };
window.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0);
window.cancelAnimationFrame = (id) => clearTimeout(id);

// injeta o app.js no contexto da janela (+ hook de teste para acessar internals)
window.eval(appjs + "\n;window.__t = { state: state, applyFilter, sortFiltered, selectIndex, renderList, ensureVisible, setFilterMode, setMark, mkKey, buildAllPayloads, currentMark };");

const $ = (s) => window.document.querySelector(s);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const fire = (elm, type, opts) => elm.dispatchEvent(new window.Event(type, Object.assign({ bubbles: true }, opts)));

(async () => {
  let pass = 0, fail = 0;
  const ok = (c, m) => { if (c) { pass++; console.log("  ✓", m); } else { fail++; console.log("  ✗", m); } };

  // dispara boot
  window.document.dispatchEvent(new window.Event("DOMContentLoaded"));
  window.dispatchEvent(new window.Event("pywebviewready"));
  await wait(60);

  console.log("\n[1] Tema");
  ok(window.document.documentElement.dataset.theme === "light", "tema 'light' aplicado a partir das prefs salvas");
  ok($("#themeBtn").textContent === "☀", "botão mostra ícone do sol no tema claro");
  fire($("#themeBtn"), "click");
  await wait(20);
  ok(window.document.documentElement.dataset.theme === "dark", "clicar alterna para 'dark'");
  ok(prefsStore.theme === "dark", "preferência de tema persistida via set_prefs");

  console.log("\n[2] Carregamento inicial / sistemas");
  await wait(40);
  ok($("#systemSelect").options.length === 2, "select preenchido com 2 consoles");
  ok($("#systemSelect").value === "snes", "console inicial = snes");
  ok($("#listSystemName").textContent === "snes", "cabeçalho mostra snes");
  ok($("#loadOverlay").hidden === true, "overlay de carregamento escondido após carregar");

  console.log("\n[3] Troca de console (sem pendências)");
  $("#systemSelect").value = "nes";
  fire($("#systemSelect"), "change");
  // durante o await do get_gamelist o overlay deve aparecer
  ok($("#loadOverlay").hidden === false, "overlay aparece durante a troca");
  await wait(40);
  ok($("#systemSelect").value === "nes", "select agora em nes");
  ok($("#listSystemName").textContent === "nes", "cabeçalho atualizado para nes");
  ok($("#loadOverlay").hidden === true, "overlay some após carregar nes");
  ok($("#toast").textContent.includes("nes") && $("#toast").textContent.includes("2"), "toast confirma: console nes, 2 jogos");
  ok(calls.some((c) => c[0] === "get_gamelist" && c[1] === "nes"), "get_gamelist('nes') foi chamado");

  console.log("\n[4] Troca de console COM pendências -> confirmação");
  // cria uma pendência de edição fictícia
  window.__t.state.edits.set("./mm2.nes", { genre: "X" });
  $("#systemSelect").value = "snes";
  fire($("#systemSelect"), "change");
  await wait(20);
  ok($("#confirmModal").hidden === false, "modal de confirmação aparece (substitui confirm nativo)");
  // cancela -> volta para nes, não troca
  fire($("#confirmNo"), "click");
  await wait(20);
  ok($("#confirmModal").hidden === true, "modal fecha ao cancelar");
  ok($("#systemSelect").value === "nes", "cancelar mantém o console anterior (nes)");

  // tenta de novo e confirma
  $("#systemSelect").value = "snes";
  fire($("#systemSelect"), "change");
  await wait(20);
  fire($("#confirmYes"), "click");
  await wait(40);
  ok($("#systemSelect").value === "snes", "confirmar troca leva para snes");
  ok($("#listSystemName").textContent === "snes", "cabeçalho volta para snes após confirmar");

  console.log("\n[5] Modal de ajuda fecha (regressão do [hidden])");
  fire($("#helpBtn"), "click"); await wait(10);
  ok($("#helpModal").hidden === false, "ajuda abre");
  fire($("#helpClose"), "click"); await wait(10);
  ok($("#helpModal").hidden === true, "ajuda fecha");

  console.log("\n[6] Commit: snapshot congelado (array) e proteção contra drift");
  $("#systemSelect").value = "nes"; fire($("#systemSelect"), "change"); await wait(50);
  ok($("#systemSelect").value === "nes", "em nes");
  window.__t.state.marks.clear(); window.__t.state.edits.clear();
  const mk3 = [...window.document.querySelectorAll(".markbtn")].find((b) => b.dataset.level === "3");
  fire(mk3, "click"); await wait(10);
  ok(window.__t.state.removals.size === 1, "1 remoção marcada em nes (espelho)");
  ok(window.__t.state.marks.size === 1, "1 marca no store global");
  fire($("#commitBtn"), "click"); await wait(50);
  ok($("#commitModal").hidden === false, "modal de commit aberto");
  ok(Array.isArray(window.__t.state.commitSnapshot) && window.__t.state.commitSnapshot.length === 1
     && window.__t.state.commitSnapshot[0].system === "nes", "snapshot é array, fixado em nes");
  // congelamento: marcar mais um DEPOIS do preview não entra no commit
  window.__t.setMark("nes", "./tardio.zip", 2, "Tardio");
  // troca de console com modal aberto deve ser bloqueada
  $("#systemSelect").value = "snes"; fire($("#systemSelect"), "change"); await wait(20);
  ok($("#systemSelect").value === "nes", "troca de console bloqueada enquanto o commit está aberto");
  calls.length = 0;
  fire($("#commitExecute"), "click"); await wait(60);
  const committed = calls.find((c) => c[0] === "commit");
  ok(committed && committed[1].system === "nes", "commit usa o sistema do snapshot (nes)");
  ok(committed && Object.keys(committed[1].removals).length === 1, "commit envia só a remoção do snapshot (congelado)");
  const reloaded = calls.filter((c) => c[0] === "get_gamelist").pop();
  ok(reloaded && reloaded[1] === "nes", "após o commit recarrega o console atual (nes)");
  const nesOpt = [...$("#systemSelect").options].find((o) => o.value === "nes");
  ok(nesOpt && nesOpt.textContent.includes("99"), "contagem do console atualizada pós-commit (do relatório)");
  ok(!calls.some((c) => c[0] === "get_systems"), "não relê todos os sistemas no commit (performance no NAS)");
  ok(window.__t.state.marks.size === 1, "marca aplicada é removida; a marca tardia (pós-preview) permanece");
  ok($("#commitExecute").disabled === false, "botão reabilitado após o commit (não fica travado)");
  ok($("#commitExecute").textContent === "Concluído", "botão mostra 'Concluído'");
  ok(window.__t.state.commitCompleted === true, "estado: commit concluído");
  fire($("#commitExecute"), "click"); await wait(20);
  ok($("#commitModal").hidden === true, "clicar em 'Concluído' fecha o modal");
  ok(window.__t.state.commitCompleted === false, "estado de commit reseta ao fechar");
  window.__t.state.marks.clear();

  console.log("\n[7] Tema claro: invariantes de contraste no CSS");
  const css = fs.readFileSync(path.join(root, "frontend/css/style.css"), "utf8");
  ok(/\.topbar\s*\{[^}]*background:\s*var\(--topbar-bg\)/s.test(css), "topbar usa --topbar-bg (não cor fixa)");
  const lightBlock = (css.match(/\[data-theme="light"\]\s*\{([^}]*)\}/s) || [])[1] || "";
  ok(/--topbar-bg:\s*linear-gradient\([^)]*#fff/i.test(lightBlock) || /--topbar-bg:\s*#?f/i.test(lightBlock), "tema claro define topbar-bg claro");
  ok(/--txt-0:\s*#1/i.test(lightBlock), "tema claro define texto principal escuro (--txt-0)");
  ok(/\.row-name\s*\{[^}]*color:\s*var\(--txt-0\)/s.test(css), "row-name tem cor explícita var(--txt-0)");
  ok(!/text-decoration-color:\s*rgba\(255,255,255/.test(css), "tachado não usa branco fixo");

  console.log("\n[8] Ordenação da lista");
  const mk = (name, date) => ({ id: "./" + name + ".zip", fields: { name, releasedate: date }, media: {}, _s: name.toLowerCase() });
  window.__t.state.games = [
    mk("Zelda", "19870101"), mk("Astro", "19911231"), mk("Mario", "19850101"),
    mk("battle", ""), mk("Castlevania", "1989"),
  ];
  const namesIn = (st) => st.filtered.map((i) => st.games[i].fields.name);

  window.__t.state.query = "";
  window.__t.state.sort = { key: "name", dir: "asc" };
  window.__t.applyFilter();
  ok(JSON.stringify(namesIn(window.__t.state)) === JSON.stringify(["Astro", "battle", "Castlevania", "Mario", "Zelda"]), "Nome A–Z (case-insensitive)");

  window.__t.state.sort = { key: "name", dir: "desc" };
  window.__t.applyFilter();
  ok(JSON.stringify(namesIn(window.__t.state)) === JSON.stringify(["Zelda", "Mario", "Castlevania", "battle", "Astro"]), "Nome Z–A");

  window.__t.state.sort = { key: "date", dir: "asc" };
  window.__t.applyFilter();
  ok(JSON.stringify(namesIn(window.__t.state)) === JSON.stringify(["Mario", "Zelda", "Castlevania", "Astro", "battle"]), "Data ↑ (sem data por último)");

  window.__t.state.sort = { key: "date", dir: "desc" };
  window.__t.applyFilter();
  ok(JSON.stringify(namesIn(window.__t.state)) === JSON.stringify(["Astro", "Castlevania", "Zelda", "Mario", "battle"]), "Data ↓ (sem data por último)");

  console.log("\n[9] Navegação por teclado não rola além do conteúdo");
  const ls = $("#listScroll");
  let _st = 0;
  Object.defineProperty(ls, "scrollTop", { get: () => _st, set: (v) => { _st = v; }, configurable: true });
  Object.defineProperty(ls, "clientHeight", { get: () => 400, configurable: true });
  // 50 itens de 46px = 2300px; viewport 400 -> maxScroll = 1900
  window.__t.state.games = Array.from({ length: 50 }, (_, i) => mk("Game " + String(i).padStart(2, "0"), ""));
  window.__t.state.query = ""; window.__t.state.sort = { key: "name", dir: "asc" };
  window.__t.applyFilter();
  window.__t.state.selectedIdx = 0; _st = 0;
  window.__t.selectIndex(49);                 // vai para o último
  ok(window.__t.state.selectedIdx === 49, "seleção chega no último item");
  ok(_st === 1900, "scrollTop para no fim do conteúdo (maxScroll), sem ultrapassar");
  const stBefore = _st;
  window.__t.selectIndex(50);                  // além do fim: no-op
  ok(window.__t.state.selectedIdx === 49 && _st === stBefore, "ir além do último não rola mais (sem rolagem infinita)");

  console.log("\n[10] Mitigações de rolagem nativa");
  ok(!$("#listScroll").hasAttribute("tabindex"), "listScroll não é focável (sem tabindex) — sem scroll nativo por seta");
  ok(/overflow-anchor:\s*none/.test(css), "CSS desliga scroll anchoring (overflow-anchor: none)");
  // após trocar de console, o foco não fica no select (senão setas mexeriam nele)
  $("#systemSelect").value = "snes"; fire($("#systemSelect"), "change"); await wait(40);
  ok(window.document.activeElement !== $("#systemSelect"), "select de console perde o foco após a troca");

  console.log("\n[11] Importação de marcações em lote (multi-console, global)");
  const mkg = (n) => ({ id: "./" + n + ".zip", fields: { name: n }, media: {}, _s: n.toLowerCase() });
  window.__t.state.system = "snes";
  window.__t.state.games = [mkg("A"), mkg("B"), mkg("C")];
  window.__t.state.gamesById = new Map(window.__t.state.games.map((g) => [g.id, g]));
  window.__t.state.marks.clear();
  window.__t.state.removals.clear();
  window.__t.state.edits.clear();
  window.__t.state.filterMode = "all";
  window.__t.state.query = ""; window.__t.state.sort = { key: "name", dir: "asc" };
  // mock retorna: snes/A:3, snes/B:1, nes/remote:2
  fire($("#importBtn"), "click"); await wait(40);
  const M = window.__t.state.marks;
  ok(M.get(window.__t.mkKey("snes", "./A.zip")) && M.get(window.__t.mkKey("snes", "./A.zip")).level === 3, "snes/A marcado nível 3");
  ok(M.get(window.__t.mkKey("snes", "./B.zip")) && M.get(window.__t.mkKey("snes", "./B.zip")).level === 1, "snes/B marcado nível 1");
  ok(M.get(window.__t.mkKey("nes", "./remote.zip")) && M.get(window.__t.mkKey("nes", "./remote.zip")).level === 2, "nes/remote marcado (outro console)");
  ok(M.size === 3, "3 marcas globais (2 consoles)");
  ok(window.__t.state.removals.get("./A.zip") === 3, "espelho do console atual (snes) reflete A");
  ok(!window.__t.state.removals.has("./remote.zip"), "espelho não inclui marca de outro console");

  console.log("\n[12] Filtro “Somente marcados” + coluna de console");
  window.__t.setFilterMode("marked");
  await wait(10);
  ok(window.__t.state.filterMode === "marked", "modo de filtro = marked");
  ok(window.document.body.classList.contains("marked-mode"), "body ganha classe marked-mode");
  ok(window.__t.state.filtered.length === 3, "lista marcada mostra os 3 itens (todos consoles)");
  const consoles = [...window.document.querySelectorAll("#listRows .row-console")].map((e) => e.textContent);
  ok(consoles.length === 3, "cada linha tem coluna de console");
  ok(consoles.includes("nes") && consoles.includes("snes"), "consoles nes e snes aparecem na coluna");

  console.log("\n[13] Commit multi-console agrega todos os consoles marcados");
  window.__t.state.system = "snes"; window.__t.state.edits.clear();
  const payloads = window.__t.buildAllPayloads();
  const systems = payloads.map((p) => p.system).sort();
  ok(payloads.length === 2 && systems[0] === "nes" && systems[1] === "snes", "buildAllPayloads gera 1 payload por console (nes, snes)");
  const snesP = payloads.find((p) => p.system === "snes");
  ok(Object.keys(snesP.removals).length === 2, "payload snes tem 2 remoções (A,B)");
  const nesP = payloads.find((p) => p.system === "nes");
  ok(nesP.removals["./remote.zip"] === 2, "payload nes tem a remoção importada");
  window.__t.setFilterMode("all"); window.__t.state.marks.clear();

  console.log("\n[14] Barras de rolagem visíveis");
  ok(/--sb-thumb:/.test(css), "variável de cor do thumb definida");
  ok(/::-webkit-scrollbar\s*\{[^}]*width:\s*1[0-9]px/.test(css), "scrollbar com largura visível");
  ok(/\.list-scroll\s*\{[^}]*overflow-y:\s*scroll/.test(css), "lista sempre mostra a barra (overflow-y: scroll)");

  console.log("\n[15] Logo nova e versão");
  const htmlSrc = fs.readFileSync(path.join(root, "frontend/index.html"), "utf8");
  ok(/class="brand-logo"/.test(htmlSrc) && /<svg/.test(htmlSrc), "logo SVG presente no topo");
  ok(/brand-ver">v1\.3</.test(htmlSrc), "versão v1.3 exibida na marca");
  ok(/--logo-accent/.test(css), "variáveis de cor da logo definidas (temáveis)");

  console.log("\n[16] Importação de edição de campo (name D2 [USA] → D2)");
  window.__t.state.system = "nes";
  window.__t.state.games = [
    { id: "./D2 (USA).zip", fields: { name: "D2 [USA]" }, media: {}, _s: "d2" },
    { id: "./Other.zip", fields: { name: "Other" }, media: {}, _s: "other" },
  ];
  window.__t.state.gamesById = new Map(window.__t.state.games.map((g) => [g.id, g]));
  window.__t.state.marks.clear(); window.__t.state.edits.clear(); window.__t.state.importEdits.clear();
  window.__t.state.filterMode = "all"; window.__t.state.query = "";
  // mock só com uma edição de campo (console nes) + uma de outro console (snes)
  window.pywebview.api.read_marks_file = async () => ({
    entries: [
      { kind: "edit", system: "nes", path: "./D2 (USA).zip", field: "name", value: "D2" },
      { kind: "edit", system: "snes", path: "./Z.zip", field: "genre", value: "RPG" },
    ], skipped: 0, total: 2,
  });
  fire($("#importBtn"), "click"); await wait(40);
  const IE = window.__t.state.importEdits;
  ok(IE.get(window.__t.mkKey("nes", "./D2 (USA).zip")) && IE.get(window.__t.mkKey("nes", "./D2 (USA).zip")).name === "D2", "edição nes/D2 → name=D2 registrada");
  ok(IE.get(window.__t.mkKey("snes", "./Z.zip")) && IE.get(window.__t.mkKey("snes", "./Z.zip")).genre === "RPG", "edição de outro console (snes) registrada");
  ok(Number($("#pCntEdit").textContent) === 2, "contador de edições pendentes = 2 (global)");
  const pl = window.__t.buildAllPayloads();
  const nes2 = pl.find((p) => p.system === "nes"), snes2 = pl.find((p) => p.system === "snes");
  ok(nes2 && nes2.edits["./D2 (USA).zip"].name === "D2", "payload nes inclui a edição de name");
  ok(snes2 && snes2.edits["./Z.zip"].genre === "RPG", "payload snes inclui a edição importada de outro console");

  console.log("\n[17] Diálogo Abrir: campos de pasta vazios por padrão + backup");
  window.__t.state.config = {};      // sem config: cai nos padrões (vazios — nada machine-specific)
  fire($("#openBtn"), "click"); await wait(20);
  ok($("#in_gamelists_root").value === "", "gamelists vazio por padrão (sem caminho pessoal embutido)");
  ok($("#in_roms_root").value === "", "roms vazio por padrão");
  ok($("#in_media_root").value === "", "downloaded_media vazio por padrão");
  ok($("#in_backup_root").value === "", "backup vazio por padrão");
  ok(!!$("#in_backup_root"), "campo de backup existe no diálogo");

  console.log("\n[18] ES-DE Orphan Cleaner");
  // abre a tela e escaneia (console atual = nes)
  window.__t.state.system = "nes";
  window.__t.state.config = { hard_delete: false };
  fire($("#orphanBtn"), "click"); await wait(10);
  ok($("#orphanModal").hidden === false, "tela Orphan Cleaner abre");
  ok($("#orphanMode").textContent.includes("lixeira"), "modo lixeira exibido (backup/lixeira ativos)");
  fire($("#orphanScanBtn"), "click"); await wait(50);
  const scanned = calls.find((c) => c[0] === "scan_orphans");
  ok(scanned && JSON.stringify(scanned[1]) === JSON.stringify({ systems: ["nes"] }), "escaneia o console atual");
  ok($("#orphanResults").hidden === false, "resultados visíveis");
  ok(document.querySelectorAll("#orphListEntries .orphan-item").length === 1, "1 entrada órfã listada");
  ok(document.querySelectorAll("#orphListMedia .orphan-item").length === 2, "2 mídias órfãs listadas");
  ok($("#orphSecM3u").hidden === false && document.querySelectorAll("#orphListM3u .orphan-item").length === 1, "m3u quebrado listado (informativo)");
  ok($("#orphanCleanBtn").disabled === false && /\(3\)/.test($("#orphanCleanBtn").textContent), "botão Limpar habilitado com 3 selecionados");
  // desmarcar categoria de mídia reduz a seleção
  $("#orphChkAllMedia").checked = false; fire($("#orphChkAllMedia"), "change"); await wait(10);
  ok(/\(1\)/.test($("#orphanCleanBtn").textContent), "desmarcar mídia deixa 1 selecionado");
  $("#orphChkAllMedia").checked = true; fire($("#orphChkAllMedia"), "change"); await wait(10);
  // limpar: confirma no modal customizado
  calls.length = 0;
  fire($("#orphanCleanBtn"), "click"); await wait(30);
  ok($("#confirmModal").hidden === false, "pede confirmação antes de limpar");
  fire($("#confirmYes"), "click"); await wait(80);
  const cleaned = calls.find((c) => c[0] === "clean_orphans");
  ok(!!cleaned, "clean_orphans chamado após confirmação");
  ok(cleaned[1].entries.nes.length === 1 && cleaned[1].entries.nes[0] === "./Ghost.nes", "payload: entrada órfã por console");
  ok(cleaned[1].media.nes.length === 2 && cleaned[1].media.nes.every((f) => f.includes("Zombie")), "payload: mídias órfãs por console (caminho absoluto)");
  ok($("#orphanResult").hidden === false && /Entradas removidas: 1/.test($("#orphanResult").textContent), "relatório da limpeza exibido");
  const nesOpt2 = [...$("#systemSelect").options].find((o) => o.value === "nes");
  ok(nesOpt2 && nesOpt2.textContent.includes("42"), "contagem do console atualizada após limpeza");
  fire($("#orphanClose"), "click"); await wait(10);
  ok($("#orphanModal").hidden === true, "Fechar fecha a tela");

  console.log(`\nRESULTADO: ${pass} passaram, ${fail} falharam`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("ERRO no teste:", e); process.exit(2); });
