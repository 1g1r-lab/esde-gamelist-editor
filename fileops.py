"""
fileops.py — Descoberta de mídia ES-DE, montagem do plano (dry-run) e execução (commit).

Princípios de design:
  * Validação primeiro: sempre é possível gerar um PLANO (dry-run) antes de aplicar.
  * Disciplina de backup: a gamelist.xml é copiada para .bak-pre-edit-<timestamp> antes
    de qualquer escrita.
  * Segurança na remoção: por padrão arquivos vão para uma LIXEIRA (move), não rm.
    Há opção de hard-delete para quem quiser.

Estrutura ES-DE assumida:
  ROMs:   <roms_root>/<system>/<arquivo>           (path da gamelist é relativo a esta pasta)
  Mídia:  <media_root>/<system>/<tipo>/<stem>.<ext> (auto-descoberta por nome de arquivo)
            tipos: covers, screenshots, marquees, miximages, 3dboxes, physicalmedia,
                   videos, fanart, titlescreens, backcovers, manuals, ...
"""

from __future__ import annotations

import hashlib
import json
import os
import shutil
import time
from dataclasses import dataclass, field

from gamelist import normalize_path, rom_basename, rom_stem

# Mapa tag-da-gamelist -> pasta de mídia (casos não óbvios).
# box3d (tag <box3d>) mapeia para a pasta "3dboxes".
TAG_TO_MEDIA_DIR = {
    "image": "covers",
    "thumbnail": "covers",
    "marquee": "marquees",
    "video": "videos",
    "fanart": "fanart",
    "titlescreen": "titlescreens",
    "manual": "manuals",
    "magazine": "magazines",
    "box3d": "3dboxes",
}

# Pastas de mídia padrão do ES-DE varridas no nível-3 de remoção.
DEFAULT_MEDIA_DIRS = [
    "covers", "screenshots", "marquees", "miximages", "3dboxes",
    "physicalmedia", "videos", "fanart", "titlescreens", "backcovers",
    "manuals", "magazines",
]

REMOVE_LEVELS = {
    1: "Remover apenas a entrada da gamelist",
    2: "Remover entrada + arquivo de ROM",
    3: "Remover entrada + ROM + mídia (downloaded_media)",
}


@dataclass
class MediaIndex:
    """Índice de arquivos de mídia de um sistema, agrupado por stem."""
    by_stem: dict = field(default_factory=dict)  # stem -> [caminhos absolutos]

    def for_stem(self, stem: str) -> list[str]:
        return self.by_stem.get(stem, [])


def _scan_type_dir(type_path: str) -> list[str]:
    """Lista os arquivos de um diretório de tipo usando scandir.

    scandir aproveita os metadados já retornados pela leitura do diretório
    (is_file sem stat extra na maioria dos casos), o que é muito mais rápido
    que listdir + os.path.isfile em filesystem remoto (SMB/NFS).
    """
    files: list[str] = []
    try:
        with os.scandir(type_path) as it:
            for de in it:
                try:
                    if de.is_file():
                        files.append(de.name)
                except OSError:
                    continue
    except OSError:
        pass
    return files


# ----------------------------------------------------------------------------
# Cache do índice de mídia (memória + disco local), p/ acelerar no NAS remoto
# ----------------------------------------------------------------------------
_MEDIA_CACHE: dict = {}   # key -> MediaIndex (sessão atual)


def _cache_dir() -> str:
    base = os.environ.get("XDG_CACHE_HOME") or os.path.join(
        os.path.expanduser("~"), ".cache")
    d = os.path.join(base, "esde-gamelist-editor", "media-index")
    try:
        os.makedirs(d, exist_ok=True)
    except OSError:
        pass
    return d


def _cache_key(media_root: str, system: str) -> str:
    raw = f"{os.path.abspath(media_root)}|{system}".encode("utf-8")
    return hashlib.sha1(raw).hexdigest()[:16]


