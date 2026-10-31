#!/usr/bin/env python3
"""Phase 0 — Generate bundled audio with Piper TTS (MIT, Standard German voice).
Produces ~2,000 .ogg files: one word + one example per lemma.
No scraped or ripped audio anywhere (self-generated only)."""

import json
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WORDS_JSON = ROOT / "src" / "assets" / "words.json"
VOICE_MODEL = ROOT / "scripts" / "voices" / "de_DE-thorsten-medium.onnx"
AUDIO_DIR = ROOT / "public" / "audio"
WORDS_DIR = AUDIO_DIR / "words"
EXAMPLES_DIR = AUDIO_DIR / "examples"


def generate_ogg(text: str, output_path: Path, voice_model: Path) -> bool:
    """Generate a single .ogg file from text using Piper + ffmpeg."""
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=True) as tmp:
        # Piper → WAV
        piper = subprocess.run(
            [
                sys.executable, "-m", "piper",
                "--model", str(voice_model),
                "--output_file", tmp.name,
            ],
            input=text.encode("utf-8"),
            capture_output=True,
            timeout=30,
        )
        if piper.returncode != 0:
            print(f"  Piper error for '{text}': {piper.stderr.decode()[:200]}")
            return False

        # WAV → OGG (libvorbis)
        ffmpeg = subprocess.run(
            [
                "ffmpeg", "-y", "-i", tmp.name,
                "-c:a", "libopus",
                str(output_path),
            ],
            capture_output=True,
            timeout=30,
        )
        if ffmpeg.returncode != 0:
            print(f"  ffmpeg error for '{text}': {ffmpeg.stderr.decode()[:200]}")
            return False

    return True


def main():
    if not VOICE_MODEL.exists():
        print(f"Voice model not found: {VOICE_MODEL}")
        print("Download from https://huggingface.co/rhasspy/piper-voices")
        sys.exit(1)

    words = json.loads(WORDS_JSON.read_text())["words"]
    WORDS_DIR.mkdir(parents=True, exist_ok=True)
    EXAMPLES_DIR.mkdir(parents=True, exist_ok=True)

    total = len(words) * 2
    generated = 0
    skipped = 0
    failed = 0

    for i, w in enumerate(words):
        wid = w["id"]
        lemma = w["lemma"]
        example = w["example_de"]

        # Word audio
        word_file = WORDS_DIR / f"{wid}.ogg"
        if not word_file.exists():
            if generate_ogg(lemma, word_file, VOICE_MODEL):
                generated += 1
            else:
                failed += 1
                print(f"  FAILED word: {wid} ({lemma})")
        else:
            skipped += 1

        # Example audio
        example_file = EXAMPLES_DIR / f"{wid}.ogg"
        if not example_file.exists():
            if generate_ogg(example, example_file, VOICE_MODEL):
                generated += 1
            else:
                failed += 1
                print(f"  FAILED example: {wid} ({example[:40]}...)")
        else:
            skipped += 1

        # Progress
        done = generated + skipped + failed
        if done % 100 == 0 or done == total:
            print(f"  [{done}/{total}] generated={generated} skipped={skipped} failed={failed}")

    print(f"\nDone: {generated} generated, {skipped} skipped, {failed} failed")
    if failed > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
