import { App, FuzzySuggestModal, Notice, Modal, FuzzyMatch } from 'obsidian';
import { CommandScript, PluginSettings } from '../types';
import { TerminalExecutor } from '../utils/terminal-executor';
import { PromptModal } from './prompt-modal';

interface CommandSuggestion {
    script: CommandScript;
    displayText: string;
}

export class CommandSelectorModal extends FuzzySuggestModal<CommandSuggestion> {
    private terminalExecutor: TerminalExecutor;

    constructor(
        app: App,
        private settings: PluginSettings,
        private onSettingsChange: () => void
    ) {
        super(app);

        this.terminalExecutor = new TerminalExecutor(app, settings);

        this.setPlaceholder('Search commands...');
    }

    getItems(): CommandSuggestion[] {
        return this.settings.commands
            .filter(cmd => cmd.enabled)
            .map(script => ({
                script,
                displayText: this.formatDisplayText(script),
            }));
    }

    getItemText(item: CommandSuggestion): string {
        return item.displayText;
    }

    onChooseItem(item: CommandSuggestion, evt: MouseEvent | KeyboardEvent): void {
        // Simple execution only
        this.executeCommand(item.script, evt);
    }

    renderSuggestion(item: FuzzyMatch<CommandSuggestion>, el: HTMLElement): void {
        const container = el.createDiv('command-suggestion');

        // Command name
        const nameEl = container.createDiv('command-name');
        nameEl.textContent = item.item.script.name;
        nameEl.style.fontWeight = 'bold';
        nameEl.style.marginBottom = '4px';

        // Command description
        if (item.item.script.description) {
            const descEl = container.createDiv('command-description');
            descEl.textContent = item.item.script.description;
            descEl.style.fontSize = '0.9em';
            descEl.style.color = 'var(--text-muted)';
            descEl.style.marginBottom = '4px';
        }

        // Command preview
        const previewEl = container.createDiv('command-preview');
        previewEl.innerHTML = `<code>${this.escapeHtml(item.item.script.command)}</code>`;
        previewEl.style.fontSize = '0.8em';
        previewEl.style.color = 'var(--text-faint)';
        previewEl.style.fontFamily = 'var(--font-monospace)';


        // Keyboard hints
        const hintEl = container.createDiv('command-hint');
        hintEl.textContent = `Enter: Execute`;
        hintEl.style.fontSize = '0.7em';
        hintEl.style.color = 'var(--text-faint)';
        hintEl.style.marginTop = '8px';
        hintEl.style.fontStyle = 'italic';
    }


    private async executeCommand(script: CommandScript, evt: MouseEvent | KeyboardEvent): Promise<void> {
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

                        // Execute command (modal is automatically shown by TerminalExecutor)
                        await this.terminalExecutor.executeCommand(script, substitutedCommand, context);
                    } catch (error: any) {
                        new Notice(`Command execution failed: ${error.message}`, 5000);
                    }
                }).open();
            } else {
                // Substitute parameters
                const substitutedCommand = this.terminalExecutor.substituteParameters(script.command, context);

                // Execute command (modal is automatically shown by TerminalExecutor)
                await this.terminalExecutor.executeCommand(script, substitutedCommand, context);
            }

        } catch (error: any) {
            new Notice(`Command execution failed: ${error.message}`, 5000);
        }
    }


    private formatDisplayText(script: CommandScript): string {
        let text = script.name;

        if (script.description) {
            text += ` - ${script.description}`;
        }


        text += ` | ${script.command}`;

        return text;
    }

    private escapeHtml(text: string): string {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

/**
 * Modal to display parameter help
 */
export class ParameterHelpModal extends Modal {
    constructor(app: App, private settings: PluginSettings) {
        super(app);
    }

    /**
     * Returns the list of available parameters.
     */
    private getAvailableParameters(): Array<{ name: string; description: string; example: string }> {
        return [
            {
                name: '{activeNote}',
                description: 'Current active note filename (without extension)',
                example: 'MyNote'
            },
            {
                name: '{activeNotePath}',
                description: 'Full path of the current active note',
                example: 'folder/MyNote.md'
            },
            {
                name: '{activeNoteContent}',
                description: 'Complete content of the current active note',
                example: '# My Note\n\nThis is the content...'
            },
            {
                name: '{selectedText}',
                description: 'Currently selected text',
                example: 'selected content'
            },
            {
                name: '{currentDir}',
                description: 'Directory containing the current note',
                example: 'folder'
            },
            {
                name: '{vaultPath}',
                description: 'Root path of the Obsidian vault',
                example: '/Users/username/MyVault'
            },
            {
                name: '{currentLine}',
                description: 'Content of the current line where cursor is located',
                example: '# This is a heading'
            },
            {
                name: '{currentLineNumber}',
                description: 'Line number where cursor is located (1-based)',
                example: '42'
            },
            {
                name: '{cursorLine}',
                description: 'Cursor line position (0-based)',
                example: '41'
            },
            {
                name: '{cursorColumn}',
                description: 'Cursor column position',
                example: '15'
            },
            {
                name: '{prompt:name}',
                description: 'User input from prompt dialog (use prompt:keyword format)',
                example: '{prompt:filename}, {prompt:searchTerm}, {prompt:targetDir}'
            }
        ];
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        // Set modal width for better table display
        contentEl.style.width = '90vw';
        contentEl.style.maxWidth = '800px';
        contentEl.style.minWidth = '600px';

        contentEl.createEl('h2', { text: 'Available Parameters' });

        const parameters = this.getAvailableParameters();

        const table = contentEl.createEl('table');
        table.style.width = '100%';
        table.style.borderCollapse = 'collapse';
        table.style.tableLayout = 'fixed'; // Fixed layout for better column control

        // Header
        const headerRow = table.createEl('tr');
        headerRow.createEl('th', { text: 'Parameter' }).style.cssText = 'border: 1px solid var(--background-modifier-border); padding: 8px; text-align: left; width: 20%;';
        headerRow.createEl('th', { text: 'Description' }).style.cssText = 'border: 1px solid var(--background-modifier-border); padding: 8px; text-align: left; width: 50%;';
        headerRow.createEl('th', { text: 'Example' }).style.cssText = 'border: 1px solid var(--background-modifier-border); padding: 8px; text-align: left; width: 30%;';

        // Parameter list
        parameters.forEach(param => {
            const row = table.createEl('tr');

            const nameCell = row.createEl('td');
            nameCell.innerHTML = `<code>${param.name}</code>`;
            nameCell.style.cssText = 'border: 1px solid var(--background-modifier-border); padding: 8px; font-family: var(--font-monospace); width: 20%; word-wrap: break-word;';

            const descCell = row.createEl('td', { text: param.description });
            descCell.style.cssText = 'border: 1px solid var(--background-modifier-border); padding: 8px; width: 50%; word-wrap: break-word; line-height: 1.4;';

            const exampleCell = row.createEl('td');
            exampleCell.innerHTML = `<code>${param.example}</code>`;
            exampleCell.style.cssText = 'border: 1px solid var(--background-modifier-border); padding: 8px; font-family: var(--font-monospace); color: var(--text-muted); width: 30%; word-wrap: break-word;';
        });

        // Close button
        const buttonContainer = contentEl.createDiv();
        buttonContainer.style.marginTop = '20px';
        buttonContainer.style.textAlign = 'center';

        const closeButton = buttonContainer.createEl('button', { text: 'Close' });
        closeButton.onclick = () => this.close();
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
