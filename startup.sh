#!/bin/sh
set -eu
# Works from the platform workspace (/workspace) and from a local checkout.
cd /workspace 2>/dev/null || cd "$(dirname "$0")"

# Up already? `PORT` is set when another host serves the preview on its own
# port (Arena); otherwise this is the usual 8080 probe.
if curl -sf -o /dev/null --max-time 1 "http://127.0.0.1:${PORT:-8080}/"; then
  exit 0
fi

# `npm run dev` (never `vite` directly) keeps `.grok/app-env.json` in the env.
npm run dev > /tmp/rutagourmet-dev.log 2>&1 &
exit 0
