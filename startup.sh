#!/bin/sh
set -eu
# Works from the platform workspace (/workspace) and from a local checkout.
cd /workspace 2>/dev/null || cd "$(dirname "$0")"

if curl -sf -o /dev/null --max-time 1 http://127.0.0.1:8080/; then
  exit 0
fi

npm run dev > /tmp/rutagourmet-dev.log 2>&1 &
exit 0
