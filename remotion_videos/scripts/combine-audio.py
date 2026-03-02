#!/usr/bin/env python3
"""
Combine Suno background music + Qwen3-TTS narration segments
into final audio tracks for each video.

Expects:
  suno-prompts/01-hero-intro.mp3  (background music from Suno)
  narration/01-hero-intro/segment_00.wav ... segment_NN.wav

Outputs:
  audio-final/01-hero-intro.wav  (combined music + voice)
"""

import json
import sys
from pathlib import Path

try:
    from pydub import AudioSegment
except ImportError:
    print("ERROR: pydub not installed. Run: pip install pydub")
    print("Also needs ffmpeg in PATH.")
    sys.exit(1)

# Video durations in seconds
DURATIONS = {
    "01-hero-intro": 30,
    "02-modes-jarvis": 20,
    "03-modes-agent": 20,
    "04-modes-monitor": 20,
    "05-spiral-memory": 30,
    "06-brain-3d": 25,
    "07-getting-started": 45,
    "08-features-overview": 30,
}

# When each narration segment should start (seconds into video)
# These align with the Remotion composition timelines
SEGMENT_TIMING = {
    "01-hero-intro": [1, 5, 10, 13, 15, 22],
    "02-modes-jarvis": [1, 4, 7, 12, 16],
    "03-modes-agent": [1, 3, 6, 10, 14],
    "04-modes-monitor": [1, 3, 6, 10, 16],
    "05-spiral-memory": [1, 4, 8, 12, 17, 22],
    "06-brain-3d": [1, 5, 9, 14, 19],
    "07-getting-started": [1, 4, 11, 19, 24, 29, 38],
    "08-features-overview": [1, 4, 8, 12, 16, 20, 25],
}


VOICE_TARGET_DBFS = -16.0   # normalize all voice segments to this
MUSIC_BASE_DBFS = -20.0     # music base level (quiet bed)
MUSIC_DUCK_DBFS = -32.0     # music level during voice
DUCK_RAMP_MS = 300          # fade duration for duck in/out
FINAL_TARGET_DBFS = -14.0   # final master normalization
MIN_GAP_S = 0.5             # minimum gap between voice segments


def normalize(seg, target_dbfs):
    """Normalize audio segment to target dBFS."""
    if seg.dBFS == float('-inf'):
        return seg
    delta = target_dbfs - seg.dBFS
    return seg.apply_gain(delta)


def find_music(suno_dir, video_key):
    """Find music file with flexible name matching."""
    for ext in ("mp3", "wav", "ogg", "flac"):
        candidate = suno_dir / f"{video_key}.{ext}"
        if candidate.exists():
            return candidate
    # Glob for partial matches (e.g. "02-modes-jarvis02.wav")
    audio_exts = {".mp3", ".wav", ".ogg", ".flac", ".m4a"}
    matches = [m for m in suno_dir.glob(f"{video_key}*.*")
               if m.suffix.lower() in audio_exts]
    return matches[0] if matches else None


def build_duck_envelope(track_len_ms, voice_regions, ramp_ms=DUCK_RAMP_MS):
    """Build a list of (start_ms, end_ms, is_ducked) regions with ramps."""
    events = []
    for start, end in voice_regions:
        ramp_in_start = max(0, start - ramp_ms)
        ramp_out_end = min(track_len_ms, end + ramp_ms)
        events.append((ramp_in_start, start, "ramp_down"))
        events.append((start, end, "ducked"))
        events.append((end, ramp_out_end, "ramp_up"))
    return events


