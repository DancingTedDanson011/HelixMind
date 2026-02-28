#!/usr/bin/env python3
import re

# Read the file
with open('README.md', 'r', encoding='utf-8') as f:
    content = f.read()

# Additional replacements
additional = {
    'ðŸ"š': '📚',  # Documentation icon
}

for corrupted, correct in additional.items():
    if corrupted in content:
        content = content.replace(corrupted, correct)

# Fix the development section - replace web dashboard lines
# Pattern: "# Web dashboard\r\ncd web\r\nnpm install\r\nnpm run dev"
# Note: \r\n is Windows line ending
pattern = r'# Web dashboard\r\ncd web\r\nnpm install\r\nnpm run dev'
replacement = r'# Web dashboard (separate repository)\r\n# Visit https://helix-mind.ai for the web platform'
content = re.sub(pattern, replacement, content)

# Also fix in case there's a space after cd
pattern2 = r'# Web dashboard\r\ncd web\r\nnpm install\r\nnpm run dev'
if pattern2 in content:
    content = content.replace(pattern2, replacement)

# Write back
with open('README.md', 'w', encoding='utf-8') as f:
    f.write(content)

print("Applied additional fixes")