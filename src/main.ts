import { Plugin, Notice } from 'obsidian';
import { PluginSettings, DEFAULT_SETTINGS, CommandScript } from './types';
import { CommandSelectorModal, ParameterHelpModal } from './ui/command-selector-modal';
import { ShellRunnerSettingTab } from './ui/settings-tab';
import { TerminalExecutor } from './utils/terminal-executor';
import { PromptModal } from './ui/prompt-modal';

export default class ShellRunnerPlugin extends Plugin {
    settings!: PluginSettings;
    terminalExecutor!: TerminalExecutor;
    registeredCommandIds: string[] = [];

    async onload() {
        await this.loadSettings();

        // Initialize terminal executor
        this.terminalExecutor = new TerminalExecutor(this.app, this.settings);

        // Main command: Open command launcher
        this.addCommand({
            id: 'open-command-launcher',
            name: 'Open Command Launcher',
            callback: () => {
                new CommandSelectorModal(
                    this.app,
                    this.settings,
                    () => this.openSettings()
                ).open();
            },
        });

        // Parameter help command
        this.addCommand({
            id: 'show-parameter-help',
            name: 'Show Parameter Help',
            callback: () => {
                new ParameterHelpModal(this.app, this.settings).open();
            },
        });

        // Add settings tab
        this.addSettingTab(new ShellRunnerSettingTab(this.app, this));

        // Register user commands
        this.registerUserCommands();

        // Add ribbon icon (optional)
        this.addRibbonIcon('terminal', 'Shell Runner', () => {
            new CommandSelectorModal(
                this.app,
                this.settings,
                () => this.openSettings()
            ).open();
        });
    }

    onunload() {
        // Add cleanup tasks if needed
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());

        if (!this.settings.defaultWorkingDirectory) {
            this.settings.defaultWorkingDirectory = this.getVaultPath();
            await this.saveSettings();
        }
    }

    async saveSettings() {
        await this.saveData(this.settings);
        // Re-register commands when settings change
        this.refreshUserCommands();
    }

    /**
     * Registers all enabled user commands to Obsidian command palette
     */
    registerUserCommands() {
        this.settings.commands
            .filter(cmd => cmd.enabled)
            .forEach(cmd => this.registerSingleCommand(cmd));
    }

    /**
     * Registers a single command to Obsidian command palette
     */
    registerSingleCommand(script: CommandScript) {
        const commandId = `user-command-${script.id}`;

        // Skip if already registered
        if (this.registeredCommandIds.includes(commandId)) {
            return;
        }

        try {
            this.addCommand({
                id: commandId,
                name: `${script.name}${script.description ? ` - ${script.description}` : ''}`,
                callback: () => this.executeUserCommand(script),
            });

            this.registeredCommandIds.push(commandId);
        } catch (error) {
            console.warn(`Failed to register command ${script.name}:`, error);
        }
    }

    /**
     * Executes a user command
     */
    async executeUserCommand(script: CommandScript) {
        try {
            // Collect parameter context
            const context = await this.terminalExecutor.getParameterContext();

            // If prompts are needed
            if (script.prompts && script.prompts.length > 0) {
                new PromptModal(this.app, script.name, script.prompts, async (promptResults: Record<string, string>) => {
                    try {
                        // Add prompt values to context
                        context.prompts = promptResults;

                        // Substitute parameters
                        const substitutedCommand = this.terminalExecutor.substituteParameters(script.command, context);

                        // Execute command
                        await this.terminalExecutor.executeCommand(script, substitutedCommand, context);
                    } catch (error: any) {
                        new Notice(`Command execution failed: ${error.message}`, 5000);
                    }
                }).open();
            } else {
                // Substitute parameters
                const substitutedCommand = this.terminalExecutor.substituteParameters(script.command, context);

                // Execute command
                await this.terminalExecutor.executeCommand(script, substitutedCommand, context);
            }

        } catch (error: any) {
            new Notice(`Command execution failed: ${error.message}`, 5000);
        }
    }

    /**
     * Refreshes user commands (unregister old ones and register new ones)
     */
    refreshUserCommands() {
        // Note: Obsidian doesn't provide a way to unregister commands
        // So we'll track registered commands and avoid duplicates
        // New commands will be registered, old ones will remain but become inactive
        this.registerUserCommands();
    }

    /**
     * Gets the vault path safely using official API methods.
     */
    private getVaultPath(): string {
        try {
            // Method 1: Use getResourcePath with empty string to get vault root
            const resourcePath = this.app.vault.adapter.getResourcePath("");

            // Remove file:// protocol and decode URI if present
            if (resourcePath.startsWith('file://')) {
                return decodeURIComponent(resourcePath.replace('file://', ''));
            }

            // Method 2: Try to extract from adapter name (fallback)
            const adapterName = this.app.vault.adapter.getName();
            if (adapterName && adapterName !== 'unknown') {
                return adapterName;
            }

            return '';
        } catch (error) {
            // Final fallback
            return '';
        }
    }

    private openSettings() {
        // Helper method to open settings tab
        // Note: Direct access to settings is not available in public API
        // Users can manually open settings via Settings -> Community plugins
        new Notice('Please open Settings → Community plugins → Shell Runner to configure commands');
    }
}
