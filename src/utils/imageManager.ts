import { TFile } from 'obsidian';
import CommonplaceNotesPlugin from '../main';
import { PathUtils } from './path';
import { Logger } from './logging';

interface StagedImage {
	vaultPath: string;
	hash: string;
	extension: string;
	url: string;
}

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.bmp', '.ico']);

export class ImageManager {
	private plugin: CommonplaceNotesPlugin;
	private stagedImages: Map<string, StagedImage>;

	constructor(plugin: CommonplaceNotesPlugin) {
		this.plugin = plugin;
		this.stagedImages = new Map();
	}

	async processImage(imageName: string, currentFilePath: string, profileId: string): Promise<string | null> {
		try {
			// Resolve the image file in the vault
			const file = this.plugin.app.metadataCache.getFirstLinkpathDest(imageName, currentFilePath);
			if (!(file instanceof TFile)) {
				Logger.warn(`Image not found in vault: ${imageName} (referenced from ${currentFilePath})`);
				return null;
			}

			// Validate it's an image extension
			const ext = '.' + file.extension.toLowerCase();
			if (!IMAGE_EXTENSIONS.has(ext)) {
				return null;
			}

			// Return cached URL if already processed
			if (this.stagedImages.has(file.path)) {
				return this.stagedImages.get(file.path)!.url;
			}

			// Read binary content
			const data = await this.plugin.app.vault.readBinary(file);

			// Compute SHA-1 hash
			const hash = await this.hashBinary(data);

			// Write to staging directory
			const stagedAssetsDir = this.plugin.profileManager.getStagedAssetsDir(profileId);
			await PathUtils.ensureDirectory(this.plugin, stagedAssetsDir);
			const stagedPath = `${stagedAssetsDir}/${hash}${ext}`;

			// Write the binary data
			await this.plugin.app.vault.adapter.writeBinary(stagedPath, data);

			// Build the URL
			const profile = this.plugin.settings.publishingProfiles.find(p => p.id === profileId);
			let url: string;
			if (profile?.baseUrl) {
				const base = profile.baseUrl.replace(/\/?$/, '/');
				url = `${base}assets/${hash}${ext}`;
			} else {
				url = `assets/${hash}${ext}`;
			}

			// Cache
			const staged: StagedImage = {
				vaultPath: file.path,
				hash,
				extension: ext,
				url
			};
			this.stagedImages.set(file.path, staged);

			Logger.debug(`Staged image: ${file.path} → ${stagedPath} (${hash}${ext})`);
			return url;
		} catch (error) {
			Logger.error(`Error processing image ${imageName}:`, error);
			return null;
		}
	}

	private async hashBinary(data: ArrayBuffer): Promise<string> {
		const hashBuffer = await crypto.subtle.digest('SHA-1', data);
		const hashArray = Array.from(new Uint8Array(hashBuffer));
		return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
	}

	clear() {
		this.stagedImages.clear();
	}
}
