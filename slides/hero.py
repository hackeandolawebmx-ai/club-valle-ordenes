# Compone hero_plataforma.png: dashboard en ventana + dos celulares. Uso: python3 slides/hero.py <dir_capturas>
import sys, os
from PIL import Image, ImageDraw, ImageFilter
D = sys.argv[1] if len(sys.argv) > 1 else "/tmp/shots3"
W, H = 2920, 1560
out = Image.new("RGBA", (W, H), (0, 0, 0, 0))
def rr(im, r):
    m = Image.new("L", im.size, 0); ImageDraw.Draw(m).rounded_rectangle([0, 0, im.size[0]-1, im.size[1]-1], r, fill=255)
    im = im.convert("RGBA"); im.putalpha(m); return im
def shadow(box, r, blur=40, off=24, a=70):
    s = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(s)
    x0, y0, x1, y1 = box; d.rounded_rectangle([x0, y0+off, x1, y1+off], r, fill=(20, 40, 30, a))
    out.alpha_composite(s.filter(ImageFilter.GaussianBlur(blur)))
# ventana de escritorio
dash = Image.open(f"{D}/dashboard.png").convert("RGB")
dw = 1960; dh = int(dash.height * dw / dash.width); dash = dash.resize((dw, dh), Image.LANCZOS)
bar = 56; wx, wy = 0, 80
win = Image.new("RGB", (dw, dh + bar), (236, 232, 220)); win.paste(dash, (0, bar))
d = ImageDraw.Draw(win)
for i, c in enumerate([(224, 120, 110), (230, 190, 100), (130, 190, 130)]): d.ellipse([24+i*34, 18, 24+i*34+20, 38], fill=c)
d.rounded_rectangle([200, 12, dw-200, 44], 16, fill=(250, 248, 240))
win = rr(win, 28); shadow((wx, wy, wx+dw, wy+dh+bar), 28); out.alpha_composite(win, (wx, wy))
# celulares
def phone(name, x, y, pw):
    im = Image.open(f"{D}/{name}.png").convert("RGB"); ph = int(im.height * pw / im.width); im = im.resize((pw, ph), Image.LANCZOS)
    b = 16; fr = Image.new("RGB", (pw+2*b, ph+2*b), (28, 38, 33)); fr.paste(rr(im, 40).convert("RGB"), (b, b), rr(im, 40))
    fr = rr(fr, 56); shadow((x, y, x+fr.width, y+fr.height), 56, 36, 22, 90); out.alpha_composite(fr, (x, y)); return fr.size
phone("reportar", 1700, 120, 500)
phone("detalle", 2260, 330, 500)
bb = out.getbbox(); out = out.crop((0, 0, min(W, bb[2]+40), min(H, bb[3]+60)))
out.save(os.path.join(os.path.dirname(__file__), "hero_plataforma.png")); print(out.size)
