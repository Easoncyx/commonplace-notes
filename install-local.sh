#!/bin/bash
# Install the locally built plugin into the Obsidian vault.
# Usage: ./install-local.sh [--build]
#   --build   Run npm run build before copying (default: copy only)

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Load environment variables
if [ -f "$SCRIPT_DIR/.env" ]; then
    source "$SCRIPT_DIR/.env"
else
    echo "Error: .env file not found. Copy .env.example to .env and set VAULT_PLUGIN_DIR."
    exit 1
fi

if [ -z "$VAULT_PLUGIN_DIR" ]; then
    echo "Error: VAULT_PLUGIN_DIR is not set in .env"
    exit 1
fi

if [ "$1" = "--build" ]; then
    echo "Building plugin..."
    npm run build --prefix "$SCRIPT_DIR"
    echo ""
fi

echo "Installing to: $VAULT_PLUGIN_DIR"
mkdir -p "$VAULT_PLUGIN_DIR"

# Remove old plugin files first to avoid "Operation canceled" on locked files.
# data.json (plugin config) is intentionally preserved.
rm -f "$VAULT_PLUGIN_DIR/main.js" "$VAULT_PLUGIN_DIR/manifest.json" "$VAULT_PLUGIN_DIR/styles.css"
cp "$SCRIPT_DIR/main.js" "$SCRIPT_DIR/manifest.json" "$SCRIPT_DIR/styles.css" "$VAULT_PLUGIN_DIR/"

echo "Installed:"
ls -lh "$VAULT_PLUGIN_DIR/main.js" "$VAULT_PLUGIN_DIR/manifest.json" "$VAULT_PLUGIN_DIR/styles.css"
echo ""
echo "Reload the plugin in Obsidian to pick up changes."
