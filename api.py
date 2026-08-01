"""
api.py — camada de aplicação exposta à interface (pywebview).

Substitui o antigo servidor Flask: em vez de rotas HTTP, cada método desta
classe fica acessível no front-end como ``window.pywebview.api.<metodo>(...)``.
Toda a lógica pesada continua em gamelist.py e fileops.py.
"""
from __future__ import annotations

import base64
import json
import mimetypes
import os

import webview  # type: ignore

import gamelist as gl
import fileops as fo


# Optional default folders pre-filled in the "Open" dialog. Empty by default so
# nothing machine-specific ships with the app — you pick folders via the native
# "Procurar…" buttons, and the app remembers your last choice. To pre-fill them
# for your own setup, set these environment variables before launching:
#   ESDE_GAMELISTS_ROOT, ESDE_MEDIA_ROOT, ESDE_ROMS_ROOT, ESDE_BACKUP_ROOT
DEFAULT_GAMELISTS = os.environ.get("ESDE_GAMELISTS_ROOT", "")
DEFAULT_MEDIA = os.environ.get("ESDE_MEDIA_ROOT", "")
DEFAULT_ROMS = os.environ.get("ESDE_ROMS_ROOT", "")
DEFAULT_BACKUP = os.environ.get("ESDE_BACKUP_ROOT", "")


