#!/usr/bin/env python3
"""Translate i18n-fa-batch-work part files to .done.json via MyMemory."""
from __future__ import annotations

import json
import re
import sys
import time
from pathlib import Path

from deep_translator import MyMemoryTranslator

ROOT = Path(__file__).resolve().parents[1]
PH = re.compile(r"(\{\d+\}|\{\@\w+\}|\{\{[^}]+\}\}|\\n)")
BRAND = re.compile(r"1 in 8 Billion", re.I)


def protect(s: str) -> tuple[str, list[str]]:
    slots: list[str] = []

    def repl(m: re.Match[str]) -> str:
        slots.append(m.group(0))
        return f"[[{len(slots) - 1}]]"

    return PH.sub(repl, s), slots


def restore(s: str, slots: list[str]) -> str:
    def repl(m: re.Match[str]) -> str:
        i = int(m.group(1))
        return slots[i] if i < len(slots) else m.group(0)

    return re.sub(r"\[\[(\d+)\]\]", repl, s)


def translate_text(tr: MyMemoryTranslator, text: str) -> str:
    p, slots = protect(text)
    if not p.strip():
        return text
    pieces: list[str] = []
    buf = p
    while buf:
        chunk, buf = buf[:450], buf[450:]
        for attempt in range(3):
            try:
                pieces.append(tr.translate(chunk))
                break
            except Exception:
                time.sleep(1.5 * (attempt + 1))
        else:
            pieces.append(chunk)
        time.sleep(0.12)
    out = restore("".join(pieces), slots)
    out = BRAND.sub("«۱ در ۸ میلیارد»", out)
    return out


def process_part(path: Path) -> Path:
    done_path = path.with_suffix(".json").name.replace(".json", ".done.json")
    done_path = path.parent / done_path
    if done_path.exists():
        print(f"skip existing {done_path.name}")
        return done_path

    items = json.loads(path.read_text(encoding="utf-8"))
    tr = MyMemoryTranslator(source="en-US", target="fa-IR")
    out_items = []
    for i, it in enumerate(items, 1):
        en = it["en"]
        fa = translate_text(tr, en)
        out_items.append({"k": it["k"], "en": en, "fa": fa})
        if i % 25 == 0:
            print(f"  {path.name}: {i}/{len(items)}", flush=True)
    done_path.write_text(
        json.dumps(out_items, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"wrote {done_path.name} ({len(out_items)} items)")
    return done_path


def main() -> None:
    if len(sys.argv) < 2:
        print("usage: translate-fa-batch-part.py <part.json> ...")
        sys.exit(2)
    for arg in sys.argv[1:]:
        process_part(Path(arg))


if __name__ == "__main__":
    main()
