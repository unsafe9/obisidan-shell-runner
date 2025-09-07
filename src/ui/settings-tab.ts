import { App, PluginSettingTab, Setting, Notice, Modal, TextAreaComponent, TextComponent, ToggleComponent } from 'obsidian';
import { CommandScript, PluginSettings } from '../types';
import { ParameterHelpModal } from './command-selector-modal';
import ShellRunnerPlugin from '../main';
import { TerminalExecutor } from '../utils/terminal-executor';

export class ShellRunnerSettingTab extends PluginSettingTab {
    plugin: ShellRunnerPlugin;

    constructor(app: App, plugin: ShellRunnerPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    /**
     * Gets the vault path safely using official API methods.
     */
    private getVaultPath(): string {
        return (this.app.vault.adapter as any).basePath || '';
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: 'Command Line Launcher Settings' });

        // General settings
        this.createGeneralSettings(containerEl);

        // Commands list
        this.createCommandsList(containerEl);

        // Add new command button
        this.createAddCommandButton(containerEl);
    }

    private createGeneralSettings(containerEl: HTMLElement): void {
        containerEl.createEl('h3', { text: 'General Settings' });

        new Setting(containerEl)
            .setName('Default Working Directory')
            .setDesc('Default directory for command execution')
            .addText(text => text
                .setPlaceholder(this.getVaultPath() || '/path/to/default/directory')
                .setValue(this.plugin.settings.defaultWorkingDirectory)
                .onChange(async (value) => {
                    this.plugin.settings.defaultWorkingDirectory = value;
                    await this.plugin.saveSettings();
                }))
            .addButton(button => button
                .setButtonText('Use Vault')
                .setTooltip('Set vault directory as default')
                .onClick(async () => {
                    const vaultPath = this.getVaultPath();
                    if (vaultPath) {
                        this.plugin.settings.defaultWorkingDirectory = vaultPath;
                        await this.plugin.saveSettings();
                        this.display(); // Refresh UI
                    }
                }));

        new Setting(containerEl)
            .setName('Show Notifications')
            .setDesc('Show execution notifications')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showNotifications)
                .onChange(async (value) => {
                    this.plugin.settings.showNotifications = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Maximum Output Length')
            .setDesc('Maximum length of command output (bytes)')
            .addText(text => text
                .setPlaceholder('10000')
                .setValue(this.plugin.settings.maxOutputLength.toString())
                .onChange(async (value) => {
                    const numValue = parseInt(value);
                    if (!isNaN(numValue) && numValue > 0) {
                        this.plugin.settings.maxOutputLength = numValue;
                        await this.plugin.saveSettings();
                    }
                }));

        new Setting(containerEl)
            .setName('Shell Program')
            .setDesc('Shell program to use for command execution')
            .addDropdown(dropdown => {
                // Create temporary TerminalExecutor to get detected shell
                const terminalExecutor = new TerminalExecutor(this.app, this.plugin.settings);
                const detectedShell = terminalExecutor.getDetectedShellName();

                dropdown.addOption('auto', `Auto-detect system default (${detectedShell})`);

                if (process.platform === 'win32') {
                    // Windows shells
                    dropdown
                        .addOption('cmd', 'Command Prompt (cmd)')
                        .addOption('powershell', 'PowerShell');
                } else {
                    // Unix-like shells
                    dropdown
                        .addOption('bash', 'Bash')
                        .addOption('zsh', 'Zsh')
                        .addOption('busybox', 'BusyBox')
                        .addOption('csh', 'C Shell')
                        .addOption('dash', 'Dash');
                }

                return dropdown
                    .setValue(this.plugin.settings.shellProgram)
                    .onChange(async (value: any) => {
                        this.plugin.settings.shellProgram = value;
                        await this.plugin.saveSettings();
                    });
            });

        // Login Shell option (Unix only)
        if (process.platform !== 'win32') {
            new Setting(containerEl)
                .setName('Use Login Shell')
                .setDesc('Use login shell (-l flag) to load profile files (.profile, .zprofile, etc.). Enable this if PATH or environment variables are not loaded properly.')
                .addToggle(toggle => toggle
                    .setValue(this.plugin.settings.useLoginShell)
                    .onChange(async (value) => {
                        this.plugin.settings.useLoginShell = value;
                        await this.plugin.saveSettings();
                    }));
        }

    }

    private createCommandsList(containerEl: HTMLElement): void {
        const commandsHeader = containerEl.createDiv();
        commandsHeader.style.display = 'flex';
        commandsHeader.style.justifyContent = 'space-between';
        commandsHeader.style.alignItems = 'center';
        commandsHeader.style.marginTop = '30px';

        commandsHeader.createEl('h3', { text: 'Command List' });

        const commandsContainer = containerEl.createDiv('commands-container');

        this.plugin.settings.commands.forEach((command, index) => {
            this.createCommandSetting(commandsContainer, command, index);
        });
    }

    private createCommandSetting(container: HTMLElement, command: CommandScript, index: number): void {
        const commandEl = container.createDiv('command-setting');
        commandEl.style.border = '1px solid var(--background-modifier-border)';
        commandEl.style.borderRadius = '6px';
        commandEl.style.padding = '10px 12px';
        commandEl.style.marginBottom = '8px';
        commandEl.style.backgroundColor = 'var(--background-secondary)';
        commandEl.style.transition = 'all 0.2s ease';
        commandEl.style.cursor = 'default';

        // Hover effect
        commandEl.addEventListener('mouseenter', () => {
            commandEl.style.borderColor = 'var(--interactive-accent)';
            commandEl.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
        });
        commandEl.addEventListener('mouseleave', () => {
            commandEl.style.borderColor = 'var(--background-modifier-border)';
            commandEl.style.boxShadow = 'none';
        });

        // Compact header (all info in one line)
        const headerEl = commandEl.createDiv();
        headerEl.style.display = 'flex';
        headerEl.style.justifyContent = 'space-between';
        headerEl.style.alignItems = 'center';
        headerEl.style.marginBottom = '8px';

        // Left: name and description
        const leftEl = headerEl.createDiv();
        leftEl.style.flex = '1';
        leftEl.style.minWidth = '0'; // Handle text overflow

        const titleEl = leftEl.createEl('span', { text: command.name || `Command ${index + 1}` });
        titleEl.style.fontWeight = '600';
        titleEl.style.fontSize = '15px';
        titleEl.style.color = 'var(--text-normal)';

        if (command.description) {
            const descEl = leftEl.createEl('span', { text: ` • ${command.description}` });
            descEl.style.fontSize = '13px';
            descEl.style.color = 'var(--text-muted)';
            descEl.style.marginLeft = '8px';
            descEl.style.fontWeight = '400';
        }

        // Right: controls
        const controlsEl = headerEl.createDiv();
        controlsEl.style.display = 'flex';
        controlsEl.style.gap = '6px';
        controlsEl.style.alignItems = 'center';

        // Background execution indicator
        if (command.backgroundExecution) {
            const bgLabel = controlsEl.createEl('span', { text: 'BG' });
            bgLabel.style.fontSize = '11px';
            bgLabel.style.padding = '3px 6px';
            bgLabel.style.backgroundColor = 'var(--interactive-accent)';
            bgLabel.style.color = 'var(--text-on-accent)';
            bgLabel.style.borderRadius = '4px';
            bgLabel.style.fontWeight = '600';
            bgLabel.style.letterSpacing = '0.5px';
        }

        // Enable toggle
        const enableToggle = controlsEl.createEl('input');
        enableToggle.type = 'checkbox';
        enableToggle.checked = command.enabled;
        enableToggle.style.margin = '0';
        enableToggle.onchange = async () => {
            command.enabled = enableToggle.checked;
            await this.plugin.saveSettings();
        };

        // Edit button
        const editButton = controlsEl.createEl('button', { text: 'Edit' });
        editButton.style.fontSize = '12px';
        editButton.style.padding = '4px 8px';
        editButton.style.borderRadius = '4px';
        editButton.style.border = '1px solid var(--background-modifier-border)';
        editButton.style.backgroundColor = 'var(--background-primary)';
        editButton.style.color = 'var(--text-normal)';
        editButton.style.cursor = 'pointer';
        editButton.style.transition = 'all 0.2s ease';
        editButton.onclick = () => {
            new CommandEditModal(this.app, command, async (updatedCommand) => {
                this.plugin.settings.commands[index] = updatedCommand;
                await this.plugin.saveSettings();
                this.display();
            }, this.plugin).open();
        };

        // Delete button
        const deleteButton = controlsEl.createEl('button', { text: '×' });
        deleteButton.style.fontSize = '16px';
        deleteButton.style.padding = '6px 8px';
        deleteButton.style.backgroundColor = 'var(--interactive-accent)';
        deleteButton.style.color = 'var(--text-on-accent)';
        deleteButton.style.border = 'none';
        deleteButton.style.borderRadius = '5px';
        deleteButton.style.cursor = 'pointer';
        deleteButton.style.transition = 'all 0.2s ease';
        deleteButton.style.fontWeight = '600';
        deleteButton.onclick = async () => {
            if (confirm(`Are you sure you want to delete the "${command.name}" command?`)) {
                this.plugin.settings.commands.splice(index, 1);
                await this.plugin.saveSettings();
                this.display();
            }
        };

        // Compact command preview
        const commandPreview = commandEl.createEl('code', {
            text: command.command.length > 80 ? command.command.substring(0, 80) + '...' : command.command
        });
        commandPreview.style.display = 'block';
        commandPreview.style.padding = '10px 12px';
        commandPreview.style.backgroundColor = 'var(--background-primary)';
        commandPreview.style.borderRadius = '6px';
        commandPreview.style.fontSize = '12px';
        commandPreview.style.fontFamily = 'var(--font-monospace)';
        commandPreview.style.color = 'var(--text-muted)';
        commandPreview.style.wordBreak = 'break-all';
        commandPreview.style.border = '1px solid var(--background-modifier-border-hover)';
        commandPreview.style.lineHeight = '1.4';
    }

    private createAddCommandButton(containerEl: HTMLElement): void {
        const buttonContainer = containerEl.createDiv();
        buttonContainer.style.textAlign = 'center';
        buttonContainer.style.marginTop = '20px';

        const addButton = buttonContainer.createEl('button', { text: '+ Add New Command' });
        addButton.style.backgroundColor = 'var(--interactive-accent)';
        addButton.style.color = 'var(--text-on-accent)';
        addButton.style.padding = '10px 20px';
        addButton.style.borderRadius = '5px';
        addButton.style.border = 'none';
        addButton.style.cursor = 'pointer';

        addButton.onclick = () => {
            const newCommand: CommandScript = {
                id: `cmd-${Date.now()}`,
                name: 'New Command',
                command: '',
                useAbsolutePath: false,
                backgroundExecution: false,
                prompts: [],
                defaultAction: 'none',
                enabled: true,
            };

            new CommandEditModal(this.app, newCommand, async (command) => {
                this.plugin.settings.commands.push(command);
                await this.plugin.saveSettings();
                this.display();
            }, this.plugin).open();
        };
    }
}

