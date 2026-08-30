<img src="icon.png" width="72" align="left" alt="ES-DE Gamelist Editor icon">

# ES-DE Gamelist Editor

A safe, fast **desktop app for editing ES-DE (EmulationStation Desktop Edition) gamelists**,
built for curating large collections. Retro-gamer "Pixel Lounge" UI.

<br clear="left">

> **No ROMs, BIOS or game media are hosted or distributed here.** This is an editor that
> operates only on files **you already own legally** (your gamelists, ROMs and media).
> No machine-specific paths are baked in.

It's a **single-window app** — it opens like any program, no browser and no server. Under the
hood it uses [pywebview](https://pywebview.flowrl.com/): the UI runs in a native window and
talks straight to Python. Runs on **Windows, macOS and Linux**, and ships as a **single-file
executable**.

> **Edit without fear.** Nothing is deleted outright: removals go to a **trash** folder and
> every `gamelist.xml` gets an **automatic backup** before each write.

---

## Download

Grab a prebuilt binary from the [**latest release**](https://github.com/1g1r-lab/esde-gamelist-editor/releases/latest):

| OS | Asset |
|----|-------|
| Windows | `esde-gamelist-editor-windows-x86_64.exe` |
| macOS (Apple Silicon) | `esde-gamelist-editor-macos-arm64` |
| Linux | `esde-gamelist-editor-linux-x86_64` |

Just double-click — no Python needed. The binaries are unsigned, so on first run Windows
SmartScreen may warn: click **More info → Run anyway**. Windows uses the built-in **WebView2**
(present on Win 10/11); macOS uses WKWebView; Linux uses Qt WebEngine.

---

## Features

- **Console sidebar** — every system in one panel; click to switch, collapse with `Ctrl+B`
  (it folds into horizontal "pills" on top), jump between consoles with `[` and `]`.
- **List and Grid views** — toggle `☰ LIST / ▦ GRID` in the header (or press `G`). Grid shows
  3:4 box-art covers with a video-game "spine" look, a size slider (120–220 px), and a
  slide-over detail panel.
- **Inline 3-level marking** — hover any row (or cover) and hit `1` / `2` / `3` to mark for
  removal without leaving the list; click the active level again to unmark.
  1. **Entry only** — removes the game from `gamelist.xml`; keeps ROM and media.
  2. **+ ROM** — also moves the ROM file to trash.
  3. **+ ROM + media** — also moves the matching media (`downloaded_media/<system>/<type>/…`).
- **Change plan bar** — a live bottom bar counts pending edits / entries / ROMs / media, so you
  always know what will happen before you apply.
- **Media carousel** — large cover / screenshot / miximage preview with arrows and dots.
- **Edit any field** (`name`, `desc`, `genre`, `rating`, `players`, `favorite`, media paths,
  and so on), including adding new fields. Edited fields are highlighted live.
- **Dry-run review** before applying: see exactly what will be changed, removed and moved,
  then confirm. Nothing touches disk until you apply.
- **Batch import** from a `.txt` (see below): mark games for removal **and** update fields
  across many consoles at once, with a validated preview (✓ found / ✕ not found).
- **ES-DE Orphan Cleaner**: find and remove gamelist entries with no ROM, and media files with
  no matching game (`.m3u`-aware) — with backup and trash.
- **"Marked only" filter** shows every marked item across all consoles in one view — great for
  a final review before applying.
- **Instant search** and a **virtual-scrolled list** — thousands of entries per system, no lag.
- **100% keyboard-navigable**, with a shortcut help screen (`?`).
- Preferences (open paths, sidebar state, list/grid view, tile size, sort) are **remembered**.

---

## Safety & data preservation

Deliberate choices, for large collections where a mistake is costly:

- **Trash instead of delete.** By default, removed ROMs and media are **moved** to a trash
  folder (`_GAMELIST_EDITOR_TRASH`, configurable), preserving the subfolder structure. A
  **hard-delete** option is available if you want direct deletion.
- **Gamelist backup.** Before rewriting, a `gamelist.xml.bak-pre-edit-<timestamp>` copy is
  written next to the original.
- **XML tags preserved.** The backend uses **lxml**, so `<name>` stays `<name>` (never
  corrupted to `<n>`, a known issue with some Python XML libs). Entities like `&amp;` are
  written correctly.
- **Path-traversal protection** when loading media for the preview.
- **Stateless commit.** The file is re-read from scratch at apply time, avoiding stale state.
- **Commit matches the preview.** What runs is exactly what the dry-run showed: the change set
  is frozen when you open the review, so switching consoles afterward doesn't affect what's
  written.

---

## Usage

1. On launch, the app asks what to open. Click **Browse…** to choose:
   - **Systems folder** — the `gamelists_root` (containing `snes/gamelist.xml`, etc.). The app
     lists every console it finds; **or**
   - **Single file** — one specific `gamelist.xml`.
2. Provide the **ROMs folder** and **downloaded_media** folder — needed for level-2/3 removals
   and cover previews. (Backup, trash and hard-delete live under **Advanced**.)
3. Pick a system in the sidebar, browse the list or grid, and edit fields on the right.
4. Mark entries for removal (levels 1–3) as needed.
5. Click **Apply (Ctrl+S)** → review the **dry-run** → confirm.

---

## Keyboard shortcuts

| Action | Keys |
|--------|------|
| Navigate the list | `↑` `↓` or `J` `K` |
| Jump | `PgUp` `PgDn` `Home` `End` |
| Previous / next console | `[` `]` |
| Toggle console sidebar | `Ctrl+B` |
| Toggle list / grid view | `G` |
| Mark removal (entry only) | `Del` / `X` / `1` |
| Mark removal (+ ROM) | `Shift+Del` / `2` |
| Mark removal (+ ROM + media) | `Alt+Del` / `3` |
| Unmark | `U` |
| Edit fields (or open a marked item) | `Enter` |
| Search / filter | `/` |
| Review & apply plan | `Ctrl+S` |
| Close dialog / slide-over | `Esc` |
| Help | `?` |

---

## Batch import (removals and field edits)

Via the **Import** button, pick a text file with **two line types**, mixed, for many consoles
at once (separator `|`):

```
# removal:     <console>|<path>|<action>
nes|./Batman (Japan) (En).zip|3

# field edit:  <console>|<path>|<field>|<new value>
nes|./D2 (USA).zip|name|D2
```

- **console** — the system name in the gamelist (`nes`, `snes`, `psx`…).
- **path** — the exact `<path>` value from the gamelist (the key).
- **action** — `1` (entry only), `2` (+ ROM) or `3` (+ ROM + media); also accepts
  `entry`, `rom`, `media`.
- **field / new value** — any gamelist field (`name`, `genre`, `developer`…); the value may
  contain `|`, and an empty value clears the field.

Blank lines and lines starting with `#` are ignored. The old 2-field form (`path|action`),
which uses the open console, is still accepted. Marks and edits are **global** (they span
consoles). See `docs/exemplo_marcacoes.txt`.

---

## ES-DE Orphan Cleaner

A dedicated screen to tidy the collection, on the current console or **all consoles**:

1. **Orphan gamelist entries** — a `<path>` that no longer exists in the ROMs folder. `.m3u`
   files count as present if the `.m3u` itself is there; if it exists but references missing
   discs, it shows in the informational **"M3U with missing discs"** section (not removed by
   the cleaner — likely a case for restoring discs).
2. **Orphan media files** — files under `downloaded_media/<console>/<type>/` whose name (stem)
   matches no gamelist game, no real ROM file, and no disc listed inside an `.m3u`.

The scan shows everything with checkboxes (checked by default), counts and recoverable space.
Cleaning uses the usual safeguards: per-console **backup** before writing, and media moved to
**trash** (or hard-deleted, if you opened the collection in that mode).

---

## How ES-DE lays out files

```
<gamelists_root>/
  snes/gamelist.xml
  psx/gamelist.xml
<roms_root>/
  snes/Super Mario World.sfc
<media_root>/            (usually ".../downloaded_media")
  snes/
    covers/Super Mario World.png
    screenshots/Super Mario World.png
```

Media is matched by **stem** (ROM filename without extension). The `<box3d>` tag maps to the
`3dboxes/` folder (legacy ES-DE mapping).

### Default folders & environment variables

Open-dialog fields start **empty** — nothing machine-specific is baked in. To pre-fill them
for your own layout (without editing code), set these before launching:

| Field | Variable | Example |
|-------|----------|---------|
| Gamelists | `ESDE_GAMELISTS_ROOT` | `.../ES-DE/gamelists` |
| downloaded_media | `ESDE_MEDIA_ROOT` | `.../ES-DE/downloaded_media` |
| ROMs | `ESDE_ROMS_ROOT` | `.../ROMs` |
| Backup | `ESDE_BACKUP_ROOT` | `.../ES-DE/backup` |

Before each commit, the console's gamelist is copied to the backup folder, organized per
console (`<backup>/<console>/gamelist.xml.bak-pre-edit-<timestamp>`).

---

## Performance on NAS / remote filesystems

The editor targets large collections on network drives (SMB/NFS), where every file access is a
round trip. To keep browsing fluid:

- Media scanning uses `os.scandir` (no `stat` per file) and is **cached in memory and on local
  disk** (`~/.cache/esde-gamelist-editor`), validated by each type-subfolder's `mtime` — only
  what changed is re-read.
- The same index is reused by browsing, the dry-run and the commit.
- Grid covers are lazy-loaded (only what's visible) and cached for the session.
- After a commit, only the affected console's count is refreshed.

To force a full media re-read, delete the cache folder above.

---

## Build from source

Requires **Python 3.10+**.

**Run directly** — dependencies install into a virtualenv on first run:

```bash
./run.sh      # Linux/macOS  (installs a Qt window backend automatically, no sudo)
run.bat       # Windows      (uses the built-in WebView2)
```

**Build a single-file executable** (PyInstaller):

```bash
./build.sh    # → dist/esde-gamelist-editor-v1.3.2
build.bat     # → dist\esde-gamelist-editor-v1.3.2.exe
```

## Tests

The UI logic has jsdom integration tests:

```bash
npm install
npm test
```

They cover the sidebar, list/grid views, 3-level marking, the change plan, import preview and
the orphan cleaner.

---

## Project structure

```
esde-gamelist-editor/
  app.py            # entry point (pywebview window)
  api.py            # API exposed to the UI (window.pywebview.api)
  gamelist.py       # gamelist.xml parse/serialize (lxml)
  fileops.py        # media index, dry-run, commit, trash, backups
  frontend/
    index.html
    css/style.css
    js/app.js        # state, virtual scrolling, grid, keyboard, marking, editing
  icon.ico / icon.png
  esde-gamelist-editor.spec   # PyInstaller config (embeds the icon)
```

## Known limitations

- **Multi-disc / M3U.** On level-2 removal, only the file referenced by `<path>` (e.g. the
  `.m3u`) is moved; the `.discs/` folder is **not** moved automatically (conservative).
- Changes apply per selected console, one `gamelist.xml` at a time.

---

## License

[MIT](LICENSE). Part of [1G1R Lab](https://1g1rlab.ai). Contributions, issues and PRs welcome.
