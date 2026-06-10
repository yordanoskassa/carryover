#!/usr/bin/env bash
# Run Elastic Open Crawler over every config in this directory (or the ones
# passed as arguments). Reads ES credentials from the repo .env.
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
set -a
source "$DIR/../.env"
set +a

CONFIGS=("$@")
if [ ${#CONFIGS[@]} -eq 0 ]; then
  CONFIGS=($(cd "$DIR" && ls *.yml))
fi

for cfg in "${CONFIGS[@]}"; do
  echo "=== Crawling: $cfg ==="
  docker run --rm \
    -e ES_HOST="$ELASTICSEARCH_URL" \
    -e ES_API_KEY="$ELASTICSEARCH_API_KEY" \
    -v "$DIR/$cfg:/home/app/config/crawler.yml" \
    --entrypoint "" \
    docker.elastic.co/integrations/crawler:1.0.0 \
    bin/crawler crawl /home/app/config/crawler.yml || echo "!!! $cfg failed, continuing"
  echo "=== Done: $cfg ==="
done
