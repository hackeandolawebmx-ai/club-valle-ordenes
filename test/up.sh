#!/bin/bash
# levanta Postgres local + PostgREST + mock (réplica de pruebas)
pgrep -f "pgtest/data" >/dev/null || su postgres -c "/usr/lib/postgresql/16/bin/pg_ctl -D /home/claude/pgtest/data -o '-k /home/claude/pgtest -c listen_addresses=' -l /tmp/pg.log start" >/dev/null 2>&1
sleep 2
pgrep -x postgrest >/dev/null || (cd /home/claude/pgrst && PGRST_DB_URI="postgres://authenticator:authpass@%2Fhome%2Fclaude%2Fpgtest/cv2" PGRST_DB_SCHEMAS=public PGRST_DB_ANON_ROLE=anon PGRST_JWT_SECRET="cv-local-secret-cv-local-secret-1234" PGRST_SERVER_PORT=3001 PGRST_SERVER_HOST=127.0.0.1 nohup ./postgrest >/tmp/pgrst.log 2>&1 &)
pgrep -f mock-server.mjs >/dev/null || (cd /home/claude/club-valle/app && DIST=dist-local nohup node test/mock-server.mjs >/tmp/mock.log 2>&1 &)
sleep 3; curl -s -o /dev/null -w "mock %{http_code}\n" http://127.0.0.1:3000/