class Api:
    def __init__(self) -> None:
        self._window = None
        self._last_dir = ""
        self._media_data_cache = {}
        self.state = {
            "mode": "",            # "" | "system_root" | "single_file"
            "gamelists_root": DEFAULT_GAMELISTS,
            "single_file": "",
            "single_system": "",
            "roms_root": DEFAULT_ROMS,
            "media_root": DEFAULT_MEDIA,
            "trash_root": "",
            "backup_root": DEFAULT_BACKUP,
            "hard_delete": False,
        }

    # -- ligação com a janela (definida no app.py) --------------------------
    def set_window(self, window) -> None:
        self._window = window

    def _win(self):
        return self._window or (webview.active_window() if webview.windows else None)

    # ----------------------------------------------------------------- helpers
    def _gamelist_path_for(self, system: str) -> str:
        if self.state["mode"] == "single_file":
            return self.state["single_file"]
        return os.path.join(self.state["gamelists_root"], system, "gamelist.xml")

    def _default_trash(self) -> str:
        base = (self.state["gamelists_root"]
                or os.path.dirname(self.state["single_file"] or os.getcwd()))
        return os.path.join(base, "_GAMELIST_EDITOR_TRASH")

    def _ctx(self) -> dict:
        return {
            "roms_root": self.state["roms_root"],
            "media_root": self.state["media_root"],
            "trash_root": self.state["trash_root"] or self._default_trash(),
            "hard_delete": self.state["hard_delete"],
        }

    @staticmethod
    def _quick_count(path: str) -> int:
        """Conta entradas <game> sem fazer o parse completo do XML (rápido)."""
        try:
            n = 0
            with open(path, "rb") as fh:
                for chunk in iter(lambda: fh.read(1 << 20), b""):
                    n += chunk.count(b"<game>") + chunk.count(b"<game ")
            return n
        except Exception:
            return -1

    def _discover_systems(self) -> list:
        root = self.state["gamelists_root"]
        out: list = []
        if not root or not os.path.isdir(root):
            return out
        names = []
        try:
            with os.scandir(root) as it:
                for de in it:
                    try:
                        if de.is_dir():
                            names.append(de.name)
                    except OSError:
                        continue
        except OSError:
            return out
        for name in sorted(names):
            gpath = os.path.join(root, name, "gamelist.xml")
            if os.path.isfile(gpath):
                out.append({"system": name, "count": self._quick_count(gpath)})
        return out

    # ----------------------------------------------------------------- diálogos nativos
    def pick_folder(self, title: str = "Selecione a pasta") -> dict:
        w = self._win()
        if not w:
            return {"path": ""}
        try:
            res = w.create_file_dialog(
                webview.FOLDER_DIALOG, directory=self._last_dir or "")
        except Exception as e:
            return {"path": "", "error": str(e)}
        if not res:
            return {"path": ""}
        p = res[0] if isinstance(res, (list, tuple)) else res
        self._last_dir = p
        return {"path": p}

    def pick_file(self, title: str = "Selecione o gamelist.xml") -> dict:
        w = self._win()
        if not w:
            return {"path": ""}
        try:
            res = w.create_file_dialog(
                webview.OPEN_DIALOG, directory=self._last_dir or "",
                file_types=("gamelist (*.xml)", "Todos os arquivos (*.*)"))
        except Exception as e:
            return {"path": "", "error": str(e)}
        if not res:
            return {"path": ""}
        p = res[0] if isinstance(res, (list, tuple)) else res
        self._last_dir = os.path.dirname(p)
        return {"path": p}

    def pick_marks_file(self, title: str = "Selecione o arquivo de marcações (.txt)") -> dict:
        w = self._win()
        if not w:
            return {"path": ""}
        try:
            res = w.create_file_dialog(
                webview.OPEN_DIALOG, directory=self._last_dir or "",
                file_types=("Texto (*.txt)", "Todos os arquivos (*.*)"))
        except Exception as e:
            return {"path": "", "error": str(e)}
        if not res:
            return {"path": ""}
        p = res[0] if isinstance(res, (list, tuple)) else res
        self._last_dir = os.path.dirname(p)
        return {"path": p}

    @staticmethod
    def _action_level(action: str) -> int:
        m = {
            "1": 1, "2": 2, "3": 3,
            "entrada": 1, "entry": 1,
            "rom": 2, "+rom": 2, "rom+": 2,
            "midia": 3, "mídia": 3, "media": 3, "+midia": 3, "+mídia": 3,
        }
        return m.get((action or "").strip().lower(), 0)

    def read_marks_file(self, file_path: str) -> dict:
        """Lê um .txt de marcações/edições em lote (separador '|').

        Dois tipos de linha:
          • Remoção:  <console>|<path>|<ação>        (ação: 1/2/3 ou entrada/rom/midia)
          • Edição:   <console>|<path>|<campo>|<novo valor>
            ex.:  nes|./D2 (USA).zip|name|D2

        Distinção pelo nº de campos: 3 campos cujo 3º é uma ação válida = remoção;
        4 ou mais campos = edição de campo (o valor pode conter '|', pois é o resto
        da linha). Também aceita o formato antigo de 2 campos (path|ação), sem console.
        O '|' não pode aparecer em nome de arquivo no Windows, então o path nunca colide.
        Linhas vazias ou iniciadas por '#' são ignoradas.
        """
        path = os.path.expanduser((file_path or "").strip())
        if not os.path.isfile(path):
            return {"error": f"Arquivo não encontrado: {path}"}
        entries: list = []
        skipped = 0
        try:
            with open(path, "r", encoding="utf-8-sig", errors="replace") as fh:
                for raw in fh:
                    line = raw.rstrip("\r\n")
                    if not line.strip() or line.strip().startswith("#"):
                        continue
                    if "|" in line:
                        parts = line.split("|")
                        n = len(parts)
                        if n >= 4:
                            # edição: console | path | campo | valor (valor pode ter '|')
                            system = parts[0].strip()
                            rom = parts[1].strip()
                            field = parts[2].strip()
                            value = "|".join(parts[3:]).strip()  # valor (pode conter '|')
                            if not rom or not field:
                                skipped += 1
                                continue
                            entries.append({"kind": "edit", "system": system,
                                            "path": rom, "field": field, "value": value})
                            continue
                        if n == 3:
                            system, rom, action = parts[0].strip(), parts[1].strip(), parts[2].strip()
                        else:  # n == 2: legado path|ação
                            system, rom, action = "", parts[0].strip(), parts[1].strip()
                    else:
                        # legado: TAB ou ';' (separador mais à direita) → path<sep>ação
                        pos, sep = -1, None
                        for s in ("\t", ";"):
                            p = line.rfind(s)
                            if p > pos:
                                pos, sep = p, s
                        if sep is None:
                            skipped += 1
                            continue
                        system, rom, action = "", line[:pos].strip(), line[pos + 1:].strip()
                    level = self._action_level(action)
                    if not rom or level == 0:
                        skipped += 1
                        continue
                    entries.append({"kind": "mark", "system": system, "path": rom, "level": level})
        except Exception as e:
            return {"error": str(e)}
        return {"entries": entries, "skipped": skipped, "total": len(entries) + skipped}

    # ----------------------------------------------------------------- config
    def get_config(self) -> dict:
        cfg = dict(self.state)
        cfg["trash_default"] = self._default_trash()
        cfg["loaded"] = bool(self.state["mode"])
        return cfg

    # ----------------------------------------------------------------- preferências
    def _prefs_path(self) -> str:
        return os.path.join(os.path.expanduser("~"), ".esde_gamelist_editor.json")

    def get_prefs(self) -> dict:
        try:
            with open(self._prefs_path(), "r", encoding="utf-8") as fh:
                data = json.load(fh)
                return data if isinstance(data, dict) else {}
        except Exception:
            return {}

    def set_prefs(self, prefs: dict) -> dict:
        try:
            with open(self._prefs_path(), "w", encoding="utf-8") as fh:
                json.dump(prefs or {}, fh, ensure_ascii=False, indent=2)
            return {"ok": True}
        except Exception as e:
            return {"error": str(e)}

    # ----------------------------------------------------------------- abrir
    def open_target(self, data: dict) -> dict:
        data = data or {}
        mode = data.get("mode")
        exp = os.path.expanduser

        if mode == "single_file":
            f = exp((data.get("gamelist_file") or "").strip())
            if not os.path.isfile(f):
                return {"error": f"Arquivo não encontrado: {f}"}
            self.state["mode"] = "single_file"
            self.state["single_file"] = f
            sysname = (data.get("system") or "").strip() \
                or os.path.basename(os.path.dirname(f))
            self.state["single_system"] = sysname
            self.state["roms_root"] = exp((data.get("roms_root") or "").strip())
            self.state["media_root"] = exp((data.get("media_root") or "").strip())
            self.state["trash_root"] = exp((data.get("trash_root") or "").strip())
            self.state["backup_root"] = exp((data.get("backup_root") or "").strip())
            self.state["hard_delete"] = bool(data.get("hard_delete", False))
            return {"ok": True, "mode": mode, "system": sysname}

        if mode == "system_root":
            groot = exp((data.get("gamelists_root") or "").strip())
            if not os.path.isdir(groot):
                return {"error": f"Pasta não encontrada: {groot}"}
            self.state["mode"] = "system_root"
            self.state["gamelists_root"] = groot
            self.state["roms_root"] = exp((data.get("roms_root") or "").strip())
            self.state["media_root"] = exp((data.get("media_root") or "").strip())
            self.state["trash_root"] = exp((data.get("trash_root") or "").strip())
            self.state["backup_root"] = exp((data.get("backup_root") or "").strip())
            self.state["hard_delete"] = bool(data.get("hard_delete", False))
            return {"ok": True, "mode": mode, "systems": self._discover_systems()}

        return {"error": "modo inválido (use system_root ou single_file)"}

    # ----------------------------------------------------------------- sistemas
    def get_systems(self) -> list:
        if self.state["mode"] == "single_file":
            count = self._quick_count(self.state["single_file"])
            return [{"system": self.state["single_system"], "count": count}]
        return self._discover_systems()

    # ----------------------------------------------------------------- gamelist
    def get_gamelist(self, system: str) -> dict:
        gpath = self._gamelist_path_for(system)
        if not os.path.isfile(gpath):
            return {"error": f"gamelist.xml não encontrado: {gpath}"}
        try:
            entries, root_tag = gl.parse_gamelist(gpath)
        except Exception as e:
            return {"error": f"Falha ao parsear: {e}"}

        media_idx = (fo.get_media_index(self.state["media_root"], system)
                     if self.state["media_root"] else fo.MediaIndex())

        games = []
        for e in entries:
            d = e.to_dict()
            stem = gl.rom_stem(e.path)
            media_map = {}
            for mf in media_idx.for_stem(stem):
                type_dir = os.path.basename(os.path.dirname(mf))
                media_map[type_dir] = os.path.basename(mf)
            d["media"] = media_map
            d["stem"] = stem
            games.append(d)

        return {
            "system": system,
            "root_tag": root_tag,
            "path": gpath,
            "count": len(games),
            "games": games,
        }

    # ----------------------------------------------------------------- mídia (data URI)
    def get_media(self, system: str, mtype: str, fname: str) -> dict:
        root = self.state["media_root"]
        if not root:
            return {"error": "media_root não configurado"}
        directory = os.path.join(root, system, mtype)
        full = os.path.normpath(os.path.join(directory, fname))
        # anti path-traversal
        try:
            if os.path.commonpath([os.path.realpath(full),
                                   os.path.realpath(root)]) != os.path.realpath(root):
                return {"error": "forbidden"}
        except ValueError:
            return {"error": "forbidden"}

        # cache em memória (evita reler/recodificar a mesma imagem na rede)
        cached = self._media_data_cache.get(full)
        if cached is not None:
            return {"src": cached}
        if not os.path.isfile(full):
            return {"error": "not found"}
        mime = mimetypes.guess_type(full)[0] or "application/octet-stream"
        try:
            with open(full, "rb") as fh:
                b64 = base64.b64encode(fh.read()).decode("ascii")
        except Exception as e:
            return {"error": str(e)}
        src = f"data:{mime};base64,{b64}"
        # mantém o cache limitado
        if len(self._media_data_cache) > 240:
            self._media_data_cache.clear()
        self._media_data_cache[full] = src
        return {"src": src}

    # ----------------------------------------------------------------- plano (dry-run)
    def build_plan(self, data: dict) -> dict:
        data = data or {}
        system = data.get("system", "")
        removals = {k: int(v) for k, v in (data.get("removals") or {}).items()}
        edits = data.get("edits") or {}
        gpath = self._gamelist_path_for(system)
        if not os.path.isfile(gpath):
            return {"error": "gamelist.xml não encontrado"}
        entries, _ = gl.parse_gamelist(gpath)
        ops, summary = fo.build_plan(entries, system, self._ctx(), removals, edits)
        return {
            "summary": summary,
            "operations": [o.to_dict() for o in ops],
            "trash_root": self._ctx()["trash_root"],
            "hard_delete": self.state["hard_delete"],
        }

    # ----------------------------------------------------------------- orphan cleaner
    def scan_orphans(self, data: dict) -> dict:
        """Varre órfãos. data: {"systems": ["nes", ...]} ou {"all": true}."""
        data = data or {}
        if data.get("all"):
            systems = [s["system"] for s in self._discover_systems()]
        else:
            systems = [s for s in (data.get("systems") or []) if s]
        if not systems:
            return {"error": "nenhum console para varrer"}
        results = []
        for sysname in systems:
            gpath = self._gamelist_path_for(sysname)
            if not os.path.isfile(gpath):
                continue
            try:
                entries, _ = gl.parse_gamelist(gpath)
            except Exception as e:
                results.append({"system": sysname, "error": str(e)})
                continue
            r = fo.scan_orphans(entries, sysname,
                                self.state["roms_root"], self.state["media_root"])
            r["gamelist_entries"] = len(entries)
            results.append(r)
        totals = {
            "orphan_entries": sum(len(r.get("orphan_entries", [])) for r in results),
            "orphan_media": sum(len(r.get("orphan_media", [])) for r in results),
            "m3u_broken": sum(len(r.get("m3u_broken", [])) for r in results),
            "media_bytes": sum(r.get("media_bytes", 0) for r in results),
        }
        return {"results": results, "totals": totals,
                "roms_root": self.state["roms_root"],
                "media_root": self.state["media_root"]}

    def clean_orphans(self, data: dict) -> dict:
        """Aplica a limpeza selecionada.

        data: {"entries": {system: [path, ...]}, "media": {system: [abs, ...]}}
        Entradas: backup da gamelist (backup_root) + remoção + gravação.
        Mídia: lixeira (ou hard delete, conforme a config aberta).
        """
        data = data or {}
        ent_by_sys = data.get("entries") or {}
        media_by_sys = data.get("media") or {}
        ctx = self._ctx()
        report = {"systems": [], "media_ops": [], "errors": []}

        # 1) entradas órfãs — por sistema, com backup antes de escrever
        for sysname, paths in ent_by_sys.items():
            if not paths:
                continue
            gpath = self._gamelist_path_for(sysname)
            if not os.path.isfile(gpath):
                report["errors"].append(f"{sysname}: gamelist não encontrada")
                continue
            try:
                entries, root_tag = gl.parse_gamelist(gpath)
                backup = fo.backup_gamelist(
                    gpath, self.state.get("backup_root", ""), sysname)
                targets = set(paths)
                kept = [e for e in entries if e.path not in targets]
                removed = len(entries) - len(kept)
                for i, e in enumerate(kept):
                    e.index = i
                body = gl.serialize_gamelist(kept, root_tag or "gameList")
                with open(gpath, "wb") as fh:
                    fh.write(body)
                report["systems"].append({
                    "system": sysname, "removed_entries": removed,
                    "remaining_entries": len(kept), "backup": backup,
                })
            except Exception as e:
                report["errors"].append(f"{sysname}: {e}")

        # 2) mídia órfã — lixeira/hard delete
        media_root = self.state["media_root"]
        for sysname, files in media_by_sys.items():
            for fabs in files or []:
                if not fo._safe_inside(fabs, media_root):
                    report["media_ops"].append(
                        {"path": fabs, "action": "error",
                         "reason": "fora da pasta de mídia"})
                    continue
                fo._remove_file(fabs, ctx["hard_delete"], ctx["trash_root"],
                                media_root, report["media_ops"])
            if files and media_root:
                fo.invalidate_media_index(media_root, sysname)

        trashed = sum(1 for o in report["media_ops"] if o["action"] == "trashed")
        deleted = sum(1 for o in report["media_ops"] if o["action"] == "deleted")
        errors = [o for o in report["media_ops"] if o["action"] == "error"]
        report["summary"] = {
            "entries_removed": sum(s["removed_entries"] for s in report["systems"]),
            "media_trashed": trashed, "media_deleted": deleted,
            "media_errors": len(errors) + len(report["errors"]),
        }
        return {"ok": True, "report": report}

    # ----------------------------------------------------------------- commit
    def commit(self, data: dict) -> dict:
        data = data or {}
        system = data.get("system", "")
        removals = {k: int(v) for k, v in (data.get("removals") or {}).items()}
        edits = data.get("edits") or {}
        gpath = self._gamelist_path_for(system)
        if not os.path.isfile(gpath):
            return {"error": "gamelist.xml não encontrado"}

        # re-parseia o arquivo do disco (commit stateless e seguro)
        entries, root_tag = gl.parse_gamelist(gpath)
        # backup ANTES de qualquer escrita (para backup_root, se configurado)
        backup = fo.backup_gamelist(gpath, self.state.get("backup_root", ""), system)
        new_entries, report = fo.apply_changes(
            entries, gpath, system, self._ctx(), removals, edits)
        body = gl.serialize_gamelist(new_entries, root_tag or "gameList")
        with open(gpath, "wb") as fh:
            fh.write(body)

        # mídia pode ter sido movida p/ lixeira: descarta o índice em memória
        if self.state["media_root"]:
            fo.invalidate_media_index(self.state["media_root"], system)

        report["backup"] = backup
        report["gamelist"] = gpath
        report["remaining_entries"] = len(new_entries)
        return {"ok": True, "report": report}
