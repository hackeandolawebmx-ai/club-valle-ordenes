# Uso: python3 compose2.py [voz.wav]   (sin wav = vista previa muda con subtítulos de tiempos estimados)
import json, subprocess, sys, re, os
V='/tmp/vid'; FONT='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'; LOGO='/home/claude/club-valle/brand/logo-horizontal-verde-oak-transparente.png'
wav=sys.argv[1] if len(sys.argv)>1 else None
T=json.load(open('timeline.json'))['sent']; SC=json.load(open('script.json')); LAB=SC['labels']
CAPS=json.load(open(V+'/caps.json'))['caps']
def run(a): subprocess.run(a,check=True,stderr=subprocess.DEVNULL)
def dur(f): return float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',f]).decode())
def chunks(text,maxw=6):
    ws=text.split(); out=[]; cur=[]
    for w in ws:
        cur.append(w)
        if len(cur)>=maxw or re.search(r'[,:.]$',w) and len(cur)>=3: out.append(' '.join(cur)); cur=[]
    if cur: out.append(' '.join(cur))
    if len(out)>1 and len(out[-1].split())<2: out[-2]+=' '+out.pop()
    return out
def wrap(t,n):  # dos líneas balanceadas
    ws=t.split()
    if len(t)<=n or len(ws)<4: return t
    best=min(range(1,len(ws)),key=lambda i:abs(len(' '.join(ws[:i]))-len(' '.join(ws[i:]))))
    return ' '.join(ws[:best])+'\n'+' '.join(ws[best:])
parts=[]; placements=[]  # (voz_start, voz_end, t_video)
gt=0.0  # reloj global del video
def subs_for(sents,base,phone):
    """devuelve lista (t0,t1,texto) en tiempo local del clip"""
    out=[]
    for (vs,ve,tl) in sents:
        text=vs; ch=chunks(text); nw=[len(c.split()) for c in ch]; tot=sum(nw); span=ve; t=tl
        for j,(c,n) in enumerate(zip(ch,nw)):
            d=span*n/tot; out.append((max(0,t-(0.15 if j==0 else 0)-base),t+d-base,wrap(c,26 if phone else 62))); t+=d
    return out
def drawtexts(subs,tag,phone,cur):
    fc=''; 
    for i,(a,b,t) in enumerate(subs):
        fn=f'{tag}_{i}.txt'; open(fn,'w').write(t)
        box=":box=1:boxcolor=0xF5F1E5@0.9:boxborderw=14" if tag=='cis' else ""
        x,y,sz=('60','330',38) if phone else ('(w-text_w)/2',('632' if '\n' in t else '650'),32)
        fc+=f";[{cur}]drawtext=fontfile={FONT}:textfile={fn}:fontcolor=0x31674F:fontsize={sz}:line_spacing=12:x={x}:y={y}{box}:enable='between(t,{a:.2f},{b-0.02:.2f})'[{tag}{i}]"; cur=f'{tag}{i}'
    return fc,cur
vo=lambda i:(T[i]['end']-T[i]['start'])
# intro
d1=vo(0); L0=d1+1.0; placements.append((0,0.5))
ct=['Órdenes de servicio','Mantenimiento e intendencia']
fl=["[0:v]null[b]","[1:v]scale=420:-1[l]","[b][l]overlay=(W-w)/2:120[v0]"]; cur='v0'; y=300
for i,t in enumerate(ct):
    open(f'ci_{i}.txt','w').write(t); fl.append(f"[{cur}]drawtext=fontfile={FONT}:textfile=ci_{i}.txt:fontcolor=0x31674F:fontsize={50 if i==0 else 32}:x=(w-text_w)/2:y={y}[ci{i}]"); cur=f'ci{i}'; y+=72
