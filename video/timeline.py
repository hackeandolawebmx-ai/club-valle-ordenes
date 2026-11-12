# Uso: python3 timeline.py [voz.wav]  -> timeline.json (tiempos de cada oración en la voz)
import json, sys, re, subprocess
S=json.load(open('script.json'))['sent']; words=[len(re.findall(r'\w+',t)) for t,_ in S]
if len(sys.argv)>1:
    wav=sys.argv[1]; dur=float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',wav]).decode())
    out=subprocess.run(['ffmpeg','-hide_banner','-i',wav,'-af','silencedetect=noise=-38dB:d=0.18','-f','null','-'],capture_output=True,text=True).stderr
    st=[float(x) for x in re.findall(r'silence_start: ([\d.]+)',out)]; en=[float(x) for x in re.findall(r'silence_end: ([\d.]+)',out)]
    gaps=[(a+ (b-a)/2) for a,b in zip(st,en) if b>a]  # centros de pausa
    lead=en[0] if st and st[0]<0.05 else 0.0
    tail=st[-1] if st and st[-1]>dur-1.2 else dur
else: dur=57.0; gaps=[]; lead=0.1; tail=56.8
tot=sum(words); pause=0.0; t=lead; bounds=[lead]
for w in words[:-1]:
    t+= (tail-lead)*w/tot; bounds.append(t)
bounds.append(tail)
# ajusta cada frontera a la pausa detectada más cercana (±0.7 s)
for i in range(1,len(bounds)-1):
    c=[g for g in gaps if abs(g-bounds[i])<0.7]
    if c: bounds[i]=min(c,key=lambda g:abs(g-bounds[i]))
sent=[]
for i,(t,g) in enumerate(S): sent.append({'text':t,'group':g,'start':round(bounds[i]+(0.08 if i else 0),2),'end':round(bounds[i+1]-0.08,2)})
json.dump({'dur':dur,'sent':sent},open('timeline.json','w'),ensure_ascii=False,indent=1); print(dur,[(s['group'],s['start'],s['end']) for s in sent])
