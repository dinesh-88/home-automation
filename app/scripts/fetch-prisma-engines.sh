#!/usr/bin/env bash
# Run on a machine WITH internet. Downloads Prisma's Linux engines into
# vendor/prisma-engines so the app can install and run on an offline Linux box
# (Prisma fetches engines from binaries.prisma.sh, not from the npm registry).
# Usage: scripts/fetch-prisma-engines.sh [target ...]
#   default targets: debian-openssl-3.0.x debian-openssl-1.1.x
#   arm64 boxes:     linux-arm64-openssl-3.0.x linux-arm64-openssl-1.1.x
set -euo pipefail
cd "$(dirname "$0")/.."

hash=$(node -p "require('@prisma/engines-version/package.json').prisma.enginesVersion")
targets=("$@")
[ ${#targets[@]} -eq 0 ] && targets=(debian-openssl-3.0.x debian-openssl-1.1.x)

for t in "${targets[@]}"; do
  dir="vendor/prisma-engines/$t"
  mkdir -p "$dir"
  for f in libquery_engine.so.node schema-engine; do
    echo "fetching $t/$f"
    curl -fsSL "https://binaries.prisma.sh/all_commits/$hash/$t/$f.gz" | gunzip > "$dir/$f"
  done
  chmod +x "$dir/schema-engine"
done
echo "$hash" > vendor/prisma-engines/VERSION
du -sh vendor/prisma-engines
