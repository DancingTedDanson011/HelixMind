#!/usr/bin/env python3
import re

# Read the file with the correct encoding (it's UTF-8 but with corrupted chars)
with open('README.md', 'r', encoding='utf-8') as f:
    content = f.read()

# Mapping of corrupted sequences to correct emojis
replacements = {
    # Emojis - these are the corrupted UTF-8 sequences when interpreted as Windows-1252
    'ðŸ§': '🧠',
    'ðŸ”„': '🔄',
    'ðŸ¤–': '🤖',
    'ðŸŽ¯': '🎯',
    'ðŸŒ': '🌐',
    'ðŸ”¬': '🔬',
    'ðŸ“Š': '📊',
    'ðŸŒ': '🌍',
    'ðŸ›': '🐛',
    'ðŸ’¾': '💾',
    'ðŸ›¡ï¸': '🛡️',
    'ðŸ“ˆ': '📈',
    'ðŸš€': '🚀',
    'ðŸŽ®': '🎮',
    'ðŸ“‹': '📋',
    
    # Other corrupted characters
    'â€¢': '•',
    'â€”': '—',
    'âœ¨': '✨',
    'âš¡': '⚡',
    'âš™ï¸': '⚙️',
    'ðŸ”': '🔍',
    'ðŸ”‘': '🔑',
    'ðŸšª': '🚪',
    'ðŸ‘¤': '👤',
    'ðŸ‹ï¸': '🏋️',
    'âš–ï¸': '⚖️',
    'âŒ¨ï¸': '⌨️',
    'ðŸ›‘': '🛑',
    'ðŸ§¹': '🧹',
    'ðŸ”‡': '🔇',
    'ðŸ‘ï¸': '👁️',
    'ðŸ—œï¸': '🗜️',
    'ðŸ“‚': '📂',
    'ðŸ“–': '📖',
    'ðŸ“¥': '📥',
    'ðŸ”Ž': '🔎',
    'ðŸ’¬': '💬',
    'ðŸš«': '🚫',
    
    # Special cases
    'â¤ï¸': '❤️',
    'â¬†': '⬆',
}

# Also replace box drawing characters
box_replacements = {
    'â”Œ': '┌',
    'â”€': '─',
    'â”': '┐',
    'â”‚': '│',
    'â”œ': '├',
    'â”¤': '┤',
    'â””': '└',
    'â”˜': '┘',
}

# Combine all replacements
all_replacements = {**replacements, **box_replacements}

# Perform replacements
for corrupted, correct in all_replacements.items():
    if corrupted in content:
        content = content.replace(corrupted, correct)
        # Don't print to avoid encoding issues

# Remove Web Setup section like in public repo
# Find from "### Web Setup" to the next "---"
import re
pattern = r'### Web Setup.*?(\n---)'
content = re.sub(pattern, r'\1', content, flags=re.DOTALL)

# Update web dashboard description
content = content.replace(
    'The web dashboard (`web/`) is a full **Next.js 15** application:',
    'The web dashboard (available at [helix-mind.ai](https://helix-mind.ai)) is a separate **Next.js 15** application:'
)

# Write back the file
with open('README.md', 'w', encoding='utf-8') as f:
    f.write(content)

print("Fixed encoding in README.md")