/* =========================================================================
   ES-DE Gamelist Editor — i18n (EN default, PT-BR). Vanilla, no build step.
   Static strings in index.html use data-i18n / -html / -title / -ph.
   Dynamic strings in app.js use t("key", { token: value }).
   ========================================================================= */
"use strict";
(function () {
  const STR = {
    en: {
      // header
      "hdr.panelToggle": "Collapse/expand consoles (Ctrl+B)",
      "view.list": "☰ LIST", "view.list.title": "List mode (G)",
      "view.grid": "▦ GRID", "view.grid.title": "Grid mode (G)",
      "search.ph": "Filter  ( / )",
      "open.btn": "Open", "open.btn.title": "Open collection",
      "import.btn": "Import", "import.btn.title": "Import marks (.txt)",
      "orphan.btn": "Cleanup", "orphan.btn.title": "Orphan cleanup",
      "help.btn.title": "Shortcuts ( ? )",
      "lang.en.title": "English", "lang.pt.title": "Português",
      // sidebar
      "seg.panel.title": "Side panel", "seg.pills.title": "Pills on top",
      "foot.trashActive": "trash active · backup ok",
      "foot.hardDelete": "hard delete · backup ok",
      // toolbar
      "tab.all": "ALL", "tab.marked": "MARKED", "sort.title": "Sort",
      "sort.nameAsc": "Name A–Z", "sort.nameDesc": "Name Z–A",
      "sort.dateAsc": "Date ↑", "sort.dateDesc": "Date ↓", "sort.pathAsc": "File A–Z",
      "tilesize.label": "size",
      // detail
      "slide.close.title": "Close (Esc)",
      "detail.selectGame": "Select a game from the list.",
      "detail.navHint": "↑ ↓ or J / K to navigate",
      "detail.markedEmpty": "“Marked” mode: click an item (or Enter) to open it in its console.",
      "mark.r1": "1·ENTRY", "mark.r2": "2·+ROM", "mark.r3": "3·+MEDIA", "mark.clear": "CLEAR·U",
      "mark.r1.title": "Del / 1", "mark.r2.title": "Shift+Del / 2", "mark.r3.title": "Alt+Del / 3", "mark.clear.title": "U",
      "field.new.ph": "new field (e.g. region)", "field.add": "+ Field", "field.clear.title": "Clear field",
      // plan bar
      "plan.label": "PLAN ▲", "plan.edits": "edits", "plan.entries": "entries",
      "plan.roms": "ROMs", "plan.media": "media", "plan.tail": "— all → trash, with backup",
      "review.btn": "Review plan", "commit.btn": "APPLY (CTRL+S)", "commit.btn.title": "Ctrl+S",
      // open modal
      "open.title": "OPEN COLLECTION",
      "open.tab.root": "Systems folder (ES-DE)", "open.tab.file": "Single file",
      "open.lbl.root": "Gamelists folder <small>(contains <code>&lt;system&gt;/gamelist.xml</code>)</small>",
      "open.ph.root": "e.g. .../ES-DE/gamelists", "pick.browse": "Browse…",
      "open.lbl.file": "gamelist.xml file", "open.ph.file": "e.g. .../gamelists/snes/gamelist.xml",
      "open.lbl.system": "System name <small>(optional — inferred from the folder)</small>",
      "open.lbl.roms": "ROMs folder <small>(needed for level-2 removal)</small>", "open.ph.roms": "e.g. .../ROMs",
      "open.lbl.media": "downloaded_media folder <small>(level 3 + cover preview)</small>", "open.ph.media": "e.g. .../ES-DE/downloaded_media",
      "open.adv": "ADVANCED — BACKUP, TRASH, HARD DELETE",
      "open.lbl.backup": "Backup folder <small>(copy of the gamelist before each commit)</small>", "open.ph.backup": "e.g. .../ES-DE/backup",
      "open.lbl.trash": "Trash <small>(default: <code>_GAMELIST_EDITOR_TRASH</code>)</small>", "open.ph.trash": "use default",
      "open.hardDelete": "Delete permanently (hard delete) — <span class=\"warn\">no trash</span>",
      "open.cancel": "Cancel", "open.confirm": "OPEN",
      // commit modal
      "commit.title": "PLAN REVIEW", "commit.back": "Back", "commit.apply": "APPLY PLAN",
      // orphan modal
      "orphan.title": "ORPHAN CLEANUP", "orphan.scope": "Scope",
      "orphan.scope.current": "Current console", "orphan.scope.all": "All consoles",
      "orphan.scan": "SCAN", "orphan.hint": "Entries with no ROM and media with no game (.m3u-aware).",
      "orphan.sec.entries": "Orphan entries", "orphan.sec.media": "Orphan media",
      "orphan.sec.m3u": "⚠ M3U with missing discs", "orphan.sec.m3u.meta": "informational",
      "orphan.close": "Close", "orphan.clean": "CLEAN SELECTED",
      // import modal
      "import.title": "IMPORT MARKS",
      "import.drop": "Drop the <b>.txt</b> here or click to browse…",
      "import.fmt": "console|path|level(1-3)  ·  or  console|path|field|value",
      "import.cancel": "Cancel", "import.apply": "APPLY",
      // help / confirm / overlays
      "help.title": "SHORTCUTS", "help.close": "Close",
      "confirm.title": "Confirm", "confirm.no": "Cancel", "confirm.yes": "Continue",
      "loading": "Loading…",

      // ---- dynamic (app.js) ----
      "err.methodUnavailable": "method unavailable: {method}",
      "openingCollection": "Opening collection…",
      "closePlanBeforeSwitch": "Close the plan review before switching console",
      "switch.msg": "There are unsaved field edits on this console. Switching will discard them. Continue? (Marks are kept.)",
      "switch.title": "Switch console", "switch.yes": "Discard and switch",
      "loadingSystem": "Loading {system}…",
      "count.marked": "{n} marked", "count.entries": "{n} entries",
      "noMarkedYet": "No items marked yet", "noName": "(no name)",
      "badge.entry": "ENTRY", "badge.rom": "+ROM", "badge.media": "+MEDIA",
      "noCover": "no cover",
      "tbadge.1": "1·ENTRY", "tbadge.2": "2·+ROM", "tbadge.3": "3·+MEDIA",
      "itemNotFound": "Item not found in the current gamelist (it may have been removed)",
      "media.none": "no media indexed", "media.unavailable": "media unavailable",
      "nothingPending": "Nothing pending to apply", "calculating": "Calculating changes…",
      "applyPlan": "APPLY PLAN", "applyPlanN": "APPLY PLAN ({n})",
      "mode.hardDelete": "HARD DELETE", "mode.toTrash": "→ trash",
      "stat.entries": "entries", "stat.roms": "ROMs", "stat.media": "media", "stat.edits": "edits",
      "plan.sysOps": "{system} — {n} operations", "plan.truncated": "… (preview truncated)",
      "previewExpired": "Preview expired — reopen the review.",
      "applying": "Applying…", "applyingChanges": "Applying changes…",
      "commit.line": "• {system}: {removed} removed · {trashed} to trash · {remaining} remaining",
      "commit.header": "✓ Plan applied — {n} console(s)",
      "commit.totals": "Totals: {removed} entries · {trashed} to trash · {deleted} deleted",
      "commit.errors": "⚠ {n} error(s) — check the logs",
      "done": "Done", "commit.toast": "Plan applied — {n} operations, files in trash",
      "readingFile": "Reading file…",
      "import.editTag": "EDIT", "import.levelTag": "LEVEL {n}",
      "import.okN": "{n} OK", "import.notFoundN": "{n} NOT FOUND",
      "import.applyN": "APPLY {n} MARKS",
      "import.toast": "Import: {marks} marks · {edits} edits · {consoles} console(s)",
      "orphan.openConsoleFirst": "Open a console first",
      "orphan.scanAll": "Scanning all consoles…", "orphan.scanOne": "Scanning {system}…",
      "orphan.scanToast": "Scan: {entries} entries · {media} orphan media",
      "orphan.stat.entries": "orphan entries", "orphan.stat.media": "orphan media",
      "orphan.stat.recoverable": "recoverable", "orphan.stat.m3u": "broken m3u",
      "orphan.noEntries": "No orphan entries 🎉", "orphan.noMedia": "No orphan media 🎉",
      "orphan.nItems": "{n} items", "orphan.mediaMeta": "{n} items · {size}",
      "orphan.missing": "missing: {list}",
      "orphan.cleanN": "CLEAN SELECTED ({n})",
      "orphan.mode.hard": "PERMANENTLY DELETED (hard delete)", "orphan.mode.trash": "moved to trash",
      "orphan.confirm.msg": "Remove {nE} orphan entry(ies) and {nM} orphan media?\nGamelists are backed up; media will be {mode}.",
      "orphan.confirm.title": "Orphan cleanup", "orphan.confirm.yes": "Clean now",
      "orphan.applying": "Applying cleanup…",
      "orphan.clean.header": "✓ Cleanup done\nEntries removed: {entries}\nMedia to trash: {trashed} · deleted: {deleted}\n",
      "orphan.clean.sysLine": "• {system}: -{removed} entries (backup ok)\n",
      "orphan.clean.errors": "⚠ {n} error(s)\n", "orphan.clean.toast": "Orphan cleanup done",
      "help.nav": "Navigate the list", "help.skip": "Jump several entries",
      "help.consolePrevNext": "Previous / next console", "help.togglePanel": "Collapse / expand console panel",
      "help.mark1": "Mark — entry only", "help.mark2": "Mark — entry + ROM", "help.mark3": "Mark — entry + ROM + media",
      "help.unmark": "Unmark", "help.focusSearch": "Focus search / filter",
      "help.editFields": "Edit fields (or open marked in console)", "help.reviewApply": "Review & apply plan",
      "help.closeDialog": "Close dialog / leave field", "help.thisHelp": "This help",
    },
    pt: {
      "hdr.panelToggle": "Recolher/expandir consoles (Ctrl+B)",
      "view.list": "☰ LISTA", "view.list.title": "Modo lista (G)",
      "view.grid": "▦ GRADE", "view.grid.title": "Modo grade (G)",
      "search.ph": "Filtrar  ( / )",
      "open.btn": "Abrir", "open.btn.title": "Abrir coleção",
      "import.btn": "Importar", "import.btn.title": "Importar marcações (.txt)",
      "orphan.btn": "Limpeza", "orphan.btn.title": "Limpeza de órfãos",
      "help.btn.title": "Atalhos ( ? )",
      "lang.en.title": "English", "lang.pt.title": "Português",
      "seg.panel.title": "Painel lateral", "seg.pills.title": "Caixinhas no topo",
      "foot.trashActive": "lixeira ativa · backup ok",
      "foot.hardDelete": "hard delete · backup ok",
      "tab.all": "TODOS", "tab.marked": "MARCADOS", "sort.title": "Ordenar",
      "sort.nameAsc": "Nome A–Z", "sort.nameDesc": "Nome Z–A",
      "sort.dateAsc": "Data ↑", "sort.dateDesc": "Data ↓", "sort.pathAsc": "Arquivo A–Z",
      "tilesize.label": "tamanho",
      "slide.close.title": "Fechar (Esc)",
      "detail.selectGame": "Selecione um jogo na lista.",
      "detail.navHint": "↑ ↓ ou J / K para navegar",
      "detail.markedEmpty": "Modo “Marcados”: clique num item (ou Enter) para abri-lo no seu console.",
      "mark.r1": "1·ENTRADA", "mark.r2": "2·+ROM", "mark.r3": "3·+MÍDIA", "mark.clear": "LIMPAR·U",
      "mark.r1.title": "Del / 1", "mark.r2.title": "Shift+Del / 2", "mark.r3.title": "Alt+Del / 3", "mark.clear.title": "U",
      "field.new.ph": "novo campo (ex.: region)", "field.add": "+ Campo", "field.clear.title": "Esvaziar campo",
      "plan.label": "PLANO ▲", "plan.edits": "edições", "plan.entries": "entradas",
      "plan.roms": "ROMs", "plan.media": "mídias", "plan.tail": "— tudo → lixeira, com backup",
      "review.btn": "Revisar plano", "commit.btn": "APLICAR (CTRL+S)", "commit.btn.title": "Ctrl+S",
      "open.title": "ABRIR COLEÇÃO",
      "open.tab.root": "Pasta de sistemas (ES-DE)", "open.tab.file": "Arquivo único",
      "open.lbl.root": "Pasta de gamelists <small>(contém <code>&lt;sistema&gt;/gamelist.xml</code>)</small>",
      "open.ph.root": "ex.: .../ES-DE/gamelists", "pick.browse": "Procurar…",
      "open.lbl.file": "Arquivo gamelist.xml", "open.ph.file": "ex.: .../gamelists/snes/gamelist.xml",
      "open.lbl.system": "Nome do sistema <small>(opcional — inferido da pasta)</small>",
      "open.lbl.roms": "Pasta de ROMs <small>(necessária p/ remoção nível 2)</small>", "open.ph.roms": "ex.: .../ROMs",
      "open.lbl.media": "Pasta downloaded_media <small>(nível 3 + prévia de capas)</small>", "open.ph.media": "ex.: .../ES-DE/downloaded_media",
      "open.adv": "AVANÇADO — BACKUP, LIXEIRA, HARD DELETE",
      "open.lbl.backup": "Pasta de backup <small>(cópia da gamelist antes de cada commit)</small>", "open.ph.backup": "ex.: .../ES-DE/backup",
      "open.lbl.trash": "Lixeira <small>(padrão: <code>_GAMELIST_EDITOR_TRASH</code>)</small>", "open.ph.trash": "usar padrão",
      "open.hardDelete": "Apagar de vez (hard delete) — <span class=\"warn\">sem lixeira</span>",
      "open.cancel": "Cancelar", "open.confirm": "ABRIR",
      "commit.title": "REVISÃO DO PLANO", "commit.back": "Voltar", "commit.apply": "APLICAR PLANO",
      "orphan.title": "LIMPEZA DE ÓRFÃOS", "orphan.scope": "Escopo",
      "orphan.scope.current": "Console atual", "orphan.scope.all": "Todos os consoles",
      "orphan.scan": "ESCANEAR", "orphan.hint": "Entradas sem ROM e mídia sem jogo (considera .m3u).",
      "orphan.sec.entries": "Entradas órfãs", "orphan.sec.media": "Mídias órfãs",
      "orphan.sec.m3u": "⚠ M3U com discos ausentes", "orphan.sec.m3u.meta": "informativo",
      "orphan.close": "Fechar", "orphan.clean": "LIMPAR SELECIONADOS",
      "import.title": "IMPORTAR MARCAÇÕES",
      "import.drop": "Arraste o <b>.txt</b> aqui ou clique para procurar…",
      "import.fmt": "console|caminho|nível(1-3)  ·  ou  console|caminho|campo|valor",
      "import.cancel": "Cancelar", "import.apply": "APLICAR",
      "help.title": "ATALHOS", "help.close": "Fechar",
      "confirm.title": "Confirmar", "confirm.no": "Cancelar", "confirm.yes": "Continuar",
      "loading": "Carregando…",

      "err.methodUnavailable": "método indisponível: {method}",
      "openingCollection": "Abrindo coleção…",
      "closePlanBeforeSwitch": "Feche a revisão do plano antes de trocar de console",
      "switch.msg": "Há edições de campos não salvas neste console. Trocar vai descartá-las. Continuar? (As marcações são mantidas.)",
      "switch.title": "Trocar de console", "switch.yes": "Descartar e trocar",
      "loadingSystem": "Carregando {system}…",
      "count.marked": "{n} marcados", "count.entries": "{n} entradas",
      "noMarkedYet": "Nenhum item marcado ainda", "noName": "(sem nome)",
      "badge.entry": "ENTRADA", "badge.rom": "+ROM", "badge.media": "+MÍDIA",
      "noCover": "sem capa",
      "tbadge.1": "1·ENTRADA", "tbadge.2": "2·+ROM", "tbadge.3": "3·+MÍDIA",
      "itemNotFound": "Item não encontrado na gamelist atual (pode ter sido removido)",
      "media.none": "sem mídia indexada", "media.unavailable": "mídia indisponível",
      "nothingPending": "Nada pendente para aplicar", "calculating": "Calculando alterações…",
      "applyPlan": "APLICAR PLANO", "applyPlanN": "APLICAR PLANO ({n})",
      "mode.hardDelete": "HARD DELETE", "mode.toTrash": "→ lixeira",
      "stat.entries": "entradas", "stat.roms": "ROMs", "stat.media": "mídias", "stat.edits": "edições",
      "plan.sysOps": "{system} — {n} operações", "plan.truncated": "… (prévia truncada)",
      "previewExpired": "Prévia expirada — reabra a revisão.",
      "applying": "Aplicando…", "applyingChanges": "Aplicando alterações…",
      "commit.line": "• {system}: {removed} removidas · {trashed} p/ lixeira · restam {remaining}",
      "commit.header": "✓ Plano aplicado — {n} console(s)",
      "commit.totals": "Totais: {removed} entradas · {trashed} p/ lixeira · {deleted} apagados",
      "commit.errors": "⚠ {n} erro(s) — verifique os logs",
      "done": "Concluído", "commit.toast": "Plano aplicado — {n} operações, arquivos na lixeira",
      "readingFile": "Lendo arquivo…",
      "import.editTag": "EDIÇÃO", "import.levelTag": "NÍVEL {n}",
      "import.okN": "{n} OK", "import.notFoundN": "{n} NÃO ENCONTRADOS",
      "import.applyN": "APLICAR {n} MARCAÇÕES",
      "import.toast": "Importação: {marks} marcações · {edits} edições · {consoles} console(s)",
      "orphan.openConsoleFirst": "Abra um console primeiro",
      "orphan.scanAll": "Varredura em todos os consoles…", "orphan.scanOne": "Varredura em {system}…",
      "orphan.scanToast": "Varredura: {entries} entradas · {media} mídias órfãs",
      "orphan.stat.entries": "entradas órfãs", "orphan.stat.media": "mídias órfãs",
      "orphan.stat.recoverable": "recuperável", "orphan.stat.m3u": "m3u quebrados",
      "orphan.noEntries": "Nenhuma entrada órfã 🎉", "orphan.noMedia": "Nenhuma mídia órfã 🎉",
      "orphan.nItems": "{n} itens", "orphan.mediaMeta": "{n} itens · {size}",
      "orphan.missing": "faltam: {list}",
      "orphan.cleanN": "LIMPAR SELECIONADOS ({n})",
      "orphan.mode.hard": "APAGADAS DE VEZ (hard delete)", "orphan.mode.trash": "movidas para a lixeira",
      "orphan.confirm.msg": "Remover {nE} entrada(s) órfã(s) e {nM} mídia(s) órfã(s)?\nGamelists recebem backup; mídias serão {mode}.",
      "orphan.confirm.title": "Limpeza de órfãos", "orphan.confirm.yes": "Limpar agora",
      "orphan.applying": "Aplicando limpeza…",
      "orphan.clean.header": "✓ Limpeza concluída\nEntradas removidas: {entries}\nMídias p/ lixeira: {trashed} · apagadas: {deleted}\n",
      "orphan.clean.sysLine": "• {system}: -{removed} entradas (backup ok)\n",
      "orphan.clean.errors": "⚠ {n} erro(s)\n", "orphan.clean.toast": "Limpeza de órfãos concluída",
      "help.nav": "Navegar pela lista", "help.skip": "Pular várias entradas",
      "help.consolePrevNext": "Console anterior / próximo", "help.togglePanel": "Recolher / expandir painel de consoles",
      "help.mark1": "Marcar — só a entrada", "help.mark2": "Marcar — entrada + ROM", "help.mark3": "Marcar — entrada + ROM + mídia",
      "help.unmark": "Desmarcar", "help.focusSearch": "Focar busca / filtro",
      "help.editFields": "Editar campos (ou abrir marcado no console)", "help.reviewApply": "Revisar & aplicar plano",
      "help.closeDialog": "Fechar diálogo / sair do campo", "help.thisHelp": "Esta ajuda",
    },
  };

  const LS_LANG = "gle.lang";
  let lang = "en";
  try { const s = localStorage.getItem(LS_LANG); if (s === "pt" || s === "en") lang = s; } catch (_) {}

  function t(key, params) {
    let s = (STR[lang] && STR[lang][key]);
    if (s == null) s = (STR.en[key] != null ? STR.en[key] : key);
    if (params) for (const k in params) s = s.split("{" + k + "}").join(params[k]);
    return s;
  }
  function applyStatic(root) {
    const scope = root || document;
    scope.querySelectorAll("[data-i18n]").forEach((e) => { e.textContent = t(e.getAttribute("data-i18n")); });
    scope.querySelectorAll("[data-i18n-html]").forEach((e) => { e.innerHTML = t(e.getAttribute("data-i18n-html")); });
    scope.querySelectorAll("[data-i18n-title]").forEach((e) => { e.setAttribute("title", t(e.getAttribute("data-i18n-title"))); });
    scope.querySelectorAll("[data-i18n-ph]").forEach((e) => { e.setAttribute("placeholder", t(e.getAttribute("data-i18n-ph"))); });
  }
  const listeners = [];
  function setLang(l) {
    lang = (l === "pt") ? "pt" : "en";
    try { localStorage.setItem(LS_LANG, lang); } catch (_) {}
    document.documentElement.lang = (lang === "pt") ? "pt-BR" : "en";
    applyStatic();
    listeners.forEach((fn) => { try { fn(lang); } catch (_) {} });
  }

  window.i18n = { t, setLang, applyStatic, onChange: (fn) => listeners.push(fn), get lang() { return lang; } };
  window.t = t;

  document.documentElement.lang = (lang === "pt") ? "pt-BR" : "en";
  applyStatic();
})();
