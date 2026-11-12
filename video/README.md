# Video de la demo (voz de Daro + subtítulos)

Pipeline usado el 11-12 nov 2026. Los scripts tienen rutas fijas a `/tmp/vid` y `/tmp/vid2`; ajústalas si cambias de entorno.

1. Levantar la réplica local: `bash test/up.sh` (Postgres + PostgREST + mock). Reiniciar datos: aplicar `supabase/seed/seed_demo.sql` a la base local `cv2`.
2. Grabar segmentos: `node test/video.cjs` (Playwright; deja `/tmp/vid/seg1..5.webm` y `caps.json`).
3. Voz: generar en Google AI Studio (Speech, voz Daro, estilo español mexicano de Monterrey) con el texto de `script.json`; guardar el WAV como `voz_daro.wav`.
4. Tiempos: `python3 timeline.py voz_daro.wav` (usa las pausas del audio; el cálculo final se hizo con alineación por programación dinámica sobre las pausas) y `python3 compose2.py voz_daro.wav` (arma subtítulos, cards, mezcla y normaliza a -14 LUFS).

La voz del repo (`voz_daro.wav`) corresponde al guion actual de `script.json`. Si cambias el guion hay que regenerarla.
