# Commonplace Notes (Obsidian plugin)

An Obsidian plugin that publishes markdown notes with sliding panes and interlinked navigation to AWS S3 or local file systems.

## Features

- **Multi-profile publishing** — Maintain separate publishing profiles (AWS S3 or local) with independent settings
- **Wikilink resolution** — Obsidian `[[wikilinks]]` are converted to navigable HTML links between published notes
- **Image support** — Obsidian `![[image.png]]` embeds and standard `![alt](path)` images are resolved from the vault, deduplicated via SHA-1 hashing, and uploaded alongside notes
- **Backlink tracking** — Published notes include backlink metadata for bidirectional navigation
- **Content indexing** — Optional FlexSearch/Fuse.js content index for client-side search
- **Publish status indicators** — Visual indicators in the file explorer show which notes are published per profile
- **CloudFront invalidation** — Configurable automatic cache invalidation after publishing

## Build

```bash
npm install
npm run dev    # watch mode
npm run build  # production build (type-check + minify)
```

## Install to Obsidian Vault

```bash
./install-local.sh --build
```

Copies `main.js`, `manifest.json`, and `styles.css` to the configured vault plugin directory. Reload the plugin in Obsidian after installing.

## Usage

1. Configure a publishing profile in the plugin settings (AWS CLI or Local)
2. Add publish contexts to notes via the `Toggle publishing context` command
3. Publish using one of: `Publish current note`, `Publish active and connected notes`, `Publish updates since last full publish`, or `Publish all notes`

## Image Publishing

Embedded images in both Obsidian and standard markdown syntax are automatically handled during publishing:

- `![[screenshot.png]]` — Obsidian image embeds (with optional `![[image.png|400]]` width syntax)
- `![alt text](path/to/image.png)` — Standard markdown images with relative paths
- External URLs (`https://...`) are left unchanged

Images are read from the vault, hashed with SHA-1 for deduplication, staged locally, and uploaded to an `assets/` prefix on S3 using `aws s3 sync` (skips files already present).

## S3 Path Structure

```
s3://{bucket}/{s3Prefix}
  notes/           # Note JSON files
  assets/          # Image files ({sha1hash}.{ext})
  static/
    mapping/       # slug-to-uid.json, uid-to-hash.json
    content/       # contentIndex.json
```