/**
 * Command edit modal
 */
class CommandEditModal extends Modal {
    private command: CommandScript;
    private onSave: (command: CommandScript) => void;
    private commandTextArea!: HTMLTextAreaElement;
    private nameInput!: HTMLInputElement;
    private descriptionInput!: HTMLInputElement;
    private workingDirectoryInput!: HTMLInputElement;
    private saveTimeout: NodeJS.Timeout | null = null;

    constructor(app: App, command: CommandScript, onSave: (command: CommandScript) => void, private plugin: ShellRunnerPlugin) {
        super(app);
        this.command = { ...command }; // Create copy
        this.onSave = onSave;
    }

    /**
     * Debounced save function to prevent excessive saves
     */
    private debouncedSave(): void {
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }

        this.saveTimeout = setTimeout(() => {
            // Update command with latest values
            this.command.name = this.nameInput.value;
            this.command.description = this.descriptionInput.value;
            this.command.command = this.commandTextArea.value;
            this.command.workingDirectory = this.workingDirectoryInput.value;

            // Basic validation - only save if name and command are not empty
            if (this.command.name.trim() && this.command.command.trim()) {
                console.log('Auto-saving command:', this.command);
                this.onSave(this.command);
            }
        }, 500); // 500ms delay
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

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        // Set modal to natural size
        contentEl.style.width = 'auto';
        contentEl.style.maxWidth = '90vw';
        contentEl.style.padding = '20px';

