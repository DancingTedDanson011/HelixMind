import type { BrainExport } from './exporter.js';

export function generateBrainHTML(data: BrainExport): string {
  const dataJSON = JSON.stringify(data);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net blob:; style-src 'self' 'unsafe-inline'; connect-src 'self' ws://127.0.0.1:* wss://127.0.0.1:*; img-src 'self' data:; media-src 'self' blob:; worker-src blob:;">
<title>\u{1F300} HelixMind Brain \u2014 ${data.meta.projectName}</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { background: #050510; color: #e0e0e0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', monospace; overflow: hidden; }
canvas { display: block; }

#ui-overlay {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  pointer-events: none; z-index: 10;
}
#ui-overlay > * { pointer-events: auto; }

#header {
  position: fixed; top: 16px; left: 16px; z-index: 20;
  background: rgba(5,5,16,0.9); border: 1px solid rgba(0,212,255,0.15);
  border-radius: 12px; padding: 12px 20px; backdrop-filter: blur(16px);
}
#header h1 { font-size: 15px; color: #00d4ff; margin-bottom: 4px; letter-spacing: 1px; }
#header .stats { font-size: 11px; color: #556; }
#header .live-dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #0f0; margin-right: 6px; animation: livePulse 2s ease infinite; }
@keyframes livePulse { 0%,100% { opacity: 1; box-shadow: 0 0 4px #0f0; } 50% { opacity: 0.4; box-shadow: none; } }

#scope-switcher { display: flex; gap: 4px; margin-top: 6px; }
#scope-switcher .scope-btn {
  padding: 3px 10px; border-radius: 6px; font-size: 10px; cursor: pointer;
  border: 1px solid rgba(0,212,255,0.12); background: rgba(0,212,255,0.03);
  color: #556; transition: all 0.25s; user-select: none;
}
#scope-switcher .scope-btn.active {
  background: rgba(0,212,255,0.15); border-color: rgba(0,212,255,0.4); color: #00d4ff; font-weight: 600;
}
#scope-switcher .scope-btn.active.project-btn {
  background: rgba(0,212,255,0.15); border-color: rgba(0,212,255,0.4); color: #00d4ff;
}
#scope-switcher .scope-btn.active.global-btn {
  background: rgba(108,117,125,0.15); border-color: rgba(108,117,125,0.4); color: #6C757D;
}
#scope-switcher .scope-btn:hover:not(.active) { background: rgba(0,212,255,0.08); color: #889; }

#controls {
  position: fixed; top: 16px; right: 16px; z-index: 20;
  display: flex; flex-direction: column; gap: 6px;
}
.control-group {
  background: rgba(5,5,16,0.9); border: 1px solid rgba(0,212,255,0.1);
  border-radius: 8px; padding: 8px 12px; backdrop-filter: blur(16px);
}
.control-group label { font-size: 10px; color: #556; display: block; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 1px; }

#search-box {
  position: fixed; top: 16px; left: 50%; transform: translateX(-50%); z-index: 20;
  background: rgba(5,5,16,0.9); border: 1px solid rgba(0,212,255,0.2);
  border-radius: 20px; padding: 8px 20px; backdrop-filter: blur(16px);
}
#search-input {
  background: transparent; border: none; color: #e0e0e0; outline: none;
  font-size: 13px; width: 220px; font-family: inherit;
}
#search-input::placeholder { color: #445; }

.toggle-btn {
  display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px; margin: 1px;
  background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.08);
  border-radius: 4px; color: #334; cursor: pointer; font-size: 10px;
  transition: all 0.3s; user-select: none; opacity: 0.35;
}
.toggle-btn .ldot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; transition: all 0.3s; filter: saturate(0.2) brightness(0.4); }
.toggle-btn .lcount { font-size: 9px; opacity: 0.5; margin-left: 2px; }
.toggle-btn.active { opacity: 1; }
.toggle-btn.active .ldot { filter: saturate(1) brightness(1); }
.toggle-btn:hover { opacity: 0.8; }
.toggle-btn[data-edge] { opacity: 0.4; }
.toggle-btn[data-edge].active { opacity: 1; background: rgba(0,212,255,0.12); border-color: rgba(0,212,255,0.3); color: #00d4ff; }

#sidebar {
  position: fixed; right: -380px; top: 0; bottom: 0; width: 380px; z-index: 30;
  background: rgba(5,5,16,0.97); border-left: 1px solid rgba(0,212,255,0.1);
  backdrop-filter: blur(24px); padding: 24px; overflow-y: auto;
  transition: right 0.35s cubic-bezier(0.4,0,0.2,1);
}
#sidebar.open { right: 0; }
#sidebar h2 { color: #00d4ff; font-size: 14px; margin-bottom: 12px; padding-right: 32px; word-break: break-word; }
#sidebar .node-type { font-size: 10px; padding: 2px 8px; border-radius: 10px; display: inline-block; margin-bottom: 8px; }
#sidebar .content-preview { font-size: 12px; color: #8899aa; white-space: pre-wrap; word-break: break-word; background: rgba(0,212,255,0.03); border: 1px solid rgba(0,212,255,0.06); padding: 12px; border-radius: 8px; margin: 12px 0; max-height: 200px; overflow-y: auto; line-height: 1.5; }
#sidebar .relations { font-size: 11px; color: #667; list-style: none; }
#sidebar .relations li { margin: 4px 0; padding: 4px 0; border-bottom: 1px solid rgba(255,255,255,0.03); }
#sidebar .close-btn { position: absolute; top: 14px; right: 14px; cursor: pointer; color: #556; font-size: 18px; transition: all 0.2s; z-index: 2; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; border-radius: 6px; background: rgba(5,5,16,0.8); }
#sidebar .close-btn:hover { color: #fff; background: rgba(255,60,60,0.2); }
#sidebar .meta-row { font-size: 11px; color: #556; margin: 4px 0; }

#findings-panel {
  position: fixed; left: -320px; top: 0; bottom: 0; width: 320px; z-index: 25;
  background: rgba(5,5,16,0.97); border-right: 1px solid rgba(0,212,255,0.1);
  backdrop-filter: blur(24px); padding: 16px; overflow-y: auto;
  transition: left 0.35s cubic-bezier(0.4,0,0.2,1);
}
#findings-panel.open { left: 0; }
#findings-panel h2 { color: #00d4ff; font-size: 13px; margin-bottom: 12px; letter-spacing: 0.5px; }
#findings-panel .finding-item {
  padding: 10px 12px; margin-bottom: 6px; border-radius: 8px; cursor: pointer;
  background: rgba(0,212,255,0.03); border: 1px solid rgba(0,212,255,0.06);
  transition: all 0.2s; font-size: 11px; line-height: 1.4;
}
#findings-panel .finding-item:hover { background: rgba(0,212,255,0.08); border-color: rgba(0,212,255,0.2); }
#findings-panel .finding-item .f-severity {
  font-size: 9px; padding: 1px 6px; border-radius: 8px; display: inline-block; margin-bottom: 4px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;
}
#findings-panel .finding-item .f-severity.critical { background: rgba(255,0,0,0.15); color: #ff4444; }
#findings-panel .finding-item .f-severity.high { background: rgba(255,100,0,0.15); color: #ff6600; }
#findings-panel .finding-item .f-severity.medium { background: rgba(255,200,0,0.15); color: #ffaa00; }
#findings-panel .finding-item .f-severity.low { background: rgba(0,200,100,0.15); color: #00cc66; }
#findings-panel .finding-item .f-severity.info { background: rgba(0,180,255,0.15); color: #00b4ff; }
#findings-panel .finding-item .f-text { color: #aab; word-break: break-word; }
#findings-panel .finding-item .f-file { color: #556; font-size: 10px; margin-top: 3px; font-family: monospace; }
#findings-panel .f-session { color: #667; font-size: 10px; margin-bottom: 8px; }
#findings-panel .f-count { color: #556; font-size: 11px; margin-bottom: 8px; }
#findings-panel .f-empty { color: #445; font-size: 12px; text-align: center; margin-top: 40px; }
#findings-toggle {
  position: fixed; left: 16px; bottom: 16px; z-index: 26;
  background: rgba(5,5,16,0.9); border: 1px solid rgba(0,212,255,0.15);
  border-radius: 8px; padding: 6px 12px; cursor: pointer; color: #889;
  font-size: 11px; transition: all 0.2s;
}
#findings-toggle:hover { border-color: rgba(0,212,255,0.4); color: #00d4ff; }
#findings-toggle .badge { background: #ff4444; color: white; font-size: 9px; padding: 1px 5px; border-radius: 8px; margin-left: 4px; }

#models-toggle {
  position: fixed; left: 120px; bottom: 16px; z-index: 26;
  background: rgba(255,40,40,0.12); border: 1px solid rgba(255,40,40,0.35);
  border-radius: 8px; padding: 6px 12px; cursor: pointer; color: #ff6666;
  font-size: 11px; transition: all 0.2s;
}
#models-toggle:hover { background: rgba(255,40,40,0.25); border-color: rgba(255,40,40,0.6); color: #ff8888; }
#models-toggle.online { background: rgba(0,255,100,0.08); border-color: rgba(0,255,100,0.25); color: #00ff66; }
#models-toggle.online:hover { background: rgba(0,255,100,0.15); border-color: rgba(0,255,100,0.4); }
#models-toggle .status-dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; margin-right: 4px; }
#models-toggle .status-dot.online { background: #0f0; box-shadow: 0 0 4px #0f0; }
#models-toggle .status-dot.offline { background: #ff4444; box-shadow: 0 0 4px #ff4444; animation: livePulse 1.5s ease infinite; }

#models-panel {
  position: fixed; left: -400px; top: 0; bottom: 0; width: 400px; z-index: 28;
  background: rgba(5,5,16,0.97); border-right: 1px solid rgba(0,212,255,0.1);
  backdrop-filter: blur(24px); padding: 20px; overflow-y: auto;
  transition: left 0.35s cubic-bezier(0.4,0,0.2,1);
}
#models-panel.open { left: 0; }
#models-panel h2 { color: #00d4ff; font-size: 14px; margin-bottom: 6px; letter-spacing: 0.5px; }
#models-panel .mp-subtitle { color: #556; font-size: 11px; margin-bottom: 14px; }
#models-panel .mp-close { position: absolute; top: 14px; right: 14px; cursor: pointer; color: #556; font-size: 18px; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; border-radius: 6px; background: rgba(5,5,16,0.8); transition: all 0.2s; z-index: 2; }
#models-panel .mp-close:hover { color: #fff; background: rgba(255,60,60,0.2); }
#models-panel .mp-section { margin-bottom: 16px; }
#models-panel .mp-section-title { font-size: 10px; color: #556; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; padding-bottom: 4px; border-bottom: 1px solid rgba(0,212,255,0.06); }

