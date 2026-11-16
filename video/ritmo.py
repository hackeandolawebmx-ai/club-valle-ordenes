# Quita los tiempos muertos: comprime las pausas de cada segmento grabado y ajusta cada tramo
# a la duración de su oración. Uso: python3 ritmo.py   (lee timeline.json en el cwd y /tmp/vid/segN.webm)
import json, subprocess, re, os
V = os.environ.get("VID_DIR", "/tmp/vid")
T = json.load(open("timeline.json"))["sent"]
vo = lambda i: T[i]["end"] - T[i]["start"]
ANCH = {"1": [0.0, 7.0], "2": [5.0], "3": [3.3], "4": [0.0, 6.8], "5": [0.0, 18.4]}
GAP, TAIL, KEEP, MAXV = 0.5, 1.2, 0.9, 1.25
def dur(f): return float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).decode())
def freezes(f):
    o = subprocess.run(["ffmpeg", "-hide_banner", "-i", f, "-vf", "freezedetect=n=0.003:d=0.5", "-f", "null", "-"], capture_output=True, text=True).stderr
    s = [float(x) for x in re.findall(r"freeze_start: ([0-9.]+)", o)]; e = [float(x) for x in re.findall(r"freeze_end: ([0-9.]+)", o)]
    return list(zip(s, e + [None] * (len(s) - len(e))))
out = {}
for n in "12345":
    src = f"{V}/seg{n}.webm"; nat = dur(src); fr = [(a, b if b else nat) for a, b in freezes(src)]
    pts = [nat + float(a[3:]) if isinstance(a, str) else a for a in ANCH[n]] + [nat]
    ids = [i for i, s in enumerate(T) if s["group"] == n]; pieces = []; starts = []; t0 = 0.0
    for k, i in enumerate(ids):
        a, b = pts[k], pts[k + 1]
        keep = []; cur = a
        for fs, fe in sorted(fr):
            if fe <= a or fs >= b: continue
            fs, fe = max(fs, a), min(fe, b)
            if fs > cur: keep.append((cur, fs))
            keep.append((fs, min(fs + KEEP, fe))); cur = fe
        if cur < b: keep.append((cur, b))
        keep = [(x, y) for x, y in keep if y - x > 0.03]
        c = sum(y - x for x, y in keep); target = vo(i) + (TAIL if k == len(ids) - 1 else GAP)
        sp = min(max(c / target, 1.0), MAXV); real = c / sp
        fc = ";".join(f"[0:v]trim={x:.3f}:{y:.3f},setpts=PTS-STARTPTS,fps=25[p{j}]" for j, (x, y) in enumerate(keep))
        fc += ";" + "".join(f"[p{j}]" for j in range(len(keep))) + f"concat=n={len(keep)}:v=1[c];[c]setpts=PTS/{sp:.4f}"
        if real < target: fc += f",tpad=stop_mode=clone:stop_duration={target - real:.3f}"
        fc += "[o]"; fn = f"{V}/seg{n}_p{k}.mp4"
        subprocess.run(["ffmpeg", "-y", "-i", src, "-filter_complex", fc, "-map", "[o]", "-an", "-pix_fmt", "yuv420p", "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", fn], check=True, stderr=subprocess.DEVNULL)
        pieces.append(fn); starts.append(round(t0 + 0.1, 2)); t0 += max(real, target)
    open(f"{V}/seg{n}_l.txt", "w").write("".join(f"file '{p}'\n" for p in pieces))
    subprocess.run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", f"{V}/seg{n}_l.txt", "-c", "copy", f"{V}/seg{n}_t.mp4"], check=True, stderr=subprocess.DEVNULL)
    out[n] = starts; print(n, "origen", round(nat, 1), "->", round(dur(f"{V}/seg{n}_t.mp4"), 1), starts)
json.dump(out, open("anchors.json", "w"))
