# Theming & Farbsystem

## Theme-Palette

```javascript
// Claude Theme (TrueColor Terminals):
const claudeTheme = {
  claude:          "rgb(215,119,87)",   // Claude Orange
  claudeShimmer:   "rgb(245,149,117)",  // Shimmer Highlight
  claudeBlue:      "rgb(87,105,247)",   // System Spinner
  permission:      "rgb(87,105,247)",   // Permission-Dialoge
  bashBorder:      "rgb(255,0,135)",    // Bash Command Border
  // Rainbow-Farben für Shimmer-Effekte...
};

// ANSI Fallback Theme (für Terminals ohne TrueColor):
const ansiTheme = {
  claude:          "ansi:redBright",
  claudeShimmer:   "ansi:yellowBright",
  claudeBlue:      "ansi:blue",
  permission:      "ansi:blue",
  bashBorder:      "ansi:magentaBright",
};
```

## Color-Funktion

```javascript
function color(colorName, theme, mode = "foreground") {
  return (text) => {
    const resolvedColor = theme[colorName] || colorName;

    if (resolvedColor.startsWith("rgb(")) {
      // TrueColor: ESC[38;2;R;G;Bm (foreground)
      //            ESC[48;2;R;G;Bm (background)
      const [r, g, b] = parseRGB(resolvedColor);
      const code = mode === "foreground" ? 38 : 48;
      return `\x1b[${code};2;${r};${g};${b}m${text}\x1b[0m`;
    }

    if (resolvedColor.startsWith("#")) {
      // Hex zu RGB konvertieren
      const [r, g, b] = hexToRGB(resolvedColor);
      const code = mode === "foreground" ? 38 : 48;
      return `\x1b[${code};2;${r};${g};${b}m${text}\x1b[0m`;
    }

    if (resolvedColor.startsWith("ansi:")) {
      // ANSI Named Color
      const ansiCode = ANSI_CODES[resolvedColor.replace("ansi:", "")];
      return `\x1b[${ansiCode}m${text}\x1b[0m`;
    }

    return text;
  };
}

const ANSI_CODES = {
  red: 31, green: 32, yellow: 33, blue: 34,
  magenta: 35, cyan: 36, white: 37,
  redBright: 91, greenBright: 92, yellowBright: 93,
  blueBright: 94, magentaBright: 95, cyanBright: 96,
};
```

## Theme Detection

```javascript
// Erkennt ob Terminal TrueColor unterstützt
function detectColorSupport() {
  const colorterm = process.env.COLORTERM;
  if (colorterm === "truecolor" || colorterm === "24bit") {
    return "truecolor";
  }

  const term = process.env.TERM;
  if (term?.includes("256color")) return "256";
  if (term?.includes("color")) return "16";

  return "basic";
}
```

## Syntax Highlighting

```javascript
// Bundled highlight.js mit allen Major-Sprachen
// Code-Blöcke werden in Markdown erkannt und gehighlighted

// Text-Wrapping für Terminal:
function wrapText(text, columns) {
  // Word-Wrap mit ANSI-Escape-Sequence-Awareness
  // (Escape-Sequenzen zählen nicht zur Spaltenbreite)
  return wordWrap(text, columns, {
    preserveAnsi: true,
    hard: true      // Harte Umbrüche bei langen Wörtern
  });
}
```

## Für dein Projekt: Minimal Theme System

```javascript
const THEMES = {
  default: {
    primary: "\x1b[36m",      // Cyan
    error: "\x1b[31m",        // Rot
    success: "\x1b[32m",      // Grün
    warning: "\x1b[33m",      // Gelb
    dim: "\x1b[90m",          // Grau
    reset: "\x1b[0m",
    bold: "\x1b[1m",
  },
  truecolor: {
    primary: "\x1b[38;2;87;105;247m",   // Blau
    error: "\x1b[38;2;255;85;85m",      // Rot
    success: "\x1b[38;2;80;250;123m",   // Grün
    warning: "\x1b[38;2;255;184;108m",  // Orange
    dim: "\x1b[90m",
    reset: "\x1b[0m",
    bold: "\x1b[1m",
  }
};

function createTheme() {
  const colorterm = process.env.COLORTERM;
  const isTrueColor = colorterm === "truecolor" || colorterm === "24bit";
  return isTrueColor ? THEMES.truecolor : THEMES.default;
}

const theme = createTheme();

// Nutzung:
console.log(`${theme.primary}Hello${theme.reset}`);
console.log(`${theme.error}Error!${theme.reset}`);
```
