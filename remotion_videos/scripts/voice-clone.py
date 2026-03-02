#!/usr/bin/env python3
"""
HelixMind Video Narration — Qwen3-TTS Voice Clone Pipeline

Uses audio_og_for_voice_clone.mp3 as reference voice.
Generates narration WAVs for each video composition.
"""

import os
import sys
import json
from pathlib import Path

# ─── Narration texts for each video ─────────────────────────────

NARRATIONS = {
    "01-hero-intro": {
        "language": "English",
        "segments": [
            "HelixMind. The AI coding agent that remembers everything.",
            "Install it globally with npm. One command, and you're ready.",
            "Spiral memory initializes with six intelligence levels.",
            "Your brain visualization connects instantly.",
            "Jarvis, your autonomous AI daemon, stands by.",
            "HelixMind. Built for developers who think ahead.",
        ],
    },
    "02-modes-jarvis": {
        "language": "English",
        "segments": [
            "Jarvis AGI mode. Autonomous intelligence at your command.",
            "Jarvis analyzes your entire project structure automatically.",
            "It finds security vulnerabilities, proposes fixes, and waits for your approval.",
            "One click to approve. Three files patched. All tests passing.",
            "Autonomous coding. Human oversight. Perfect balance.",
        ],
    },
    "03-modes-agent": {
        "language": "English",
        "segments": [
            "Agent mode. Twenty-two tools working toward one goal.",
            "Tell it what to fix. Watch it read, search, edit, test, and commit.",
            "Spiral memory recalls patterns from past sessions.",
            "The entire tool chain executes in seconds.",
            "From bug report to committed fix. Fully automated.",
        ],
    },
    "04-modes-monitor": {
        "language": "English",
        "segments": [
            "Security Monitor. Always watching your codebase.",
            "Continuous scanning detects threats in real time.",
            "Critical vulnerabilities flagged instantly.",
            "Automatic fixes applied where possible.",
            "Two hundred forty-seven files scanned. Four threats found. Three auto-fixed.",
        ],
    },
    "05-spiral-memory": {
        "language": "English",
        "segments": [
            "Spiral Context Memory. Six levels of intelligence.",
            "Level one: Focus. Your current conversation context.",
            "Level two: Active. Recently used knowledge ready for recall.",
            "Level three through five: Reference, archive, and deep storage.",
            "Level six: Web knowledge. Intelligence enriched from the internet.",
            "Nodes promote with frequent use. Decay when unused. Context that never dies.",
        ],
    },
    "06-brain-3d": {
        "language": "English",
        "segments": [
            "Your live neural map. Every node is a piece of knowledge.",
            "Watch connections form between related concepts.",
            "Color-coded by level. Cyan for focus, green for active, violet for archive.",
            "Web knowledge populates automatically during work.",
            "This is your brain, visualized in three dimensions.",
        ],
    },
    "07-getting-started": {
        "language": "English",
        "segments": [
            "Getting started with HelixMind. From zero to AI coding agent in sixty seconds.",
            "Step one. Install globally with npm.",
            "Step two. Initialize your project. HelixMind analyzes your entire codebase.",
            "Step three. Start chatting. Ask anything about your code.",
            "Spiral memory stores context across sessions. It never forgets.",
            "Step four. Open the brain visualization. Watch your knowledge graph grow.",
            "You're ready. Spiral memory, twenty-two tools, 3D brain, and Jarvis AGI. All yours.",
        ],
    },
    "08-features-overview": {
        "language": "English",
        "segments": [
            "Built different. Five features that set HelixMind apart.",
            "Spiral memory with 384-dimensional embeddings and semantic search.",
            "A live 3D brain visualization connected via WebSocket.",
            "Three-phase validation: static checks, mini-LLM review, spiral knowledge.",
            "Web knowledge enrichment. Automatic internet intelligence.",
            "Fully offline with Ollama. No cloud dependency. Zero latency.",
            "Open source. AGPL-3.0. Free forever. Community driven.",
        ],
    },
}


def main():
    base_dir = Path(__file__).parent.parent
    ref_audio = str(base_dir / "audio_og_for_voice_clone.mp3")
    output_dir = base_dir / "narration"
    output_dir.mkdir(exist_ok=True)

    if not Path(ref_audio).exists():
        print(f"ERROR: Reference audio not found: {ref_audio}")
        sys.exit(1)

    print(f"Reference audio: {ref_audio}")
    print(f"Output directory: {output_dir}")
    print(f"Videos to narrate: {len(NARRATIONS)}\n")

    # Import and initialize model
    print("Loading Qwen3-TTS model (1.7B-Base for voice clone)...")
    import torch
    import soundfile as sf
    from qwen_tts import Qwen3TTSModel

    model = Qwen3TTSModel.from_pretrained(
        "Qwen/Qwen3-TTS-12Hz-1.7B-Base",
        device_map="cuda:0",
        dtype=torch.bfloat16,
    )
    print("Model loaded.\n")

    # Build reusable voice clone prompt from reference audio
    print("Creating voice clone prompt from reference audio...")
    prompt = model.create_voice_clone_prompt(
        ref_audio=ref_audio,
        ref_text="",  # empty = x_vector_only_mode
        x_vector_only_mode=True,
    )
    print("Voice clone prompt ready.\n")

    # Generate narration for each video
    for video_key, config in NARRATIONS.items():
        video_dir = output_dir / video_key
        video_dir.mkdir(exist_ok=True)

        segments = config["segments"]
        language = config["language"]

        print(f"> {video_key} ({len(segments)} segments)")

        # Generate all segments in batch
        wavs, sr = model.generate_voice_clone(
            text=segments,
            language=[language] * len(segments),
            voice_clone_prompt=prompt,
        )

        for i, (wav, text) in enumerate(zip(wavs, segments)):
            out_path = video_dir / f"segment_{i:02d}.wav"
            sf.write(str(out_path), wav, sr)
            print(f"  + segment_{i:02d}.wav -- \"{text[:50]}...\"")

        # Save segment metadata
        meta = {
            "video": video_key,
            "language": language,
            "segments": [
                {"index": i, "text": t, "file": f"segment_{i:02d}.wav"}
                for i, t in enumerate(segments)
            ],
        }
        with open(video_dir / "metadata.json", "w") as f:
            json.dump(meta, f, indent=2)

        print(f"  + metadata.json saved\n")

    print("=" * 60)
    print(f"All narrations generated in: {output_dir}")
    print("Next: Add Suno MP3s to suno-prompts/ folder,")
    print("then run combine-audio.py to mix music + narration.")


if __name__ == "__main__":
    main()
