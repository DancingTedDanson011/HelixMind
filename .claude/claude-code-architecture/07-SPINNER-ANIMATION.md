# Spinner & Animation System

## Shimmer-Effekt

Claude Code nutzt einen **Rainbow-Shimmer**, der über den Text wandert.

```javascript
// Shimmer-Komponente (Uk4)
function Spinner({ text, state, prefersReducedMotion }) {
  const [frameCount, setFrameCount] = useState(0);

  // Animation mit useAnimationFrame (nicht requestAnimationFrame!)
  useAnimationFrame(() => {
    setFrameCount(prev => prev + 1);
  }, {
    fps: state === "requesting" ? 20 : 10  // 50ms vs 100ms
  });

  if (prefersReducedMotion) {
    // Keine Animation, nur statischer Text
    return <Text>{text}</Text>;
  }

  // Shimmer-Position berechnen
  const textLength = text.length;
  let shimmerPos;

  if (state === "requesting") {
    // Schneller Sweep von links nach rechts
    shimmerPos = frameCount % textLength - 10;
  } else {
    // Langsamer Reverse-Sweep
    shimmerPos = textLength + 10 - frameCount % textLength;
  }

  // Jedes Zeichen basierend auf Abstand zum Shimmer einfärben
  const coloredChars = text.split("").map((char, i) => {
    const distance = Math.abs(i - shimmerPos);
    const color = getShimmerColor(distance);
    return applyColor(char, color);
  });

  return <Text>{coloredChars.join("")}</Text>;
}
```

### Shimmer-Farben

```javascript
// Rainbow-Palette für Shimmer:
const shimmerColors = [
  "rgb(215,119,87)",   // Claude Orange (Zentrum)
  "rgb(245,149,117)",  // Heller
  "rgb(255,179,147)",  // Noch heller
  // Fading zu dim...
];

function getShimmerColor(distance) {
  if (distance < 3) return shimmerColors[distance];
  return "dim";  // Außerhalb des Shimmer-Bereichs
}
```

## Stall Detection

```javascript
// Erkennt wenn die API-Antwort "hängt"
function useStallDetection(responseLength) {
  const [isStalled, setIsStalled] = useState(false);
  const lastLength = useRef(responseLength);
  const stallTimer = useRef(null);

  useEffect(() => {
    if (responseLength !== lastLength.current) {
      // Response wächst → nicht stalled
      lastLength.current = responseLength;
      setIsStalled(false);
      clearTimeout(stallTimer.current);
    }

    // Timer setzen
    stallTimer.current = setTimeout(() => {
      setIsStalled(true);
    }, 3000);  // 3 Sekunden ohne neue Tokens = stalled

    return () => clearTimeout(stallTimer.current);
  }, [responseLength]);

  return isStalled;
}
```

### Tool-Use Intensität

```javascript
// Sinuswellen-Animation bei Tool-Nutzung
const toolUseIntensity =
  (Math.sin(frameCount / 1000 * Math.PI) + 1) / 2;
// Ergibt Wert zwischen 0 und 1, pulsierend
```

## Timing-Anzeige

```javascript
// Zeigt an: Elapsed Time, Token Count, Thinking Duration
function TimingDisplay({ startTime, tokenCount, thinkingDuration }) {
  const elapsed = Date.now() - startTime;

  return (
    <Text dimColor>
      {formatDuration(elapsed)}
      {tokenCount > 0 && ` · ${tokenCount} tokens`}
      {thinkingDuration > 0 && ` · thinking ${formatDuration(thinkingDuration)}`}
    </Text>
  );
}
```

## Für dein Projekt: Einfacher Shimmer

```javascript
const SHIMMER_CHARS = "⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏";

class TerminalSpinner {
  frame = 0;
  interval = null;
  text = "";

  start(text) {
    this.text = text;
    this.interval = setInterval(() => {
      this.frame = (this.frame + 1) % SHIMMER_CHARS.length;
      const spinner = SHIMMER_CHARS[this.frame];

      // Rainbow-Effekt auf den Text
      const colored = this.text.split("").map((char, i) => {
        const dist = Math.abs(i - (this.frame * 2) % this.text.length);
        if (dist < 3) return `\x1b[33m${char}\x1b[0m`;  // Gelb
        if (dist < 6) return `\x1b[90m${char}\x1b[0m`;   // Grau
        return char;
      }).join("");

      process.stdout.write(`\r\x1b[2K ${spinner} ${colored}`);
    }, 80);
  }

  stop() {
    clearInterval(this.interval);
    process.stdout.write("\r\x1b[2K");
  }
}
```
