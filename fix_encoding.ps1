$content = Get-Content README.md -Raw

# Mapping of corrupted sequences to correct characters
$replacements = @{
    # Emojis
    'ðŸ§' = '🧠'
    'ðŸ”„' = '🔄'
    'ðŸ¤–' = '🤖'
    'ðŸŽ¯' = '🎯'
    'ðŸŒ' = '🌐'
    'ðŸ”¬' = '🔬'
    'ðŸ“Š' = '📊'
    'ðŸŒ' = '🌍'
    'ðŸ›' = '🐛'
    'ðŸ’¾' = '💾'
    'ðŸ›¡ï¸' = '🛡️'
    'ðŸ“ˆ' = '📈'
    'ðŸš€' = '🚀'
    'ðŸŽ®' = '🎮'
    'ðŸ“‹' = '📋'
    
    # Other corrupted characters
    'â€¢' = '•'
    'â€”' = '—'
    'âœ¨' = '✨'
    'âš¡' = '⚡'
    'âš™ï¸' = '⚙️'
    'ðŸ”' = '🔍'
    'ðŸ”‘' = '🔑'
    'ðŸšª' = '🚪'
    'ðŸ‘¤' = '👤'
    'ðŸ‹ï¸' = '🏋️'
    'âš–ï¸' = '⚖️'
    'âŒ¨ï¸' = '⌨️'
    'ðŸ›‘' = '🛑'
    'ðŸ§¹' = '🧹'
    'ðŸ”‡' = '🔇'
    'ðŸ‘ï¸' = '👁️'
    'ðŸ—œï¸' = '🗜️'
    'ðŸ“‚' = '📂'
    'ðŸ“–' = '📖'
    'ðŸ“¥' = '📥'
    'ðŸ”Ž' = '🔎'
    'ðŸ’¬' = '💬'
    'ðŸš«' = '🚫'
    
    # Box drawing characters in memory architecture diagram
    'â”Œ' = '┌'
    'â”€' = '─'
    'â”' = '┐'
    'â”‚' = '│'
    'â”œ' = '├'
    'â”¤' = '┤'
    'â””' = '└'
    'â”˜' = '┘'
    
    # Web Platform section specific
    'The web dashboard \(`web/`\) is a full' = 'The web dashboard (available at [helix-mind.ai](https://helix-mind.ai)) is a separate'
}

# Perform replacements
foreach ($key in $replacements.Keys) {
    if ($content.Contains($key)) {
        $content = $content.Replace($key, $replacements[$key])
        Write-Host "Replaced: $key → $($replacements[$key])"
    }
}

# Special case for Web Setup section - remove it like in public repo
if ($content.Contains('### Web Setup')) {
    # Find from "### Web Setup" to the next "---" (including blank lines)
    $pattern = '(?s)### Web Setup.*?(\r?\n---)'
    $content = $content -replace $pattern, '$1'
    Write-Host "Removed Web Setup section"
}

# Fix the heart emoji at the bottom
$content = $content.Replace('â¤ï¸', '❤️')
$content = $content.Replace('â¬†', '⬆')

Set-Content -Path README.md -Value $content -Encoding UTF8
Write-Host "Fixed encoding in README.md"