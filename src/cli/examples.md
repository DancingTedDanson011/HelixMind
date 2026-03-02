# HelixMind CLI Examples

## Basic Usage
```bash
# Start interactive chat
helixmind chat

# Configure API keys
helixmind config set OPENAI_API_KEY your-key-here

# Work with spiral memory
helixmind spiral search "cli programming"

# Import/export brain data
helixmind export ./backup
helixmind import ./backup.zip

# Authentication
helixmind login
helixmind whoami
```

## Advanced Usage
```bash
# Benchmark models
helixmind bench run --model gpt-4

# Feed files to context
helixmind feed src/**/*.ts

# Manage sessions
helixmind sessions list
```

## Troubleshooting
```bash
# Get detailed help
helixmind --help
helixmind chat --help

# Check version
helixmind --version

# Verbose mode (if implemented)
helixmind chat --verbose
```