        contentEl.createEl('h2', { text: this.command.name ? `Edit "${this.command.name}"` : 'New Command' });

        // Basic information
        this.createBasicSettings(contentEl);

        // Buttons
        this.createAutoSaveNotice(contentEl);
    }


    private createBasicSettings(container: HTMLElement): void {

        // Name
        new Setting(container)
            .setName('Name')
            .setDesc('Display name of the command')
            .addText(text => {
                text.setValue(this.command.name);
                text.onChange((value) => {
                    this.command.name = value;
                    this.debouncedSave();
                });
                // Improve input field style
                text.inputEl.style.width = '100%';
                text.inputEl.style.padding = '8px 12px';
                text.inputEl.style.fontSize = '14px';
                text.inputEl.style.boxSizing = 'border-box';

                // Store reference
                this.nameInput = text.inputEl;
            });

        // Description
        new Setting(container)
            .setName('Description')
            .setDesc('Description of the command (optional)')
            .addText(text => {
                text.setValue(this.command.description || '');
                text.onChange((value) => {
                    this.command.description = value;
                    this.debouncedSave();
                });
                // Improve input field style
                text.inputEl.style.width = '100%';
                text.inputEl.style.padding = '8px 12px';
                text.inputEl.style.fontSize = '14px';
                text.inputEl.style.boxSizing = 'border-box';

                // Store reference
                this.descriptionInput = text.inputEl;
            });

        // Command section (new layout)
        const commandSection = container.createDiv();
        commandSection.style.marginBottom = '20px';

        // Command header with help button
        const commandHeader = commandSection.createDiv();
        commandHeader.style.display = 'flex';
        commandHeader.style.justifyContent = 'space-between';
        commandHeader.style.alignItems = 'center';
        commandHeader.style.marginBottom = '12px';

        const commandLabel = commandHeader.createEl('h4', { text: 'Command' });
        commandLabel.style.margin = '0';
        commandLabel.style.fontSize = '16px';
        commandLabel.style.fontWeight = '600';

        const helpButton = commandHeader.createEl('button', { text: '? Parameters' });
        helpButton.style.padding = '4px 8px';
        helpButton.style.fontSize = '12px';
        helpButton.style.backgroundColor = 'var(--interactive-accent)';
        helpButton.style.color = 'var(--text-on-accent)';
        helpButton.style.border = 'none';
        helpButton.style.borderRadius = '4px';
        helpButton.style.cursor = 'pointer';
        helpButton.style.fontWeight = '500';
        helpButton.onclick = () => {
            new ParameterHelpModal(this.app, this.plugin.settings).open();
        };

        const commandTextArea = commandSection.createEl('textarea');
        commandTextArea.value = this.command.command;
        commandTextArea.placeholder = 'Enter your shell command here...';
        commandTextArea.rows = 4;
        commandTextArea.style.width = '100%';
        commandTextArea.style.padding = '12px';
        commandTextArea.style.fontSize = '14px';
        commandTextArea.style.fontFamily = 'var(--font-monospace)';
        commandTextArea.style.lineHeight = '1.5';
        commandTextArea.style.resize = 'vertical';
        commandTextArea.style.border = '1px solid var(--background-modifier-border)';
        commandTextArea.style.borderRadius = '6px';
        commandTextArea.style.backgroundColor = 'var(--background-primary)';
        commandTextArea.style.color = 'var(--text-normal)';
        commandTextArea.style.minHeight = '100px';
        commandTextArea.style.boxSizing = 'border-box';

        commandTextArea.addEventListener('input', () => {
            this.command.command = commandTextArea.value;
            this.debouncedSave();
        });

        // Store reference to textarea for save validation
        this.commandTextArea = commandTextArea;

        // Working Directory
        new Setting(container)
            .setName('Working Directory')
            .setDesc('Working directory to use when executing the command (optional, uses default directory if empty)')
            .addText(text => {
                text.setPlaceholder(this.getVaultPath() || 'Use default directory');
                text.setValue(this.command.workingDirectory || '');
                text.onChange((value) => {
                    this.command.workingDirectory = value;
                    this.debouncedSave();
                });
                // Improve input field style
                text.inputEl.style.width = '100%';
                text.inputEl.style.padding = '8px 12px';
                text.inputEl.style.fontSize = '14px';
                text.inputEl.style.boxSizing = 'border-box';
                text.inputEl.style.fontFamily = 'var(--font-monospace)';

                // Store reference
                this.workingDirectoryInput = text.inputEl;
            });

        // Use absolute path option
        new Setting(container)
            .setName('Use Absolute Path')
            .setDesc('If checked, use working directory as absolute path; if unchecked, use as relative path to default directory')
            .addToggle(toggle => toggle
                .setValue(this.command.useAbsolutePath || false)
                .onChange((value) => {
                    this.command.useAbsolutePath = value;
                    this.debouncedSave();
                }));

        // Background execution option
        new Setting(container)
            .setName('Background Execution')
            .setDesc('If checked, execution results will be shown only as notifications without result modal')
            .addToggle(toggle => toggle
                .setValue(this.command.backgroundExecution || false)
                .onChange((value) => {
                    this.command.backgroundExecution = value;
                    this.debouncedSave();
                }));

        // Default action option
        new Setting(container)
            .setName('Default Action')
            .setDesc('Action to perform automatically after command execution (instead of showing result modal)')
            .addDropdown(dropdown => dropdown
                .addOption('none', 'Show Result Modal')
                .addOption('copy', 'Copy to Clipboard')
                .addOption('replace', 'Replace Selection')
                .addOption('insert', 'Insert at Cursor')
                .addOption('append', 'Append to Current Note')
                .setValue(this.command.defaultAction || 'none')
                .onChange((value: any) => {
                    this.command.defaultAction = value;
                    this.debouncedSave();
                }));

        // Inline Prompt Settings
        const promptsContainer = container.createDiv();
        promptsContainer.style.marginTop = '20px';

        const promptsHeader = promptsContainer.createEl('h3', { text: 'Prompt Input Settings' });
        promptsHeader.style.marginBottom = '12px';
        promptsHeader.style.fontSize = '16px';
        promptsHeader.style.fontWeight = '600';

        const promptsDesc = promptsContainer.createEl('p', {
            text: 'Configure prompts to receive user input before execution. Use {prompt:keyword} in commands.'
        });
        promptsDesc.style.fontSize = '13px';
        promptsDesc.style.color = 'var(--text-muted)';
        promptsDesc.style.marginBottom = '16px';

        this.createInlinePromptsSection(promptsContainer);

    }

    private createInlinePromptsSection(container: HTMLElement): void {
        // Initialize prompts array if not exists
        if (!this.command.prompts) {
            this.command.prompts = [];
        }

        // Prompts container
        const promptsListContainer = container.createDiv();
        promptsListContainer.style.border = '1px solid var(--background-modifier-border)';
        promptsListContainer.style.borderRadius = '6px';
        promptsListContainer.style.padding = '16px';
        promptsListContainer.style.backgroundColor = 'var(--background-secondary)';
        promptsListContainer.style.marginBottom = '12px';

        // Render existing prompts
        this.renderInlinePrompts(promptsListContainer);

        // Add prompt button
        const addPromptBtn = container.createEl('button', { text: '+ Add Prompt' });
        addPromptBtn.style.padding = '8px 16px';
        addPromptBtn.style.fontSize = '14px';
        addPromptBtn.style.border = '1px solid var(--interactive-accent)';
        addPromptBtn.style.borderRadius = '6px';
        addPromptBtn.style.backgroundColor = 'var(--interactive-accent)';
        addPromptBtn.style.color = 'var(--text-on-accent)';
        addPromptBtn.style.cursor = 'pointer';
        addPromptBtn.style.fontWeight = '500';
        addPromptBtn.onclick = () => {
            this.addInlinePrompt(promptsListContainer);
        };
    }

    private renderInlinePrompts(container: HTMLElement): void {
        container.empty();

        if (this.command.prompts!.length === 0) {
            const emptyMsg = container.createEl('div', { text: 'No prompts configured. Click "Add Prompt" to create one.' });
            emptyMsg.style.color = 'var(--text-muted)';
            emptyMsg.style.fontStyle = 'italic';
            emptyMsg.style.textAlign = 'center';
            emptyMsg.style.padding = '20px';
            return;
        }

        this.command.prompts!.forEach((prompt, index) => {
            this.createInlinePromptItem(container, prompt, index);
        });
    }

    private createInlinePromptItem(container: HTMLElement, prompt: any, index: number): void {
        const promptGroup = container.createDiv();
        promptGroup.style.border = '1px solid var(--background-modifier-border)';
        promptGroup.style.borderRadius = '6px';
        promptGroup.style.padding = '12px';
        promptGroup.style.backgroundColor = 'var(--background-primary)';
        promptGroup.style.marginBottom = '12px';

        // Delete button (top right)
        const deleteBtn = promptGroup.createEl('button', { text: '×' });
        deleteBtn.style.position = 'absolute';
        deleteBtn.style.top = '8px';
        deleteBtn.style.right = '8px';
        deleteBtn.style.fontSize = '16px';
        deleteBtn.style.padding = '4px 8px';
        deleteBtn.style.border = 'none';
        deleteBtn.style.backgroundColor = 'var(--background-modifier-error)';
        deleteBtn.style.color = 'var(--text-on-accent)';
        deleteBtn.style.borderRadius = '4px';
        deleteBtn.style.cursor = 'pointer';
        deleteBtn.onclick = () => {
            this.command.prompts!.splice(index, 1);
            this.renderInlinePrompts(container);
            this.debouncedSave();
        };

        // Make prompt group relative for absolute positioning
        promptGroup.style.position = 'relative';

        // Input fields in a grid
        const fieldsDiv = promptGroup.createDiv();
        fieldsDiv.style.display = 'grid';
        fieldsDiv.style.gridTemplateColumns = '1fr 1fr';
        fieldsDiv.style.gap = '12px';

        // Display Name
        const displayNameDiv = fieldsDiv.createDiv();
        const displayNameLabel = displayNameDiv.createEl('label', { text: 'Display Name' });
        displayNameLabel.style.display = 'block';
        displayNameLabel.style.fontSize = '12px';
        displayNameLabel.style.fontWeight = '500';
        displayNameLabel.style.marginBottom = '4px';
        displayNameLabel.style.color = 'var(--text-normal)';

        const displayNameInput = displayNameDiv.createEl('input');
        displayNameInput.type = 'text';
        displayNameInput.value = prompt.displayName || '';
        displayNameInput.placeholder = 'Enter display name';
        displayNameInput.style.width = '100%';
        displayNameInput.style.padding = '6px 8px';
        displayNameInput.style.fontSize = '13px';
        displayNameInput.style.border = '1px solid var(--background-modifier-border)';
        displayNameInput.style.borderRadius = '4px';
        displayNameInput.style.backgroundColor = 'var(--background-primary)';
        displayNameInput.style.boxSizing = 'border-box';
        displayNameInput.addEventListener('input', () => {
            prompt.displayName = displayNameInput.value;
            this.debouncedSave();
        });

        // Keyword
        const keywordDiv = fieldsDiv.createDiv();
        const keywordLabel = keywordDiv.createEl('label', { text: 'Keyword' });
        keywordLabel.style.display = 'block';
        keywordLabel.style.fontSize = '12px';
        keywordLabel.style.fontWeight = '500';
        keywordLabel.style.marginBottom = '4px';
        keywordLabel.style.color = 'var(--text-normal)';

        const keywordInput = keywordDiv.createEl('input');
        keywordInput.type = 'text';
        keywordInput.value = prompt.name || '';
        keywordInput.placeholder = 'keyword';
        keywordInput.style.width = '100%';
        keywordInput.style.padding = '6px 8px';
        keywordInput.style.fontSize = '13px';
        keywordInput.style.border = '1px solid var(--background-modifier-border)';
        keywordInput.style.borderRadius = '4px';
        keywordInput.style.backgroundColor = 'var(--background-primary)';
        keywordInput.style.fontFamily = 'var(--font-monospace)';
        keywordInput.style.boxSizing = 'border-box';
        keywordInput.addEventListener('input', () => {
            prompt.name = keywordInput.value;
            this.debouncedSave();
        });


    }

    private addInlinePrompt(container: HTMLElement): void {
        if (!this.command.prompts) {
            this.command.prompts = [];
        }

        const newPrompt = {
            name: `prompt${this.command.prompts.length + 1}`,
            displayName: `Prompt ${this.command.prompts.length + 1}`
        };

        this.command.prompts.push(newPrompt);
        this.renderInlinePrompts(container);
        this.debouncedSave();
    }


    private createAutoSaveNotice(container: HTMLElement): void {
        // Auto-save notice
        const noticeDiv = container.createDiv();
        noticeDiv.style.marginTop = '20px';
        noticeDiv.style.padding = '12px';
        noticeDiv.style.backgroundColor = 'var(--background-secondary)';
        noticeDiv.style.borderRadius = '6px';
        noticeDiv.style.fontSize = '13px';
        noticeDiv.style.color = 'var(--text-muted)';
        noticeDiv.style.textAlign = 'center';
        noticeDiv.textContent = '✨ Changes are automatically saved';
    }

    onClose() {
        // Clear any pending save timeout
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
            this.saveTimeout = null;
        }

        const { contentEl } = this;
        contentEl.empty();
    }
}
