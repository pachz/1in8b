
import json, re, time, sys
from pathlib import Path
from deep_translator import MyMemoryTranslator

PH = re.compile(r"(\{\d+\}|\{\@\w+\}|\{\{[^}]+\}\}|\\n)")
AR = re.compile(r"[\u0600-\u06FF]")

def protect(s):
    slots=[]
    def repl(m):
        slots.append(m.group(0)); return "[[%d]]"%(len(slots)-1)
    return PH.sub(repl,s), slots

def restore(s, slots):
    def repl(m):
        i=int(m.group(1)); return slots[i] if i<len(slots) else m.group(0)
    return re.sub(r"\[\[(\d+)\]\]", repl, s)

def run(chunk_name):
    root = Path(__file__).resolve().parents[1]
    src = json.loads((root/"data/i18n-chunks"/chunk_name).read_text())
    outp = root/"data/i18n-fa-out"/chunk_name
    done = json.loads(outp.read_text()) if outp.exists() else {}
    tr = MyMemoryTranslator(source="en-US", target="fa-IR")
    pending = [(k,v) for k,v in src.items() if k not in done or not AR.search(str(done.get(k,"")))]
    print(chunk_name, "pending", len(pending), flush=True)
    for i,(k,v) in enumerate(pending,1):
        try:
            p,slots = protect(v)
            pieces=[]
            buf=p
            while buf:
                c,buf=buf[:450],buf[450:]
                try: pieces.append(tr.translate(c))
                except Exception:
                    time.sleep(1); 
                    try: pieces.append(tr.translate(c))
                    except Exception: pieces.append(c)
                time.sleep(0.15)
            done[k]=restore("".join(pieces), slots)
        except Exception as e:
            done[k]=v
        if i%30==0:
            outp.write_text(json.dumps(done, ensure_ascii=False))
            print(chunk_name, i, "/", len(pending), flush=True)
    outp.write_text(json.dumps(done, ensure_ascii=False))
    print(chunk_name, "DONE", len(done), flush=True)
    return chunk_name, len(done)

if __name__=="__main__":
    print(run(sys.argv[1]))
