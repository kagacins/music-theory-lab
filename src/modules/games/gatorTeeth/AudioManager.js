/**
 * AudioManager - Handles all audio for Chord Runner
 *
 * Supports two sound styles:
 * - 'piano': Uses Tone.js sampler (from Music Theory Lab)
 * - '8bit': Uses Web Audio API for retro synth sounds
 *
 * Game event sounds are always 8-bit style for that arcade feel.
 */

export class AudioManager {
    constructor(settings) {
        this.settings = settings;
        this.audioContext = null;
        this.piano = null;
        this.isInitialized = false;

        // 8-bit synth oscillator pool
        this.oscillators = [];

        // Sound effect buffers
        this.sfxVolume = 0.3;
        this.musicVolume = 0.5;
    }

    /**
     * Initialize audio (must be called after user interaction)
     */
    async init() {
        try {
            // Create audio context
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

            // Try to get the existing piano sampler from Music Theory Lab
            if (window.getPiano) {
                this.piano = window.getPiano();
            }

            this.isInitialized = true;
            console.log('ChordRunner AudioManager initialized');
            return true;
        } catch (error) {
            console.error('Failed to initialize audio:', error);
            return false;
        }
    }

    /**
     * Resume audio context (needed for browser autoplay policies)
     */
    async resume() {
        if (this.audioContext && this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }
    }

    /**
     * Play a single note
     */
    playNote(note, style = 'piano') {
        if (!this.isInitialized) return;
        this.resume();

        if (style === '8bit' || !this.piano) {
            this.play8BitNote(note, 0.2);
        } else {
            this.playPianoNote(note, 0.3);
        }
    }

    /**
     * Play a full chord
     */
    playChord(notes, style = 'piano') {
        if (!this.isInitialized || !notes || notes.length === 0) return;
        this.resume();

        if (style === '8bit' || !this.piano) {
            notes.forEach((note, i) => {
                // Slight stagger for arpeggio effect
                setTimeout(() => this.play8BitNote(note, 0.3), i * 30);
            });
        } else {
            this.playPianoChord(notes, 0.5);
        }
    }

    /**
     * Play note using Tone.js piano sampler
     */
    playPianoNote(note, duration = 0.3) {
        if (!this.piano) return;

        try {
            this.piano.triggerAttackRelease(note, duration);
        } catch (error) {
            console.warn('Piano note playback failed:', error);
        }
    }

    /**
     * Play chord using Tone.js piano sampler
     */
    playPianoChord(notes, duration = 0.5) {
        if (!this.piano) return;

        try {
            this.piano.triggerAttackRelease(notes, duration);
        } catch (error) {
            console.warn('Piano chord playback failed:', error);
        }
    }

    /**
     * Play note using 8-bit style synth
     */
    play8BitNote(note, duration = 0.2) {
        if (!this.audioContext) return;

        const frequency = this.noteToFrequency(note);
        if (!frequency) return;

        const osc = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        // Square wave for that classic 8-bit sound
        osc.type = 'square';
        osc.frequency.value = frequency;

        // Quick attack, sustain, quick release
        const now = this.audioContext.currentTime;
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(this.musicVolume * 0.3, now + 0.01);
        gainNode.gain.setValueAtTime(this.musicVolume * 0.3, now + duration - 0.05);
        gainNode.gain.linearRampToValueAtTime(0, now + duration);

        osc.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        osc.start(now);
        osc.stop(now + duration);
    }

    /**
     * Convert note name to frequency
     */
    noteToFrequency(note) {
        // Parse note name and octave
        const match = note.match(/^([A-G][#b]?)(\d+)$/);
        if (!match) return null;

        const noteName = match[1];
        const octave = parseInt(match[2]);

        // Note to semitone offset from A
        const noteOffsets = {
            'C': -9, 'C#': -8, 'Db': -8,
            'D': -7, 'D#': -6, 'Eb': -6,
            'E': -5,
            'F': -4, 'F#': -3, 'Gb': -3,
            'G': -2, 'G#': -1, 'Ab': -1,
            'A': 0, 'A#': 1, 'Bb': 1,
            'B': 2
        };

        const offset = noteOffsets[noteName];
        if (offset === undefined) return null;

        // A4 = 440Hz, calculate frequency
        const semitonesFromA4 = offset + (octave - 4) * 12;
        return 440 * Math.pow(2, semitonesFromA4 / 12);
    }

    /**
     * Play error sound (wrong note)
     */
    playError() {
        this.playGameSound('error');
    }

    /**
     * Play success sound (chord complete)
     */
    playSuccess() {
        this.playGameSound('success');
    }

    /**
     * Play chomp sound (gator catches runner)
     */
    playChomp() {
        this.playGameSound('chomp');
    }

    /**
     * Play victory sound (level complete)
     */
    playVictory() {
        this.playGameSound('victory');
    }

    /**
     * Play game over sound
     */
    playGameOver() {
        this.playGameSound('gameover');
    }

    /**
     * Play 8-bit game sound effect
     */
    playGameSound(type) {
        if (!this.audioContext) return;
        this.resume();

        const now = this.audioContext.currentTime;

        switch (type) {
            case 'error':
                this.playNoise(0.1, 200, 100);
                break;

            case 'success':
                this.playTone(523.25, 0.1, 'square'); // C5
                setTimeout(() => this.playTone(659.25, 0.1, 'square'), 100); // E5
                setTimeout(() => this.playTone(783.99, 0.15, 'square'), 200); // G5
                break;

            case 'chomp':
                this.playNoise(0.15, 150, 50);
                setTimeout(() => this.playTone(100, 0.1, 'sawtooth'), 50);
                break;

            case 'victory':
                const victoryNotes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
                victoryNotes.forEach((freq, i) => {
                    setTimeout(() => this.playTone(freq, 0.2, 'square'), i * 150);
                });
                break;

            case 'gameover':
                this.playTone(200, 0.3, 'sawtooth');
                setTimeout(() => this.playTone(150, 0.3, 'sawtooth'), 300);
                setTimeout(() => this.playTone(100, 0.5, 'sawtooth'), 600);
                break;
        }
    }

    /**
     * Play a simple tone
     */
    playTone(frequency, duration, waveType = 'square') {
        if (!this.audioContext) return;

        const osc = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        osc.type = waveType;
        osc.frequency.value = frequency;

        const now = this.audioContext.currentTime;
        gainNode.gain.setValueAtTime(this.sfxVolume, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + duration);

        osc.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        osc.start(now);
        osc.stop(now + duration);
    }

    /**
     * Play noise burst (for error/chomp sounds)
     */
    playNoise(duration, startFreq = 200, endFreq = 100) {
        if (!this.audioContext) return;

        // Create noise using oscillator with rapid frequency modulation
        const osc = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        osc.type = 'sawtooth';

        const now = this.audioContext.currentTime;
        osc.frequency.setValueAtTime(startFreq, now);
        osc.frequency.exponentialRampToValueAtTime(endFreq, now + duration);

        gainNode.gain.setValueAtTime(this.sfxVolume, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + duration);

        osc.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        osc.start(now);
        osc.stop(now + duration);
    }

    /**
     * Update settings
     */
    updateSettings(settings) {
        this.settings = { ...this.settings, ...settings };
    }

    /**
     * Set volumes
     */
    setVolume(sfx, music) {
        this.sfxVolume = sfx;
        this.musicVolume = music;
    }

    /**
     * Clean up resources
     */
    destroy() {
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
    }
}
