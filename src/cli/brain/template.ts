import type { BrainExport } from './exporter.js';

export function generateBrainHTML(data: BrainExport): string {
  const dataJSON = JSON.stringify(data);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; connect-src 'self' ws://127.0.0.1:* wss://127.0.0.1:*; img-src 'self' data:; media-src 'self' blob:;">
<title>\u{1F300} HelixMind Brain \u2014 ${data.meta.projectName}</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { background: #030308; color: #e0e0e0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', monospace; overflow: hidden; }
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
  display: inline-block; padding: 3px 8px; margin: 1px;
  background: rgba(0,212,255,0.05); border: 1px solid rgba(0,212,255,0.15);
  border-radius: 4px; color: #668; cursor: pointer; font-size: 10px;
  transition: all 0.3s; user-select: none;
}
.toggle-btn.active { background: rgba(0,212,255,0.15); border-color: rgba(0,212,255,0.4); color: #00d4ff; }
.toggle-btn:hover { background: rgba(0,212,255,0.1); color: #aad; }

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

/* === Findings Panel (left sidebar) === */
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

/* === Model Management Panel === */
#models-toggle {
  position: fixed; left: 120px; bottom: 16px; z-index: 26;
  background: rgba(5,5,16,0.9); border: 1px solid rgba(0,212,255,0.15);
  border-radius: 8px; padding: 6px 12px; cursor: pointer; color: #889;
  font-size: 11px; transition: all 0.2s;
}
#models-toggle:hover { border-color: rgba(0,212,255,0.4); color: #00d4ff; }
#models-toggle .status-dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; margin-right: 4px; }
#models-toggle .status-dot.online { background: #0f0; box-shadow: 0 0 4px #0f0; }
#models-toggle .status-dot.offline { background: #ff4444; box-shadow: 0 0 4px #ff4444; }

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

#gpu-filter {
  display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 14px;
}
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
.model-card .mc-progress-bar {
  height: 3px; background: rgba(0,212,255,0.15); border-radius: 2px; overflow: hidden;
}
.model-card .mc-progress-fill {
  height: 100%; background: linear-gradient(90deg, #00d4ff, #00ff88);
  border-radius: 2px; width: 0%; transition: width 0.3s;
}
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

/* === Voice Input Panel === */
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
#voice-btn.recording {
  border-color: #ff3c3c; background: rgba(255,60,60,0.15); color: #ff3c3c;
  animation: voicePulse 1.2s ease infinite;
}
@keyframes voicePulse {
  0%,100% { box-shadow: 0 0 0 0 rgba(255,60,60,0.4); }
  50% { box-shadow: 0 0 0 10px rgba(255,60,60,0); }
}

#voice-transcript {
  flex: 1; min-width: 200px; max-width: 500px;
  font-size: 13px; color: #e0e0e0; min-height: 20px;
  max-height: 60px; overflow-y: auto; word-break: break-word;
}
#voice-transcript.placeholder { color: #445; font-style: italic; }

#voice-send {
  padding: 6px 14px; border-radius: 8px; border: 1px solid rgba(0,212,255,0.3);
  background: rgba(0,212,255,0.1); color: #00d4ff; cursor: pointer;
  font-size: 12px; font-weight: 600; transition: all 0.2s; flex-shrink: 0;
  display: none;
}
#voice-send:hover { background: rgba(0,212,255,0.25); border-color: rgba(0,212,255,0.5); }
#voice-send.visible { display: block; }

#voice-waveform {
  display: none; align-items: center; gap: 2px; height: 24px; flex-shrink: 0;
}
#voice-panel.recording #voice-waveform { display: flex; }
.waveform-bar {
  width: 3px; background: #ff3c3c; border-radius: 2px;
  animation: waveformPulse 0.6s ease-in-out infinite alternate;
}
@keyframes waveformPulse {
  from { height: 4px; opacity: 0.4; }
  to { height: 20px; opacity: 1; }
}

#voice-lang {
  background: transparent; border: 1px solid rgba(0,212,255,0.15);
  border-radius: 4px; color: #556; font-size: 9px; padding: 2px 4px;
  cursor: pointer; flex-shrink: 0;
}
#voice-lang:focus { outline: none; border-color: rgba(0,212,255,0.4); }

#voice-status {
  font-size: 9px; color: #445; flex-shrink: 0; min-width: 40px; text-align: center;
}

/* === Web Knowledge Pop-up Notifications === */
#web-knowledge-container {
  position: fixed; top: 80px; right: 16px; z-index: 40;
  display: flex; flex-direction: column; gap: 8px;
  pointer-events: none; max-width: 340px;
}

.web-knowledge-popup {
  background: rgba(5,5,16,0.95);
  border: 1px solid rgba(0,255,136,0.3);
  border-radius: 12px; padding: 14px 18px;
  backdrop-filter: blur(24px);
  box-shadow: 0 4px 24px rgba(0,255,136,0.15), 0 0 60px rgba(0,255,136,0.05);
  animation: webKnowledgeSlideIn 0.5s cubic-bezier(0.16,1,0.3,1) forwards;
  opacity: 0; transform: translateX(60px);
  pointer-events: auto;
  transition: opacity 0.4s ease, transform 0.4s ease;
}

.web-knowledge-popup.removing {
  opacity: 0 !important; transform: translateX(60px) !important;
}

