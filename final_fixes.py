#!/usr/bin/env python3
import re

with open('README.md', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Fix Documentation emoji - replace any "ðŸ"š" with "📚"
# The corrupted sequence for 📚 is "ðŸ"š" 
content = content.replace('ðŸ"š', '📚')

# 2. Fix Development section - replace the web dashboard lines
# Find the code block in Development section
dev_section = re.search(r'(## 🏗️ Development.*?)(```bash.*?```)(.*?)---', content, re.DOTALL)
if dev_section:
    full_match = dev_section.group(0)
    before = dev_section.group(1)
    code_block = dev_section.group(2)
    after = dev_section.group(3)
    
    # Replace the 3 lines about web dashboard
    new_code_block = code_block.replace(
        '# Web dashboard\ncd web\nnpm install\nnpm run dev',
        '# Web dashboard (separate repository)\n# Visit https://helix-mind.ai for the web platform'
    )
    
    # If not replaced (different line endings), try with \r\n
    if new_code_block == code_block:
        new_code_block = code_block.replace(
            '# Web dashboard\r\ncd web\r\nnpm install\r\nnpm run dev',
            '# Web dashboard (separate repository)\r\n# Visit https://helix-mind.ai for the web platform'
        )
    
    # Update content
    content = content.replace(full_match, before + new_code_block + after)

# 3. Add note to video section
video_section = re.search(r'(<div align="center">.*?<video src="assets/brain_3d_vision\.mp4".*?<p><em>Interactive 3D brain visualization.*?</em></p>)(\s*</div>)', content, re.DOTALL)
if video_section:
    before = video_section.group(1)
    after = video_section.group(2)
    new_section = before + '\n  <p><small><em>Note: The video may not auto-play in GitHub\'s web view. You can <a href="assets/brain_3d_vision.mp4" download>download it directly</a> or clone the repository to view it.</em></small></p>' + after
    content = content.replace(video_section.group(0), new_section)

# Write back
with open('README.md', 'w', encoding='utf-8') as f:
    f.write(content)

print("Applied final fixes")