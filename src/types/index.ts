export interface PromptConfig {
    name: string;           // Keyword (internal identifier)
    displayName: string;    // Display name
}

export interface CommandScript {
    id: string;
    name: string;
    description?: string;
    command: string;
    workingDirectory?: string;
    useAbsolutePath?: boolean;
    backgroundExecution?: boolean;
    prompts?: PromptConfig[];
    defaultAction?: 'none' | 'copy' | 'replace' | 'insert' | 'append';
    enabled: boolean;
}

export interface ParameterContext {
    activeNote?: string;
    activeNotePath?: string;
    activeNoteContent?: string;
    selectedText?: string;
    currentDirectory?: string;
    vaultPath?: string;
    currentLine?: string;
    currentLineNumber?: number;
    cursorPosition?: { line: number; ch: number };
    prompts?: Record<string, string>;
}

export interface CommandExecutionResult {
    success: boolean;
    output: string;
    error?: string;
    exitCode?: number;
    command: string;           // Substituted command (actually executed)
    originalCommand: string;   // Original command (before parameter substitution)
    parameters: ParameterContext;
}

export interface PluginSettings {
    commands: CommandScript[];
    defaultWorkingDirectory: string;
    showNotifications: boolean;
    maxOutputLength: number;
    shellProgram: 'auto' | 'bash' | 'zsh' | 'busybox' | 'csh' | 'dash' | 'cmd' | 'powershell';
    useLoginShell: boolean;
}

export const DEFAULT_SETTINGS: PluginSettings = {
    commands: [
        {
            id: 'example-pwd',
            name: 'Show current working directory',
            description: 'Shows the current working directory path',
            command: 'pwd',
            useAbsolutePath: false,
            backgroundExecution: false,
            prompts: [],
            defaultAction: 'none',
            enabled: true,
        },
        {
            id: 'example-ls-vault',
            name: 'List vault contents',
            description: 'Lists all files in the vault root directory',
            command: 'ls -la "{vaultpath}"',
            useAbsolutePath: false,
            backgroundExecution: false,
            prompts: [],
            defaultAction: 'none',
            enabled: true,
        },
        {
            id: 'example-date',
            name: 'Show current date and time',
            description: 'Displays the current date and time',
            command: 'date',
            useAbsolutePath: false,
            backgroundExecution: false,
            prompts: [],
            defaultAction: 'none',
            enabled: true,
        },
    ],
    defaultWorkingDirectory: '',
    showNotifications: true,
    maxOutputLength: 10000,
    shellProgram: 'auto',
    useLoginShell: false,
};