.web-knowledge-popup .wk-header {
  display: flex; align-items: center; gap: 8px; margin-bottom: 6px;
}
.web-knowledge-popup .wk-icon {
  font-size: 16px; animation: wkIconPulse 1.5s ease infinite;
}
.web-knowledge-popup .wk-title {
  font-size: 11px; color: #00ff88; font-weight: 600;
  text-transform: uppercase; letter-spacing: 1px;
}
.web-knowledge-popup .wk-topic {
  font-size: 13px; color: #e0e0e0; font-weight: 500; margin-bottom: 4px;
}
.web-knowledge-popup .wk-summary {
  font-size: 11px; color: #8899aa; line-height: 1.4;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.web-knowledge-popup .wk-source {
  font-size: 9px; color: #445566; margin-top: 6px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.web-knowledge-popup .wk-progress {
  height: 2px; background: rgba(0,255,136,0.1); border-radius: 1px;
  margin-top: 8px; overflow: hidden;
}
.web-knowledge-popup .wk-progress-bar {
  height: 100%; background: linear-gradient(90deg, #00ff88, #00d4ff);
  border-radius: 1px; width: 100%;
  animation: wkProgressShrink 6s linear forwards;
}

@keyframes webKnowledgeSlideIn {
  from { opacity: 0; transform: translateX(60px) scale(0.95); }
  to { opacity: 1; transform: translateX(0) scale(1); }
}
@keyframes wkIconPulse {
  0%,100% { transform: scale(1); filter: drop-shadow(0 0 4px rgba(0,255,136,0.6)); }
  50% { transform: scale(1.15); filter: drop-shadow(0 0 8px rgba(0,255,136,0.9)); }
}
@keyframes wkProgressShrink {
  from { width: 100%; }
  to { width: 0%; }
}

/* Particle burst effect */
.wk-particle-burst {
  position: fixed; pointer-events: none; z-index: 50;
}
.wk-particle {
  position: absolute; width: 4px; height: 4px;
  border-radius: 50%; background: #00ff88;
  box-shadow: 0 0 6px #00ff88;
  animation: wkParticleFly 1s ease-out forwards;
}
@keyframes wkParticleFly {
  from { opacity: 1; transform: translate(0, 0) scale(1); }
  to { opacity: 0; transform: translate(var(--tx), var(--ty)) scale(0); }
}
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

<div id="search-box">
  <input id="search-input" type="text" placeholder="Search nodes..." aria-label="Search nodes" />
</div>

<div id="controls">
  <div class="control-group">
    <label>Levels</label>
    <span class="toggle-btn active" data-level="5" style="border-color:rgba(108,117,125,0.5);color:#6c757d"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#6c757d;margin-right:4px;vertical-align:middle;box-shadow:0 0 4px #6c757d"></span>L5 Deep</span>
    <span class="toggle-btn active" data-level="4" style="border-color:rgba(138,43,226,0.5);color:#8a2be2"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#8a2be2;margin-right:4px;vertical-align:middle;box-shadow:0 0 4px #8a2be2"></span>L4 Archive</span>
    <span class="toggle-btn active" data-level="3" style="border-color:rgba(65,105,225,0.5);color:#4169e1"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#4169e1;margin-right:4px;vertical-align:middle;box-shadow:0 0 4px #4169e1"></span>L3 Ref</span>
    <span class="toggle-btn active" data-level="2" style="border-color:rgba(0,255,136,0.5);color:#00ff88"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#00ff88;margin-right:4px;vertical-align:middle;box-shadow:0 0 4px #00ff88"></span>L2 Active</span>
    <span class="toggle-btn active" data-level="1" style="border-color:rgba(0,255,255,0.5);color:#00ffff"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#00ffff;margin-right:4px;vertical-align:middle;box-shadow:0 0 4px #00ffff"></span>L1 Focus</span>
    <span class="toggle-btn active" data-level="6" style="border-color:rgba(255,170,0,0.5);color:#ffaa00"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#ffaa00;margin-right:4px;vertical-align:middle;box-shadow:0 0 4px #ffaa00"></span>L6 Web</span>
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

<div id="sidebar">
  <span class="close-btn" id="sidebar-close">\u2715</span>
  <div id="sidebar-content"></div>
</div>

<div id="tooltip">
  <div class="tt-name"></div>
  <div class="tt-type"></div>
  <div class="tt-meta"></div>
</div>

<div id="legend">
  <div class="item"><span class="dot" style="color:#00FFFF"></span> L1 Focus</div>
  <div class="item"><span class="dot" style="color:#00FF88"></span> L2 Active</div>
  <div class="item"><span class="dot" style="color:#4169E1"></span> L3 Reference</div>
  <div class="item"><span class="dot" style="color:#8A2BE2"></span> L4 Archive</div>
  <div class="item"><span class="dot" style="color:#6C757D"></span> L5 Deep Archive</div>
  <div class="item"><span class="dot" style="color:#FFAA00"></span> L6 Web Knowledge</div>
</div>

<div id="status">
  <span id="node-count">0</span> nodes \u00B7 <span id="fps-counter">60</span> fps \u00B7 <span id="web-count" style="color:#FFAA00"></span>
</div>

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

  <div class="mp-section" id="cloud-section">
    <div class="mp-section-title">\u{2601} Cloud Models</div>
    <div id="cloud-models"><div style="color:#445;font-size:11px">Loading cloud models...</div></div>
  </div>

  <div class="mp-section">
    <div class="mp-section-title">GPU / VRAM Filter</div>
    <div id="gpu-filter">
      <span class="gpu-btn" data-vram="8">8 GB</span>
      <span class="gpu-btn" data-vram="12">12 GB</span>
      <span class="gpu-btn" data-vram="16">16 GB</span>
      <span class="gpu-btn" data-vram="24">24 GB</span>
      <span class="gpu-btn active" data-vram="32">32 GB (RTX 5090)</span>
      <span class="gpu-btn" data-vram="48">48 GB</span>
    </div>
  </div>

  <div class="mp-section" id="running-section" style="display:none">
    <div class="mp-section-title">\u{25B6} Running Models</div>
    <div id="running-models"></div>
  </div>

  <div class="mp-section" id="installed-section">
    <div class="mp-section-title">\u{2705} Installed Models</div>
    <div id="installed-models"><div style="color:#445;font-size:11px">Loading...</div></div>
  </div>

  <div class="mp-section">
    <div class="mp-section-title">\u{2B50} Recommended for Coding</div>
    <div id="recommended-models"></div>
  </div>
</div>

<button id="help-btn" title="Keyboard shortcuts & controls">?</button>

<div id="help-overlay">
  <div id="help-box">
    <h3>\u{1F300} HelixMind Brain \u2014 Controls</h3>
    <div class="help-section">
      <h4>Navigation</h4>
      <div class="help-row"><span class="help-key">Left Drag</span> <span class="help-desc">Rotate view</span></div>
      <div class="help-row"><span class="help-key">Right Drag</span> <span class="help-desc">Pan view</span></div>
      <div class="help-row"><span class="help-key">Scroll</span> <span class="help-desc">Zoom in / out</span></div>
    </div>
    <div class="help-section">
      <h4>Nodes</h4>
      <div class="help-row"><span class="help-key">Click</span> <span class="help-desc">Select node \u2192 zoom in + details</span></div>
      <div class="help-row"><span class="help-key">\u2715 Close</span> <span class="help-desc">Deselect \u2192 zoom out to overview</span></div>
      <div class="help-row"><span class="help-key">Shift + \u2715</span> <span class="help-desc">Close details but stay zoomed in</span></div>
      <div class="help-row"><span class="help-key">Hover</span> <span class="help-desc">Preview node info</span></div>
    </div>
    <div class="help-section">
      <h4>Tools</h4>
      <div class="help-row"><span class="help-key">Search</span> <span class="help-desc">Filter nodes by name/content</span></div>
      <div class="help-row"><span class="help-key">L1\u2013L6</span> <span class="help-desc">Toggle spiral levels</span></div>
      <div class="help-row"><span class="help-key">\u{1F3A4} Mic</span> <span class="help-desc">Voice input \u2192 send to CLI</span></div>
    </div>
    <div class="help-section">
      <h4>Keyboard</h4>
      <div class="help-row"><span class="help-key">?</span> <span class="help-desc">Toggle this help</span></div>
      <div class="help-row"><span class="help-key">Esc</span> <span class="help-desc">Close sidebar / help</span></div>
    </div>
    <div class="help-close">Press <span style="color:#00d4ff">?</span> or <span style="color:#00d4ff">Esc</span> to close</div>
  </div>
</div>

<div id="voice-panel">
  <button id="voice-btn" title="Voice Input (click to record)">\u{1F3A4}</button>
  <div id="voice-waveform"></div>
  <div id="voice-transcript" class="placeholder">Click mic to speak...</div>
  <select id="voice-lang" title="Language" aria-label="Voice language">
    <option value="de-DE">DE</option>
    <option value="en-US">EN</option>
  </select>
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

// =========== DATA ===========
let BRAIN_DATA = ${dataJSON};

// =========== CONSTANTS ===========
const LEVEL_COLORS_HEX = { 1: 0x00FFFF, 2: 0x00FF88, 3: 0x4169E1, 4: 0x8A2BE2, 5: 0x6C757D, 6: 0xFFAA00 };
const LEVEL_COLORS_CSS = { 1: '#00FFFF', 2: '#00FF88', 3: '#4169E1', 4: '#8A2BE2', 5: '#6C757D', 6: '#FFAA00' };
const EDGE_COLORS = {
  imports: '#00ff88', calls: '#ffdd00', depends_on: '#ffdd00',
  related_to: '#4488ff', similar_to: '#4488ff',
  belongs_to: '#ff6600', part_of: '#ff6600', supersedes: '#ff4444',
  default: '#334466',
};
// Inverted funnel: L5 (wisdom) small at TOP, L6 (web) large at BOTTOM
// Each layer gets progressively wider as we go down — like the OG brain
const SPATIAL = {
  5: { iR: 10,  oR: 60,   yBase: 550,  yS: 35,  size: 52, pulse: 0.3 },
  4: { iR: 20,  oR: 120,  yBase: 380,  yS: 40,  size: 42, pulse: 0.5 },
  3: { iR: 40,  oR: 200,  yBase: 210,  yS: 50,  size: 36, pulse: 0.8 },
  2: { iR: 60,  oR: 300,  yBase: 30,   yS: 55,  size: 28, pulse: 1.2 },
  1: { iR: 80,  oR: 420,  yBase: -170, yS: 65,  size: 22, pulse: 2.0 },
  6: { iR: 100, oR: 550,  yBase: -400, yS: 75,  size: 30, pulse: 0.6 },
};
const MAX_RENDERED_EDGES = 8000; // cap for performance + clarity

function srand(s) { const x = Math.sin(s * 9301 + 49297) * 49297; return x - Math.floor(x); }
function escapeHtml(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

// =========== THREE.JS SETUP ===========
const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(1);
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#030308');
scene.fog = new THREE.FogExp2('#030308', 0.00025);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 1, 12000);
camera.position.set(500, 500, 800);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.08;
controls.minDistance = 80;
controls.maxDistance = 4000;
controls.maxPolarAngle = Math.PI * 0.85;
controls.minPolarAngle = Math.PI * 0.15;
controls.update();

// =========== BACKGROUND STARS ===========
const starCount = 700;
const starPos = new Float32Array(starCount * 3);
for (let i = 0; i < starCount; i++) {
  starPos[i * 3] = (srand(i * 31) - 0.5) * 5000;
  starPos[i * 3 + 1] = (srand(i * 37) - 0.5) * 5000;
  starPos[i * 3 + 2] = (srand(i * 41) - 0.5) * 5000;
}
const starGeo = new THREE.BufferGeometry();
starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
const starMat = new THREE.PointsMaterial({
  size: 1.2, color: '#223344', transparent: true, opacity: 0.5,
  blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true
});
scene.add(new THREE.Points(starGeo, starMat));

// =========== NODE + EDGE SHADER MATERIALS ===========
const nodeMat = new THREE.ShaderMaterial({
  uniforms: { uTime: { value: 0 } },
  vertexShader: \`
    attribute float aSize;
    attribute vec3 aColor;
    attribute float aHighlight;
    attribute float aPulse;
    varying vec3 vColor;
    varying float vAlpha;
    uniform float uTime;
    void main(){
      vColor = aColor;
      float breath = 1.0 + sin(uTime * aPulse + position.x * .008 + position.z * .006) * .12;
      vec3 pos = position;
      pos.y += sin(uTime * .3 + position.x * .01 + position.z * .015) * 3.0;
      vAlpha = aHighlight;
      vec4 mv = modelViewMatrix * vec4(pos, 1.0);
      gl_PointSize = aSize * breath * aHighlight * (500.0 / -mv.z);
      gl_Position = projectionMatrix * mv;
    }
  \`,
  fragmentShader: \`
    varying vec3 vColor;
    varying float vAlpha;
    void main(){
      vec2 c = gl_PointCoord - vec2(.5);
      float d = length(c);
      if(d > .5) discard;
      float core = exp(-d*d*100.0);
      float g1 = exp(-d*d*18.0) * .45;
      float g2 = exp(-d*d*4.0) * .15;
      float g3 = exp(-d*d*1.2) * .06;
      float i = core + g1 + g2 + g3;
      gl_FragColor = vec4(vColor * (1.0 + core * .5), i * vAlpha);
    }
  \`,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
});

const edgeMat = new THREE.ShaderMaterial({
  uniforms: { uTime: { value: 0 } },
  vertexShader: \`
    attribute vec3 color;
    attribute float aAlpha;
    varying vec3 vColor;
    varying float vAlpha;
    uniform float uTime;
    void main(){
      vColor = color;
      float pulse = .5 + .5 * sin(uTime * 1.2 + length(position) * .008);
      vAlpha = aAlpha * (0.6 + pulse * 0.4);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  \`,
  fragmentShader: \`
    varying vec3 vColor;
    varying float vAlpha;
    void main(){ gl_FragColor = vec4(vColor, vAlpha); }
  \`,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
});

const particleMat = new THREE.PointsMaterial({
  size: 3, vertexColors: true, transparent: true, opacity: 0.7,
  blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true
});

// =========== SCENE OBJECTS (rebuilt by rebuildScene) ===========
let nodePoints = null;
let nodeGeo = null;
let edgeLines = null;
let edgeGeo = null;
let particlePoints = null;
let particleGeo = null;

// Data arrays rebuilt per scene
let nodes = [];
let positions = [];
let byLevel = {};
let adj = {};
let nodeIdxMap = {};
let nodeEdgeMap = {};
let validEdges = [];
let pData = [];
let nCount = 0;
let eCount = 0;
let pCount = 0;

const PARTICLES_PER_EDGE = 3;
const tc = new THREE.Color();

// =========== REBUILD SCENE ===========
function rebuildScene() {
  // Dispose old geometries
  if (nodeGeo) { nodeGeo.dispose(); scene.remove(nodePoints); }
  if (edgeGeo) { edgeGeo.dispose(); scene.remove(edgeLines); }
  if (particleGeo) { particleGeo.dispose(); scene.remove(particlePoints); }

  nodes = BRAIN_DATA.nodes;
  nCount = nodes.length;

  // Group by level
  byLevel = {};
  nodes.forEach((n, i) => {
    const lv = n.level || 3;
    if (!byLevel[lv]) byLevel[lv] = [];
    byLevel[lv].push(i);
  });

  // Compute radial spiral positions
  positions = new Array(nCount);
  for (const [lv, indices] of Object.entries(byLevel)) {
    const s = SPATIAL[lv] || SPATIAL[3];
    const c = indices.length;
    indices.forEach((ni, j) => {
      const angle = (j / Math.max(c, 1)) * Math.PI * 2;
      const r = s.iR + srand(ni * 7) * (s.oR - s.iR);
      const spiral = angle + r * 0.004;
      const y = (s.yBase || 0) + (srand(ni * 11) - 0.5) * s.yS;
      positions[ni] = new THREE.Vector3(Math.cos(spiral) * r, y, Math.sin(spiral) * r);
    });
  }

  // Build adjacency + nodeIdxMap
  nodeIdxMap = {};
  nodes.forEach((n, i) => { nodeIdxMap[n.id] = i; });
  adj = {};
  nodeEdgeMap = {};
  BRAIN_DATA.edges.forEach((e, ei) => {
    const si = nodeIdxMap[e.source], ti = nodeIdxMap[e.target];
    if (si === undefined || ti === undefined) return;
    if (!adj[si]) adj[si] = new Set();
    if (!adj[ti]) adj[ti] = new Set();
    adj[si].add(ti);
    adj[ti].add(si);
    if (!nodeEdgeMap[si]) nodeEdgeMap[si] = [];
    if (!nodeEdgeMap[ti]) nodeEdgeMap[ti] = [];
    nodeEdgeMap[si].push(ei);
    nodeEdgeMap[ti].push(ei);
  });

  // ---- NODE POINTS ----
  nodeGeo = new THREE.BufferGeometry();
  const nPos = new Float32Array(nCount * 3);
  const nCol = new Float32Array(nCount * 3);
  const nSize = new Float32Array(nCount);
  const nHighlight = new Float32Array(nCount);
  const nPulse = new Float32Array(nCount);

  for (let i = 0; i < nCount; i++) {
    const p = positions[i];
    const n = nodes[i];
    const s = SPATIAL[n.level] || SPATIAL[3];
    nPos[i * 3] = p.x; nPos[i * 3 + 1] = p.y; nPos[i * 3 + 2] = p.z;
    tc.set(LEVEL_COLORS_HEX[n.level] || 0x00FFFF);
    nCol[i * 3] = tc.r; nCol[i * 3 + 1] = tc.g; nCol[i * 3 + 2] = tc.b;
    nSize[i] = s.size;
    nHighlight[i] = 1.0;
    nPulse[i] = s.pulse;
  }
  nodeGeo.setAttribute('position', new THREE.BufferAttribute(nPos, 3));
  nodeGeo.setAttribute('aColor', new THREE.BufferAttribute(nCol, 3));
  nodeGeo.setAttribute('aSize', new THREE.BufferAttribute(nSize, 1));
  nodeGeo.setAttribute('aHighlight', new THREE.BufferAttribute(nHighlight, 1));
  nodeGeo.setAttribute('aPulse', new THREE.BufferAttribute(nPulse, 1));
  nodePoints = new THREE.Points(nodeGeo, nodeMat);
  scene.add(nodePoints);

  // ---- EDGES (LineSegments) ----
  // Prioritize cross-level edges (vertical) over intra-level (horizontal)
  const allEdges = [];
  BRAIN_DATA.edges.forEach((e, i) => {
    const si = nodeIdxMap[e.source], ti = nodeIdxMap[e.target];
    if (si !== undefined && ti !== undefined) {
      const crossLevel = nodes[si].level !== nodes[ti].level;
      allEdges.push({ si, ti, weight: e.weight, type: e.type, idx: i, crossLevel });
    }
  });
  // Sort: cross-level edges first (they create the beautiful vertical connections)
  allEdges.sort((a, b) => {
    if (a.crossLevel !== b.crossLevel) return b.crossLevel ? 1 : -1;
    return b.weight - a.weight; // then by weight
  });
  validEdges = allEdges.slice(0, MAX_RENDERED_EDGES);

  eCount = validEdges.length;
  const ePos = new Float32Array(eCount * 6);
  const eCol = new Float32Array(eCount * 6);
  const eAlpha = new Float32Array(eCount * 2);
  const sc = new THREE.Color(), dc = new THREE.Color();

  // Scale alpha down when there are many edges
  const alphaScale = Math.min(1.0, 3000 / eCount);

  for (let i = 0; i < eCount; i++) {
    const { si, ti, weight, crossLevel } = validEdges[i];
    const s = positions[si], t = positions[ti];
    const o = i * 6;
    ePos[o] = s.x; ePos[o + 1] = s.y; ePos[o + 2] = s.z;
    ePos[o + 3] = t.x; ePos[o + 4] = t.y; ePos[o + 5] = t.z;
    sc.set(LEVEL_COLORS_HEX[nodes[si].level] || 0x00FFFF);
    dc.set(LEVEL_COLORS_HEX[nodes[ti].level] || 0x00FFFF);
    eCol[o] = sc.r; eCol[o + 1] = sc.g; eCol[o + 2] = sc.b;
    eCol[o + 3] = dc.r; eCol[o + 4] = dc.g; eCol[o + 5] = dc.b;
    // Cross-level edges brighter, intra-level edges dimmer
    const baseAlpha = crossLevel ? (0.08 + weight * 0.12) : (0.03 + weight * 0.04);
    eAlpha[i * 2] = baseAlpha * alphaScale;
    eAlpha[i * 2 + 1] = baseAlpha * alphaScale;
  }

  edgeGeo = new THREE.BufferGeometry();
  edgeGeo.setAttribute('position', new THREE.BufferAttribute(ePos, 3));
  edgeGeo.setAttribute('color', new THREE.BufferAttribute(eCol, 3));
  edgeGeo.setAttribute('aAlpha', new THREE.BufferAttribute(eAlpha, 1));
  edgeLines = new THREE.LineSegments(edgeGeo, edgeMat);
  scene.add(edgeLines);

  // ---- FLOWING PARTICLES (only on cross-level edges for clarity) ----
  pData = [];
  const maxParticleEdges = Math.min(eCount, 2000);
  for (let i = 0; i < maxParticleEdges; i++) {
    const { si, ti, weight, crossLevel } = validEdges[i];
    if (!crossLevel) continue; // only particles on vertical connections
    const particleCount = weight > 0.6 ? 2 : 1;
    for (let j = 0; j < particleCount; j++) {
      pData.push({
        edgeIdx: i, progress: srand(i * 100 + j * 31),
        speed: 0.15 + weight * 0.4 + srand(i * 70 + j * 17) * 0.1,
        srcIdx: si, tgtIdx: ti
      });
    }
  }
  pCount = pData.length;
  const pPos = new Float32Array(pCount * 3);
  const pCol = new Float32Array(pCount * 3);

  particleGeo = new THREE.BufferGeometry();
  particleGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  particleGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
  particlePoints = new THREE.Points(particleGeo, particleMat);
  scene.add(particlePoints);

  // ---- UPDATE HUD COUNTERS ----
  document.getElementById('node-count').textContent = nCount;
  const webCount = BRAIN_DATA.meta.webKnowledgeCount || nodes.filter(n => n.level === 6).length;
  document.getElementById('stats-text').textContent =
    nCount + ' nodes \\u00B7 ' + BRAIN_DATA.edges.length + ' connections' +
    (webCount > 0 ? ' \\u00B7 ' + webCount + ' web' : '') +
    ' \\u00B7 ' + BRAIN_DATA.meta.projectName;
  document.getElementById('web-count').textContent = webCount > 0 ? '\\u{1F310} ' + webCount + ' web' : '';

  // Reset level toggles to all active
  levelToggles = {};
  document.querySelectorAll('[data-level]').forEach(btn => {
    levelToggles[parseInt(btn.dataset.level)] = btn.classList.contains('active');
  });

  // Reset interaction state
  hoveredIdx = -1;
  selectedIdx = -1;
}

// =========== INTERACTION STATE ===========
const raycaster = new THREE.Raycaster();
raycaster.params.Points = { threshold: 12 };
const mouse = new THREE.Vector2();
let hoveredIdx = -1;
let selectedIdx = -1;
let camTween = null;
let levelToggles = {};

const tooltipEl = document.getElementById('tooltip');
const ttNameEl = tooltipEl.querySelector('.tt-name');
const ttTypeEl = tooltipEl.querySelector('.tt-type');
const ttMetaEl = tooltipEl.querySelector('.tt-meta');

// =========== MOUSEMOVE (hover) ===========
renderer.domElement.addEventListener('mousemove', (e) => {
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

  if (!nodePoints) return;
  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObject(nodePoints);
  const prevHovered = hoveredIdx;

  if (hits.length > 0) {
    hoveredIdx = hits[0].index;
    renderer.domElement.style.cursor = 'pointer';

    const n = nodes[hoveredIdx];
    ttNameEl.textContent = n.label;
    const levelLabel = n.level === 6 ? '\\u{1F310} Web Knowledge' : n.type + ' \\u00B7 Level ' + n.level;
    ttTypeEl.textContent = levelLabel;
    const metaExtra = n.webTopic ? ' \\u00B7 ' + n.webTopic : '';
    ttMetaEl.textContent =
      'Relevance: ' + n.relevanceScore.toFixed(2) + ' \\u00B7 ' + n.createdAt.slice(0, 10) + metaExtra;
    tooltipEl.style.display = 'block';
    tooltipEl.style.left = (e.clientX + 14) + 'px';
    tooltipEl.style.top = (e.clientY - 10) + 'px';
  } else {
    hoveredIdx = -1;
    renderer.domElement.style.cursor = 'default';
    tooltipEl.style.display = 'none';
  }

  if (prevHovered !== hoveredIdx) updateHighlights();
});

// =========== CLICK (select) ===========
renderer.domElement.addEventListener('click', () => {
  if (hoveredIdx >= 0) {
    selectedIdx = hoveredIdx;
    showSidebar(nodes[selectedIdx]);
    controls.autoRotate = false;

    // Fly to node
    const np = positions[selectedIdx];
    const dir = camera.position.clone().sub(np).normalize();
    camTween = {
      startPos: camera.position.clone(), startLookAt: controls.target.clone(),
      targetPos: np.clone().add(dir.multiplyScalar(70)), targetLookAt: np.clone(),
      progress: 0
    };
    updateHighlights();
  }
});

// =========== HIGHLIGHTS ===========
function updateHighlights() {
  if (!nodeGeo || !edgeGeo) return;
  const ha = nodeGeo.attributes.aHighlight;
  const ea = edgeGeo.attributes.aAlpha;
  const searchQuery = document.getElementById('search-input').value.toLowerCase();
  const hasSearch = searchQuery.length > 0;
  const hasFocus = selectedIdx >= 0;
  const connectedToHover = hoveredIdx >= 0 && adj[hoveredIdx] ? adj[hoveredIdx] : new Set();
  const connectedToSelected = selectedIdx >= 0 && adj[selectedIdx] ? adj[selectedIdx] : new Set();

  for (let i = 0; i < nCount; i++) {
    let h = 1.0;

    // Level toggle filter
    const lv = nodes[i].level;
    if (levelToggles[lv] === false) { h = 0.05; ha.array[i] = h; continue; }

    if (hasSearch) {
      const n = nodes[i];
      const match = n.label.toLowerCase().includes(searchQuery) || n.content.toLowerCase().includes(searchQuery);
      h = match ? 1.0 : 0.12;
    }
    if (hasFocus) {
      h = connectedToSelected.has(i) || i === selectedIdx ? 1.0 : 0.1;
    }
    if (hoveredIdx >= 0) {
      if (i === hoveredIdx) h = Math.max(h, 1.5);
      else if (connectedToHover.has(i)) h = Math.max(h, 1.2);
    }
    ha.array[i] = h;
  }
  ha.needsUpdate = true;

  // Edge highlights
  const activeEdgeTypes = getActiveEdgeTypes();
  const alphaS = Math.min(1.0, 3000 / eCount);
  for (let i = 0; i < eCount; i++) {
    const { si, ti, weight, type, crossLevel } = validEdges[i];
    const baseA = crossLevel ? (0.08 + weight * 0.12) : (0.03 + weight * 0.04);
    let a = baseA * alphaS;

    // Level toggle: hide edges connected to hidden levels
    const sLv = nodes[si].level, tLv = nodes[ti].level;
    if (levelToggles[sLv] === false || levelToggles[tLv] === false) { a = 0; ea.array[i * 2] = 0; ea.array[i * 2 + 1] = 0; continue; }

    // Edge type filter
    if (activeEdgeTypes !== null && !activeEdgeTypes.has(type)) { a = 0; }

    if (hasFocus) {
      const connected = (si === selectedIdx || ti === selectedIdx);
      a = connected ? 0.4 + weight * 0.3 : 0.01;
    }
    if (hoveredIdx >= 0) {
      const connected = (si === hoveredIdx || ti === hoveredIdx);
      if (connected) a = Math.max(a, 0.35 + weight * 0.3);
    }
    if (hasSearch) {
      const sm = nodes[si].label.toLowerCase().includes(searchQuery);
      const tm = nodes[ti].label.toLowerCase().includes(searchQuery);
      if (!sm && !tm) a = 0.01;
    }
    ea.array[i * 2] = a;
    ea.array[i * 2 + 1] = a;
  }
  ea.needsUpdate = true;
}

function getActiveEdgeTypes() {
  const allBtn = document.querySelector('[data-edge="all"]');
  if (allBtn && allBtn.classList.contains('active')) return null; // show all
  const active = new Set();
  document.querySelectorAll('[data-edge].active').forEach(b => {
    if (b.dataset.edge !== 'all') active.add(b.dataset.edge);
  });
  return active.size > 0 ? active : null;
}

// =========== SIDEBAR ===========
function showSidebar(node) {
  const sidebar = document.getElementById('sidebar');
  const content = document.getElementById('sidebar-content');

  const typeColors = { code: '#00FFFF', module: '#00CED1', architecture: '#8A2BE2', pattern: '#00ff88', error: '#ff4444', decision: '#ffdd00', summary: '#888', web_knowledge: '#FFAA00' };
  const color = typeColors[node.type] || '#888';

  const connEdges = BRAIN_DATA.edges.filter(e => e.source === node.id || e.target === node.id);
  const relHtml = connEdges.map(e => {
    const otherId = e.source === node.id ? e.target : e.source;
    const otherIdx = nodeIdxMap[otherId];
    const otherLabel = otherIdx !== undefined ? nodes[otherIdx].label : otherId.slice(0, 8);
    const edgeColor = EDGE_COLORS[e.type] || EDGE_COLORS.default;
    return '<li><span style="color:' + edgeColor + '">' + e.type + '</span> \\u2192 ' + escapeHtml(otherLabel) + '</li>';
  }).join('');

  const levelName = node.level === 6 ? 'Web Knowledge' : 'L' + node.level;
  const isWeb = node.level === 6;

  let webInfoHtml = '';
  if (isWeb) {
    if (node.webTopic) webInfoHtml += '<div class="meta-row" style="color:#FFAA00">\\u{1F310} Topic: ' + escapeHtml(node.webTopic) + '</div>';
    if (node.webSource) webInfoHtml += '<div class="meta-row"><a href="' + escapeHtml(node.webSource) + '" target="_blank" style="color:#668;text-decoration:underline">\\u{1F517} ' + escapeHtml(node.webSource) + '</a></div>';
  }

  content.innerHTML =
    '<h2>' + escapeHtml(node.label) + '</h2>' +
    '<span class="node-type" style="background:' + color + '15;color:' + color + ';border:1px solid ' + color + '33">' + (isWeb ? '\\u{1F310} Web' : node.type) + ' \\u00B7 ' + levelName + '</span>' +
    webInfoHtml +
    '<div class="content-preview">' + escapeHtml(node.content) + '</div>' +
    '<div class="meta-row">Relevance: ' + node.relevanceScore.toFixed(3) + '</div>' +
    '<div class="meta-row">Created: ' + node.createdAt.slice(0, 10) + '</div>' +
    '<div class="meta-row">Accessed: ' + node.lastAccessed.slice(0, 10) + '</div>' +
    (connEdges.length > 0 ? '<h3 style="margin-top:16px;font-size:11px;color:#556;text-transform:uppercase;letter-spacing:1px">Relations (' + connEdges.length + ')</h3><ul class="relations">' + relHtml + '</ul>' : '');

  sidebar.classList.add('open');
}

function closeSidebar(evt) {
  document.getElementById('sidebar').classList.remove('open');
  selectedIdx = -1;
  updateHighlights();

  // Shift+click = stay zoomed in, otherwise zoom back to overview
  const holdPosition = evt && evt.shiftKey;
  if (!holdPosition) {
    controls.autoRotate = true;
    camTween = {
      startPos: camera.position.clone(), startLookAt: controls.target.clone(),
      targetPos: new THREE.Vector3(500, 350, 700), targetLookAt: new THREE.Vector3(0, 60, 0),
      progress: 0
    };
  }
}

document.getElementById('sidebar-close').addEventListener('click', (e) => closeSidebar(e));

// =========== HELP OVERLAY ===========
const helpOverlay = document.getElementById('help-overlay');
document.getElementById('help-btn').addEventListener('click', () => {
  helpOverlay.classList.toggle('open');
});
helpOverlay.addEventListener('click', (e) => {
  if (e.target === helpOverlay) helpOverlay.classList.remove('open');
});

// =========== GLOBAL KEYBOARD ===========
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;

  if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
    e.preventDefault();
    helpOverlay.classList.toggle('open');
  }
  if (e.key === 'Escape') {
    if (helpOverlay.classList.contains('open')) {
      helpOverlay.classList.remove('open');
    } else if (document.getElementById('sidebar').classList.contains('open')) {
      closeSidebar(e);
    }
  }
});

// =========== SEARCH ===========
document.getElementById('search-input').addEventListener('input', () => {
  updateHighlights();
});

// =========== LEVEL TOGGLES ===========
document.querySelectorAll('[data-level]').forEach(btn => {
  btn.addEventListener('click', () => {
    btn.classList.toggle('active');
    const level = parseInt(btn.dataset.level);
    levelToggles[level] = btn.classList.contains('active');
    updateHighlights();
  });
});

// =========== EDGE TOGGLES ===========
document.querySelectorAll('[data-edge]').forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.dataset.edge === 'all') {
      document.querySelectorAll('[data-edge]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    } else {
      document.querySelector('[data-edge="all"]').classList.remove('active');
      btn.classList.toggle('active');
      const activeTypes = new Set();
      document.querySelectorAll('[data-edge].active').forEach(b => {
        if (b.dataset.edge !== 'all') activeTypes.add(b.dataset.edge);
      });
      if (activeTypes.size === 0) {
        document.querySelector('[data-edge="all"]').classList.add('active');
      }
    }
    updateHighlights();
  });
});

// =========== ANIMATION LOOP ===========
const clock = new THREE.Clock();
let fpsFrames = 0;
let lastFpsTime = performance.now();

function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();
  const t = clock.getElapsedTime();

  // Update shader uniforms
  nodeMat.uniforms.uTime.value = t;
  edgeMat.uniforms.uTime.value = t;

  // Camera tween
  if (camTween) {
    camTween.progress = Math.min(camTween.progress + dt * 1.8, 1);
    const ease = 1 - Math.pow(1 - camTween.progress, 3);
    camera.position.lerpVectors(camTween.startPos, camTween.targetPos, ease);
    controls.target.lerpVectors(camTween.startLookAt, camTween.targetLookAt, ease);
    if (camTween.progress >= 1) camTween = null;
  }

  controls.update();

  // Update flowing particles
  if (particleGeo && pCount > 0) {
    const pPosArr = particleGeo.attributes.position.array;
    const pColArr = particleGeo.attributes.color.array;
    const sc2 = new THREE.Color(), dc2 = new THREE.Color();
    for (let i = 0; i < pCount; i++) {
      const pd = pData[i];
      pd.progress += pd.speed * dt;
      if (pd.progress > 1) pd.progress -= 1;
      const p = pd.progress;
      const sp = positions[pd.srcIdx], tp = positions[pd.tgtIdx];
      pPosArr[i * 3] = sp.x + (tp.x - sp.x) * p;
      pPosArr[i * 3 + 1] = sp.y + (tp.y - sp.y) * p;
      pPosArr[i * 3 + 2] = sp.z + (tp.z - sp.z) * p;
      sc2.set(LEVEL_COLORS_HEX[nodes[pd.srcIdx].level] || 0x00FFFF);
      dc2.set(LEVEL_COLORS_HEX[nodes[pd.tgtIdx].level] || 0x00FFFF);
      pColArr[i * 3] = sc2.r + (dc2.r - sc2.r) * p;
      pColArr[i * 3 + 1] = sc2.g + (dc2.g - sc2.g) * p;
      pColArr[i * 3 + 2] = sc2.b + (dc2.b - sc2.b) * p;
    }
    particleGeo.attributes.position.needsUpdate = true;
    particleGeo.attributes.color.needsUpdate = true;
  }

  // Render (no bloom/composer, direct render)
  renderer.render(scene, camera);

  // FPS counter
  fpsFrames++;
  const now = performance.now();
  if (now - lastFpsTime > 1000) {
    document.getElementById('fps-counter').textContent = fpsFrames;
    fpsFrames = 0;
    lastFpsTime = now;
  }
}

// =========== RESIZE ===========
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// =========== WEBSOCKET LIVE UPDATES ===========
let ws = null;

(function connectWebSocket() {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = proto + '//' + location.host;

  function connect() {
    try { ws = new WebSocket(wsUrl); } catch { return; }

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'full_sync' && msg.data) {
          if (msg.data.nodes.length !== BRAIN_DATA.nodes.length ||
              msg.data.edges.length !== BRAIN_DATA.edges.length) {
            BRAIN_DATA = msg.data;
            rebuildScene();
          }
        }
        if (msg.type === 'web_knowledge') {
          showWebKnowledgePopup(msg.topic, msg.summary, msg.source);
        }
        if (msg.type === 'agent_finding') {
          addAgentFinding(msg.sessionName, msg.finding, msg.severity, msg.file);
        }
        if (msg.type === 'scope_changed') {
          updateScopeUI(msg.scope);
        }
        if (msg.type === 'model_activated') {
          document.querySelectorAll('[data-activate]').forEach(btn => {
            btn.disabled = false;
            btn.textContent = '\\u26A1 Activate';
          });
          const note = document.createElement('div');
          note.style.cssText = 'position:fixed;top:60px;left:50%;transform:translateX(-50%);' +
            'background:rgba(0,255,100,0.15);border:1px solid rgba(0,255,100,0.3);' +
            'color:#00ff66;padding:8px 20px;border-radius:8px;font-size:12px;z-index:999;' +
            'backdrop-filter:blur(10px);';
          note.textContent = '\\u26A1 Model activated: ' + msg.model;
          document.body.appendChild(note);
          setTimeout(() => note.remove(), 3000);
          refreshModels();
        }
      } catch {}
    };

    ws.onclose = () => {
      setTimeout(connect, 3000);
    };

    ws.onerror = () => { ws.close(); };
  }

  connect();
})();

// =========== WEB KNOWLEDGE POP-UP SYSTEM ===========
function showWebKnowledgePopup(topic, summary, source) {
  const container = document.getElementById('web-knowledge-container');

  const popup = document.createElement('div');
  popup.className = 'web-knowledge-popup';

  let displayUrl = source;
  try {
    const u = new URL(source);
    displayUrl = u.hostname + u.pathname.slice(0, 30);
  } catch {}

  popup.innerHTML =
    '<div class="wk-header">' +
      '<span class="wk-icon">\\u{1F310}</span>' +
      '<span class="wk-title">Web Knowledge</span>' +
    '</div>' +
    '<div class="wk-topic">' + escapeHtml(topic) + '</div>' +
    '<div class="wk-summary">' + escapeHtml(summary) + '</div>' +
    '<div class="wk-source">' + escapeHtml(displayUrl) + '</div>' +
    '<div class="wk-progress"><div class="wk-progress-bar"></div></div>';

  container.appendChild(popup);

  setTimeout(() => {
    const rect = popup.getBoundingClientRect();
    spawnParticleBurst(rect.left + rect.width / 2, rect.top + 20);
  }, 400);

  flashRandomNode();

  setTimeout(() => {
    popup.classList.add('removing');
    setTimeout(() => popup.remove(), 500);
  }, 6000);

  while (container.children.length > 3) {
    container.firstChild.remove();
  }
}

function spawnParticleBurst(x, y) {
  const burst = document.createElement('div');
  burst.className = 'wk-particle-burst';
  burst.style.left = x + 'px';
  burst.style.top = y + 'px';
  document.body.appendChild(burst);

  for (let i = 0; i < 8; i++) {
    const particle = document.createElement('div');
    particle.className = 'wk-particle';
    const angle = (i / 8) * Math.PI * 2;
    const dist = 30 + Math.random() * 40;
    particle.style.setProperty('--tx', Math.cos(angle) * dist + 'px');
    particle.style.setProperty('--ty', Math.sin(angle) * dist + 'px');
    burst.appendChild(particle);
  }

  setTimeout(() => burst.remove(), 1200);
}

function flashRandomNode() {
  if (!nodeGeo || nCount === 0) return;

  // Pick a random L2 node (or any if no L2)
  const l2Indices = (byLevel[2] || []);
  const targets = l2Indices.length > 0 ? l2Indices : Object.values(byLevel).flat();
  const idx = targets[Math.floor(Math.random() * targets.length)];

  const ha = nodeGeo.attributes.aHighlight;
  const origVal = ha.array[idx];

  // Flash to 2.0
  ha.array[idx] = 2.0;
  ha.needsUpdate = true;

  // Animate back to 1.0
  let progress = 0;
  const restore = () => {
    progress += 0.02;
    if (progress >= 1) {
      ha.array[idx] = origVal;
      ha.needsUpdate = true;
      return;
    }
    ha.array[idx] = 2.0 - progress * (2.0 - origVal);
    ha.needsUpdate = true;
    requestAnimationFrame(restore);
  };
  setTimeout(restore, 800);
}

// =========== SCOPE SWITCHER ===========
let currentScope = '${data.meta.brainScope === 'project' ? 'project' : 'global'}';

document.querySelectorAll('#scope-switcher .scope-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const newScope = btn.dataset.scope;
    if (newScope === currentScope) return;

    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = proto + '//' + location.host;
    const scopeWs = new WebSocket(wsUrl);
    scopeWs.onopen = () => {
      scopeWs.send(JSON.stringify({ type: 'scope_switch', scope: newScope }));
      scopeWs.close();
    };

    updateScopeUI(newScope);
  });
});

function updateScopeUI(scope) {
  currentScope = scope;
  document.querySelectorAll('#scope-switcher .scope-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.scope === scope);
  });
}

// =========== MODEL MANAGEMENT PANEL ===========
const RECOMMENDED_MODELS = [
  { name: 'qwen3-coder:30b', size: '~18 GB', desc: 'Best coding model for 32GB VRAM (MoE, 30B/3B active)', vram: 18 },
  { name: 'qwen2.5-coder:32b', size: '~22 GB', desc: 'Battle-tested coding champion, excellent tool use', vram: 22 },
  { name: 'qwen2.5-coder:14b', size: '~10 GB', desc: 'Great coding, lower VRAM \\u2014 fast on any GPU', vram: 10 },
  { name: 'deepseek-r1:32b', size: '~22 GB', desc: 'Strong reasoning + coding (chain-of-thought)', vram: 22 },
  { name: 'qwen2.5-coder:7b', size: '~5 GB', desc: 'Lightweight coder, runs on almost anything', vram: 5 },
  { name: 'deepseek-coder-v2:16b', size: '~11 GB', desc: 'Good all-round coder, MoE architecture', vram: 11 },
  { name: 'codellama:34b', size: '~20 GB', desc: 'Meta code model, good for infill + completion', vram: 20 },
  { name: 'llama3.3:70b-instruct-q4_K_M', size: '~42 GB', desc: 'Full Llama 3.3 70B \\u2014 needs 48GB+ VRAM', vram: 42 },
];

const modelsPanel = document.getElementById('models-panel');
const modelsToggle = document.getElementById('models-toggle');
const modelsClose = document.getElementById('models-close');
const ollamaStatus = document.getElementById('ollama-status');
const ollamaDot = document.getElementById('ollama-dot');
const runningSection = document.getElementById('running-section');
const runningModels = document.getElementById('running-models');
const installedModels = document.getElementById('installed-models');
const recommendedModels = document.getElementById('recommended-models');

let currentVramFilter = 32;
let installedModelNames = new Set();
let runningModelNames = new Set();
let ollamaOnline = false;

modelsToggle.addEventListener('click', () => {
  modelsPanel.classList.toggle('open');
  if (modelsPanel.classList.contains('open')) refreshModels();
});
modelsClose.addEventListener('click', () => modelsPanel.classList.remove('open'));

// GPU filter buttons
document.querySelectorAll('#gpu-filter .gpu-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#gpu-filter .gpu-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentVramFilter = parseInt(btn.dataset.vram);
    renderRecommended();
  });
});

async function checkOllamaStatus() {
  try {
    const res = await fetch('/api/ollama/status');
    const data = await res.json();
    if (data.version) {
      ollamaOnline = true;
      ollamaStatus.textContent = 'Ollama v' + data.version + ' \\u2014 running';
      ollamaStatus.style.color = '#00ff88';
      ollamaDot.className = 'status-dot online';
      return true;
    }
  } catch {}
  ollamaOnline = false;
  ollamaStatus.textContent = 'Ollama not running \\u2014 start with: ollama serve';
  ollamaStatus.style.color = '#ff4444';
  ollamaDot.className = 'status-dot offline';
  return false;
}

async function fetchInstalledModels() {
  try {
    const res = await fetch('/api/ollama/models');
    const data = await res.json();
    return data.models || [];
  } catch { return []; }
}

async function fetchRunningModels() {
  try {
    const res = await fetch('/api/ollama/running');
    const data = await res.json();
    return data.models || [];
  } catch { return []; }
}

async function fetchCloudModels() {
  try {
    const res = await fetch('/api/cloud/models');
    const data = await res.json();
    return data.models || [];
  } catch { return []; }
}

function formatBytes(bytes) {
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return gb.toFixed(1) + ' GB';
  return (bytes / (1024 * 1024)).toFixed(0) + ' MB';
}

async function refreshModels() {
  const online = await checkOllamaStatus();
  if (!online) {
    installedModels.innerHTML = '<div style="color:#556;font-size:11px">Start Ollama to see models</div>';
    runningSection.style.display = 'none';
    renderRecommended();
    return;
  }

  const [installed, running] = await Promise.all([fetchInstalledModels(), fetchRunningModels()]);
  installedModelNames = new Set(installed.map(m => m.name));
  runningModelNames = new Set(running.map(m => m.name));

  // Running models
  if (running.length > 0) {
    runningSection.style.display = 'block';
    runningModels.innerHTML = '';
    for (const m of running) {
      const card = document.createElement('div');
      card.className = 'model-card';
      const sizeStr = m.size ? formatBytes(m.size) : '';
      const vramStr = m.size_vram ? formatBytes(m.size_vram) : '';
      card.innerHTML =
        '<div class="mc-name">' + escapeHtml(m.name) + '</div>' +
        '<div class="mc-meta">' + sizeStr + (vramStr ? ' \\u00B7 VRAM: ' + vramStr : '') + '</div>' +
        '<span class="mc-status running">\\u25B6 running</span>';
      runningModels.appendChild(card);
    }
  } else {
    runningSection.style.display = 'none';
  }

  // Installed models
  if (installed.length > 0) {
    installedModels.innerHTML = '';
    for (const m of installed) {
      const card = document.createElement('div');
      card.className = 'model-card';
      const sizeStr = m.size ? formatBytes(m.size) : '';
      const paramSize = m.details?.parameter_size || '';
      const quant = m.details?.quantization_level || '';
      const isRunning = runningModelNames.has(m.name);
      card.innerHTML =
        '<div class="mc-name">' + escapeHtml(m.name) + '</div>' +
        '<div class="mc-meta">' + sizeStr + (paramSize ? ' \\u00B7 ' + paramSize : '') + (quant ? ' \\u00B7 ' + quant : '') + '</div>' +
        (isRunning ? '<span class="mc-status running">\\u25B6 running</span>' : '<span class="mc-status installed">\\u2705 installed</span>') +
        '<div class="mc-actions">' +
          '<button class="mc-btn primary" data-activate="' + escapeHtml(m.name) + '">\\u26A1 Activate</button>' +
          '<button class="mc-btn danger" data-delete="' + escapeHtml(m.name) + '">\\u{1F5D1} Delete</button>' +
        '</div>';
      installedModels.appendChild(card);
    }
    // Attach activate handlers
    installedModels.querySelectorAll('[data-activate]').forEach(btn => {
      btn.addEventListener('click', () => {
        const name = btn.dataset.activate;
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'activate_model', model: name }));
          btn.textContent = '\\u23F3 Activating...';
          btn.disabled = true;
        }
      });
    });
    // Attach delete handlers
    installedModels.querySelectorAll('[data-delete]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const name = btn.dataset.delete;
        if (!confirm('Delete model ' + name + '?')) return;
        btn.disabled = true;
        btn.textContent = 'Deleting...';
        try {
          await fetch('/api/ollama/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name }),
          });
        } catch {}
        refreshModels();
      });
    });
  } else {
    installedModels.innerHTML = '<div style="color:#556;font-size:11px">No models installed yet</div>';
  }

  renderRecommended();
}

function renderRecommended() {
  recommendedModels.innerHTML = '';
  const filtered = RECOMMENDED_MODELS.filter(m => m.vram <= currentVramFilter);

  if (filtered.length === 0) {
    recommendedModels.innerHTML = '<div style="color:#556;font-size:11px">No models fit this VRAM budget</div>';
    return;
  }

  for (const m of filtered) {
    const installed = installedModelNames.has(m.name);
    const running = runningModelNames.has(m.name);
    const card = document.createElement('div');
    card.className = 'model-card';
    card.innerHTML =
      '<div class="mc-name">' + escapeHtml(m.name) + '</div>' +
      '<div class="mc-meta">' + m.size + ' VRAM</div>' +
      '<div class="mc-desc">' + escapeHtml(m.desc) + '</div>' +
      (running ? '<span class="mc-status running">\\u25B6 running</span>' :
       installed ? '<span class="mc-status installed">\\u2705 installed</span>' :
       '<span class="mc-status available">\\u2B07 available</span>') +
      (installed ? '<div class="mc-actions"><button class="mc-btn primary" data-activate="' + escapeHtml(m.name) + '">\\u26A1 Activate</button></div>' :
       '<div class="mc-actions"><button class="mc-btn" data-pull="' + escapeHtml(m.name) + '">\\u2B07 Download</button></div>') +
      '<div class="mc-progress" id="progress-' + m.name.replace(/[^a-z0-9]/gi, '-') + '">' +
        '<div class="mc-progress-bar"><div class="mc-progress-fill"></div></div>' +
        '<div class="mc-progress-text"></div>' +
      '</div>';
    recommendedModels.appendChild(card);
  }

  // Attach pull handlers
  recommendedModels.querySelectorAll('[data-pull]').forEach(btn => {
    btn.addEventListener('click', () => pullModel(btn.dataset.pull, btn));
  });
  // Attach activate handlers for installed recommended models
  recommendedModels.querySelectorAll('[data-activate]').forEach(btn => {
    btn.addEventListener('click', () => {
      const name = btn.dataset.activate;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'activate_model', model: name }));
        btn.textContent = '\\u23F3 Activating...';
        btn.disabled = true;
      }
    });
  });
}

async function pullModel(name, btn) {
  if (!ollamaOnline) { checkOllamaStatus(); return; }
  btn.disabled = true;
  btn.textContent = 'Downloading...';

  const progressId = 'progress-' + name.replace(/[^a-z0-9]/gi, '-');
  const progressEl = document.getElementById(progressId);
  if (progressEl) progressEl.classList.add('active');
  const progressFill = progressEl?.querySelector('.mc-progress-fill');
  const progressText = progressEl?.querySelector('.mc-progress-text');
  if (progressText) progressText.textContent = 'Connecting to Ollama...';

  try {
    const res = await fetch('/api/ollama/pull', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });

    if (!res.ok || !res.body) {
      btn.textContent = '\\u274C Failed';
      btn.disabled = false;
      if (progressText) progressText.textContent = 'Server error: HTTP ' + res.status;
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let gotData = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const data = JSON.parse(line.slice(6));
          gotData = true;
          if (data.error) {
            if (progressText) progressText.textContent = data.error;
            btn.textContent = '\\u274C Failed';
            btn.disabled = false;
            console.error('Ollama pull error:', data.error);
            return;
          }
          if (data.completed && data.total) {
            const pct = Math.round((data.completed / data.total) * 100);
            if (progressFill) progressFill.style.width = pct + '%';
            if (progressText) progressText.textContent = (data.status || 'downloading') + ' ' + pct + '%';
          } else if (data.status) {
            if (progressText) progressText.textContent = data.status;
          }
          if (data.status === 'success') {
            btn.textContent = '\\u2705 Installed';
            btn.classList.add('installed');
            if (progressText) progressText.textContent = 'Complete!';
            setTimeout(() => refreshModels(), 1000);
            return;
          }
        } catch (parseErr) {
          console.warn('SSE parse error:', line, parseErr);
        }
      }
    }

    if (gotData) {
      btn.textContent = '\\u2705 Installed';
      if (progressText) progressText.textContent = 'Complete!';
      setTimeout(() => refreshModels(), 1000);
    } else {
      btn.textContent = '\\u274C Failed';
      btn.disabled = false;
      if (progressText) progressText.textContent = 'No response from Ollama';
    }
  } catch (err) {
    console.error('Pull fetch error:', err);
    btn.textContent = '\\u274C Retry';
    btn.disabled = false;
    if (progressText) progressText.textContent = 'Connection failed: ' + (err.message || err);
  }
}

// Auto-refresh models every 15 seconds while panel is open
setInterval(() => {
  if (modelsPanel.classList.contains('open')) refreshModels();
}, 15000);

// Initial status check
checkOllamaStatus();

// =========== AGENT FINDINGS PANEL ===========
let findingsData = [];
const findingsPanel = document.getElementById('findings-panel');
const findingsList = document.getElementById('findings-list');
const findingsCount = document.getElementById('findings-count');
const findingsToggle = document.getElementById('findings-toggle');
const findingsBadge = document.getElementById('findings-badge');

findingsToggle.addEventListener('click', () => {
  findingsPanel.classList.toggle('open');
});

function addAgentFinding(sessionName, finding, severity, file) {
  findingsData.push({ sessionName, finding, severity, file, time: Date.now() });

  findingsBadge.style.display = 'inline';
  findingsBadge.textContent = findingsData.length;
  findingsCount.textContent = findingsData.length + ' finding(s)';

  findingsList.innerHTML = '';
  const sorted = [...findingsData].reverse();
  for (const f of sorted) {
    const item = document.createElement('div');
    item.className = 'finding-item';
    item.innerHTML =
      '<span class="f-severity ' + f.severity + '">' + f.severity + '</span> ' +
      '<div class="f-text">' + escapeHtml(f.finding) + '</div>' +
      (f.file ? '<div class="f-file">' + escapeHtml(f.file) + '</div>' : '') +
      '<div class="f-file">' + escapeHtml(f.sessionName) + '</div>';
    findingsList.appendChild(item);
  }

  flashRandomNode();

  if (findingsData.length === 1) {
    findingsPanel.classList.add('open');
  }
}

// =========== VOICE INPUT SYSTEM ===========
(function initVoice() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const voicePanel = document.getElementById('voice-panel');
  const voiceBtn = document.getElementById('voice-btn');
  const transcript = document.getElementById('voice-transcript');
  const sendBtn = document.getElementById('voice-send');
  const langSelect = document.getElementById('voice-lang');
  const statusEl = document.getElementById('voice-status');
  const waveform = document.getElementById('voice-waveform');

  if (!SpeechRecognition) {
    transcript.textContent = 'Voice not supported in this browser';
    voiceBtn.style.opacity = '0.3';
    voiceBtn.style.cursor = 'not-allowed';
    return;
  }

  // Build waveform bars with staggered delays
  for (let i = 0; i < 5; i++) {
    const bar = document.createElement('div');
    bar.className = 'waveform-bar';
    bar.style.animationDelay = (i * 0.12) + 's';
    waveform.appendChild(bar);
  }

  let recognition = null;
  let isRecording = false;
  let finalText = '';
  let interimText = '';

  function createRecognition() {
    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = langSelect.value;
    rec.maxAlternatives = 1;

    rec.onresult = (event) => {
      interimText = '';
      finalText = '';
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalText += result[0].transcript;
        } else {
          interimText += result[0].transcript;
        }
      }

      const display = finalText + (interimText ? '<span style="color:#556">' + escapeHtml(interimText) + '</span>' : '');
      transcript.innerHTML = display || '<span style="color:#445;font-style:italic">Listening...</span>';
      transcript.classList.remove('placeholder');

      if (finalText.trim()) {
        sendBtn.classList.add('visible');
      }
    };

    rec.onerror = (event) => {
      if (event.error === 'not-allowed') {
        statusEl.textContent = 'denied';
        transcript.textContent = 'Microphone access denied';
        transcript.classList.add('placeholder');
      } else if (event.error !== 'aborted') {
        statusEl.textContent = event.error;
      }
      stopRecording();
    };

    rec.onend = () => {
      if (isRecording) {
        try { rec.start(); } catch { stopRecording(); }
      }
    };

    return rec;
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(t => t.stop());
    } catch (permErr) {
      statusEl.textContent = 'denied';
      transcript.textContent = 'Microphone permission denied. Allow mic access in your browser.';
      transcript.classList.add('placeholder');
      return;
    }

    recognition = createRecognition();
    finalText = '';
    interimText = '';
    isRecording = true;

    voiceBtn.classList.add('recording');
    voicePanel.classList.add('recording');
    voiceBtn.textContent = '\\u23F9';
    transcript.innerHTML = '<span style="color:#445;font-style:italic">Listening...</span>';
    transcript.classList.remove('placeholder');
    sendBtn.classList.remove('visible');
    statusEl.textContent = '\\u25CF rec';
    statusEl.style.color = '#ff3c3c';

    try {
      recognition.start();
    } catch (e) {
      statusEl.textContent = 'error';
      stopRecording();
    }
  }

  function stopRecording() {
    isRecording = false;
    voiceBtn.classList.remove('recording');
    voicePanel.classList.remove('recording');
    voiceBtn.textContent = '\\u{1F3A4}';
    statusEl.textContent = '';
    statusEl.style.color = '';

    if (recognition) {
      try { recognition.stop(); } catch {}
      recognition = null;
    }

    if (finalText.trim()) {
      sendBtn.classList.add('visible');
      transcript.textContent = finalText;
    } else if (!transcript.textContent || transcript.textContent === 'Listening...') {
      transcript.textContent = 'Click mic to speak...';
      transcript.classList.add('placeholder');
    }
  }

  voiceBtn.addEventListener('click', () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  });

  // Send voice text to CLI via WebSocket
  sendBtn.addEventListener('click', () => {
    const text = finalText.trim();
    if (!text) return;

    sendVoiceToCLI(text);

    finalText = '';
    interimText = '';
    transcript.textContent = 'Click mic to speak...';
    transcript.classList.add('placeholder');
    sendBtn.classList.remove('visible');
  });

  // Enter key sends
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && finalText.trim() && sendBtn.classList.contains('visible')) {
      e.preventDefault();
      sendBtn.click();
    }
  });

  langSelect.addEventListener('change', () => {
    if (isRecording) {
      stopRecording();
      startRecording();
    }
  });

  function sendVoiceToCLI(text) {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = proto + '//' + location.host;
    const sendWs = new WebSocket(wsUrl);

    sendWs.onopen = () => {
      sendWs.send(JSON.stringify({ type: 'voice_input', text: text }));
      statusEl.textContent = '\\u2713 sent';
      statusEl.style.color = '#00ff88';
      setTimeout(() => { statusEl.textContent = ''; statusEl.style.color = ''; }, 2000);
      sendWs.close();
    };

    sendWs.onerror = () => {
      statusEl.textContent = 'send failed';
      statusEl.style.color = '#ff4444';
      setTimeout(() => { statusEl.textContent = ''; statusEl.style.color = ''; }, 2000);
    };
  }
})();

// =========== INITIAL LOAD ===========
rebuildScene();
animate();
</script>
</body>
</html>`;
}
