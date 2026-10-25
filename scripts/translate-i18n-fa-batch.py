#!/usr/bin/env python3
"""Fast EN→FA i18n translation via Bing batching. Resumable."""
from __future__ import annotations

import json
import os
import re
import time
from pathlib import Path

os.environ.setdefault("translators_default_region", "EN")

import translators as ts  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
IN_DIR = ROOT / "data" / "i18n-chunks"
OUT_DIR = ROOT / "data" / "i18n-fa-out"
OUT_DIR.mkdir(parents=True, exist_ok=True)

SEP = "\u0001"
MAX_BATCH_ITEMS = 20
MAX_BATCH_CHARS = 1200
MAX_SINGLE = 2000

PH = re.compile(
    r"(\{\d+\}|\{\@\w+\}|\{\{[^}]+\}\}|\\n|\\t|%\d+\$[sd]|\{[a-zA-Z_]+\})"
)

EXACT_OVERRIDES = {
    "Be born": "متولد شو",
    "Be born yourself": "متولد شو",
    "Be born too": "تو هم متولد شو",
    "Be born again": "دوباره متولد شو",
    "Shared lives": "زندگی‌های مشترک",
    "Memorial": "یادبود",
    "House of Past Lives": "خانهٔ زندگی‌های گذشته",
}

BRAND = "1 in 8 Billion"
BRAND_FA = "۱ در ۸ میلیارد"


def protect(s: str):
    slots = []

    def repl(m):
        slots.append(m.group(0))
        return f"⟦{len(slots) - 1}⟧"

    return PH.sub(repl, s), slots


def restore(s: str, slots):
    def repl(m):
        i = int(m.group(1))
        return slots[i] if i < len(slots) else m.group(0)

    return re.sub(r"⟦(\d+)⟧", repl, s)


def needs_translation(text: str) -> bool:
    if not text or not text.strip():
        return False
    if re.fullmatch(r"[\d\s.,:%+\-–—/|·•]+", text):
        return False
    return True


def post_process(fa: str, english: str) -> str:
    if english in EXACT_OVERRIDES:
        return EXACT_OVERRIDES[english]
    return fa.replace(BRAND, BRAND_FA)


def translate_batch(texts: list[str]) -> list[str]:
    if not texts:
        return []
    if len(texts) == 1:
        return [translate_one(texts[0])]

    protected_list = []
    all_slots = []
    for t in texts:
        p, slots = protect(t)
        protected_list.append(p)
        all_slots.append(slots)

    joined = SEP.join(protected_list)
    for attempt in range(3):
        try:
            out = ts.translate_text(
                joined,
                translator="bing",
                from_language="en",
                to_language="fa",
            )
            parts = out.split(SEP)
            if len(parts) != len(texts):
                raise ValueError(f"split mismatch {len(parts)} vs {len(texts)}")
            return [restore(parts[i], all_slots[i]) for i in range(len(texts))]
        except Exception as e:
            if attempt == 2:
                print(f"  batch fail ({len(texts)}): {e}", flush=True)
                return [translate_one(t) for t in texts]
            time.sleep(1.5 * (attempt + 1))


def translate_one(text: str) -> str:
    if not needs_translation(text):
        return text
    protected, slots = protect(text)
    for attempt in range(3):
        try:
            out = ts.translate_text(
                protected,
                translator="bing",
                from_language="en",
                to_language="fa",
            )
            return restore(out, slots)
        except Exception:
            time.sleep(1.5 * (attempt + 1))
    return text


def translate_chunk(path: Path):
    out_path = OUT_DIR / path.name
    done = {}
    if out_path.exists():
        done = json.loads(out_path.read_text())
    src = json.loads(path.read_text())
    pending_keys = [k for k in src if k not in done]
    print(f"{path.name}: {len(done)} done, {len(pending_keys)} pending", flush=True)

    batch_keys: list[str] = []
    batch_vals: list[str] = []
    batch_chars = 0

    def flush_batch():
        nonlocal batch_keys, batch_vals, batch_chars
        if not batch_keys:
            return
        en_vals = batch_vals[:]
        fa_vals = translate_batch(batch_vals)
        for k, en, fa in zip(batch_keys, en_vals, fa_vals):
            done[k] = post_process(fa, en)
        out_path.write_text(json.dumps(done, ensure_ascii=False))
        print(f"  {path.name} +{len(batch_keys)} (total {len(done)})", flush=True)
        batch_keys = []
        batch_vals = []
        batch_chars = 0
        time.sleep(0.25)

    for k in pending_keys:
        v = src[k]
        if not needs_translation(v):
            done[k] = v
            continue
        if len(v) > MAX_SINGLE:
            flush_batch()
            fa = translate_one(v)
            done[k] = post_process(fa, v)
            out_path.write_text(json.dumps(done, ensure_ascii=False))
            time.sleep(0.2)
            continue
        add_len = len(v) + len(SEP)
        if batch_keys and (
            batch_chars + add_len > MAX_BATCH_CHARS
            or len(batch_keys) >= MAX_BATCH_ITEMS
        ):
            flush_batch()
        batch_keys.append(k)
        batch_vals.append(v)
        batch_chars += add_len

    flush_batch()
    # fill any keys still missing (pure pass-through)
    for k, v in src.items():
        if k not in done:
            done[k] = v
    out_path.write_text(json.dumps(done, ensure_ascii=False))
    print(f"{path.name}: complete {len(done)}", flush=True)


def main():
    for p in sorted(IN_DIR.glob("*.json")):
        translate_chunk(p)
    merged = {}
    for p in sorted(OUT_DIR.glob("*.json")):
        merged.update(json.loads(p.read_text()))
    out = ROOT / "data" / "i18n_fa.json"
    out.write_text(json.dumps(merged, ensure_ascii=False))
    print("merged", len(merged), flush=True)


if __name__ == "__main__":
    main()
