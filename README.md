# Shell Runner for Obsidian

> **⚠️ Development Discontinued**
> 
> During the development of this plugin, I discovered the [obsidian-shellcommands](https://github.com/Taitava/obsidian-shellcommands) plugin and have decided to discontinue this project. 
> 
> **Please use the above plugin instead for more mature and stable functionality.**

A powerful shell command executor plugin for Obsidian that provides a Quick Switcher-style interface for executing shell commands with dynamic context parameters.

## ✨ Key Features

### 🚀 Quick Switcher Style Interface
- **Fuzzy Search**: Quickly find commands by name or description
- **Fast Execution**: Execute commands with a single keystroke
- **Command Palette Integration**: Access commands through Obsidian's command palette
- **Hotkey Support**: Assign custom hotkeys to frequently used commands

### 🔧 Dynamic Parameter System
Automatically inject context information into your commands:

| Parameter | Description | Example |
|-----------|-------------|---------|
| `{activeNote}` | Current active note filename | `MyNote.md` |
| `{activeNotePath}` | Full path of current note | `/vault/folder/MyNote.md` |
| `{activeNoteContent}` | Complete content of current note | `# Title\nContent...` |
| `{selectedText}` | Currently selected text | `selected text` |
| `{currentDirectory}` | Directory containing current note | `/vault/folder` |
| `{vaultPath}` | Root path of Obsidian vault | `/vault` |
| `{currentLine}` | Content of line where cursor is located | `This is the current line` |
| `{currentLineNumber}` | Current line number (1-based) | `42` |
| `{cursorPosition}` | Cursor position (line:column) | `42:15` |

### 💬 Interactive Prompts
- **Multiple Prompts**: Define multiple named prompts per command
- **Dynamic Input**: Use `{prompt:keyword}` to request user input at runtime
- **Flexible UI**: Clean modal interface for prompt collection

### 🎯 Smart Execution Modes
- **Normal Execution**: Run commands and display results in a modal
- **Background Execution**: Run commands silently with notification-only feedback
- **Result Actions**: Copy, insert at cursor, replace selection, or append to note

### 🐚 Advanced Shell Support
- **Multi-Shell Support**: bash, zsh, fish, csh, tcsh, dash, PowerShell, cmd
- **Auto-Detection**: Automatically detects your system's default shell
- **Login Shell Option**: Use login shells (-l flag) to load profile files
- **Cross-Platform**: Works on macOS, Linux, and Windows

### 🔒 Robust Security
- **Shell Escaping**: Advanced parameter escaping using `shescape` library
- **Safe Execution**: Prevents shell injection attacks
- **User Control**: All commands are user-defined and managed

## 🚀 Quick Start

### Installation
1. Download the latest release
2. Extract to `.obsidian/plugins/shell-runner/` in your vault
3. Enable the plugin in Settings → Community plugins

### Basic Usage
1. **Open Shell Runner**: 
   - Use ribbon icon (terminal symbol)
   - Command palette: "Shell Runner: Open command selector"
   - Hotkey: Assign in Settings → Hotkeys

2. **Execute Commands**:
   - Type to search commands
   - Press `Enter` to execute
   - View results in the modal

3. **Add Your First Command**:
   - Go to Settings → Shell Runner
   - Click "Add Command"
   - Configure name, description, and shell command

## 📋 Command Examples

### File Operations
```bash
# List files in current note's directory
ls -la "{currentDirectory}"

# Backup current note with timestamp
cp "{activeNotePath}" "{currentDirectory}/backup_{activeNote}_$(date +%Y%m%d_%H%M%S)"

# Find files containing selected text
grep -r "{selectedText}" "{vaultPath}"
```

### Git Operations
```bash
# Check git status
cd "{vaultPath}" && git status

# Commit current note
cd "{vaultPath}" && git add "{activeNotePath}" && git commit -m "Update {activeNote}"

# Show git log for current note
cd "{vaultPath}" && git log --oneline "{activeNotePath}"
```

### Text Processing
```bash
# Count words in selected text
echo "{selectedText}" | wc -w

# Convert selected text to uppercase
echo "{selectedText}" | tr '[:lower:]' '[:upper:]'

# Search and replace in current note content
echo "{activeNoteContent}" | sed 's/old/new/g'
```

### Interactive Commands with Prompts
```bash
# Search with user input
grep -r "{prompt:search_term}" "{vaultPath}"

# Create file with custom name
touch "{currentDirectory}/{prompt:filename}.md"

# Run custom git command
cd "{vaultPath}" && git {prompt:git_command}
```

## ⚙️ Configuration

### General Settings
- **Default Working Directory**: Base directory for command execution
- **Shell Program**: Choose your preferred shell (auto-detect, bash, zsh, etc.)
- **Use Login Shell**: Enable to load profile files (.zshrc, .bash_profile, etc.)
- **Show Notifications**: Control execution feedback
- **Max Output Length**: Limit command output size

### Command Configuration
Each command can be configured with:
- **Basic Info**: Name, description, shell command
- **Working Directory**: Absolute or relative path
- **Background Execution**: Run without showing result modal
- **Prompts**: Define interactive input parameters
- **Default Action**: Auto-copy, insert, or append results

### Security Settings
- **Shell Escaping**: Always enabled for parameter safety
- **Command Validation**: User-defined commands only
- **Path Restrictions**: Configurable working directory limits

## 🔧 Advanced Features

### Shell Environment Loading
The plugin can load your shell configuration:
- **Auto-detection**: Finds your system's default shell
- **Login Shell Mode**: Loads `.zshrc`, `.bash_profile`, etc.
- **Environment Variables**: Access your custom PATH and aliases
- **Cross-platform**: Works on Unix-like systems and Windows

### Command Palette Integration
- All enabled commands appear in Obsidian's command palette
- Assign hotkeys to frequently used commands
- Quick access without opening the main interface

### Flexible Output Handling
- **Modal Display**: Rich formatting with copy/action buttons
- **Background Mode**: Silent execution with notifications
- **Direct Integration**: Insert results directly into notes

## 🛠️ Development

### Building from Source
```bash
# Clone repository
git clone <repository-url>
cd shell-runner

# Install dependencies
npm install

# Development mode (watch)
npm run dev

# Production build
npm run build
```

### Project Structure
```
src/
├── main.ts              # Plugin entry point
├── types/               # TypeScript interfaces
├── ui/                  # User interface components
│   ├── command-selector-modal.ts
│   ├── command-result-modal.ts
│   ├── settings-tab.ts
│   └── prompt-modal.ts
└── utils/               # Core functionality
    └── terminal-executor.ts
```

## 🔒 Security Considerations

⚠️ **Important Security Notes**:

- This plugin executes shell commands with system privileges
- Only add commands you trust and understand
- Parameters are automatically escaped to prevent injection attacks
- Review commands before enabling them
- Use absolute paths when possible
- Avoid storing sensitive information in commands

### Best Practices
1. **Validate Commands**: Test commands manually before adding them
2. **Use Parameters**: Leverage dynamic parameters instead of hardcoded values
3. **Limit Scope**: Use specific working directories
4. **Regular Review**: Periodically audit your command list
5. **Backup**: Keep backups of your command configurations

## 🤝 Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

- **Issues**: Report bugs on GitHub Issues
- **Discussions**: Join community discussions
- **Documentation**: Check the wiki for detailed guides

---

**Made with ❤️ for the Obsidian community**