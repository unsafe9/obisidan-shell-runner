import { App, Modal, Notice, MarkdownView, TFile } from 'obsidian';
import { CommandExecutionResult } from '../types';

export class CommandResultModal extends Modal {
    private result: CommandExecutionResult;
    private commandName: string;

    constructor(app: App, result: CommandExecutionResult, commandName: string) {
        super(app);
        this.result = result;
        this.commandName = commandName;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        // Modal title (command name)
        const titleEl = contentEl.createEl('h2', { text: this.commandName });
        titleEl.style.marginBottom = '20px';

        // Status information (simple when successful)
        if (this.result.success) {
            const statusEl = contentEl.createEl('div', {
                text: `✅ Success (Exit code: ${this.result.exitCode || 0})`
            });
            statusEl.style.color = 'var(--text-success)';
            statusEl.style.marginBottom = '15px';
            statusEl.style.fontSize = '14px';
        } else {
            const statusEl = contentEl.createEl('div', {
                text: `❌ Failed (Exit code: ${this.result.exitCode || -1})`
            });
            statusEl.style.color = 'var(--text-error)';
            statusEl.style.marginBottom = '15px';
            statusEl.style.fontSize = '14px';
        }

        // Executed command (code block)
        const commandSection = contentEl.createDiv();
        commandSection.createEl('h3', { text: 'Executed Command' });
        const commandEl = commandSection.createEl('pre');
        commandEl.style.backgroundColor = 'var(--background-secondary)';
        commandEl.style.padding = '10px';
        commandEl.style.borderRadius = '5px';
        commandEl.style.fontFamily = 'var(--font-monospace)';
        commandEl.style.fontSize = '13px';
        commandEl.style.marginBottom = '20px';
        commandEl.textContent = this.result.originalCommand;

        // Output results
        if (this.result.output || this.result.error) {
            const outputSection = contentEl.createDiv();
            outputSection.createEl('h3', { text: 'Execution Results' });

            const outputEl = outputSection.createEl('div');
            outputEl.style.backgroundColor = 'var(--background-secondary)';
            outputEl.style.padding = '15px';
            outputEl.style.borderRadius = '5px';
            outputEl.style.fontFamily = 'var(--font-monospace)';
            outputEl.style.fontSize = '13px';
            outputEl.style.whiteSpace = 'pre-wrap';
            outputEl.style.maxHeight = '400px';
            outputEl.style.overflowY = 'auto';
            outputEl.style.marginBottom = '20px';

            const content = this.result.output || this.result.error || '';
            outputEl.textContent = content;

            if (this.result.error && !this.result.success) {
                outputEl.style.color = 'var(--text-error)';
            }
        }

        // Action buttons
        this.createActionButtons(contentEl);
    }

    private createActionButtons(container: HTMLElement) {
        const buttonContainer = container.createDiv();
        buttonContainer.style.display = 'flex';
        buttonContainer.style.flexWrap = 'wrap';
        buttonContainer.style.gap = '10px';
        buttonContainer.style.justifyContent = 'center';
        buttonContainer.style.marginTop = '20px';

        const output = this.result.output || '';

        // Platform-specific shortcut settings
        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
        const modKey = isMac ? 'Cmd' : 'Ctrl';

        // Copy button
        const copyButton = buttonContainer.createEl('button', { text: `📋 Copy (${modKey}+C)` });
        copyButton.style.padding = '8px 16px';
        copyButton.onclick = () => this.copyToClipboard(output);

        // Replace selected text
        const replaceButton = buttonContainer.createEl('button', { text: `🔄 Replace Selection (${modKey}+R)` });
        replaceButton.style.padding = '8px 16px';
        replaceButton.onclick = () => this.replaceSelection(output);

        // Insert at cursor
        const insertButton = buttonContainer.createEl('button', { text: `📍 Insert at Cursor (${modKey}+I)` });
        insertButton.style.padding = '8px 16px';
        insertButton.onclick = () => this.insertAtCursor(output);

        // Append to current note
        const appendButton = buttonContainer.createEl('button', { text: `➕ Append to Note (${modKey}+A)` });
        appendButton.style.padding = '8px 16px';
        appendButton.onclick = () => this.appendToCurrentNote(output);

        // Close button
        const closeButton = buttonContainer.createEl('button', { text: '❌ Close (Esc)' });
        closeButton.style.padding = '8px 16px';
        closeButton.style.backgroundColor = 'var(--interactive-accent)';
        closeButton.style.color = 'var(--text-on-accent)';
        closeButton.onclick = () => this.close();

        // Register keyboard shortcuts (platform-specific)
        if (isMac) {
            this.scope.register(['Mod'], 'c', () => this.copyToClipboard(output));
            this.scope.register(['Mod'], 'r', () => this.replaceSelection(output));
            this.scope.register(['Mod'], 'i', () => this.insertAtCursor(output));
            this.scope.register(['Mod'], 'a', () => this.appendToCurrentNote(output));
        } else {
            this.scope.register(['Ctrl'], 'c', () => this.copyToClipboard(output));
            this.scope.register(['Ctrl'], 'r', () => this.replaceSelection(output));
            this.scope.register(['Ctrl'], 'i', () => this.insertAtCursor(output));
            this.scope.register(['Ctrl'], 'a', () => this.appendToCurrentNote(output));
        }
        this.scope.register([], 'Escape', () => this.close());
    }

    private async copyToClipboard(text: string) {
        await navigator.clipboard.writeText(text);
        new Notice('Copied to clipboard');
        this.close();
    }

    private replaceSelection(text: string) {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (activeView && activeView.editor) {
            const selection = activeView.editor.getSelection();
            if (selection) {
                activeView.editor.replaceSelection(text);
                new Notice('Selected text replaced');
            } else {
                new Notice('No text selected');
            }
        } else {
            new Notice('No active editor');
        }
        this.close();
    }

    private insertAtCursor(text: string) {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (activeView && activeView.editor) {
            const cursor = activeView.editor.getCursor();
            activeView.editor.replaceRange(text, cursor);
            new Notice('Inserted at cursor position');
        } else {
            new Notice('No active editor');
        }
        this.close();
    }


    private async appendToCurrentNote(text: string) {
        const activeFile = this.app.workspace.getActiveFile();
        if (activeFile) {
            try {
                const currentContent = await this.app.vault.read(activeFile);
                const newContent = currentContent + '\n\n' + text;
                await this.app.vault.modify(activeFile, newContent);
                new Notice('Added to current note');
            } catch (error) {
                new Notice('Failed to add to note');
            }
        } else {
            new Notice('No active note');
        }
        this.close();
    }
}
