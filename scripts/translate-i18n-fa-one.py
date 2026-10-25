#!/usr/bin/env python3
import importlib.util
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location(
    "tr", ROOT / "scripts" / "translate-i18n-fa-batch.py"
)
tr = importlib.util.module_from_spec(spec)
assert spec.loader
spec.loader.exec_module(tr)

if __name__ == "__main__":
    for arg in sys.argv[1:]:
        if arg == "--merge":
            tr.merge()
        else:
            tr.translate_chunk(tr.IN_DIR / arg)