def _disk_cache_path(media_root: str, system: str) -> str:
    return os.path.join(_cache_dir(), _cache_key(media_root, system) + ".json")


def _load_disk_cache(media_root: str, system: str):
    try:
        with open(_disk_cache_path(media_root, system), "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return None


def _save_disk_cache(media_root: str, system: str, data: dict) -> None:
    try:
        with open(_disk_cache_path(media_root, system), "w", encoding="utf-8") as f:
            json.dump(data, f)
    except Exception:
        pass


def build_media_index(media_root: str, system: str, use_cache: bool = True) -> MediaIndex:
    """Indexa <media_root>/<system>/<tipo>/* por stem.

    Usa cache em disco validado pelo mtime de cada subpasta de tipo: só relê
    do filesystem as pastas que mudaram desde a última varredura.
    """
    idx = MediaIndex()
    base = os.path.join(media_root, system)
    if not media_root or not os.path.isdir(base):
        return idx

    # mtimes das subpastas de tipo (poucas; barato mesmo em rede)
    type_mtimes: dict = {}
    try:
        with os.scandir(base) as it:
            for de in it:
                try:
                    if de.is_dir():
                        type_mtimes[de.name] = de.stat().st_mtime
                except OSError:
                    continue
    except OSError:
        return idx

    disk = _load_disk_cache(media_root, system) if use_cache else None
    disk_types = (disk or {}).get("types", {})
    new_types: dict = {}

    for tname, mtime in type_mtimes.items():
        cached = disk_types.get(tname)
        if cached and abs(float(cached.get("mtime", -1)) - mtime) < 1e-6:
            files = cached.get("files", [])          # inalterada: reaproveita
        else:
            files = _scan_type_dir(os.path.join(base, tname))  # mudou: relê
        new_types[tname] = {"mtime": mtime, "files": files}
        tpath = os.path.join(base, tname)
        for fname in files:
            stem, _ext = os.path.splitext(fname)
            idx.by_stem.setdefault(stem, []).append(os.path.join(tpath, fname))

    if use_cache:
        _save_disk_cache(media_root, system, {"types": new_types})
    return idx


def get_media_index(media_root: str, system: str, force: bool = False) -> MediaIndex:
    """Índice de mídia com cache em memória (uma varredura por sessão/sistema)."""
    if not media_root:
        return MediaIndex()
    key = _cache_key(media_root, system)
    if not force and key in _MEDIA_CACHE:
        return _MEDIA_CACHE[key]
    idx = build_media_index(media_root, system, use_cache=True)
    _MEDIA_CACHE[key] = idx
    return idx


def invalidate_media_index(media_root: str, system: str) -> None:
    """Descarta o índice em memória (após commit que mexeu na mídia).

    O cache em disco permanece: na próxima leitura, o mtime das pastas
    alteradas faz com que apenas elas sejam relidas.
    """
    _MEDIA_CACHE.pop(_cache_key(media_root, system), None)


def rom_abs_path(roms_root: str, system: str, path_value: str) -> str:
    """Resolve o caminho absoluto do ROM a partir do <path> relativo."""
    rel = normalize_path(path_value).lstrip("./").replace("\\", "/")
    return os.path.normpath(os.path.join(roms_root, system, rel))


def _safe_inside(child: str, parent: str) -> bool:
    """Garante que 'child' está dentro de 'parent' (anti path-traversal)."""
    if not parent:
        return False
    child_abs = os.path.realpath(child)
    parent_abs = os.path.realpath(parent)
    return os.path.commonpath([child_abs, parent_abs]) == parent_abs


@dataclass
class PlannedOp:
    kind: str            # "remove_entry" | "delete_rom" | "delete_media" | "edit"
    game_id: str
    name: str
    detail: str          # caminho ou descrição
    exists: bool = True
    error: str = ""

    def to_dict(self):
        return {
            "kind": self.kind, "game_id": self.game_id, "name": self.name,
            "detail": self.detail, "exists": self.exists, "error": self.error,
        }


def build_plan(entries, system, ctx, removals: dict, edits: dict):
    """
    Monta o plano (dry-run).
      removals: {game_id: level(1|2|3)}
      edits:    {game_id: {campo: valor}}
    ctx: dict com roms_root, media_root.
    Retorna (lista[PlannedOp], resumo dict).
    """
    roms_root = ctx.get("roms_root", "")
    media_root = ctx.get("media_root", "")
    media_idx = get_media_index(media_root, system) if media_root else MediaIndex()

    by_id = {e.path: e for e in entries}
    ops: list[PlannedOp] = []
    counts = {"remove_entry": 0, "delete_rom": 0, "delete_media": 0, "edit": 0}

    for game_id, level in removals.items():
        entry = by_id.get(game_id)
        name = (entry.fields.get("name") if entry else None) or game_id
        if not entry:
            # id sem correspondência: não conta como remoção real, apenas sinaliza
            ops.append(PlannedOp("remove_entry", game_id, name,
                                 "entrada não encontrada nesta gamelist", False,
                                 "id sem correspondência"))
            continue
        ops.append(PlannedOp("remove_entry", game_id, name, "entrada da gamelist"))
        counts["remove_entry"] += 1

        if level >= 2 and entry:
            rp = rom_abs_path(roms_root, system, entry.path)
            exists = os.path.exists(rp)
            err = "" if roms_root else "roms_root não configurado"
            ops.append(PlannedOp("delete_rom", game_id, name, rp, exists, err))
            if exists and not err:
                counts["delete_rom"] += 1

        if level >= 3 and entry:
            stem = rom_stem(entry.path)
            media_files = media_idx.for_stem(stem)
            if not media_root:
                ops.append(PlannedOp("delete_media", game_id, name,
                                     "(media_root não configurado)", False,
                                     "media_root não configurado"))
            elif not media_files:
                ops.append(PlannedOp("delete_media", game_id, name,
                                     f"(nenhuma mídia para '{stem}')", False))
            else:
                for mf in media_files:
                    ops.append(PlannedOp("delete_media", game_id, name, mf, True))
                    counts["delete_media"] += 1

    for game_id, changes in edits.items():
        if game_id in removals:
            continue  # remoção tem prioridade
        entry = by_id.get(game_id)
        if not entry:
            continue
        name = entry.fields.get("name") or game_id
        changed = []
        for k, v in changes.items():
            old = entry.fields.get(k, "")
            if (old or "") != (v or ""):
                changed.append(k)
        if changed:
            ops.append(PlannedOp("edit", game_id, name,
                                 "campos: " + ", ".join(changed)))
            counts["edit"] += 1

    summary = {
        "entries_to_remove": counts["remove_entry"],
        "roms_to_delete": counts["delete_rom"],
        "media_files_to_delete": counts["delete_media"],
        "entries_to_edit": counts["edit"],
    }
    return ops, summary


def _trash_target(trash_root: str, abs_path: str, source_root: str) -> str:
    """Caminho de destino na lixeira, preservando estrutura relativa."""
    try:
        rel = os.path.relpath(abs_path, source_root)
    except ValueError:
        rel = os.path.basename(abs_path)
    return os.path.join(trash_root, rel)


def _remove_file(abs_path: str, hard_delete: bool, trash_root: str,
                 source_root: str, report: list):
    """Move para a lixeira (padrão) ou apaga de vez (hard_delete)."""
    if not os.path.exists(abs_path):
        report.append({"path": abs_path, "action": "skip", "reason": "inexistente"})
        return
    if hard_delete:
        try:
            os.remove(abs_path)
            report.append({"path": abs_path, "action": "deleted"})
        except OSError as e:
            report.append({"path": abs_path, "action": "error", "reason": str(e)})
    else:
        dest = _trash_target(trash_root, abs_path, source_root)
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        # evita colisão
        if os.path.exists(dest):
            dest = dest + f".{int(time.time())}"
        try:
            shutil.move(abs_path, dest)
            report.append({"path": abs_path, "action": "trashed", "to": dest})
        except OSError as e:
            report.append({"path": abs_path, "action": "error", "reason": str(e)})


# ----------------------------------------------------------------------------
# ES-DE Orphan Cleaner — varredura de entradas e mídia órfãs
# ----------------------------------------------------------------------------
def _read_m3u_entries(m3u_abs: str) -> list[str]:
    """Linhas úteis de um .m3u (caminhos relativos dos discos)."""
    out: list[str] = []
    try:
        with open(m3u_abs, "r", encoding="utf-8-sig", errors="replace") as fh:
            for raw in fh:
                line = raw.strip()
                if line and not line.startswith("#"):
                    out.append(line.replace("\\", "/"))
    except OSError:
        pass
    return out


def _scan_rom_stems(rom_dir: str, max_depth: int = 3) -> set:
    """Stems (basename sem extensão) de todos os arquivos da pasta de ROMs.

    Varre até ``max_depth`` níveis (inclui subpastas ocultas como ``.discs``),
    o suficiente p/ layouts comuns: raiz, <jogo>/, .discs/, subpasta de disco.
    """
    stems: set = set()
    base_depth = rom_dir.rstrip(os.sep).count(os.sep)
    for cur, dirs, files in os.walk(rom_dir):
        if cur.count(os.sep) - base_depth >= max_depth:
            dirs[:] = []
        for f in files:
            stems.add(os.path.splitext(f)[0])
    return stems


def scan_orphans(entries, system: str, roms_root: str, media_root: str) -> dict:
    """Encontra órfãos de um sistema.

    1. Entradas órfãs: <path> da gamelist sem arquivo correspondente em
       <roms_root>/<system>/ (o arquivo .m3u em si conta como existente).
    2. m3u quebrado (informativo): .m3u existe, mas refere discos ausentes.
    3. Mídia órfã: arquivo em <media_root>/<system>/<tipo>/ cujo stem não casa
       com nenhum <path> da gamelist, arquivo real da pasta de ROMs ou entrada
       interna de .m3u (o ES-DE associa mídia por basename).
    """
    rom_dir = os.path.join(roms_root, system) if roms_root else ""
    have_roms = bool(rom_dir) and os.path.isdir(rom_dir)

    orphan_entries: list = []
    m3u_broken: list = []
    valid_stems: set = set()

    for e in entries:
        p = normalize_path(e.path)
        stem = os.path.splitext(os.path.basename(p.replace("\\", "/")))[0]
        valid_stems.add(stem)
        if not have_roms:
            continue
        rom_abs = rom_abs_path(roms_root, system, p)
        if not os.path.exists(rom_abs):
            orphan_entries.append({
                "path": e.path,
                "name": e.fields.get("name") or os.path.basename(p),
                "reason": "arquivo não existe na pasta de ROMs",
                "abs": rom_abs,
            })
            continue
        if p.lower().endswith(".m3u"):
            missing = []
            m3u_dir = os.path.dirname(rom_abs)
            for ref in _read_m3u_entries(rom_abs):
                valid_stems.add(os.path.splitext(os.path.basename(ref))[0])
                if not os.path.exists(os.path.normpath(os.path.join(m3u_dir, ref))):
                    missing.append(ref)
            if missing:
                m3u_broken.append({
                    "path": e.path,
                    "name": e.fields.get("name") or os.path.basename(p),
                    "missing": missing,
                })

    orphan_media: list = []
    media_base = os.path.join(media_root, system) if media_root else ""
    if media_base and os.path.isdir(media_base):
        # stems válidos também incluem os arquivos reais da pasta de ROMs
        # (mídia de jogo ainda não catalogado na gamelist não é órfã)
        if have_roms:
            valid_stems |= _scan_rom_stems(rom_dir)
        try:
            with os.scandir(media_base) as it:
                type_dirs = [de.name for de in it if de.is_dir()]
        except OSError:
            type_dirs = []
        for tname in sorted(type_dirs):
            tpath = os.path.join(media_base, tname)
            for fname in sorted(_scan_type_dir(tpath)):
                stem = os.path.splitext(fname)[0]
                if stem in valid_stems:
                    continue
                fabs = os.path.join(tpath, fname)
                try:
                    size = os.path.getsize(fabs)
                except OSError:
                    size = 0
                orphan_media.append({
                    "abs": fabs, "rel": f"{tname}/{fname}",
                    "type": tname, "stem": stem, "size": size,
                })

    return {
        "system": system,
        "roms_dir_ok": have_roms,
        "orphan_entries": orphan_entries,
        "orphan_media": orphan_media,
        "m3u_broken": m3u_broken,
        "media_bytes": sum(m["size"] for m in orphan_media),
    }


def backup_gamelist(xml_path: str, backup_root: str = "", system: str = "") -> str:
    """Copia a gamelist para um .bak com timestamp e retorna o caminho do backup.

    Se ``backup_root`` for informado, o backup vai para
    ``<backup_root>/<system>/gamelist.xml.bak-pre-edit-<ts>`` (mantém histórico
    organizado por console); senão fica ao lado do arquivo original.
    """
    ts = time.strftime("%Y%m%d-%H%M%S")
    if backup_root:
        dest_dir = os.path.join(backup_root, system) if system else backup_root
        os.makedirs(dest_dir, exist_ok=True)
        bak = os.path.join(dest_dir, f"gamelist.xml.bak-pre-edit-{ts}")
    else:
        bak = f"{xml_path}.bak-pre-edit-{ts}"
    shutil.copy2(xml_path, bak)
    return bak


def apply_changes(entries, gamelist_path, system, ctx, removals, edits):
    """
    Aplica edições e remoções na lista de entradas (em memória).
    Faz as operações de arquivo (ROM/mídia) conforme o nível.
    Retorna (novas_entries, report).
    NÃO escreve o XML — quem chama serializa e grava.
    """
    roms_root = ctx.get("roms_root", "")
    media_root = ctx.get("media_root", "")
    trash_root = ctx.get("trash_root", "")
    hard_delete = bool(ctx.get("hard_delete", False))
    media_idx = get_media_index(media_root, system) if media_root else MediaIndex()

    file_report = []

    # 1) Operações de arquivo para remoções nível 2/3
    for game_id, level in removals.items():
        entry = next((e for e in entries if e.path == game_id), None)
        if not entry:
            continue
        if level >= 2 and roms_root:
            rp = rom_abs_path(roms_root, system, entry.path)
            _remove_file(rp, hard_delete, trash_root, roms_root, file_report)
        if level >= 3 and media_root:
            for mf in media_idx.for_stem(rom_stem(entry.path)):
                _remove_file(mf, hard_delete, trash_root, media_root, file_report)

    # 2) Remove entradas do modelo
    removed_ids = set(removals.keys())
    kept = [e for e in entries if e.path not in removed_ids]

    # 3) Aplica edições nas entradas restantes
    for entry in kept:
        changes = edits.get(entry.path)
        if not changes:
            continue
        for k, v in changes.items():
            if v == "" or v is None:
                entry.fields.pop(k, None)        # campo vazio = remove a tag
            else:
                entry.fields[k] = v
        # se o path foi editado, atualiza o id da entrada
        if "path" in changes and changes["path"]:
            entry.path = changes["path"]

    # reindexa
    for i, e in enumerate(kept):
        e.index = i

    actually_removed = len(entries) - len(kept)
    edited_paths = set(edits.keys()) - removed_ids
    report = {
        "removed_entries": actually_removed,          # entradas de fato removidas
        "requested_removals": len(removed_ids),       # pedidos (pode diferir se houver id sem correspondência)
        "edited_entries": sum(1 for e in kept if e.path in edited_paths),
        "file_operations": file_report,
    }
    return kept, report