sb=subs_for([(T[0]['text'],d1,0.5)],0,False); f2,cur=drawtexts(sb,'cis',False,cur)
run(['ffmpeg','-y','-f','lavfi','-i',f'color=c=0xF5F1E5:s=1280x720:d={L0}:r=25','-i',LOGO,'-filter_complex',';'.join(fl)+f2,'-map',f'[{cur}]','-t',str(L0),'-pix_fmt','yuv420p','-c:v','libx264','-preset','veryfast','-crf','21','c_ini.mp4']); parts.append('c_ini.mp4'); gt=L0
idx={g:[i for i,s in enumerate(T) if s['group']==g] for g in '12345'}
for n in '12345':
    src=f'{V}/seg{n}.webm'; nat=dur(src); caps=[c['t'] for c in CAPS[n] if c['text']]
    ids=idx[n]; phone=n!='5'
    # inicio de cada oración dentro del segmento
    anchors={'1':[0.3,5.8,12.2,17.4],'2':[0.5,6.0],'3':[0.5,5.0,None],'4':[0.5,5.5],'5':[0.5,None]}[n]
    if n=='5': anchors=[0.5,nat-3.9]
    local=[]; prev_end=-1
    for k,i in enumerate(ids):
        a=anchors[k] if anchors[k] is not None else prev_end+0.35
        a=max(a,prev_end+0.35); local.append((T[i]['text'],vo(i),a)); prev_end=a+vo(i)
    L=max(nat,prev_end+1.0)
    sents=[(t,d,a) for (t,d,a) in local]
    for (t,d,a),i in zip(local,ids): placements.append((i,gt+a))
    subs=subs_for(sents,0,phone)
    if phone:
        fc="[0:v]scale=-2:690,pad=iw+12:ih+12:6:6:color=0x1d2b24,tpad=stop_mode=clone:stop_duration=30[ph];[1:v][ph]overlay=770:15[v0];[2:v]scale=250:-1[lg];[v0][lg]overlay=60:40[v1]"
        open(f'lab{n}.txt','w').write(LAB[n]); fc+=f";[v1]drawtext=fontfile={FONT}:textfile=lab{n}.txt:fontcolor=0x5FA880:fontsize=26:x=60:y=210[v2]"; cur='v2'
        ins=['-i',src,'-f','lavfi','-i',f'color=c=0xF5F1E5:s=1280x720:r=25:d={L}','-i',LOGO]
    else:
        fc="[0:v]scale=1280:620,pad=1280:720:0:0:color=0xF5F1E5,tpad=stop_mode=clone:stop_duration=30[v0]"; cur='v0'; ins=['-i',src]
    f2,cur=drawtexts(subs,f'sb{n}',phone,cur)
    run(['ffmpeg','-y']+ins+['-filter_complex',fc+f2,'-map',f'[{cur}]','-t',f'{L:.2f}','-r','25','-pix_fmt','yuv420p','-c:v','libx264','-preset','veryfast','-crf','21',f's{n}.mp4']); parts.append(f's{n}.mp4'); gt+=L
# cierre
i=len(T)-1; d=vo(i); Lf=d+3.0; placements.append((i,gt+0.5))
fl=["[0:v]null[b]","[1:v]scale=420:-1[l]","[b][l]overlay=(W-w)/2:140[v0]"]; cur='v0'; y=320
for k,t in enumerate(['Reportar, asignar, atender y medir','en una sola herramienta','Complemento de la app de socios del club']):
    open(f'cf_{k}.txt','w').write(t); fl.append(f"[{cur}]drawtext=fontfile={FONT}:textfile=cf_{k}.txt:fontcolor=0x31674F:fontsize={46 if k==0 else 32}:x=(w-text_w)/2:y={y}[cf{k}]"); cur=f'cf{k}'; y+=70 if k==0 else 50
run(['ffmpeg','-y','-f','lavfi','-i',f'color=c=0xF5F1E5:s=1280x720:d={Lf}:r=25','-i',LOGO,'-filter_complex',';'.join(fl),'-map',f'[{cur}]','-t',str(Lf),'-pix_fmt','yuv420p','-c:v','libx264','-preset','veryfast','-crf','21','c_fin.mp4']); parts.append('c_fin.mp4'); gt+=Lf
open('list.txt','w').write(''.join(f"file '{p}'\n" for p in parts))
run(['ffmpeg','-y','-f','concat','-safe','0','-i','list.txt','-c','copy','mudo.mp4'])
if not wav:
    print('video mudo',dur('mudo.mp4'),'s'); sys.exit()
# audio: cada oración se recorta de la voz y se coloca en su tiempo
f=[];m=[]
for k,(i,tv) in enumerate(sorted(placements,key=lambda p:p[1]) if False else placements):
    pass
pl={}
for i,tv in placements: pl[i]=tv
chain=[]
for i,s in enumerate(T):
    tv=pl[i]; chain.append(f"[0:a]atrim={s['start']-0.05:.2f}:{s['end']+0.12:.2f},asetpts=PTS-STARTPTS,afade=t=in:d=0.02,afade=t=out:st={s['end']-s['start']+0.05:.2f}:d=0.08,adelay={int(tv*1000)}|{int(tv*1000)}[a{i}]")
mix=''.join(f'[a{i}]' for i in range(len(T)))
fc=';'.join(chain)+f";{mix}amix=inputs={len(T)}:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=11[a]"
run(['ffmpeg','-y','-i',wav,'-filter_complex',fc,'-map','[a]','-ar','48000','voz_mix.wav'])
run(['ffmpeg','-y','-i','mudo.mp4','-i','voz_mix.wav','-map','0:v','-map','1:a','-c:v','copy','-c:a','aac','-b:a','192k','-shortest','Club_Valle_Demo_con_voz.mp4'])
print('final',dur('Club_Valle_Demo_con_voz.mp4'))