def main():
    base_dir = Path(__file__).parent.parent
    suno_dir = base_dir / "suno-prompts"
    narration_dir = base_dir / "narration"
    output_dir = base_dir / "audio-final"
    output_dir.mkdir(exist_ok=True)

    for video_key, duration in DURATIONS.items():
        narr_dir = narration_dir / video_key
        print(f"\n> {video_key} ({duration}s)")

        music_file = find_music(suno_dir, video_key)
        if music_file is None:
            print(f"  ! No music file found for {video_key} -- skipping")
            continue

        print(f"  Music: {music_file.name}")

        # Load + trim music to video duration
        music = AudioSegment.from_file(str(music_file))
        music = music[:duration * 1000]

        # Pad if shorter
        if len(music) < duration * 1000:
            music = music + AudioSegment.silent(duration=duration * 1000 - len(music))

        # Normalize music to base level
        music = normalize(music, MUSIC_BASE_DBFS)
        print(f"  Music normalized: {music.dBFS:.1f} dBFS")

        # No narration? Music only
        if not narr_dir.exists():
            print(f"  ! No narration dir -- music only")
            out = normalize(music, FINAL_TARGET_DBFS)
            out = out.fade_in(1000).fade_out(2000)
            out.export(str(output_dir / f"{video_key}.wav"), format="wav")
            continue

        # Load + normalize voice segments
        timings = SEGMENT_TIMING.get(video_key, [])
        seg_files = sorted(narr_dir.glob("segment_*.wav"))

        if not seg_files:
            print(f"  ! No narration segments -- music only")
            out = normalize(music, FINAL_TARGET_DBFS)
            out = out.fade_in(1000).fade_out(2000)
            out.export(str(output_dir / f"{video_key}.wav"), format="wav")
            continue

        # Normalize each voice segment to consistent level
        voices = []
        for seg_file in seg_files:
            v = AudioSegment.from_wav(str(seg_file))
            v = normalize(v, VOICE_TARGET_DBFS)
            voices.append(v)

        # Build per-ms gain map: mark which ms ranges need ducking
        track_len = len(music)
        duck_delta = MUSIC_DUCK_DBFS - MUSIC_BASE_DBFS

        # Collect voice regions with auto-spacing to prevent overlaps
        voice_regions = []
        prev_end_ms = 0
        for i, voice in enumerate(voices):
            if i >= len(timings):
                break
            desired_start = timings[i] * 1000
            # Push forward if would overlap previous segment
            earliest = prev_end_ms + int(MIN_GAP_S * 1000)
            actual_start = max(desired_start, earliest)
            end_ms = min(actual_start + len(voice), track_len)

            if actual_start != desired_start:
                print(f"  ~ segment_{i:02d} shifted: {desired_start/1000:.1f}s -> {actual_start/1000:.1f}s (avoid overlap)")

            voice_regions.append((actual_start, end_ms))
            prev_end_ms = end_ms

        # Build ducked music: chunk-based approach (50ms chunks)
        CHUNK = 50
        chunks = []
        for pos in range(0, track_len, CHUNK):
            chunk_end = min(pos + CHUNK, track_len)
            chunk = music[pos:chunk_end]

            # Check if any voice is active in this chunk
            in_voice = False
            near_voice = False
            for vs, ve in voice_regions:
                if pos >= vs and pos < ve:
                    in_voice = True
                    break
                # Ramp zone: within DUCK_RAMP_MS before/after voice
                if pos >= vs - DUCK_RAMP_MS and pos < vs:
                    near_voice = True
                    # Linear ramp: 0 at (vs - DUCK_RAMP_MS), duck_delta at vs
                    t = (pos - (vs - DUCK_RAMP_MS)) / DUCK_RAMP_MS
                    chunk = chunk.apply_gain(duck_delta * t)
                    break
                if pos >= ve and pos < ve + DUCK_RAMP_MS:
                    near_voice = True
                    # Linear ramp: duck_delta at ve, 0 at (ve + DUCK_RAMP_MS)
                    t = 1.0 - (pos - ve) / DUCK_RAMP_MS
                    chunk = chunk.apply_gain(duck_delta * t)
                    break

            if in_voice:
                chunk = chunk.apply_gain(duck_delta)
            # near_voice already handled above

            chunks.append(chunk)

        music_bed = chunks[0]
        for c in chunks[1:]:
            music_bed += c

        # Overlay all voice segments on the ducked music bed
        combined = music_bed
        for i, (start_ms, end_ms) in enumerate(voice_regions):
            if i >= len(voices):
                break
            combined = combined.overlay(voices[i], position=start_ms)
            print(f"  + segment_{i:02d} @ {start_ms/1000:.1f}s ({len(voices[i])/1000:.1f}s, {voices[i].dBFS:.1f} dBFS)")

        # Fade in/out + final normalization
        combined = combined.fade_in(1000).fade_out(2000)
        combined = normalize(combined, FINAL_TARGET_DBFS)

        out_path = output_dir / f"{video_key}.wav"
        combined.export(str(out_path), format="wav")
        print(f"  = {video_key}.wav -- {len(combined)/1000:.1f}s, {combined.dBFS:.1f} dBFS")

    print(f"\n{'='*60}")
    print(f"All audio tracks in: {output_dir}")
    print("Next: Run render-all.mjs to render videos with --audio flag")


if __name__ == "__main__":
    main()
