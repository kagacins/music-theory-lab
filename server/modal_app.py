"""
Modal.com serverless function for high-accuracy chord detection.
Features:
- Madmom CNN+CRF for reliable chord detection (original approach)
- Librosa beat tracking for timing alignment
- Bass note detection for inversion identification

Deploy with: py -3.12 -m modal deploy modal_app.py
"""

import modal

# Define the Modal app
app = modal.App("music-theory-lab-chord-detector")

# Define the container image with audio processing libraries
image = (
    modal.Image.debian_slim(python_version="3.9")
    .apt_install("ffmpeg", "libsndfile1", "build-essential", "python3-dev")
    .pip_install(
        "numpy==1.23.5",
        "cython==0.29.36",
        "scipy>=1.10.0",
        "soundfile>=0.12.0",
        "librosa>=0.10.0",
        "fastapi",
    )
    .pip_install(
        "madmom==0.16.1",
    )
)


def detect_bass_note(audio_segment, sr, note_names):
    """
    Detect the bass note (lowest prominent pitch) in an audio segment.
    Returns the note name or None if unclear.
    """
    import numpy as np
    import librosa

    try:
        # Compute CQT focused on bass range (C1 to C4, ~32Hz to ~262Hz)
        cqt = librosa.cqt(y=audio_segment, sr=sr, fmin=librosa.note_to_hz('C1'),
                         n_bins=36, bins_per_octave=12)

        cqt_mag = np.abs(cqt)

        # Sum energy per pitch class (across octaves)
        pitch_class_energy = np.zeros(12)
        for octave in range(3):
            start = octave * 12
            end = start + 12
            if end <= cqt_mag.shape[0]:
                weight = 1.0 / (octave + 1)
                pitch_class_energy += np.mean(cqt_mag[start:end, :], axis=1) * weight

        bass_pc = np.argmax(pitch_class_energy)

        if pitch_class_energy[bass_pc] > np.mean(pitch_class_energy) * 1.5:
            return note_names[bass_pc]

    except Exception as e:
        print(f"Bass detection error: {e}")

    return None


@app.function(
    image=image,
    timeout=300,
    memory=2048,
)
def analyze_chords(audio_bytes: bytes, sample_rate: int = 44100) -> dict:
    """
    Analyze audio using madmom for chords, with beat alignment and inversion detection.
    """
    import numpy as np
    import io
    import soundfile as sf
    import librosa
    import tempfile
    import os

    # madmom imports
    from madmom.features.chords import CNNChordFeatureProcessor, CRFChordRecognitionProcessor

    NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

    # Load audio from bytes
    audio_data, sr = sf.read(io.BytesIO(audio_bytes))

    # Convert to mono if stereo
    if len(audio_data.shape) > 1:
        audio_data = np.mean(audio_data, axis=1)

    duration = len(audio_data) / sr

    # Write to temp file for madmom
    with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tmp_file:
        tmp_path = tmp_file.name
        sf.write(tmp_path, audio_data, sr)

    try:
        # === MADMOM CHORD DETECTION (original approach) ===
        feat_proc = CNNChordFeatureProcessor()
        decode_proc = CRFChordRecognitionProcessor()

        features = feat_proc(tmp_path)
        madmom_chords = decode_proc(features)

        # === LIBROSA BEAT TRACKING ===
        # Resample for librosa analysis
        audio_22k = librosa.resample(audio_data, orig_sr=sr, target_sr=22050)
        tempo, beat_frames = librosa.beat.beat_track(y=audio_22k, sr=22050, units='frames')
        beat_times = librosa.frames_to_time(beat_frames, sr=22050)

        # Get tempo as a scalar value
        tempo_bpm = float(tempo) if isinstance(tempo, (int, float, np.floating)) else float(tempo[0]) if hasattr(tempo, '__len__') and len(tempo) > 0 else 120.0

        # Convert madmom output to our format
        detected_chords = []
        for start_time, end_time, chord_label in madmom_chords:
            if chord_label == "N":
                continue

            chord_duration = end_time - start_time

            # Calculate duration in beats: beats = seconds * (BPM / 60)
            duration_beats = chord_duration * (tempo_bpm / 60.0)

            # Calculate beat position (which beat number this chord starts on)
            beat_position = start_time * (tempo_bpm / 60.0)

            # Parse madmom format (e.g., "C:maj", "A:min", "G:7")
            chord_name = chord_label
            if ":" in chord_label:
                root, quality = chord_label.split(":", 1)

                quality_map = {
                    "maj": "",
                    "min": "m",
                    "dim": "dim",
                    "aug": "aug",
                    "7": "7",
                    "maj7": "maj7",
                    "min7": "m7",
                }

                suffix = quality_map.get(quality, quality)
                chord_name = f"{root}{suffix}"

            # === BASS NOTE / INVERSION DETECTION ===
            bass_note = None
            inversion = None

            # Get audio segment for bass detection
            start_sample = int(start_time * sr)
            end_sample = int(end_time * sr)
            audio_segment = audio_data[start_sample:end_sample]

            if len(audio_segment) > sr * 0.1:  # At least 0.1s of audio
                bass_note = detect_bass_note(audio_segment, sr, NOTE_NAMES)

                if bass_note:
                    # Determine chord root
                    if len(chord_name) > 1 and chord_name[1] in '#b':
                        chord_root = chord_name[:2]
                    else:
                        chord_root = chord_name[0]

                    # Check for inversion
                    if bass_note != chord_root:
                        # Verify bass note is actually in the chord before calling it an inversion
                        inversion = bass_note

            detected_chords.append({
                "time": round(float(start_time), 3),
                "duration": round(float(chord_duration), 3),
                "chord": chord_name,
                "confidence": 0.85,
                "bass": bass_note,
                "inversion": inversion,
                "is_seventh": "7" in chord_name
            })

        return {
            "success": True,
            "duration": round(duration, 2),
            "tempo": round(float(tempo), 1) if isinstance(tempo, (int, float, np.floating)) else round(float(tempo[0]), 1) if hasattr(tempo, '__len__') and len(tempo) > 0 else 120,
            "beat_count": len(beat_times),
            "chords": detected_chords,
            "method": "madmom-cnn-crf-with-inversion"
        }

    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


@app.function(image=image)
@modal.fastapi_endpoint(method="POST")
def detect_chords_api(request: dict) -> dict:
    """
    Web endpoint for chord detection.
    """
    import base64

    try:
        audio_base64 = request.get("audio")
        sample_rate = request.get("sample_rate", 44100)

        if not audio_base64:
            return {"success": False, "error": "No audio data provided"}

        audio_bytes = base64.b64decode(audio_base64)
        result = analyze_chords.remote(audio_bytes, sample_rate)

        return result

    except Exception as e:
        return {"success": False, "error": str(e)}


@app.local_entrypoint()
def main():
    """Test the chord detection locally."""
    import sys

    if len(sys.argv) < 2:
        print("Usage: modal run modal_app.py <audio_file.wav>")
        return

    audio_path = sys.argv[1]

    with open(audio_path, "rb") as f:
        audio_bytes = f.read()

    result = analyze_chords.remote(audio_bytes)

    print(f"\nAnalysis complete!")
    print(f"Duration: {result['duration']}s")
    print(f"Tempo: {result['tempo']} BPM")
    print(f"Method: {result['method']}")
    print(f"\nDetected chords:")
    for chord in result['chords']:
        inv_str = f" (bass: {chord['inversion']})" if chord.get('inversion') else ""
        print(f"  {chord['time']:.2f}s - {chord['chord']}{inv_str} ({chord['duration']:.2f}s)")
