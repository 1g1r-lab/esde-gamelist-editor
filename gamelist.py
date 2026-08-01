"""
gamelist.py — Parsing e serialização de gamelist.xml no formato ES-DE / EmulationStation.

Usa lxml propositalmente: o xml.etree.ElementTree do CPython tem um comportamento
conhecido de compactar a tag <name> para <n> em certas versões. lxml preserva os
nomes das tags exatamente, então o round-trip é fiel.

Identidade de um jogo dentro de uma gamelist = o conteúdo de <path> (assume-se
"zero duplicate paths" na coleção). Em modo de edição, o frontend sempre envia o
path ORIGINAL como id, então renomear <path> continua sendo rastreável.
"""

from __future__ import annotations

import html
import os
from dataclasses import dataclass, field
from typing import Optional

from lxml import etree


# Campos "conhecidos" do ES-DE — usados só para ordenação amigável na UI.
# A edição NÃO é restrita a esses campos: qualquer tag filha é preservada e editável.
KNOWN_ORDER = [
    "path", "name", "sortname", "collectionsortname", "desc",
    "rating", "releasedate", "developer", "publisher", "genre", "players",
    "favorite", "completed", "kidgame", "hidden", "broken", "nogamecount",
    "playcount", "lastplayed", "altemulator", "controller", "region", "lang",
    "image", "video", "marquee", "thumbnail", "fanart", "titlescreen",
    "manual", "magazine", "arcadesystemname", "cheevosHash", "cheevosId",
    "folderlink",
]

BOOL_FIELDS = {"favorite", "completed", "kidgame", "hidden", "broken", "nogamecount"}


def _order_key(tag: str) -> tuple[int, str]:
    try:
        return (KNOWN_ORDER.index(tag), tag)
    except ValueError:
        return (len(KNOWN_ORDER), tag)


@dataclass
class GameEntry:
    """Representa um <game> ou <folder> da gamelist."""
    tag: str                       # "game" ou "folder"
    fields: dict                   # {tagname: text}  (ordem preservada na serialização)
    path: str                      # conteúdo de <path> (id da entrada)
    index: int                     # posição original no documento

    def to_dict(self) -> dict:
        return {
            "id": self.path,           # id estável = path original
            "tag": self.tag,
            "index": self.index,
            "fields": self.fields,
        }


def parse_gamelist(xml_path: str) -> tuple[list[GameEntry], Optional[str]]:
    """
    Lê um gamelist.xml e retorna (lista_de_entradas, root_tag).
    Lança exceção se o arquivo não puder ser parseado.
    """
    parser = etree.XMLParser(remove_blank_text=False, recover=True)
    tree = etree.parse(xml_path, parser)
    root = tree.getroot()
    if root is None:
        return [], None

    entries: list[GameEntry] = []
    idx = 0
    for el in root:
        if not isinstance(el.tag, str):  # comentários / PIs
            continue
        if el.tag not in ("game", "folder"):
            continue
        fields: dict = {}
        for child in el:
            if not isinstance(child.tag, str):
                continue
            text = child.text if child.text is not None else ""
            # mantém o primeiro valor caso haja tags repetidas (raro)
            if child.tag not in fields:
                fields[child.tag] = text
        path = fields.get("path", "")
        entries.append(GameEntry(tag=el.tag, fields=fields, path=path, index=idx))
        idx += 1
    return entries, root.tag


def normalize_path(p: str) -> str:
    """Desescapa entidades XML (&amp; -> &) para comparar com o filesystem."""
    return html.unescape(p or "")


def rom_basename(path_value: str) -> str:
    """Nome do arquivo de ROM a partir do <path> (./Sub/Game.zip -> Game.zip)."""
    p = normalize_path(path_value).replace("\\", "/")
    return os.path.basename(p)


def rom_stem(path_value: str) -> str:
    """Stem do ROM (sem extensão) usado para casar com downloaded_media."""
    base = rom_basename(path_value)
    stem, _ext = os.path.splitext(base)
    return stem


def serialize_gamelist(
    entries: list[GameEntry],
    root_tag: str = "gameList",
) -> bytes:
    """
    Reconstrói o documento a partir das entradas (já com edições/remoções aplicadas).
    Mantém indentação com TAB, no estilo do ES-DE.
    """
    root = etree.Element(root_tag)
    for entry in entries:
        game_el = etree.SubElement(root, entry.tag)
        # ordena campos: conhecidos primeiro (na ordem canônica), demais ao final
        for tag in sorted(entry.fields.keys(), key=_order_key):
            value = entry.fields[tag]
            if value is None:
                continue
            child = etree.SubElement(game_el, tag)
            child.text = value if value != "" else None
    # serialização: indentação com tab para combinar com o ES-DE
    etree.indent(root, space="\t")
    body = etree.tostring(
        root, xml_declaration=True, encoding="UTF-8", pretty_print=True
    )
    return body
