#!/bin/bash
# Install the locally built plugin into the Obsidian vault.
# Usage: ./install-local.sh [--build]
#   --build   Run npm run build before copying (default: copy only)

set -e

VAULT_PLUGIN="/Users/yixchen/Library/CloudStorage/SynologyDrive-m4/Software/ObsidianYixu/.obsidian/plugins/commonplace-notes"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

if [ "$1" = "--build" ]; then
    echo "Building plugin..."
    npm run build --prefix "$SCRIPT_DIR"
    echo ""
fi

echo "Installing to: $VAULT_PLUGIN"
mkdir -p "$VAULT_PLUGIN"
cp "$SCRIPT_DIR/main.js" "$SCRIPT_DIR/manifest.json" "$SCRIPT_DIR/styles.css" "$VAULT_PLUGIN/"

echo "Installed:"
ls -lh "$VAULT_PLUGIN/main.js" "$VAULT_PLUGIN/manifest.json" "$VAULT_PLUGIN/styles.css"
echo ""
echo "Reload the plugin in Obsidian to pick up changes."
