import { App, Modal, Setting } from 'obsidian';
import { PromptConfig } from '../types';

export class PromptModal extends Modal {
    private results: Record<string, string> = {};
    private onSubmit: (results: Record<string, string>) => void;
    private commandName: string;
    private prompts: PromptConfig[];
    private inputElements: HTMLInputElement[] = [];

    constructor(app: App, commandName: string, prompts: PromptConfig[], onSubmit: (results: Record<string, string>) => void) {
        super(app);
        this.commandName = commandName;
        this.prompts = prompts;
        this.onSubmit = onSubmit;

        // Initialize results
        prompts.forEach(prompt => {
            this.results[prompt.name] = '';
        });
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        // Improve modal style
        contentEl.style.minWidth = '400px';
        contentEl.style.maxWidth = '600px';

        // Modal title
        const titleEl = contentEl.createEl('h2', { text: `${this.commandName}` });
        titleEl.style.marginBottom = '24px';
        titleEl.style.textAlign = 'center';
        titleEl.style.color = 'var(--text-normal)';

        // Prompt input fields
        const inputContainer = contentEl.createDiv();
        inputContainer.style.marginBottom = '32px';

        this.prompts.forEach((prompt, index) => {
            // Prompt label (using displayName)
            const labelEl = inputContainer.createEl('label');
            labelEl.style.display = 'block';
            labelEl.style.marginBottom = '8px';
            labelEl.style.fontWeight = '600';
            labelEl.style.color = 'var(--text-normal)';
            labelEl.textContent = prompt.displayName;

            // Input field
            const inputEl = inputContainer.createEl('input');
            inputEl.type = 'text';
            inputEl.placeholder = `Enter ${prompt.displayName}...`;
            inputEl.style.width = '100%';
            inputEl.style.padding = '12px 16px';
            inputEl.style.fontSize = '14px';
            inputEl.style.border = '1px solid var(--background-modifier-border)';
            inputEl.style.borderRadius = '6px';
            inputEl.style.backgroundColor = 'var(--background-primary)';
            inputEl.style.color = 'var(--text-normal)';
            inputEl.style.marginBottom = index < this.prompts.length - 1 ? '20px' : '0px';

            // Focus style
            inputEl.addEventListener('focus', () => {
                inputEl.style.borderColor = 'var(--interactive-accent)';
                inputEl.style.boxShadow = '0 0 0 2px var(--interactive-accent-hover)';
            });

            inputEl.addEventListener('blur', () => {
                inputEl.style.borderColor = 'var(--background-modifier-border)';
                inputEl.style.boxShadow = 'none';
            });

            // Handle value changes
            inputEl.addEventListener('input', () => {
                this.results[prompt.name] = inputEl.value;
            });

            // Submit with Enter key (only on last input field)
            inputEl.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    if (index === this.prompts.length - 1) {
                        this.submit();
                    } else {
                        // Move focus to next input field
                        const nextInput = this.inputElements[index + 1];
                        if (nextInput) {
                            nextInput.focus();
                        }
                    }
                } else if (e.key === 'Tab' && !e.shiftKey && index === this.prompts.length - 1) {
                    // Move focus to OK button when Tab is pressed on last field
                    e.preventDefault();
                    const submitButton = contentEl.querySelector('.submit-button') as HTMLButtonElement;
                    if (submitButton) {
                        submitButton.focus();
                    }
                }
            });

            this.inputElements.push(inputEl);
        });

        // Button container
        const buttonContainer = contentEl.createDiv();
        buttonContainer.style.display = 'flex';
        buttonContainer.style.justifyContent = 'flex-end';
        buttonContainer.style.gap = '12px';
        buttonContainer.style.paddingTop = '20px';
        buttonContainer.style.borderTop = '1px solid var(--background-modifier-border)';

        // Cancel button
        const cancelButton = buttonContainer.createEl('button', { text: 'Cancel' });
        cancelButton.style.padding = '10px 20px';
        cancelButton.style.fontSize = '14px';
        cancelButton.style.border = '1px solid var(--background-modifier-border)';
        cancelButton.style.borderRadius = '6px';
        cancelButton.style.backgroundColor = 'var(--background-secondary)';
        cancelButton.style.color = 'var(--text-normal)';
        cancelButton.style.cursor = 'pointer';
        cancelButton.style.transition = 'all 0.2s ease';

        cancelButton.addEventListener('mouseenter', () => {
            cancelButton.style.backgroundColor = 'var(--background-modifier-hover)';
        });

        cancelButton.addEventListener('mouseleave', () => {
            cancelButton.style.backgroundColor = 'var(--background-secondary)';
        });

        cancelButton.onclick = () => this.close();

        // Submit button
        const submitButton = buttonContainer.createEl('button', { text: 'OK' });
        submitButton.className = 'submit-button';
        submitButton.style.padding = '10px 20px';
        submitButton.style.fontSize = '14px';
        submitButton.style.backgroundColor = 'var(--interactive-accent)';
        submitButton.style.color = 'var(--text-on-accent)';
        submitButton.style.border = 'none';
        submitButton.style.borderRadius = '6px';
        submitButton.style.cursor = 'pointer';
        submitButton.style.fontWeight = '600';
        submitButton.style.transition = 'all 0.2s ease';

        submitButton.addEventListener('mouseenter', () => {
            submitButton.style.backgroundColor = 'var(--interactive-accent-hover)';
        });

        submitButton.addEventListener('mouseleave', () => {
            submitButton.style.backgroundColor = 'var(--interactive-accent)';
        });

        submitButton.onclick = () => this.submit();

        // Focus on first input field
        setTimeout(() => {
            if (this.inputElements.length > 0) {
                this.inputElements[0].focus();
            }
        }, 100);

        // Close with ESC key
        this.scope.register([], 'Escape', () => this.close());
    }

    private submit() {
        this.onSubmit(this.results);
        this.close();
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