#gpu-filter { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 14px; }
#gpu-filter .gpu-btn {
  padding: 4px 10px; border-radius: 6px; font-size: 10px; cursor: pointer;
  background: rgba(0,212,255,0.05); border: 1px solid rgba(0,212,255,0.12);
  color: #778; transition: all 0.2s; user-select: none;
}
#gpu-filter .gpu-btn.active { background: rgba(0,212,255,0.15); border-color: rgba(0,212,255,0.4); color: #00d4ff; }
#gpu-filter .gpu-btn:hover { background: rgba(0,212,255,0.1); color: #aad; }

.model-card {
  padding: 10px 12px; margin-bottom: 6px; border-radius: 8px;
  background: rgba(0,212,255,0.03); border: 1px solid rgba(0,212,255,0.06);
  transition: all 0.2s; font-size: 11px;
}
.model-card:hover { background: rgba(0,212,255,0.08); border-color: rgba(0,212,255,0.2); }
.model-card .mc-name { color: #e0e0e0; font-weight: 600; font-size: 12px; }
.model-card .mc-meta { color: #556; font-size: 10px; margin-top: 2px; }
.model-card .mc-desc { color: #889; font-size: 10px; margin-top: 4px; }
.model-card .mc-status { font-size: 9px; padding: 1px 6px; border-radius: 8px; display: inline-block; margin-top: 4px; }
.model-card .mc-status.running { background: rgba(0,255,0,0.12); color: #0f0; }
.model-card .mc-status.installed { background: rgba(0,212,255,0.12); color: #00d4ff; }
.model-card .mc-status.available { background: rgba(255,170,0,0.12); color: #ffaa00; }
.model-card .mc-actions { margin-top: 6px; display: flex; gap: 6px; }
.model-card .mc-btn {
  padding: 3px 10px; border-radius: 5px; font-size: 10px; cursor: pointer;
  border: 1px solid rgba(0,212,255,0.2); background: rgba(0,212,255,0.08);
  color: #00d4ff; transition: all 0.2s;
}
.model-card .mc-btn:hover { background: rgba(0,212,255,0.2); }
.model-card .mc-btn.primary { border-color: rgba(0,255,100,0.3); background: rgba(0,255,100,0.08); color: #00ff66; }
.model-card .mc-btn.primary:hover { background: rgba(0,255,100,0.2); }
.model-card .mc-btn.danger { border-color: rgba(255,60,60,0.2); background: rgba(255,60,60,0.08); color: #ff4444; }
.model-card .mc-btn.danger:hover { background: rgba(255,60,60,0.2); }
.model-card .mc-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.model-card .mc-progress { margin-top: 6px; display: none; }
.model-card .mc-progress.active { display: block; }
.model-card .mc-progress-bar { height: 3px; background: rgba(0,212,255,0.15); border-radius: 2px; overflow: hidden; }
.model-card .mc-progress-fill { height: 100%; background: linear-gradient(90deg, #00d4ff, #00ff88); border-radius: 2px; width: 0%; transition: width 0.3s; }
.model-card .mc-progress-text { font-size: 9px; color: #556; margin-top: 2px; }

#help-btn {
  position: fixed; bottom: 16px; left: 50%; transform: translateX(calc(-50% + 180px)); z-index: 20;
  width: 28px; height: 28px; border-radius: 50%;
  background: rgba(5,5,16,0.9); border: 1px solid rgba(0,212,255,0.15);
  color: #556; font-size: 13px; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  backdrop-filter: blur(16px); transition: all 0.3s;
}
#help-btn:hover { border-color: rgba(0,212,255,0.4); color: #00d4ff; }

#help-overlay {
  position: fixed; inset: 0; z-index: 50;
  background: rgba(5,5,16,0.85); backdrop-filter: blur(12px);
  display: none; align-items: center; justify-content: center;
}
#help-overlay.open { display: flex; }
#help-box {
  background: rgba(10,10,24,0.98); border: 1px solid rgba(0,212,255,0.2);
  border-radius: 16px; padding: 28px 36px; max-width: 520px; width: 90%;
  box-shadow: 0 16px 64px rgba(0,0,0,0.6);
}
#help-box h3 { color: #00d4ff; font-size: 15px; margin-bottom: 16px; letter-spacing: 1px; }
#help-box .help-section { margin-bottom: 14px; }
#help-box .help-section h4 { color: #889; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; }
#help-box .help-row { display: flex; justify-content: space-between; align-items: center; padding: 3px 0; font-size: 12px; }
#help-box .help-key { color: #00d4ff; font-family: monospace; background: rgba(0,212,255,0.08); padding: 1px 6px; border-radius: 3px; border: 1px solid rgba(0,212,255,0.15); font-size: 11px; }
#help-box .help-desc { color: #778; }
#help-box .help-close { margin-top: 16px; text-align: center; font-size: 11px; color: #445; }

#tooltip {
  position: fixed; display: none; z-index: 25;
  background: rgba(5,5,16,0.97); border: 1px solid rgba(0,212,255,0.25);
  border-radius: 10px; padding: 12px 16px; pointer-events: none;
  backdrop-filter: blur(16px); max-width: 320px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.5), 0 0 16px rgba(0,212,255,0.08);
}
#tooltip .tt-name { color: #00d4ff; font-size: 13px; font-weight: 600; }
#tooltip .tt-type { font-size: 10px; color: #556; margin-top: 2px; }
#tooltip .tt-meta { color: #667; font-size: 11px; margin-top: 4px; }

#legend {
  position: fixed; bottom: 56px; left: 16px; z-index: 20;
  background: rgba(5,5,16,0.9); border: 1px solid rgba(0,212,255,0.1);
  border-radius: 8px; padding: 10px 14px; backdrop-filter: blur(16px);
  font-size: 10px; color: #556;
}
#legend .item { display: flex; align-items: center; gap: 6px; margin: 2px 0; }
#legend .dot { width: 8px; height: 8px; border-radius: 50%; box-shadow: 0 0 6px currentColor; }

#status {
  position: fixed; bottom: 16px; right: 16px; z-index: 20;
  background: rgba(5,5,16,0.9); border: 1px solid rgba(0,212,255,0.1);
  border-radius: 8px; padding: 8px 14px; backdrop-filter: blur(16px);
  font-size: 10px; color: #556;
}

#voice-panel {
  position: fixed; bottom: 16px; left: 50%; transform: translateX(-50%); z-index: 35;
  background: rgba(5,5,16,0.95); border: 1px solid rgba(0,212,255,0.15);
  border-radius: 16px; padding: 10px 16px; backdrop-filter: blur(24px);
  display: flex; align-items: center; gap: 12px;
  box-shadow: 0 8px 40px rgba(0,0,0,0.5);
  transition: all 0.3s cubic-bezier(0.4,0,0.2,1);
}
#voice-panel.recording { border-color: rgba(255,60,60,0.5); box-shadow: 0 0 30px rgba(255,60,60,0.15), 0 8px 40px rgba(0,0,0,0.5); }
#voice-btn {
  width: 42px; height: 42px; border-radius: 50%; border: 2px solid rgba(0,212,255,0.3);
  background: rgba(0,212,255,0.08); cursor: pointer; display: flex;
  align-items: center; justify-content: center; transition: all 0.3s;
  color: #556; font-size: 18px; flex-shrink: 0;
}
#voice-btn:hover { border-color: rgba(0,212,255,0.6); background: rgba(0,212,255,0.15); color: #00d4ff; }
#voice-btn.recording { border-color: #ff3c3c; background: rgba(255,60,60,0.15); color: #ff3c3c; animation: voicePulse 1.2s ease infinite; }
@keyframes voicePulse { 0%,100% { box-shadow: 0 0 0 0 rgba(255,60,60,0.4); } 50% { box-shadow: 0 0 0 10px rgba(255,60,60,0); } }
#voice-transcript { flex: 1; min-width: 200px; max-width: 500px; font-size: 13px; color: #e0e0e0; min-height: 20px; max-height: 60px; overflow-y: auto; word-break: break-word; }
#voice-transcript.placeholder { color: #445; font-style: italic; }
#voice-send { padding: 6px 14px; border-radius: 8px; border: 1px solid rgba(0,212,255,0.3); background: rgba(0,212,255,0.1); color: #00d4ff; cursor: pointer; font-size: 12px; font-weight: 600; transition: all 0.2s; flex-shrink: 0; display: none; }
#voice-send:hover { background: rgba(0,212,255,0.25); border-color: rgba(0,212,255,0.5); }
#voice-send.visible { display: block; }
#voice-waveform { display: none; align-items: center; gap: 2px; height: 24px; flex-shrink: 0; }
#voice-panel.recording #voice-waveform { display: flex; }
.waveform-bar { width: 3px; background: #ff3c3c; border-radius: 2px; animation: waveformPulse 0.6s ease-in-out infinite alternate; }
@keyframes waveformPulse { from { height: 4px; opacity: 0.4; } to { height: 20px; opacity: 1; } }
#voice-lang { background: transparent; border: 1px solid rgba(0,212,255,0.15); border-radius: 4px; color: #556; font-size: 9px; padding: 2px 4px; cursor: pointer; flex-shrink: 0; }
#voice-lang:focus { outline: none; border-color: rgba(0,212,255,0.4); }
#voice-status { font-size: 9px; color: #445; flex-shrink: 0; min-width: 40px; text-align: center; }

#web-knowledge-container {
  position: fixed; top: 80px; right: 16px; z-index: 40;
  display: flex; flex-direction: column; gap: 8px;
  pointer-events: none; max-width: 340px;
}
.web-knowledge-popup {
  background: rgba(5,5,16,0.95); border: 1px solid rgba(0,255,136,0.3);
  border-radius: 12px; padding: 14px 18px; backdrop-filter: blur(24px);
  box-shadow: 0 4px 24px rgba(0,255,136,0.15), 0 0 60px rgba(0,255,136,0.05);
  animation: wkSlideIn 0.5s cubic-bezier(0.16,1,0.3,1) forwards;
  opacity: 0; transform: translateX(60px); pointer-events: auto;
  transition: opacity 0.4s ease, transform 0.4s ease;
}
.web-knowledge-popup.removing { opacity: 0 !important; transform: translateX(60px) !important; }
.web-knowledge-popup .wk-header { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.web-knowledge-popup .wk-icon { font-size: 16px; }
.web-knowledge-popup .wk-title { font-size: 11px; color: #00ff88; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; }
.web-knowledge-popup .wk-topic { font-size: 13px; color: #e0e0e0; font-weight: 500; margin-bottom: 4px; }
.web-knowledge-popup .wk-summary { font-size: 11px; color: #8899aa; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.web-knowledge-popup .wk-source { font-size: 9px; color: #445566; margin-top: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.web-knowledge-popup .wk-progress { height: 2px; background: rgba(0,255,136,0.1); border-radius: 1px; margin-top: 8px; overflow: hidden; }
.web-knowledge-popup .wk-progress-bar { height: 100%; background: linear-gradient(90deg, #00ff88, #00d4ff); border-radius: 1px; width: 100%; animation: wkShrink 6s linear forwards; }
@keyframes wkSlideIn { from { opacity: 0; transform: translateX(60px) scale(0.95); } to { opacity: 1; transform: translateX(0) scale(1); } }
@keyframes wkShrink { from { width: 100%; } to { width: 0%; } }
</style>
</head>
<body>

<div id="header">
  <h1><span class="live-dot"></span>\u{1F300} HelixMind Brain</h1>
  <div class="stats" id="stats-text">${data.meta.totalNodes} nodes \u00B7 ${data.meta.totalEdges} connections${data.meta.webKnowledgeCount > 0 ? ` \\u00B7 ${data.meta.webKnowledgeCount} web` : ''} \u00B7 ${data.meta.projectName}</div>
  <div id="scope-switcher">
    <span class="scope-btn project-btn${data.meta.brainScope === 'project' ? ' active' : ''}" data-scope="project">\u{1F4C1} Local</span>
    <span class="scope-btn global-btn${data.meta.brainScope !== 'project' ? ' active' : ''}" data-scope="global">\u{1F310} Global</span>
  </div>
</div>

<div id="search-box"><input id="search-input" type="text" placeholder="Search nodes..." aria-label="Search nodes" /></div>

<div id="controls">
  <div class="control-group">
    <label>Levels</label>
    <span class="toggle-btn active" data-level="5" data-color="#FF6B6B"><span class="ldot" style="background:#FF6B6B;box-shadow:0 0 6px #FF6B6B"></span>L5 Deep<span class="lcount" id="lc5"></span></span>
    <span class="toggle-btn active" data-level="4" data-color="#00FFFF"><span class="ldot" style="background:#00FFFF;box-shadow:0 0 6px #00FFFF"></span>L4 Archive<span class="lcount" id="lc4"></span></span>
    <span class="toggle-btn active" data-level="3" data-color="#7B68EE"><span class="ldot" style="background:#7B68EE;box-shadow:0 0 6px #7B68EE"></span>L3 Ref<span class="lcount" id="lc3"></span></span>
    <span class="toggle-btn active" data-level="2" data-color="#00ff88"><span class="ldot" style="background:#00ff88;box-shadow:0 0 6px #00ff88"></span>L2 Active<span class="lcount" id="lc2"></span></span>
    <span class="toggle-btn active" data-level="1" data-color="#E040FB"><span class="ldot" style="background:#E040FB;box-shadow:0 0 6px #E040FB"></span>L1 Focus<span class="lcount" id="lc1"></span></span>
    <span class="toggle-btn active" data-level="6" data-color="#FFD700"><span class="ldot" style="background:#FFD700;box-shadow:0 0 6px #FFD700"></span>L6 Web<span class="lcount" id="lc6"></span></span>
  </div>
  <div class="control-group">
    <label>Relations</label>
    <span class="toggle-btn active" data-edge="all">All</span>
    <span class="toggle-btn" data-edge="references">Refs</span>
    <span class="toggle-btn" data-edge="depends_on">Depends</span>
    <span class="toggle-btn" data-edge="related_to">Related</span>
    <span class="toggle-btn" data-edge="evolved_from">Evolved</span>
    <span class="toggle-btn" data-edge="supports">Supports</span>
    <span class="toggle-btn" data-edge="extends">Extends</span>
    <span class="toggle-btn" data-edge="implements">Impl</span>
    <span class="toggle-btn" data-edge="uses">Uses</span>
    <span class="toggle-btn" data-edge="imports">Imports</span>
  </div>
</div>

<div id="sidebar"><span class="close-btn" id="sidebar-close">\u2715</span><div id="sidebar-content"></div></div>
<div id="tooltip"><div class="tt-name"></div><div class="tt-type"></div><div class="tt-meta"></div></div>

<div id="legend">
  <div class="item"><span class="dot" style="color:#E040FB"></span> L1 Focus</div>
  <div class="item"><span class="dot" style="color:#00FF88"></span> L2 Active</div>
  <div class="item"><span class="dot" style="color:#7B68EE"></span> L3 Reference</div>
  <div class="item"><span class="dot" style="color:#00FFFF"></span> L4 Archive</div>
  <div class="item"><span class="dot" style="color:#FF6B6B"></span> L5 Deep Archive</div>
  <div class="item"><span class="dot" style="color:#FFD700"></span> L6 Web Knowledge</div>
  <div style="margin-top:4px;font-size:9px;color:#445;border-top:1px solid rgba(255,255,255,0.04);padding-top:4px">Edges = node level colors</div>
</div>

<div id="status"><span id="node-count">0</span> nodes \u00B7 <span id="fps-counter">60</span> fps \u00B7 <span id="web-count" style="color:#FFAA00"></span></div>
<div id="web-knowledge-container"></div>

<div id="findings-panel">
  <h2>\u{1F50D} Agent Findings</h2>
  <div class="f-count" id="findings-count"></div>
  <div id="findings-list"><div class="f-empty">No findings yet.<br>Start /security or /auto to see live results.</div></div>
</div>
<button id="findings-toggle" title="Toggle findings panel">\u{1F50D} Findings <span class="badge" id="findings-badge" style="display:none">0</span></button>
<button id="models-toggle" title="Local LLM Models"><span class="status-dot offline" id="ollama-dot"></span>\u{1F9E0} Models</button>

<div id="models-panel">
  <span class="mp-close" id="models-close">\u2715</span>
  <h2>\u{1F9E0} LLM Models</h2>
  <div class="mp-subtitle" id="ollama-status">Checking Ollama...</div>
  <div class="mp-section" id="cloud-section"><div class="mp-section-title">\u{2601} Cloud Models</div><div id="cloud-models"><div style="color:#445;font-size:11px">Loading cloud models...</div></div></div>
  <div class="mp-section"><div class="mp-section-title">GPU / VRAM Filter</div>
    <div id="gpu-filter">
      <span class="gpu-btn" data-vram="8">8 GB</span><span class="gpu-btn" data-vram="12">12 GB</span>
      <span class="gpu-btn" data-vram="16">16 GB</span><span class="gpu-btn" data-vram="24">24 GB</span>
      <span class="gpu-btn active" data-vram="32">32 GB (RTX 5090)</span><span class="gpu-btn" data-vram="48">48 GB</span>
    </div>
  </div>
  <div class="mp-section" id="running-section" style="display:none"><div class="mp-section-title">\u{25B6} Running Models</div><div id="running-models"></div></div>
  <div class="mp-section" id="installed-section"><div class="mp-section-title">\u{2705} Installed Models</div><div id="installed-models"><div style="color:#445;font-size:11px">Loading...</div></div></div>
  <div class="mp-section"><div class="mp-section-title">\u{2B50} Recommended for Coding</div><div id="recommended-models"></div></div>
</div>

<button id="help-btn" title="Keyboard shortcuts & controls">?</button>
<div id="help-overlay">
  <div id="help-box">
    <h3>\u{1F300} HelixMind Brain \u2014 Controls</h3>
    <div class="help-section"><h4>Navigation</h4>
      <div class="help-row"><span class="help-key">Left Drag</span> <span class="help-desc">Rotate view</span></div>
      <div class="help-row"><span class="help-key">Right Drag</span> <span class="help-desc">Pan view</span></div>
      <div class="help-row"><span class="help-key">Scroll</span> <span class="help-desc">Zoom in / out</span></div>
    </div>
    <div class="help-section"><h4>Nodes</h4>
      <div class="help-row"><span class="help-key">Click</span> <span class="help-desc">Select node \u2192 zoom in + details</span></div>
      <div class="help-row"><span class="help-key">Hover</span> <span class="help-desc">Preview node info</span></div>
    </div>
    <div class="help-section"><h4>Keyboard</h4>
      <div class="help-row"><span class="help-key">?</span> <span class="help-desc">Toggle this help</span></div>
      <div class="help-row"><span class="help-key">Esc</span> <span class="help-desc">Close sidebar / help</span></div>
    </div>
    <div class="help-close">Press <span style="color:#00d4ff">?</span> or <span style="color:#00d4ff">Esc</span> to close</div>
  </div>
</div>

<div id="voice-panel">
  <button id="voice-btn" title="Voice Input">\u{1F3A4}</button>
  <div id="voice-waveform"></div>
  <div id="voice-transcript" class="placeholder">Click mic to speak...</div>
  <select id="voice-lang" title="Language" aria-label="Voice language"><option value="de-DE">DE</option><option value="en-US">EN</option></select>
  <span id="voice-status"></span>
  <button id="voice-send">\u{2191} Send</button>
</div>

<script type="importmap">
{ "imports": {
  "three": "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js",
  "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/"
} }
</script>

<script type="module">
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ===== DATA =====
let BRAIN_DATA = ${dataJSON};

// ===== CONSTANTS =====
const LVL_HEX = { 1: 0xE040FB, 2: 0x00FF88, 3: 0x7B68EE, 4: 0x00FFFF, 5: 0xFF6B6B, 6: 0xFFD700 };
const LVL_CSS = { 1: '#E040FB', 2: '#00FF88', 3: '#7B68EE', 4: '#00FFFF', 5: '#FF6B6B', 6: '#FFD700' };
const LVL_SIZE = { 1:6, 2:7, 3:12, 4:16, 5:22, 6:10 };
let curSpread=600;
const BASE_SPREAD=400, REP=28000, ATT=0.002, ILEN=100, DAMP=0.82, GCELL=160, MAX_E=18000;
const EDGE_COL={references:'#7B68EE',depends_on:'#E040FB',related_to:'#556',evolved_from:'#00FFFF',supports:'#00FF88',extends:'#FFD700',implements:'#FF6B6B',uses:'#00d4ff',imports:'#00ff88',default:'#445'};

function srand(s) { const x=Math.sin(s*9301+49297)*49297; return x-Math.floor(x); }
function esc(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// ===== RENDERER (max perf: no AA, pixelRatio 1) =====
const R = new THREE.WebGLRenderer({ antialias:false, alpha:true, powerPreference:'high-performance' });
R.setSize(innerWidth, innerHeight);
R.setPixelRatio(1);
document.body.prepend(R.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#050510');
scene.fog = new THREE.FogExp2('#050510', 0.000012);

const cam = new THREE.PerspectiveCamera(55, innerWidth/innerHeight, 1, 30000);
cam.position.set(0, 500, 3000);

const ctrl = new OrbitControls(cam, R.domElement);
ctrl.target.set(0,0,0);
ctrl.enableDamping = true;
ctrl.dampingFactor = 0.06;
ctrl.autoRotate = true;
ctrl.autoRotateSpeed = 0.08;
ctrl.minDistance = 80;
ctrl.maxDistance = 15000;
ctrl.maxPolarAngle = Math.PI * 0.85;
ctrl.minPolarAngle = Math.PI * 0.15;
ctrl.update();

// ===== STARS (static) =====
const stP = new Float32Array(700*3);
for(let i=0;i<700;i++){ stP[i*3]=(srand(i*31)-.5)*5000; stP[i*3+1]=(srand(i*37)-.5)*5000; stP[i*3+2]=(srand(i*41)-.5)*5000; }
const stG = new THREE.BufferGeometry();
stG.setAttribute('position', new THREE.BufferAttribute(stP,3));
scene.add(new THREE.Points(stG, new THREE.PointsMaterial({ size:1.2, color:'#223344', transparent:true, opacity:0.5, blending:THREE.AdditiveBlending, depthWrite:false, sizeAttenuation:true })));

// ===== STATIC SHADERS (zero per-frame cost) =====
const nMat = new THREE.ShaderMaterial({
  vertexShader: \`
    attribute float aSize;
    attribute vec3 aColor;
    attribute float aHL;
    varying vec3 vC;
    varying float vA;
    void main(){
      vC=aColor; vA=aHL;
      vec4 mv=modelViewMatrix*vec4(position,1.0);
      gl_PointSize=aSize*aHL*(1200.0/-mv.z);
      gl_Position=projectionMatrix*mv;
    }\`,
  fragmentShader: \`
    varying vec3 vC;
    varying float vA;
    void main(){
      vec2 c=gl_PointCoord-vec2(.5);
      float d=length(c);
      if(d>.5)discard;
      float i=exp(-d*d*50.0)*0.9+exp(-d*d*8.0)*0.4+exp(-d*d*2.5)*0.15;
      float core=exp(-d*d*50.0);
      gl_FragColor=vec4(vC*(1.0+core*1.0),i*vA);
    }\`,
  transparent:true, depthWrite:false, blending:THREE.NormalBlending
});

const eMat = new THREE.ShaderMaterial({
  vertexShader: \`
    attribute vec3 color;
    attribute float aA;
    varying vec3 vC;
    varying float vA;
    void main(){ vC=color; vA=aA; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }\`,
  fragmentShader: \`
    varying vec3 vC;
    varying float vA;
    void main(){ gl_FragColor=vec4(vC,vA); }\`,
  transparent:true, depthWrite:false, blending:THREE.AdditiveBlending
});

// ===== SIGNAL PARTICLE MATERIAL (neural impulses) =====
const sigMat = new THREE.ShaderMaterial({
  vertexShader: \`
    attribute float aSize;
    attribute vec3 aColor;
    varying vec3 vC;
    void main(){
      vC=aColor;
      vec4 mv=modelViewMatrix*vec4(position,1.0);
      gl_PointSize=aSize*(1200.0/-mv.z);
      gl_Position=projectionMatrix*mv;
    }\`,
  fragmentShader: \`
    varying vec3 vC;
    void main(){
      vec2 c=gl_PointCoord-vec2(.5);
      float d=length(c);
      if(d>.5)discard;
      float glow=exp(-d*d*20.0)+exp(-d*d*5.0)*0.4;
      gl_FragColor=vec4(vC*2.0,glow*0.9);
    }\`,
  transparent:true, depthWrite:false, blending:THREE.AdditiveBlending
});

// ===== SCENE STATE =====
let nPts=null, nGeo=null, eLines=null, eGeo=null;
let sigPts=null, sigGeo=null, sigData=[];
const SIG_COUNT=80;
let nodeVisEdges={};
let nodes=[], pos=[], byLvl={}, adj={}, nMap={}, nEdgeMap={}, vEdges=[], nC=0, eC=0;
const tc=new THREE.Color(), tc2=new THREE.Color();
let layoutWorker=null, lastNodeIds='';

// ===== WEB WORKER FORCE SIMULATION (non-blocking) =====
const workerCode=\`
self.onmessage=function(ev){
  const{nC,levels,lvlCounts,ePairs,SPREAD,REP,ATT,ILEN,DAMP,GCELL,STEPS}=ev.data;
  function srand(s){const x=Math.sin(s*9301+49297)*49297;return x-Math.floor(x);}

  // Level centroids along a HELIX path (organic, non-spherical)
  const uLvl=[...new Set(levels)].sort().filter(l=>l!==6); // L6 gets satellite treatment
  const centroids={};
  const GA=2.399963;
  uLvl.forEach((lv,i)=>{
    const t=(i+0.5)/Math.max(uLvl.length,1);
    const height=(t-0.5)*SPREAD*2.4;
    const radius=SPREAD*0.7+SPREAD*0.15*Math.sin(t*Math.PI*2);
    const angle=GA*i*2.5;
    centroids[lv]={x:radius*Math.cos(angle), y:height, z:radius*Math.sin(angle)};
  });

  // L6 Web Knowledge: multiple satellite clusters distributed AROUND the brain
  const l6Indices=[];
  for(let i=0;i<nC;i++) if(levels[i]===6) l6Indices.push(i);
  const SAT_SIZE=7; // nodes per satellite cluster
  const numSats=Math.max(1,Math.ceil(l6Indices.length/SAT_SIZE));
  const satCentroids=[];
  for(let s=0;s<numSats;s++){
    // Distribute on sphere using fibonacci/golden angle for even spacing
    const phi=Math.acos(1-2*(s+0.5)/numSats);
    const theta=GA*s*3.7;
    const satR=SPREAD*1.6; // orbit distance — outside main brain
    satCentroids.push({
      x:satR*Math.sin(phi)*Math.cos(theta),
      y:satR*Math.cos(phi)*0.8, // slightly flattened
      z:satR*Math.sin(phi)*Math.sin(theta)
    });
  }
  // Map each L6 node to its satellite cluster
  const l6Sat={};
  l6Indices.forEach((ni,idx)=>{ l6Sat[ni]=Math.floor(idx/SAT_SIZE)%numSats; });

  // Init: L1 scattered, L6 at satellite positions, L2-L5 near helix centroids
  const P=new Float64Array(nC*3), V=new Float64Array(nC*3);
  for(let i=0;i<nC;i++){
    const lv=levels[i];
    const phi=Math.acos(2*srand(i*13)-1), th=srand(i*17)*Math.PI*2;
    if(lv===1){
      // L1 Focus: scatter across entire volume, driven by edges
      const r=SPREAD*0.9*Math.cbrt(srand(i*23));
      P[i*3]=r*Math.sin(phi)*Math.cos(th);
      P[i*3+1]=r*Math.sin(phi)*Math.sin(th);
      P[i*3+2]=r*Math.cos(phi);
    } else if(lv===6){
      // L6 Web: tight cluster at assigned satellite position
      const sc=satCentroids[l6Sat[i]]||satCentroids[0];
      const r=SPREAD*0.06*Math.cbrt(srand(i*23));
      P[i*3]=sc.x+r*Math.sin(phi)*Math.cos(th);
      P[i*3+1]=sc.y+r*Math.sin(phi)*Math.sin(th);
      P[i*3+2]=sc.z+r*Math.cos(phi);
    } else {
      const c=centroids[lv]||{x:0,y:0,z:0};
      const lc=lvlCounts[lv]||1;
      const initR=SPREAD*0.15*Math.sqrt(Math.max(lc/50,1));
      const r=initR*Math.cbrt(srand(i*23));
      P[i*3]=c.x+r*Math.sin(phi)*Math.cos(th);
      P[i*3+1]=c.y+r*Math.sin(phi)*Math.sin(th);
      P[i*3+2]=c.z+r*Math.cos(phi);
    }
  }

  const CPULL=0.005;

  for(let step=0;step<STEPS;step++){
    const decay=1-step/STEPS*0.3;

    // Grid-based repulsion
    const grid={};
    for(let i=0;i<nC;i++){
      const k=Math.floor(P[i*3]/GCELL)+','+Math.floor(P[i*3+1]/GCELL)+','+Math.floor(P[i*3+2]/GCELL);
      if(!grid[k])grid[k]=[];grid[k].push(i);
    }
    for(let i=0;i<nC;i++){
      const gx=Math.floor(P[i*3]/GCELL),gy=Math.floor(P[i*3+1]/GCELL),gz=Math.floor(P[i*3+2]/GCELL);
      for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(let dz=-1;dz<=1;dz++){
        const c=grid[(gx+dx)+','+(gy+dy)+','+(gz+dz)];
        if(!c)continue;
        for(const j of c){
          if(j<=i)continue;
          const ddx=P[i*3]-P[j*3],ddy=P[i*3+1]-P[j*3+1],ddz=P[i*3+2]-P[j*3+2];
          const dSq=ddx*ddx+ddy*ddy+ddz*ddz+1,d=Math.sqrt(dSq),f=REP*decay/dSq;
          const fx=ddx*f/d,fy=ddy*f/d,fz=ddz*f/d;
          V[i*3]+=fx;V[i*3+1]+=fy;V[i*3+2]+=fz;
          V[j*3]-=fx;V[j*3+1]-=fy;V[j*3+2]-=fz;
        }
      }
    }

    // Edge attraction (same-level 2x, cross-level 0.6x)
    for(const[si,ti]of ePairs){
      const ddx=P[ti*3]-P[si*3],ddy=P[ti*3+1]-P[si*3+1],ddz=P[ti*3+2]-P[si*3+2];
      const d=Math.sqrt(ddx*ddx+ddy*ddy+ddz*ddz)+0.1;
      const sameLvl=levels[si]===levels[ti]?2.0:0.6;
      const f=(d-ILEN)*ATT*sameLvl;
      const fx=ddx/d*f,fy=ddy/d*f,fz=ddz/d*f;
      V[si*3]+=fx;V[si*3+1]+=fy;V[si*3+2]+=fz;
      V[ti*3]-=fx;V[ti*3+1]-=fy;V[ti*3+2]-=fz;
    }

    // Cluster pull: L1 free, L6 toward satellites, L2-L5 toward helix centroids
    for(let i=0;i<nC;i++){
      if(levels[i]===1)continue;
      if(levels[i]===6){
        // L6: pull toward assigned satellite centroid (stronger to keep orbit)
        const sc=satCentroids[l6Sat[i]];
        if(sc){
          V[i*3]+=(sc.x-P[i*3])*CPULL*2;
          V[i*3+1]+=(sc.y-P[i*3+1])*CPULL*2;
          V[i*3+2]+=(sc.z-P[i*3+2])*CPULL*2;
        }
        continue;
      }
      const c=centroids[levels[i]];
      if(!c)continue;
      V[i*3]+=(c.x-P[i*3])*CPULL;
      V[i*3+1]+=(c.y-P[i*3+1])*CPULL;
      V[i*3+2]+=(c.z-P[i*3+2])*CPULL;
    }

    // Apply velocity + damping
    for(let i=0;i<nC*3;i++){P[i]+=V[i];V[i]*=DAMP;}
  }

  const result=new Float32Array(nC*3);
  for(let i=0;i<nC*3;i++)result[i]=P[i];
  self.postMessage({positions:result},[result.buffer]);
};
\`;
const workerBlob=new Blob([workerCode],{type:'application/javascript'});
const workerURL=URL.createObjectURL(workerBlob);

// ===== BUILD SCENE (geometry from positions) =====
function buildGeometry(P){
  if(nGeo){nGeo.dispose();scene.remove(nPts);}
  if(eGeo){eGeo.dispose();scene.remove(eLines);}

  pos=new Array(nC);
  for(let i=0;i<nC;i++) pos[i]=new THREE.Vector3(P[i*3],P[i*3+1],P[i*3+2]);

  // --- NODES ---
  nGeo=new THREE.BufferGeometry();
  const nP=new Float32Array(nC*3), nCol=new Float32Array(nC*3), nSz=new Float32Array(nC), nHL=new Float32Array(nC);
  for(let i=0;i<nC;i++){
    const p=pos[i], n=nodes[i];
    nP[i*3]=p.x; nP[i*3+1]=p.y; nP[i*3+2]=p.z;
    tc.set(LVL_HEX[n.level]||0x00FFFF);
    nCol[i*3]=tc.r; nCol[i*3+1]=tc.g; nCol[i*3+2]=tc.b;
    nSz[i]=LVL_SIZE[n.level]||36;
    nHL[i]=1.0;
  }
  nGeo.setAttribute('position',new THREE.BufferAttribute(nP,3));
  nGeo.setAttribute('aColor',new THREE.BufferAttribute(nCol,3));
  nGeo.setAttribute('aSize',new THREE.BufferAttribute(nSz,1));
  nGeo.setAttribute('aHL',new THREE.BufferAttribute(nHL,1));
  nPts=new THREE.Points(nGeo,nMat);
  scene.add(nPts);

  // --- EDGES (level-based colors, improved alpha) ---
  const crossE=[], sameE=[];
  BRAIN_DATA.edges.forEach((e,i)=>{
    const si=nMap[e.source], ti=nMap[e.target];
    if(si===undefined||ti===undefined) return;
    const obj={si,ti,w:e.weight,t:e.type,i,cross:nodes[si].level!==nodes[ti].level};
    if(obj.cross) crossE.push(obj); else sameE.push(obj);
  });
  crossE.sort((a,b)=>b.w-a.w);
  sameE.sort((a,b)=>b.w-a.w);
  // Always include ALL cross-level edges (bridges between clusters), fill rest with same-level
  vEdges=[...crossE, ...sameE].slice(0,MAX_E);
  eC=vEdges.length;

  const eP=new Float32Array(eC*6), eCol=new Float32Array(eC*6), eA=new Float32Array(eC*2);
  const ec=new THREE.Color(), aS=Math.min(1.0,2500/eC);
  for(let i=0;i<eC;i++){
    const{si,ti,w,cross}=vEdges[i];
    const s=pos[si], d=pos[ti], o=i*6;
    eP[o]=s.x; eP[o+1]=s.y; eP[o+2]=s.z;
    eP[o+3]=d.x; eP[o+4]=d.y; eP[o+5]=d.z;
    // Edge color = level color of connected nodes (gradient)
    ec.set(LVL_HEX[nodes[si].level]||0x00FFFF);
    eCol[o]=ec.r; eCol[o+1]=ec.g; eCol[o+2]=ec.b;
    ec.set(LVL_HEX[nodes[ti].level]||0x00FFFF);
    eCol[o+3]=ec.r; eCol[o+4]=ec.g; eCol[o+5]=ec.b;
    // Cross-level edges (bridges) get alpha boost so satellite connections are visible
    const ba=cross?(0.08+w*0.2):(0.04+w*0.1);
    eA[i*2]=ba*aS; eA[i*2+1]=ba*aS;
  }
  eGeo=new THREE.BufferGeometry();
  eGeo.setAttribute('position',new THREE.BufferAttribute(eP,3));
  eGeo.setAttribute('color',new THREE.BufferAttribute(eCol,3));
  eGeo.setAttribute('aA',new THREE.BufferAttribute(eA,1));
  eLines=new THREE.LineSegments(eGeo,eMat);
  scene.add(eLines);

  // HUD
  document.getElementById('node-count').textContent=nC;
  const wC=BRAIN_DATA.meta.webKnowledgeCount||nodes.filter(n=>n.level===6).length;
  document.getElementById('stats-text').textContent=nC+' nodes \\u00B7 '+BRAIN_DATA.edges.length+' connections'+(wC>0?' \\u00B7 '+wC+' web':'')+' \\u00B7 '+BRAIN_DATA.meta.projectName;
  document.getElementById('web-count').textContent=wC>0?'\\u{1F310} '+wC+' web':'';
  for(let lv=1;lv<=6;lv++){const el=document.getElementById('lc'+lv);if(el)el.textContent=(byLvl[lv]||[]).length;}

  // Build node→visible-edge map for signal chaining
  nodeVisEdges={};
  vEdges.forEach((v,idx)=>{
    if(!nodeVisEdges[v.si])nodeVisEdges[v.si]=[];
    if(!nodeVisEdges[v.ti])nodeVisEdges[v.ti]=[];
    nodeVisEdges[v.si].push(idx);
    nodeVisEdges[v.ti].push(idx);
  });

  lvlToggles={};
  document.querySelectorAll('[data-level]').forEach(b=>{lvlToggles[parseInt(b.dataset.level)]=b.classList.contains('active');updateBtnStyle(b);});
  hovIdx=-1; selIdx=-1;
  initSignals();
}

// ===== SIGNAL PARTICLES (neural impulses traveling along edges) =====
function initSignals(){
  if(sigPts){sigGeo.dispose();scene.remove(sigPts);sigPts=null;}
  if(eC===0||!pos||pos.length===0)return;
  sigData=[];
  sigGeo=new THREE.BufferGeometry();
  const sp=new Float32Array(SIG_COUNT*3);
  const sc=new Float32Array(SIG_COUNT*3);
  const ss=new Float32Array(SIG_COUNT);
  for(let i=0;i<SIG_COUNT;i++){
    const ei=Math.floor(Math.random()*eC);
    sigData.push({edge:ei, progress:Math.random(), speed:0.25+Math.random()*0.55, forward:Math.random()>0.5});
    ss[i]=6+Math.random()*5;
  }
  sigGeo.setAttribute('position',new THREE.BufferAttribute(sp,3));
  sigGeo.setAttribute('aColor',new THREE.BufferAttribute(sc,3));
  sigGeo.setAttribute('aSize',new THREE.BufferAttribute(ss,1));
  sigPts=new THREE.Points(sigGeo,sigMat);
  scene.add(sigPts);
}

function updateSignals(dt){
  if(!sigGeo||eC===0||!pos||pos.length===0)return;
  const sp=sigGeo.attributes.position;
  const sc=sigGeo.attributes.aColor;
  for(let i=0;i<SIG_COUNT;i++){
    const s=sigData[i];
    s.progress+=s.speed*dt;
    if(s.progress>=1.0){
      const{si,ti}=vEdges[s.edge];
      const endN=s.forward?ti:si;
      const nxt=nodeVisEdges[endN];
      if(nxt&&nxt.length>0){
        const newEi=nxt[Math.floor(Math.random()*nxt.length)];
        s.edge=newEi;
        s.forward=vEdges[newEi].si===endN;
      }else{
        s.edge=Math.floor(Math.random()*eC);
        s.forward=Math.random()>0.5;
      }
      s.progress=0;
      s.speed=0.25+Math.random()*0.55;
    }
    const{si,ti}=vEdges[s.edge];
    const p=s.forward?s.progress:1-s.progress;
    const src=pos[si],tgt=pos[ti];
    if(!src||!tgt)continue;
    sp.array[i*3]=src.x+(tgt.x-src.x)*p;
    sp.array[i*3+1]=src.y+(tgt.y-src.y)*p;
    sp.array[i*3+2]=src.z+(tgt.z-src.z)*p;
    tc.set(LVL_HEX[nodes[si].level]||0xE040FB);
    tc2.set(LVL_HEX[nodes[ti].level]||0xE040FB);
    tc.lerp(tc2,p);
    sc.array[i*3]=tc.r;sc.array[i*3+1]=tc.g;sc.array[i*3+2]=tc.b;
  }
  sp.needsUpdate=true;sc.needsUpdate=true;
}

// ===== MAIN BUILD (prepares data, launches worker) =====
function buildScene(){
  nodes=BRAIN_DATA.nodes; nC=nodes.length;
  byLvl={};
  nodes.forEach((n,i)=>{const lv=n.level||3;if(!byLvl[lv])byLvl[lv]=[];byLvl[lv].push(i);});

  // Adjacency
  nMap={};nodes.forEach((n,i)=>{nMap[n.id]=i;});
  adj={};nEdgeMap={};
  const ePairs=[];
  BRAIN_DATA.edges.forEach((e,ei)=>{
    const si=nMap[e.source],ti=nMap[e.target];
    if(si===undefined||ti===undefined)return;
    if(!adj[si])adj[si]=new Set();if(!adj[ti])adj[ti]=new Set();
    adj[si].add(ti);adj[ti].add(si);
    if(!nEdgeMap[si])nEdgeMap[si]=[];if(!nEdgeMap[ti])nEdgeMap[ti]=[];
    nEdgeMap[si].push(ei);nEdgeMap[ti].push(ei);
    ePairs.push([si,ti]);
  });

  // Node levels array for worker
  const levels=new Int8Array(nC);
  for(let i=0;i<nC;i++) levels[i]=nodes[i].level||3;

  // Adaptive steps: fewer for large graphs
  const STEPS=nC>2000?300:nC>1000?500:800;

  // Terminate previous worker if running
  if(layoutWorker){layoutWorker.terminate();layoutWorker=null;}

  curSpread=BASE_SPREAD+Math.sqrt(nC)*25;
  layoutWorker=new Worker(workerURL);
  layoutWorker.onmessage=function(ev){
    buildGeometry(ev.data.positions);
    cam.position.set(0,curSpread*0.3,curSpread*1.8);
    ctrl.target.set(0,0,0);
    layoutWorker.terminate();layoutWorker=null;
  };
  const lvlCounts={};for(let i=0;i<nC;i++){const lv=levels[i];lvlCounts[lv]=(lvlCounts[lv]||0)+1;}
  layoutWorker.postMessage({nC,levels:Array.from(levels),lvlCounts,ePairs,SPREAD:curSpread,REP,ATT,ILEN,DAMP,GCELL,STEPS});
}

// ===== INTERACTION =====
const ray=new THREE.Raycaster();
ray.params.Points={threshold:8};
const mouse=new THREE.Vector2();
let hovIdx=-1, selIdx=-1, camTw=null, lvlToggles={};

const ttEl=document.getElementById('tooltip');
const ttN=ttEl.querySelector('.tt-name'), ttT=ttEl.querySelector('.tt-type'), ttM=ttEl.querySelector('.tt-meta');

R.domElement.addEventListener('mousemove',(e)=>{
  mouse.x=(e.clientX/innerWidth)*2-1;
  mouse.y=-(e.clientY/innerHeight)*2+1;
  if(!nPts)return;
  ray.setFromCamera(mouse,cam);
  const hits=ray.intersectObject(nPts);
  const prev=hovIdx;
  if(hits.length>0){
    hovIdx=hits[0].index;
    R.domElement.style.cursor='pointer';
    const n=nodes[hovIdx];
    ttN.textContent=n.label;
    ttT.textContent=(n.level===6?'\\u{1F310} Web Knowledge':n.type+' \\u00B7 Level '+n.level);
    ttM.textContent='Relevance: '+n.relevanceScore.toFixed(2)+' \\u00B7 '+n.createdAt.slice(0,10)+(n.webTopic?' \\u00B7 '+n.webTopic:'');
    ttEl.style.display='block';
    ttEl.style.left=(e.clientX+14)+'px';
    ttEl.style.top=(e.clientY-10)+'px';
  } else {
    hovIdx=-1; R.domElement.style.cursor='default'; ttEl.style.display='none';
  }
  if(prev!==hovIdx) updateHL();
});

// Drag detection: only select on clean click, not after camera drag
let mdX=0,mdY=0,isDrag=false;
R.domElement.addEventListener('mousedown',(e)=>{ mdX=e.clientX; mdY=e.clientY; isDrag=false; });
R.domElement.addEventListener('mousemove',(e)=>{
  if(Math.abs(e.clientX-mdX)+Math.abs(e.clientY-mdY)>5) isDrag=true;
});
R.domElement.addEventListener('click',()=>{
  if(isDrag) return; // ignore drag-releases
  if(hovIdx>=0){
    selIdx=hovIdx;
    showSidebar(nodes[selIdx]);
    ctrl.autoRotate=false;
    const np=pos[selIdx], dir=cam.position.clone().sub(np).normalize();
    camTw={ sP:cam.position.clone(), sL:ctrl.target.clone(), tP:np.clone().add(dir.multiplyScalar(70)), tL:np.clone(), p:0 };
    updateHL();
  } else if(selIdx>=0){
    // Click on empty space while node selected → deselect + zoom out
    closeSB();
  }
});

// ===== HIGHLIGHTS (only on interaction, zero per-frame cost) =====
function updateHL(){
  if(!nGeo||!eGeo)return;
  const ha=nGeo.attributes.aHL;
  const ea=eGeo.attributes.aA;
  const sq=document.getElementById('search-input').value.toLowerCase();
  const hasS=sq.length>0, hasF=selIdx>=0;
  const cHov=hovIdx>=0&&adj[hovIdx]?adj[hovIdx]:new Set();
  const cSel=selIdx>=0&&adj[selIdx]?adj[selIdx]:new Set();

  for(let i=0;i<nC;i++){
    let h=1.0;
    const lv=nodes[i].level;
    if(lvlToggles[lv]===false){ ha.array[i]=0.05; continue; }
    if(hasS){ h=nodes[i].label.toLowerCase().includes(sq)||nodes[i].content.toLowerCase().includes(sq)?1.0:0.12; }
    if(hasF){ h=cSel.has(i)||i===selIdx?1.0:0.1; }
    if(hovIdx>=0){ if(i===hovIdx)h=Math.max(h,1.5); else if(cHov.has(i))h=Math.max(h,1.2); }
    ha.array[i]=h;
  }
  ha.needsUpdate=true;

  const aET=getActiveET();
  const aS=Math.min(1.0,2500/eC);
  for(let i=0;i<eC;i++){
    const{si,ti,w,t,cross}=vEdges[i];
    const sLv=nodes[si].level, tLv=nodes[ti].level;
    if(lvlToggles[sLv]===false||lvlToggles[tLv]===false){ ea.array[i*2]=0; ea.array[i*2+1]=0; continue; }
    let a=(cross?(0.08+w*0.2):(0.04+w*0.1))*aS;
    if(aET!==null&&!aET.has(t)) a=0;
    if(hasF){ a=(si===selIdx||ti===selIdx)?0.4+w*0.3:0.01; }
    if(hovIdx>=0){ if(si===hovIdx||ti===hovIdx) a=Math.max(a,0.35+w*0.3); }
    if(hasS){ if(!nodes[si].label.toLowerCase().includes(sq)&&!nodes[ti].label.toLowerCase().includes(sq)) a=0.01; }
    ea.array[i*2]=a; ea.array[i*2+1]=a;
  }
  ea.needsUpdate=true;
}

function getActiveET(){
  const all=document.querySelector('[data-edge="all"]');
  if(all&&all.classList.contains('active'))return null;
  const s=new Set();
  document.querySelectorAll('[data-edge].active').forEach(b=>{ if(b.dataset.edge!=='all')s.add(b.dataset.edge); });
  return s.size>0?s:null;
}

// ===== SIDEBAR =====
function showSidebar(node){
  const sb=document.getElementById('sidebar'), ct=document.getElementById('sidebar-content');
  const tCol={code:'#00FFFF',module:'#00CED1',architecture:'#7B68EE',pattern:'#00ff88',error:'#ff4444',decision:'#ffdd00',summary:'#888',web_knowledge:'#FFD700'};
  const col=tCol[node.type]||'#888';
  const cE=BRAIN_DATA.edges.filter(e=>e.source===node.id||e.target===node.id);
  const rH=cE.map(e=>{
    const oId=e.source===node.id?e.target:e.source;
    const oI=nMap[oId]; const oL=oI!==undefined?nodes[oI].label:oId.slice(0,8);
    const eC2=EDGE_COL[e.type]||EDGE_COL.default;
    return '<li><span style="color:'+eC2+'">'+e.type+'</span> \\u2192 '+esc(oL)+'</li>';
  }).join('');
  const lvN=node.level===6?'Web Knowledge':'L'+node.level;
  const isW=node.level===6;
  let wH='';
  if(isW){
    if(node.webTopic) wH+='<div class="meta-row" style="color:#FFAA00">\\u{1F310} Topic: '+esc(node.webTopic)+'</div>';
    if(node.webSource) wH+='<div class="meta-row"><a href="'+esc(node.webSource)+'" target="_blank" style="color:#668;text-decoration:underline">\\u{1F517} '+esc(node.webSource)+'</a></div>';
  }
  ct.innerHTML='<h2>'+esc(node.label)+'</h2>'+'<span class="node-type" style="background:'+col+'15;color:'+col+';border:1px solid '+col+'33">'+(isW?'\\u{1F310} Web':node.type)+' \\u00B7 '+lvN+'</span>'+wH+'<div class="content-preview">'+esc(node.content)+'</div>'+'<div class="meta-row">Relevance: '+node.relevanceScore.toFixed(3)+'</div>'+'<div class="meta-row">Created: '+node.createdAt.slice(0,10)+'</div>'+'<div class="meta-row">Accessed: '+node.lastAccessed.slice(0,10)+'</div>'+(cE.length>0?'<h3 style="margin-top:16px;font-size:11px;color:#556;text-transform:uppercase;letter-spacing:1px">Relations ('+cE.length+')</h3><ul class="relations">'+rH+'</ul>':'');
  sb.classList.add('open');
}

function closeSB(evt){
  document.getElementById('sidebar').classList.remove('open');
  selIdx=-1; updateHL();
  if(!(evt&&evt.shiftKey)){
    ctrl.autoRotate=true;
    camTw={ sP:cam.position.clone(), sL:ctrl.target.clone(), tP:new THREE.Vector3(0,curSpread*0.3,curSpread*1.8), tL:new THREE.Vector3(0,0,0), p:0 };
  }
}
document.getElementById('sidebar-close').addEventListener('click',(e)=>closeSB(e));

// ===== HELP =====
const helpO=document.getElementById('help-overlay');
document.getElementById('help-btn').addEventListener('click',()=>helpO.classList.toggle('open'));
helpO.addEventListener('click',(e)=>{ if(e.target===helpO)helpO.classList.remove('open'); });

// ===== KEYBOARD =====
document.addEventListener('keydown',(e)=>{
  if(e.target.tagName==='INPUT'||e.target.tagName==='SELECT'||e.target.tagName==='TEXTAREA')return;
  if(e.key==='?'||(e.key==='/'&&e.shiftKey)){ e.preventDefault(); helpO.classList.toggle('open'); }
  if(e.key==='Escape'){
    if(helpO.classList.contains('open')) helpO.classList.remove('open');
    else if(document.getElementById('sidebar').classList.contains('open')) closeSB(e);
  }
});

// ===== SEARCH =====
document.getElementById('search-input').addEventListener('input',()=>updateHL());

// ===== LEVEL TOGGLES =====
function updateBtnStyle(b){
  const a=b.classList.contains('active'), c=b.dataset.color||'#00d4ff';
  if(a){ b.style.borderColor=c+'80'; b.style.color=c; b.style.background=c+'18'; b.style.textShadow='0 0 8px '+c+'60'; }
  else{ b.style.borderColor='rgba(255,255,255,0.06)'; b.style.color='#334'; b.style.background='rgba(255,255,255,0.02)'; b.style.textShadow='none'; }
}
document.querySelectorAll('[data-level]').forEach(b=>{
  updateBtnStyle(b);
  b.addEventListener('click',()=>{ b.classList.toggle('active'); lvlToggles[parseInt(b.dataset.level)]=b.classList.contains('active'); updateBtnStyle(b); updateHL(); });
});

// ===== EDGE TOGGLES =====
document.querySelectorAll('[data-edge]').forEach(b=>{
  b.addEventListener('click',()=>{
    if(b.dataset.edge==='all'){
      document.querySelectorAll('[data-edge]').forEach(x=>x.classList.remove('active'));
      b.classList.add('active');
    } else {
      document.querySelector('[data-edge="all"]').classList.remove('active');
      b.classList.toggle('active');
      if(!document.querySelectorAll('[data-edge].active').length) document.querySelector('[data-edge="all"]').classList.add('active');
    }
    updateHL();
  });
});

// ===== ANIMATE (ultra-minimal: only controls + render + tween) =====
let fpsF=0, lastFT=performance.now();
const clock=new THREE.Clock();

function animate(){
  requestAnimationFrame(animate);
  const dt=clock.getDelta();

  if(camTw){
    camTw.p=Math.min(camTw.p+dt*1.8,1);
    const e=1-Math.pow(1-camTw.p,3);
    cam.position.lerpVectors(camTw.sP,camTw.tP,e);
    ctrl.target.lerpVectors(camTw.sL,camTw.tL,e);
    if(camTw.p>=1)camTw=null;
  }

  updateSignals(dt);
  ctrl.update();
  R.render(scene,cam);

  fpsF++;
  const now=performance.now();
  if(now-lastFT>1000){ document.getElementById('fps-counter').textContent=fpsF; fpsF=0; lastFT=now; }
}

// ===== RESIZE =====
addEventListener('resize',()=>{ cam.aspect=innerWidth/innerHeight; cam.updateProjectionMatrix(); R.setSize(innerWidth,innerHeight); });

// ===== WEBSOCKET =====
let ws=null;
(function connectWS(){
  const proto=location.protocol==='https:'?'wss:':'ws:';
  function connect(){
    try{ws=new WebSocket(proto+'//'+location.host)}catch{return}
    ws.onmessage=(ev)=>{
      try{
        const m=JSON.parse(ev.data);
        if(m.type==='full_sync'&&m.data){
          const newIds=m.data.nodes.map(n=>n.id).sort().join(',');
          if(newIds!==lastNodeIds){ lastNodeIds=newIds; BRAIN_DATA=m.data; buildScene(); }
        }
        if(m.type==='web_knowledge') showWKPopup(m.topic,m.summary,m.source);
        if(m.type==='agent_finding') addFinding(m.sessionName,m.finding,m.severity,m.file);
        if(m.type==='scope_changed') updateScopeUI(m.scope);
        if(m.type==='ollama_starting'){
          oStatus.textContent='Ollama starting...';oStatus.style.color='#ffaa00';
          setTimeout(()=>refreshModels(),2000);
          setTimeout(()=>refreshModels(),5000);
        }
        if(m.type==='model_activated'){
          document.querySelectorAll('[data-activate]').forEach(b=>{b.disabled=false;b.textContent='\\u26A1 Activate';});
          const n=document.createElement('div');
          n.style.cssText='position:fixed;top:60px;left:50%;transform:translateX(-50%);background:rgba(0,255,100,0.15);border:1px solid rgba(0,255,100,0.3);color:#00ff66;padding:8px 20px;border-radius:8px;font-size:12px;z-index:999;backdrop-filter:blur(10px);';
          n.textContent='\\u26A1 Model activated: '+m.model;
          document.body.appendChild(n); setTimeout(()=>n.remove(),3000); refreshModels();
        }
      }catch{}
    };
    ws.onclose=()=>setTimeout(connect,3000);
    ws.onerror=()=>ws.close();
  }
  connect();
})();

// ===== WEB KNOWLEDGE POPUPS =====
function showWKPopup(topic,summary,source){
  const ct=document.getElementById('web-knowledge-container');
  const p=document.createElement('div'); p.className='web-knowledge-popup';
  let dU=source; try{const u=new URL(source);dU=u.hostname+u.pathname.slice(0,30);}catch{}
  p.innerHTML='<div class="wk-header"><span class="wk-icon">\\u{1F310}</span><span class="wk-title">Web Knowledge</span></div><div class="wk-topic">'+esc(topic)+'</div><div class="wk-summary">'+esc(summary)+'</div><div class="wk-source">'+esc(dU)+'</div><div class="wk-progress"><div class="wk-progress-bar"></div></div>';
  ct.appendChild(p);
  setTimeout(()=>{p.classList.add('removing');setTimeout(()=>p.remove(),500);},6000);
  while(ct.children.length>3) ct.firstChild.remove();
}

// ===== SCOPE SWITCHER =====
let curScope='${data.meta.brainScope === 'project' ? 'project' : 'global'}';
document.querySelectorAll('#scope-switcher .scope-btn').forEach(b=>{
  b.addEventListener('click',()=>{
    const ns=b.dataset.scope; if(ns===curScope)return;
    const proto=location.protocol==='https:'?'wss:':'ws:';
    const sw=new WebSocket(proto+'//'+location.host);
    sw.onopen=()=>{sw.send(JSON.stringify({type:'scope_switch',scope:ns}));sw.close();};
    updateScopeUI(ns);
  });
});
function updateScopeUI(s){ curScope=s; document.querySelectorAll('#scope-switcher .scope-btn').forEach(b=>b.classList.toggle('active',b.dataset.scope===s)); }

// ===== FINDINGS =====
let fData=[];
const fPanel=document.getElementById('findings-panel'), fList=document.getElementById('findings-list');
const fCount=document.getElementById('findings-count'), fToggle=document.getElementById('findings-toggle'), fBadge=document.getElementById('findings-badge');
fToggle.addEventListener('click',()=>fPanel.classList.toggle('open'));
function addFinding(sn,f,sev,file){
  fData.push({sn,f,sev,file,t:Date.now()});
  fBadge.style.display='inline'; fBadge.textContent=fData.length;
  fCount.textContent=fData.length+' finding(s)';
  fList.innerHTML='';
  for(const d of[...fData].reverse()){
    const it=document.createElement('div'); it.className='finding-item';
    it.innerHTML='<span class="f-severity '+d.sev+'">'+d.sev+'</span> <div class="f-text">'+esc(d.f)+'</div>'+(d.file?'<div class="f-file">'+esc(d.file)+'</div>':'')+'<div class="f-file">'+esc(d.sn)+'</div>';
    fList.appendChild(it);
  }
  if(fData.length===1) fPanel.classList.add('open');
}

// ===== MODEL MANAGEMENT =====
const RECO=[
  {name:'qwen3-coder:30b',size:'~18 GB',desc:'Best coding model for 32GB VRAM',vram:18},
  {name:'qwen2.5-coder:32b',size:'~22 GB',desc:'Battle-tested coding champion',vram:22},
  {name:'qwen2.5-coder:14b',size:'~10 GB',desc:'Great coding, lower VRAM',vram:10},
  {name:'deepseek-r1:32b',size:'~22 GB',desc:'Strong reasoning + coding',vram:22},
  {name:'qwen2.5-coder:7b',size:'~5 GB',desc:'Lightweight coder',vram:5},
];
const mPanel=document.getElementById('models-panel'), mToggle=document.getElementById('models-toggle'), mClose=document.getElementById('models-close');
const oStatus=document.getElementById('ollama-status'), oDot=document.getElementById('ollama-dot');
let curVram=32, instNames=new Set(), runNames=new Set(), oOnline=false;

mToggle.addEventListener('click',()=>{
  if(!oOnline&&ws&&ws.readyState===WebSocket.OPEN){
    ws.send(JSON.stringify({type:'start_ollama'}));
    oStatus.textContent='Starting Ollama...';oStatus.style.color='#ffaa00';
    oDot.className='status-dot offline';
    setTimeout(()=>refreshModels(),3000);
  }
  mPanel.classList.toggle('open');if(mPanel.classList.contains('open'))refreshModels();
});
mClose.addEventListener('click',()=>mPanel.classList.remove('open'));
document.querySelectorAll('#gpu-filter .gpu-btn').forEach(b=>{
  b.addEventListener('click',()=>{document.querySelectorAll('#gpu-filter .gpu-btn').forEach(x=>x.classList.remove('active'));b.classList.add('active');curVram=parseInt(b.dataset.vram);renderReco();});
});

async function checkOllama(){
  try{const r=await fetch('/api/ollama/status');const d=await r.json();if(d.version){oOnline=true;oStatus.textContent='Ollama v'+d.version+' \\u2014 running';oStatus.style.color='#00ff88';oDot.className='status-dot online';mToggle.classList.add('online');return true;}}catch{}
  oOnline=false;oStatus.textContent='Ollama not running \\u2014 click to start';oStatus.style.color='#ff4444';oDot.className='status-dot offline';mToggle.classList.remove('online');return false;
}
async function fetchInst(){try{const r=await fetch('/api/ollama/models');const d=await r.json();return d.models||[];}catch{return[];}}
async function fetchRun(){try{const r=await fetch('/api/ollama/running');const d=await r.json();return d.models||[];}catch{return[];}}
function fmtB(b){const g=b/(1024*1024*1024);return g>=1?g.toFixed(1)+' GB':(b/(1024*1024)).toFixed(0)+' MB';}

async function refreshModels(){
  const on=await checkOllama();
  if(!on){document.getElementById('installed-models').innerHTML='<div style="color:#556;font-size:11px">Start Ollama to see models</div>';document.getElementById('running-section').style.display='none';renderReco();return;}
  const[inst,run]=await Promise.all([fetchInst(),fetchRun()]);
  instNames=new Set(inst.map(m=>m.name)); runNames=new Set(run.map(m=>m.name));
  const rSec=document.getElementById('running-section'), rM=document.getElementById('running-models');
  if(run.length>0){rSec.style.display='block';rM.innerHTML='';for(const m of run){const c=document.createElement('div');c.className='model-card';c.innerHTML='<div class="mc-name">'+esc(m.name)+'</div><div class="mc-meta">'+(m.size?fmtB(m.size):'')+'</div><span class="mc-status running">\\u25B6 running</span>';rM.appendChild(c);}}else{rSec.style.display='none';}
  const iM=document.getElementById('installed-models');
  if(inst.length>0){iM.innerHTML='';for(const m of inst){const c=document.createElement('div');c.className='model-card';const isR=runNames.has(m.name);c.innerHTML='<div class="mc-name">'+esc(m.name)+'</div><div class="mc-meta">'+(m.size?fmtB(m.size):'')+'</div>'+(isR?'<span class="mc-status running">\\u25B6 running</span>':'<span class="mc-status installed">\\u2705 installed</span>')+'<div class="mc-actions"><button class="mc-btn primary" data-activate="'+esc(m.name)+'">\\u26A1 Activate</button><button class="mc-btn danger" data-delete="'+esc(m.name)+'">\\u{1F5D1} Delete</button></div>';iM.appendChild(c);}
  iM.querySelectorAll('[data-activate]').forEach(b=>{b.addEventListener('click',()=>{if(ws&&ws.readyState===WebSocket.OPEN){ws.send(JSON.stringify({type:'activate_model',model:b.dataset.activate}));b.textContent='\\u23F3...';b.disabled=true;}});});
  iM.querySelectorAll('[data-delete]').forEach(b=>{b.addEventListener('click',async()=>{if(!confirm('Delete '+b.dataset.delete+'?'))return;b.disabled=true;try{await fetch('/api/ollama/delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:b.dataset.delete})});}catch{}refreshModels();});});
  }else{iM.innerHTML='<div style="color:#556;font-size:11px">No models installed</div>';}
  renderReco();
}

function renderReco(){
  const rM=document.getElementById('recommended-models'); rM.innerHTML='';
  const filt=RECO.filter(m=>m.vram<=curVram);
  if(!filt.length){rM.innerHTML='<div style="color:#556;font-size:11px">No models fit this VRAM</div>';return;}
  for(const m of filt){
    const inst=instNames.has(m.name), run=runNames.has(m.name);
    const c=document.createElement('div'); c.className='model-card';
    c.innerHTML='<div class="mc-name">'+esc(m.name)+'</div><div class="mc-meta">'+m.size+' VRAM</div><div class="mc-desc">'+esc(m.desc)+'</div>'+(run?'<span class="mc-status running">\\u25B6 running</span>':inst?'<span class="mc-status installed">\\u2705 installed</span>':'<span class="mc-status available">\\u2B07 available</span>')+(inst?'<div class="mc-actions"><button class="mc-btn primary" data-activate="'+esc(m.name)+'">\\u26A1 Activate</button></div>':'<div class="mc-actions"><button class="mc-btn" data-pull="'+esc(m.name)+'">\\u2B07 Download</button></div>');
    rM.appendChild(c);
  }
  rM.querySelectorAll('[data-pull]').forEach(b=>{b.addEventListener('click',()=>pullModel(b.dataset.pull,b));});
  rM.querySelectorAll('[data-activate]').forEach(b=>{b.addEventListener('click',()=>{if(ws&&ws.readyState===WebSocket.OPEN){ws.send(JSON.stringify({type:'activate_model',model:b.dataset.activate}));b.textContent='\\u23F3...';b.disabled=true;}});});
}

async function pullModel(name,btn){
  if(!oOnline)return;
  btn.disabled=true; btn.textContent='Downloading...';
  try{
    const res=await fetch('/api/ollama/pull',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name})});
    if(!res.ok||!res.body){btn.textContent='\\u274C Failed';btn.disabled=false;return;}
    const reader=res.body.getReader(), dec=new TextDecoder();
    let buf='';
    while(true){
      const{done,value}=await reader.read(); if(done)break;
      buf+=dec.decode(value,{stream:true}); const lines=buf.split('\\n'); buf=lines.pop()||'';
      for(const ln of lines){
        if(!ln.startsWith('data: '))continue;
        try{const d=JSON.parse(ln.slice(6));if(d.status==='success'){btn.textContent='\\u2705 Installed';setTimeout(()=>refreshModels(),1000);return;}}catch{}
      }
    }
    btn.textContent='\\u2705 Done'; setTimeout(()=>refreshModels(),1000);
  }catch{btn.textContent='\\u274C Retry';btn.disabled=false;}
}
setInterval(()=>{if(mPanel.classList.contains('open'))refreshModels();},15000);
checkOllama();

// ===== VOICE =====
(function(){
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  const vP=document.getElementById('voice-panel'), vB=document.getElementById('voice-btn');
  const tr=document.getElementById('voice-transcript'), sB=document.getElementById('voice-send');
  const lS=document.getElementById('voice-lang'), stE=document.getElementById('voice-status');
  const wf=document.getElementById('voice-waveform');
  if(!SR){tr.textContent='Voice not supported';vB.style.opacity='0.3';vB.style.cursor='not-allowed';return;}
  for(let i=0;i<5;i++){const b=document.createElement('div');b.className='waveform-bar';b.style.animationDelay=(i*0.12)+'s';wf.appendChild(b);}
  let rec=null,isR=false,fT='',iT='';
  function mkRec(){
    const r=new SR();r.continuous=true;r.interimResults=true;r.lang=lS.value;r.maxAlternatives=1;
    r.onresult=(ev)=>{iT='';fT='';for(let i=0;i<ev.results.length;i++){if(ev.results[i].isFinal)fT+=ev.results[i][0].transcript;else iT+=ev.results[i][0].transcript;}tr.innerHTML=fT+(iT?'<span style="color:#556">'+esc(iT)+'</span>':'');tr.classList.remove('placeholder');if(fT.trim())sB.classList.add('visible');};
    r.onerror=(ev)=>{if(ev.error==='not-allowed'){stE.textContent='denied';tr.textContent='Microphone denied';tr.classList.add('placeholder');}stopR();};
    r.onend=()=>{if(isR)try{r.start();}catch{stopR();}};
    return r;
  }
  async function startR(){
    try{const s=await navigator.mediaDevices.getUserMedia({audio:true});s.getTracks().forEach(t=>t.stop());}catch{stE.textContent='denied';return;}
    rec=mkRec();fT='';iT='';isR=true;
    vB.classList.add('recording');vP.classList.add('recording');vB.textContent='\\u23F9';
    tr.innerHTML='<span style="color:#445;font-style:italic">Listening...</span>';tr.classList.remove('placeholder');sB.classList.remove('visible');
    stE.textContent='\\u25CF rec';stE.style.color='#ff3c3c';
    try{rec.start();}catch{stopR();}
  }
  function stopR(){
    isR=false;vB.classList.remove('recording');vP.classList.remove('recording');vB.textContent='\\u{1F3A4}';stE.textContent='';stE.style.color='';
    if(rec)try{rec.stop();}catch{} rec=null;
    if(fT.trim()){sB.classList.add('visible');tr.textContent=fT;}
    else if(!tr.textContent||tr.textContent==='Listening...'){tr.textContent='Click mic to speak...';tr.classList.add('placeholder');}
  }
  vB.addEventListener('click',()=>{isR?stopR():startR();});
  sB.addEventListener('click',()=>{
    const t=fT.trim();if(!t)return;
    const proto=location.protocol==='https:'?'wss:':'ws:';
    const sw=new WebSocket(proto+'//'+location.host);
    sw.onopen=()=>{sw.send(JSON.stringify({type:'voice_input',text:t}));stE.textContent='\\u2713 sent';stE.style.color='#00ff88';setTimeout(()=>{stE.textContent='';stE.style.color='';},2000);sw.close();};
    sw.onerror=()=>{stE.textContent='send failed';stE.style.color='#ff4444';};
    fT='';iT='';tr.textContent='Click mic to speak...';tr.classList.add('placeholder');sB.classList.remove('visible');
  });
  document.addEventListener('keydown',(e)=>{if(e.key==='Enter'&&!e.shiftKey&&fT.trim()&&sB.classList.contains('visible')){e.preventDefault();sB.click();}});
  lS.addEventListener('change',()=>{if(isR){stopR();startR();}});
})();

// ===== START =====
lastNodeIds=BRAIN_DATA.nodes.map(n=>n.id).sort().join(',');
buildScene();
animate();
</script>
</body>
</html>`;
}
