#!/bin/sh
# Σβήνει το περιεχόμενο από το KV, ώστε η σελίδα να ξαναγυρίσει στο content.json
# που είναι μέσα στο deployment (χρήσιμο για "επαναφορά στις εργοστασιακές ρυθμίσεις").
set -e
NS_ID="ff4bb51f53f14cde941e6e80044cb308"
cd "$(dirname "$0")"
npx wrangler kv key delete content --namespace-id "$NS_ID" --remote
echo "✓ το site δείχνει ξανά το content.json του deployment"
