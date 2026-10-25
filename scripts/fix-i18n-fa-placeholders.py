#!/usr/bin/env python3
"""Re-translate FA strings where placeholders were dropped."""
from __future__ import annotations

import importlib.util
import json
import re
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location(
    "tr", ROOT / "scripts" / "translate-i18n-fa-batch.py"
)
tr = importlib.util.module_from_spec(spec)
assert spec.loader
spec.loader.exec_module(tr)

import translators as ts  # noqa: E402

PH = tr.PH
FILES = [f"{n:02d}.json" for n in range(5, 10)]


def placeholders(s: str) -> list[str]:
    return PH.findall(s)


def protect_strong(s: str) -> tuple[str, list[str]]:
    slots: list[str] = []

    def repl(m):
        slots.append(m.group(0))
        return f"__PH{len(slots) - 1}__"

    return PH.sub(repl, s), slots


def restore_strong(s: str, slots: list[str]) -> str:
    for i, slot in enumerate(slots):
        s = s.replace(f"__PH{i}__", slot)
    return s


def translate_fixed(en: str) -> str:
    if en in tr.EXACT_OVERRIDES:
        return tr.EXACT_OVERRIDES[en]
    if not tr.needs_translation(en):
        return en
    protected, slots = protect_strong(en)
    for attempt in range(4):
        try:
            out = ts.translate_text(
                protected,
                translator="bing",
                from_language="en",
                to_language="fa",
            )
            fa = restore_strong(out, slots)
            if placeholders(en) == placeholders(fa):
                return tr.post_process(fa, en)
        except Exception:
            time.sleep(1.5 * (attempt + 1))
    # last resort: keep English placeholders by appending if single {0} etc.
    fa = tr.translate_one(en)
    fa = tr.post_process(fa, en)
    want = placeholders(en)
    have = placeholders(fa)
    if want and want != have:
        # prepend missing in order (crude but rare)
        for p in want:
            if p not in fa:
                fa = fa.rstrip(".") + " " + p
    return fa


def main() -> None:
    fixed = 0
    for name in FILES:
        src = json.loads((tr.IN_DIR / name).read_text(encoding="utf-8"))
        out_path = tr.OUT_DIR / name
        fa = json.loads(out_path.read_text(encoding="utf-8"))
        for k, en in src.items():
            fv = fa.get(k, "")
            if placeholders(en) != placeholders(fv):
                fa[k] = translate_fixed(en)
                fixed += 1
                if fixed % 10 == 0:
                    out_path.write_text(json.dumps(fa, ensure_ascii=False), encoding="utf-8")
                    print(f"{name}: fixed {fixed} so far", flush=True)
                time.sleep(0.15)
        out_path.write_text(json.dumps(fa, ensure_ascii=False), encoding="utf-8")
    print(f"done, fixed {fixed} strings", flush=True)


if __name__ == "__main__":
    main()
