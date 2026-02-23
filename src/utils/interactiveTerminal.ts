import { execAsync } from './shell';
import { Logger } from './logging';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const POLL_INTERVAL_MS = 500;
const TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Detect which terminal application is available on the system.
 * Checks for Warp and iTerm2 first, falls back to Terminal.app.
 */
export function detectTerminal(): string {
	if (fs.existsSync('/Applications/Warp.app')) {
		return 'Warp';
	}
	if (fs.existsSync('/Applications/iTerm.app')) {
		return 'iTerm2';
	}
	return 'Terminal';
}

/**
 * Resolve the terminal app to use based on the setting value.
 */
function resolveTerminal(terminalApp: string | undefined): string {
	if (!terminalApp || terminalApp === 'auto') {
		return detectTerminal();
	}
	return terminalApp;
}

/**
 * Escape a string for embedding inside an AppleScript double-quoted string.
 * Escapes backslashes and double quotes. Does NOT escape $ so shell variables
 * expand correctly at runtime in the user's terminal.
 */
function escapeForAppleScript(str: string): string {
	return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * Build the shell command string that will be executed in the terminal.
 * Chains user commands with &&, captures exit code, writes it to a marker file.
 */
function buildShellCommand(commands: string[], markerPath: string): string {
	const chainedCommands = commands.join(' && ');
	// Run the commands, capture exit code, write to marker file, print status
	return `${chainedCommands}; _CPN_EXIT=$?; echo $_CPN_EXIT > "${markerPath}"; if [ $_CPN_EXIT -eq 0 ]; then echo "\\n✅ Credential refresh completed successfully. You can close this window."; else echo "\\n❌ Credential refresh failed (exit code $_CPN_EXIT)."; fi`;
}

/**
 * Generate AppleScript content for Terminal.app
 */
function appleScriptForTerminal(shellCommand: string): string {
	const escaped = escapeForAppleScript(shellCommand);
	return `tell application "Terminal"
	activate
	do script "${escaped}"
end tell`;
}

/**
 * Generate AppleScript content for iTerm2
 */
function appleScriptForITerm(shellCommand: string): string {
	const escaped = escapeForAppleScript(shellCommand);
	return `tell application "iTerm"
	activate
	set newWindow to (create window with default profile)
	tell current session of newWindow
		write text "${escaped}"
	end tell
end tell`;
}

/**
 * Generate AppleScript content for Warp.
 * Warp lacks do script AppleScript support, so we use System Events
 * keystroke injection after activating the app.
 */
function appleScriptForWarp(shellCommand: string): string {
	const escaped = escapeForAppleScript(shellCommand);
	return `tell application "Warp"
	activate
end tell
delay 0.5
tell application "System Events"
	tell process "Warp"
		keystroke "n" using command down
		delay 0.3
		keystroke "${escaped}"
		key code 36
	end tell
end tell`;
}

/**
 * Poll for the marker file and return the exit code written by the terminal command.
 */
async function pollForMarker(markerPath: string): Promise<number> {
	const startTime = Date.now();

	return new Promise<number>((resolve, reject) => {
		const interval = setInterval(() => {
			if (Date.now() - startTime > TIMEOUT_MS) {
				clearInterval(interval);
				reject(new Error('Terminal command timed out after 5 minutes'));
				return;
			}

			if (fs.existsSync(markerPath)) {
				clearInterval(interval);
				try {
					const content = fs.readFileSync(markerPath, 'utf-8').trim();
					const exitCode = parseInt(content, 10);
					resolve(isNaN(exitCode) ? 1 : exitCode);
				} catch {
					resolve(1);
				}
			}
		}, POLL_INTERVAL_MS);
	});
}

/**
 * Clean up temporary files created during terminal execution.
 */
function cleanupTempFiles(...paths: string[]): void {
	for (const p of paths) {
		try {
			if (fs.existsSync(p)) {
				fs.unlinkSync(p);
			}
		} catch {
			// Best-effort cleanup
		}
	}
}

/**
 * Execute commands in an interactive terminal window via AppleScript.
 * Returns a promise that resolves when the commands complete, or rejects on failure/timeout.
 */
export async function execInTerminal(commands: string[], terminalApp?: string): Promise<void> {
	const terminal = resolveTerminal(terminalApp);
	const timestamp = Date.now();
	const markerPath = path.join(os.tmpdir(), `cpn-cred-marker-${timestamp}`);
	const scriptPath = path.join(os.tmpdir(), `cpn-script-${timestamp}.applescript`);

	Logger.debug(`Using terminal: ${terminal}`);
	Logger.debug(`Marker file: ${markerPath}`);

	const shellCommand = buildShellCommand(commands, markerPath);

	let appleScript: string;
	switch (terminal) {
		case 'iTerm2':
			appleScript = appleScriptForITerm(shellCommand);
			break;
		case 'Warp':
			appleScript = appleScriptForWarp(shellCommand);
			break;
		default:
			appleScript = appleScriptForTerminal(shellCommand);
			break;
	}

	try {
		// Write AppleScript to temp file to avoid shell quoting issues
		fs.writeFileSync(scriptPath, appleScript, 'utf-8');

		// Execute the AppleScript
		await execAsync(`osascript "${scriptPath}"`);

		// Poll for completion
		const exitCode = await pollForMarker(markerPath);

		if (exitCode !== 0) {
			throw new Error(`Terminal commands exited with code ${exitCode}`);
		}

		Logger.debug('Terminal commands completed successfully');
	} finally {
		cleanupTempFiles(markerPath, scriptPath);
	}
}
