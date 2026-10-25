#!/usr/bin/env python3
"""Fill missing / English FA values in all i18n-fa-out chunks, then merge."""
from __future__ import annotations

import importlib.util
import json
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location(
    "tr", ROOT / "scripts" / "translate-i18n-fa-batch.py"
)
tr = importlib.util.module_from_spec(spec)
assert spec.loader
spec.loader.exec_module(tr)

WORKERS = 4


def needs_fa(src_val: str, done_val: str | None) -> bool:
    if done_val is None:
        return tr.needs_translation(src_val)
    if not tr.needs_translation(src_val):
        return False
    return not tr.AR.search(str(done_val))


def one_key(src: dict, k: str) -> tuple[str, str]:
    v = src[k]
    if not tr.needs_translation(v):
        return k, v
    fa = tr.translate_one(v)
    return k, tr.post_process(fa, v)


def finish_chunk(name: str) -> None:
    path = tr.IN_DIR / name
    out_path = tr.OUT_DIR / name
    src = json.loads(path.read_text(encoding="utf-8"))
    done: dict = {}
    if out_path.exists():
        done = json.loads(out_path.read_text(encoding="utf-8"))
    pending = [k for k in src if needs_fa(src[k], done.get(k))]
    if not pending:
        print(f"{name}: complete ({len(src)} keys)", flush=True)
        return
    print(f"{name}: {len(pending)} to translate", flush=True)
    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        futures = {pool.submit(one_key, src, k): k for k in pending}
        n = 0
        for fut in as_completed(futures):
            k, fa = fut.result()
            done[k] = fa
            n += 1
            if n % 40 == 0:
                out_path.write_text(json.dumps(done, ensure_ascii=False), encoding="utf-8")
                print(f"  {name} {n}/{len(pending)}", flush=True)
    for k, v in src.items():
        if k not in done:
            done[k] = v
    out_path.write_text(json.dumps(done, ensure_ascii=False), encoding="utf-8")
    print(f"{name}: done {len(done)}", flush=True)


def main() -> None:
    for p in sorted(tr.IN_DIR.glob("*.json")):
        finish_chunk(p.name)
    tr.merge()


if __name__ == "__main__":
    main()
