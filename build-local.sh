#!/bin/bash
# reconstruye y deja la copia local (config apuntando al mock) para pruebas
cd "$(dirname "$0")" && node build.mjs >/dev/null && rm -rf dist-local && cp -r dist dist-local && echo 'window.CV_CONFIG = { url: location.origin, key: "local", demo: true };' > dist-local/config.js
