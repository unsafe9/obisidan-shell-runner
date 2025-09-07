import { Notice, App, MarkdownView, TFile, Editor } from 'obsidian';
import { CommandScript, CommandExecutionResult, ParameterContext, PluginSettings } from '../types';
import { CommandResultModal } from '../ui/command-result-modal';
import { Shescape } from 'shescape';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';

export class TerminalExecutor {
    private shescape: Shescape;

    constructor(private app: App, private settings: PluginSettings) {
        // Initialize shescape with appropriate shell detection
        this.shescape = this.createShescapeInstance();
    }

    /**
     * Creates a Shescape instance using shell detection.
     */
    private createShescapeInstance(): Shescape {
        try {
            // Use shell detection logic
            const shellName = this.getShellNameForShescape();
            return new Shescape({ shell: shellName });
        } catch (error) {
            console.warn('Failed to create Shescape instance, using bash fallback:', error);
            return new Shescape({ shell: 'bash' });
        }
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

            // Method 2: Try basePath property (fallback)
            const basePath = (this.app.vault.adapter as any).basePath;
            if (basePath) {
                return basePath;
            }

            return '';
        } catch (error) {
            // Final fallback: try basePath property
            return (this.app.vault.adapter as any).basePath || '';
        }
    }

    /**
     * Collects parameter information from the current context.
     */
    async getParameterContext(): Promise<ParameterContext> {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        const activeFile = this.app.workspace.getActiveFile();

        const context: ParameterContext = {
            vaultPath: this.getVaultPath(),
        };

        if (activeFile) {
            context.activeNote = activeFile.basename;
            context.activeNotePath = activeFile.path;
            context.currentDirectory = activeFile.parent?.path || '';

            // Get full content of current note
            try {
                context.activeNoteContent = await this.app.vault.read(activeFile);
            } catch (error) {
                context.activeNoteContent = '';
            }
        }

        if (activeView && activeView.editor) {
            const editor = activeView.editor;
            const selection = editor.getSelection();

            if (selection) {
                context.selectedText = selection;
            }

            const cursor = editor.getCursor();
            context.cursorPosition = cursor;
            context.currentLineNumber = cursor.line + 1; // 1-based line numbers
            context.currentLine = editor.getLine(cursor.line);
        }

        return context;
    }

    /**
     * Substitutes parameters in the command string.
     */
    substituteParameters(command: string, context: ParameterContext): string {
        let substituted = command;

        // Available parameters
        const substitutions: Record<string, string> = {
            '{activenote}': context.activeNote || '',
            '{activenotepath}': context.activeNotePath || '',
            '{activenotecontent}': context.activeNoteContent || '',
            '{selectedtext}': context.selectedText || '',
            '{currentdir}': context.currentDirectory || '',
            '{vaultpath}': context.vaultPath || '',
            '{currentline}': context.currentLine || '',
            '{currentlinenumber}': context.currentLineNumber?.toString() || '',
            '{cursorline}': context.cursorPosition?.line.toString() || '',
            '{cursorcolumn}': context.cursorPosition?.ch.toString() || '',
        };

        // Add prompt parameters with {prompt:name} format
        if (context.prompts) {
            Object.entries(context.prompts).forEach(([name, value]) => {
                substitutions[`{prompt:${name.toLowerCase()}}`] = value;
            });
        }

        // Substitute each parameter (case-insensitive)
        for (const [placeholder, value] of Object.entries(substitutions)) {
            const regex = new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'gi');
            substituted = substituted.replace(regex, this.escapeShellArgument(value));
        }

        return substituted;
    }

    /**
     * Safely escapes shell arguments using shescape library.
     */
    private escapeShellArgument(arg: string): string {
        if (!arg) return '""';

        try {
            // Use shescape for cross-platform shell escaping
            return this.shescape.escape(arg);
        } catch (error) {
            console.warn('shescape failed, falling back to manual escaping:', error);
            // Fallback to simple escaping if shescape fails
            if (/[^\w\-./]/.test(arg)) {
                return `"${arg.replace(/"/g, '\\"')}"`;
            }
            return arg;
        }
    }

    /**
     * Executes a command.
     */
    async executeCommand(
        script: CommandScript,
        substitutedCommand: string,
        context: ParameterContext
    ): Promise<CommandExecutionResult> {
        try {
            // Use Node.js child_process module
            const execAsync = promisify(exec);

            // Set working directory
            let workingDir = this.settings.defaultWorkingDirectory ||
                context.vaultPath ||
                process.cwd();

            // Handle script-specific working directory
            if (script.workingDirectory) {
                if (script.useAbsolutePath) {
                    // Use as absolute path
                    workingDir = script.workingDirectory;
                } else {
                    // Use as relative path from default working directory
                    workingDir = path.join(workingDir, script.workingDirectory);
                }
            }

            // Debug logging and execution notification
            if (this.settings.showNotifications) {
                if (script.backgroundExecution) {
                    new Notice(`Running in background: ${script.name}`);
                } else {
                    new Notice(`Executing: ${script.name}`);
                }
            }

            // Prepare shell command with login flag if enabled
            const shellCommand = this.getShellWithLoginFlag();
            const execOptions: any = {
                cwd: workingDir,
                timeout: 30000, // 30 second timeout
                maxBuffer: this.settings.maxOutputLength,
            };

            let result: any;
            // Use shell array for login shell, or string for regular shell
            if (shellCommand.length > 1) {
                // Login shell: use spawn-like approach with execFile
                const { execFile } = require('child_process');
                const { promisify } = require('util');
                const execFileAsync = promisify(execFile);

                result = await execFileAsync(shellCommand[0], [...shellCommand.slice(1), '-c', substitutedCommand], execOptions);
            } else {
                // Regular shell
                execOptions.shell = shellCommand[0];
                result = await execAsync(substitutedCommand, execOptions);
            }

            const executionResult: CommandExecutionResult = {
                success: true,
                output: result.stdout || '',
                error: result.stderr || '',
                exitCode: 0,
                command: substitutedCommand,
                originalCommand: script.command,
                parameters: context,
            };

            if (this.settings.showNotifications) {
                if (script.backgroundExecution) {
                    // Show results as notification only for background execution
                    const outputPreview = executionResult.output.length > 100
                        ? executionResult.output.substring(0, 100) + '...'
                        : executionResult.output;
                    new Notice(`✅ ${script.name} completed${outputPreview ? ': ' + outputPreview : ''}`, 5000);
                } else {
                    new Notice(`Completed: ${script.name}`);
                }
            }

            // Handle result based on configuration
            if (!script.backgroundExecution) {
                if (script.defaultAction && script.defaultAction !== 'none') {
                    // Perform default action directly
                    await this.performAction(script.defaultAction, executionResult);
                } else {
                    // Show modal
                    new CommandResultModal(this.app, executionResult, script.name).open();
                }
            }

            return executionResult;

        } catch (error: any) {
            const executionResult: CommandExecutionResult = {
                success: false,
                output: error.stdout || '',
                error: error.stderr || error.message || 'An unknown error occurred.',
                exitCode: error.code || -1,
                command: substitutedCommand,
                originalCommand: script.command,
                parameters: context,
            };

            if (this.settings.showNotifications) {
                if (script.backgroundExecution) {
                    // Show error as notification only for background execution
                    const errorPreview = executionResult.error && executionResult.error.length > 100
                        ? executionResult.error.substring(0, 100) + '...'
                        : executionResult.error;
                    new Notice(`❌ ${script.name} failed${errorPreview ? ': ' + errorPreview : ''}`, 7000);
                } else {
                    new Notice(`Execution failed: ${script.name} - ${executionResult.error}`, 5000);
                }
            }

            // Show modal only for non-background execution (including errors)
            if (!script.backgroundExecution) {
                new CommandResultModal(this.app, executionResult, script.name).open();
            }

            return executionResult;
        }
    }

    /**
     * Executes a command in a terminal application (for background execution).
     */
    async executeInTerminal(
        script: CommandScript,
        substitutedCommand: string,
        context: ParameterContext
    ): Promise<void> {
        try {

            let workingDir = this.settings.defaultWorkingDirectory ||
                context.vaultPath ||
                process.cwd();

            // Handle script-specific working directory
            if (script.workingDirectory) {
                if (script.useAbsolutePath) {
                    // Use as absolute path
                    workingDir = script.workingDirectory;
                } else {
                    // Use as relative path from default working directory
                    workingDir = path.join(workingDir, script.workingDirectory);
                }
            }

            const shellCommand = this.getShellWithLoginFlag();

            if (this.settings.showNotifications) {
                new Notice(`Executing in ${this.getShellDisplayName()}: ${script.name}`, 3000);
            }

            // Execute command directly in selected shell with login flag if enabled
            let shellProcess;
            if (process.platform === 'win32') {
                // Windows
                const selectedShell = shellCommand[0]; // Windows doesn't use login shell
                if (selectedShell.includes('powershell')) {
                    shellProcess = spawn('powershell.exe', ['-Command', substitutedCommand], {
                        cwd: workingDir,
                        detached: true,
                        stdio: 'ignore'
                    });
                } else {
                    shellProcess = spawn('cmd.exe', ['/c', substitutedCommand], {
                        cwd: workingDir,
                        detached: true,
                        stdio: 'ignore'
                    });
                }
            } else {
                // Unix-like systems with login shell support
                const spawnArgs = shellCommand.length > 1
                    ? [...shellCommand.slice(1), '-c', substitutedCommand]
                    : ['-c', substitutedCommand];

                shellProcess = spawn(shellCommand[0], spawnArgs, {
                    cwd: workingDir,
                    detached: true,
                    stdio: 'ignore'
                });
            }

            shellProcess.unref(); // Allow the parent process to exit independently

            shellProcess.on('error', (error: any) => {
                new Notice(`Shell execution failed: ${error.message}`, 5000);
            });

        } catch (error: any) {
            new Notice(`Shell execution failed: ${error.message}`, 5000);
            throw error;
        }
    }

    /**
     * Gets display name for the selected shell.
     */
    private getShellDisplayName(): string {
        if (this.settings.shellProgram === 'auto') {
            const shell = this.detectDefaultShell();
            const shellName = shell.split('/').pop() || shell.split('\\').pop() || shell;
            return `${shellName} (auto-detected)`;
        } else {
            return this.settings.shellProgram;
        }
    }

    /**
     * Gets the currently detected shell name for display purposes.
     */
    getDetectedShellName(): string {
        const shell = this.detectDefaultShell();
        return shell.split('/').pop() || shell.split('\\').pop() || shell;
    }

    /**
     * Gets the shell program to use based on settings.
     */
    getSelectedShell(): string {
        if (this.settings.shellProgram === 'auto') {
            return this.detectDefaultShell();
        } else {
            return this.getShellPath(this.settings.shellProgram);
        }
    }

    /**
     * Gets the shell command with login flag if enabled (Unix only).
     */
    getShellWithLoginFlag(): string[] {
        const shell = this.getSelectedShell();

        // Windows doesn't support login shell concept
        if (process.platform === 'win32' || !this.settings.useLoginShell) {
            return [shell];
        }

        // Get login flag for Unix shells
        const loginFlag = this.getLoginFlag(shell);
        return loginFlag ? [shell, loginFlag] : [shell];
    }

    /**
     * Gets the appropriate login flag for each shell.
     */
    private getLoginFlag(shell: string): string | null {
        const shellName = shell.split('/').pop() || shell;

        switch (shellName) {
            case 'bash':
            case 'zsh':
            case 'sh':
            case 'dash':
            case 'busybox':
                return '-l';
            case 'csh':
            case 'tcsh':
                return '-l';
            default:
                // For unknown shells, try -l as it's most common
                return '-l';
        }
    }

    /**
     * Detects the default shell for the current platform.
     */
    detectDefaultShell(): string {
        if (process.platform === 'win32') {
            // Windows: prefer PowerShell, fallback to cmd
            return process.env.COMSPEC || 'cmd.exe';
        } else {
            // Unix-like: check system default shell
            const systemShell = process.env.SHELL;
            if (systemShell) {
                const shellName = systemShell.split('/').pop() || systemShell;
                // Check if it's a supported shell
                const supportedShells = ['bash', 'zsh', 'busybox', 'csh', 'dash'];
                if (supportedShells.includes(shellName)) {
                    return systemShell;
                }
            }
            // Fallback to bash
            return '/bin/bash';
        }
    }

    /**
     * Gets the shell name for shescape based on settings.
     */
    getShellNameForShescape(): string {
        if (this.settings.shellProgram === 'auto') {
            // Auto-detect shell
            if (process.platform === 'win32') {
                return 'powershell'; // Default to PowerShell on Windows
            } else {
                // Unix-like: detect from environment
                const systemShell = process.env.SHELL;
                if (systemShell) {
                    const detectedShell = systemShell.split('/').pop() || systemShell;
                    const supportedShells = ['bash', 'zsh', 'busybox', 'csh', 'dash'];
                    return supportedShells.includes(detectedShell) ? detectedShell : 'bash';
                } else {
                    return 'bash'; // Fallback
                }
            }
        } else {
            // Use selected shell
            return this.settings.shellProgram;
        }
    }

    /**
     * Gets the full path for a shell program.
     */
    private getShellPath(shell: string): string {
        if (process.platform === 'win32') {
            switch (shell) {
                case 'cmd': return 'cmd.exe';
                case 'powershell': return 'powershell.exe';
                default: return 'cmd.exe';
            }
        } else {
            switch (shell) {
                case 'bash': return '/bin/bash';
                case 'zsh': return '/bin/zsh';
                case 'busybox': return '/bin/busybox';
                case 'csh': return '/bin/csh';
                case 'dash': return '/bin/dash';
                default: return '/bin/bash';
            }
        }
    }


    /**
     * Performs the specified action with the command result
     */
    private async performAction(action: string, result: CommandExecutionResult): Promise<void> {
        const output = result.output;

        switch (action) {
            case 'copy':
                await this.copyToClipboard(output);
                break;
            case 'replace':
                this.replaceSelection(output);
                break;
            case 'insert':
                this.insertAtCursor(output);
                break;
            case 'append':
                await this.appendToCurrentNote(output);
                break;
            default:
                new Notice(`Unknown action: ${action}`);
        }
    }

    private async copyToClipboard(text: string) {
        await navigator.clipboard.writeText(text);
        new Notice('Copied to clipboard');
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
    }

    private insertAtCursor(text: string) {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (activeView && activeView.editor) {
            const cursor = activeView.editor.getCursor();
            activeView.editor.replaceRange(text, cursor);
            new Notice('Text inserted at cursor');
        } else {
            new Notice('No active editor');
        }
    }

    private async appendToCurrentNote(text: string) {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (activeView && activeView.file) {
            const currentContent = await this.app.vault.read(activeView.file);
            const newContent = currentContent + '\n' + text;
            await this.app.vault.modify(activeView.file, newContent);
            new Notice('Text appended to current note');
        } else {
            new Notice('No active note');
        }
    }
}
