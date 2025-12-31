#!/usr/bin/env bash
set -euo pipefail

# Simple deployment helper for the Cloudflare Worker.
# - Requires: wrangler installed and authenticated
# - Requires: wrangler.toml present (copy from wrangler.toml.example)

if ! command -v wrangler >/dev/null 2>&1; then
  echo "wrangler is not installed. Install with: npm i -g wrangler"
  exit 1
fi

if [ ! -f "wrangler.toml" ]; then
  echo "wrangler.toml not found. Copy from wrangler.toml.example and edit it."
  exit 1
fi

echo "Deploying Cloudflare Worker..."
wrangler deploy

echo "Done. Your Worker is live once deploy completes."
