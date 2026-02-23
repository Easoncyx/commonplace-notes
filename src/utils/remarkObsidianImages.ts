import { Plugin } from 'unified';
import { visit } from 'unist-util-visit';
import { Image } from 'mdast';

const OBSIDIAN_IMAGE_SCHEME = 'obsidian-image:';

export interface ObsidianImagesOptions {
	resolveImage: (imageName: string) => Promise<string | null>;
}

/**
 * Preprocess raw markdown to convert Obsidian ![[image]] embeds into
 * standard markdown image syntax with a custom URL scheme.
 *
 * This must run BEFORE remark-parse, because remark's tokenizer interprets
 * `![` as the start of a standard image and splits the AST nodes so that
 * a remark plugin never sees the full `![[...]]` in a single text node.
 */
export function preprocessObsidianImages(markdown: string): string {
	return markdown.replace(/!\[\[(.*?)\]\]/g, (_match, content: string) => {
		const parts = content.split('|');
		const imagePath = parts[0].trim();
		const sizeOrAlt = parts[1]?.trim();

		let alt = imagePath;
		let suffix = '';
		if (sizeOrAlt && /^\d+$/.test(sizeOrAlt)) {
			suffix = `|w=${sizeOrAlt}`;
		} else if (sizeOrAlt) {
			alt = sizeOrAlt;
		}

		// URL-encode the path so spaces don't break remark-parse's image syntax
		const encodedPath = encodeURIComponent(imagePath);
		const encodedSuffix = suffix ? '|' + suffix.slice(1) : '';
		return `![${alt}](${OBSIDIAN_IMAGE_SCHEME}${encodedPath}${encodedSuffix})`;
	});
}

/**
 * Remark plugin that resolves image URLs.
 * - Images with the obsidian-image: scheme (produced by preprocessObsidianImages)
 *   are resolved via the vault and rewritten to the published asset URL.
 * - Standard markdown images with relative paths are also resolved.
 * - External URLs (http://, https://, data:) are left unchanged.
 */
const remarkObsidianImages: Plugin<[ObsidianImagesOptions]> = (options) => {
	return async (tree) => {
		const promises: Promise<void>[] = [];

		visit(tree, 'image', (node: Image) => {
			if (node.url.startsWith(OBSIDIAN_IMAGE_SCHEME)) {
				// Obsidian embed: extract image name and optional width
				const raw = node.url.slice(OBSIDIAN_IMAGE_SCHEME.length);
				const [encodedName, ...params] = raw.split('|');
				const imageName = decodeURIComponent(encodedName);
				let width: string | undefined;
				for (const p of params) {
					const [key, val] = p.split('=');
					if (key === 'w') width = val;
				}

				promises.push((async () => {
					const resolvedUrl = await options.resolveImage(imageName);
					if (resolvedUrl) {
						node.url = resolvedUrl;
						if (width) {
							(node as any).data = {
								...(node as any).data,
								hProperties: { ...((node as any).data?.hProperties), width }
							};
						}
					} else {
						// Replace with missing-image placeholder
						(node as any).type = 'html';
						(node as any).value = `<span class="missing-image">[Missing image: ${imageName}]</span>`;
						delete (node as any).url;
						delete (node as any).alt;
					}
				})());
			} else if (!/^(https?:\/\/|data:)/.test(node.url)) {
				// Standard markdown image with relative path
				promises.push((async () => {
					const resolvedUrl = await options.resolveImage(node.url);
					if (resolvedUrl) {
						node.url = resolvedUrl;
					}
				})());
			}
		});

		await Promise.all(promises);
	};
};

export default remarkObsidianImages;
