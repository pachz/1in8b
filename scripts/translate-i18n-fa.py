#!/usr/bin/env python3
"""Translate I18N chunks EN→FA via MyMemory. Resumable. Merges to data/i18n_fa.json."""
from __future__ import annotations

import json
import re
import time
from pathlib import Path

from deep_translator import MyMemoryTranslator

ROOT = Path(__file__).resolve().parents[1]
IN_DIR = ROOT / "data" / "i18n-chunks"
OUT_DIR = ROOT / "data" / "i18n-fa-out"
OUT_DIR.mkdir(parents=True, exist_ok=True)

PH = re.compile(
    r"(\{\d+\}|\{\@\w+\}|\{\{[^}]+\}\}|\\n|\\t)"
)
AR = re.compile(r"[\u0600-\u06FF]")


def protect(s: str):
    slots = []

    def repl(m):
        slots.append(m.group(0))
        return "[[%d]]" % (len(slots) - 1)

    return PH.sub(repl, s), slots


def restore(s: str, slots):
    def repl(m):
        i = int(m.group(1))
        return slots[i] if i < len(slots) else m.group(0)

    return re.sub(r"\[\[(\d+)\]\]", repl, s)


def translate_one(tr, text: str) -> str:
    if not text or not text.strip():
        return text
    if re.fullmatch(r"[\d\s.,:%+\-–—/|·•]+", text):
        return text
    if AR.search(text) and not re.search(r"[A-Za-z]{3,}", text):
        return text  # already Persian
    protected, slots = protect(text)
    # MyMemory free tier ~500 chars
    pieces = []
    buf = protected
    while buf:
        chunk, buf = buf[:450], buf[450:]
        try:
            pieces.append(tr.translate(chunk))
        except Exception:
            time.sleep(1.5)
            try:
                pieces.append(tr.translate(chunk))
            except Exception:
                pieces.append(chunk)
        time.sleep(0.2)
    return restore("".join(pieces), slots)


def translate_chunk(tr, path: Path):
    out_path = OUT_DIR / path.name
    done = {}
    if out_path.exists():
        try:
            done = json.loads(out_path.read_text())
        except Exception:
            done = {}
    src = json.loads(path.read_text())
    pending = [
        (k, v)
        for k, v in src.items()
        if k not in done or not AR.search(str(done.get(k, "")))
    ]
    print("%s: %d done, %d pending" % (path.name, len(done), len(pending)), flush=True)
    for i, (k, v) in enumerate(pending, 1):
        try:
            done[k] = translate_one(tr, v)
        except Exception as e:
            print("  FAIL %s: %s" % (k, e), flush=True)
            done[k] = v
        if i % 25 == 0:
            out_path.write_text(json.dumps(done, ensure_ascii=False))
            print("  %s %d/%d" % (path.name, i, len(pending)), flush=True)
    out_path.write_text(json.dumps(done, ensure_ascii=False))
    print("%s: complete %d" % (path.name, len(done)), flush=True)


def merge():
    en = json.loads((ROOT / "data" / "i18n-chunks" / "00.json").read_text())
    # rebuild full EN base from all chunks
    base = {}
    for p in sorted(IN_DIR.glob("*.json")):
        base.update(json.loads(p.read_text()))
    # overlay FA
    for p in sorted(OUT_DIR.glob("*.json")):
        part = json.loads(p.read_text())
        for k, v in part.items():
            if AR.search(str(v)):
                base[k] = v
    # hand overrides
    ov_path = ROOT / "data" / "fa-overrides.json"
    if ov_path.exists():
        ov = json.loads(ov_path.read_text())
        # ov is english_value -> persian OR key -> persian
        by_val = {}
        for k, v in base.items():
            by_val.setdefault(v, []).append(k)
        for a, b in ov.items():
            if a in base:
                base[a] = b
            elif a in by_val:
                for k in by_val[a]:
                    base[k] = b
    (ROOT / "data" / "i18n_fa.json").write_text(
        json.dumps(base, ensure_ascii=False)
    )
    pers = sum(1 for v in base.values() if AR.search(str(v)))
    print("merged %d keys, %d persian (%.1f%%)" % (len(base), pers, 100 * pers / len(base)), flush=True)


def main():
    tr = MyMemoryTranslator(source="en-US", target="fa-IR")
    for p in sorted(IN_DIR.glob("*.json")):
        translate_chunk(tr, p)
    merge()


if __name__ == "__main__":
    main()
