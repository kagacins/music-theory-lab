/**
 * ChordBarrier - Staggered depth barriers for Chord Runner
 *
 * DESIGN: Each note in a chord becomes a SEPARATE full-width barrier at a different Y depth.
 * The player taps the correct key position on each barrier to break through.
 * Barriers scroll down toward the player - the first note (bass) is closest (higher Y),
 * and subsequent notes are further away (lower Y, staggered in depth).
 *
 * The keyboard shows 2 octaves and centers based on the chord's note range.
 * Black keys act as launch pads when tapped correctly.
 */

// Note state
const NoteState = {
    INTACT: 'intact',
    SHATTERED: 'shattered',
    WRONG: 'wrong'
};

// Piano key data
const WHITE_KEYS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const BLACK_KEYS_SET = new Set(['C#', 'Db', 'D#', 'Eb', 'F#', 'Gb', 'G#', 'Ab', 'A#', 'Bb']);

// Semitone index for each note (C = 0)
const NOTE_TO_SEMITONE = {
    'C': 0, 'C#': 1, 'Db': 1,
    'D': 2, 'D#': 3, 'Eb': 3,
    'E': 4,
    'F': 5, 'F#': 6, 'Gb': 6,
    'G': 7, 'G#': 8, 'Ab': 8,
    'A': 9, 'A#': 10, 'Bb': 10,
    'B': 11
};

export class ChordBarrier {
    constructor(chordData, octaveRange = 1, speed = 1.0) {
        this.chordData = chordData;
        this.speed = speed;

        // Parse chord notes first to determine required octave range
        this.notes = this.parseChordNotes(chordData);

        // ALWAYS show 2 octaves for consistency across all chords
        this.octaveRange = 2;

        // Visual dimensions - fixed for 2 octaves
        this.gameWidth = 400;
        this.keyboardWidth = 350; // Fixed width for 2 octaves
        this.whiteKeyWidth = 25;  // Fixed key width for 2 octaves
        this.blackKeyWidth = 16;  // Fixed black key width for 2 octaves
        this.barrierHeight = 70; // Height of each barrier strip (taller keys)
        this.staggerDistance = 100; // Y distance between notes WITHIN a chord (tighter)

        // Position - first barrier starts off-screen at top
        // NOTE: Y increases downward, so lower Y = closer to top of screen
        // startY is passed in from the game to control where this chord starts
        this.baseY = -50;
        this.baseSpeed = 120; // Pixels per second

        // Animation
        this.animTime = 0;
        this.shatterParticles = [];

        // Track state of each note barrier
        this.noteStates = new Array(this.notes.length).fill(NoteState.INTACT);

        // Calculate keyboard layout and note positions
        this.calculateKeyboardLayout();
        this.calculateNoteHitboxes();
    }

    /**
     * Parse chord data into individual notes with octave info
     */
    parseChordNotes(chordData) {
        if (chordData.notes && Array.isArray(chordData.notes)) {
            return chordData.notes.map((note, index) => {
                const { name, octave } = this.parseNoteName(note);
                return {
                    name: name,
                    octave: octave,
                    fullName: note,
                    index: index,
                    isBlackKey: BLACK_KEYS_SET.has(name)
                };
            });
        }

        // Fallback: generate from root and type
        return this.generateChordNotes(chordData.root, chordData.type);
    }

    /**
     * Parse note name and octave from string like "C4" or "F#5"
     */
    parseNoteName(note) {
        const match = note.match(/^([A-Ga-g][#b]?)(\d+)$/);
        if (match) {
            return { name: match[1], octave: parseInt(match[2]) };
        }
        return { name: note, octave: 4 };
    }

    /**
     * Calculate which 2 octaves to display (centered on the chord's notes)
     * Returns the starting octave for the 2-octave display
     */
    calculateDisplayOctaves() {
        if (this.notes.length === 0) return 4; // Default to octave 4-5

        // Find the octave range in the chord
        const octaves = this.notes.map(n => n.octave);
        const minOctave = Math.min(...octaves);
        const maxOctave = Math.max(...octaves);

        // If notes span 2 octaves, use those
        if (maxOctave > minOctave) {
            return minOctave;
        }

        // Otherwise, center the 2 octaves on the chord's octave
        // Prefer to show the chord's octave as the first one
        return minOctave;
    }

    /**
     * Generate chord notes from root and type (fallback)
     */
    generateChordNotes(root, type) {
        const intervals = {
            'Major': [0, 4, 7],
            'Minor': [0, 3, 7],
            'Diminished': [0, 3, 6],
            'Augmented': [0, 4, 8],
            'Dominant 7th': [0, 4, 7, 10],
            'Major 7th': [0, 4, 7, 11],
            'Minor 7th': [0, 3, 7, 10],
            'Half-Diminished 7th': [0, 3, 6, 10]
        };

        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const rootSemitone = NOTE_TO_SEMITONE[root] || 0;
        const chordIntervals = intervals[type] || intervals['Major'];

        return chordIntervals.map((interval, index) => {
            const semitone = (rootSemitone + interval) % 12;
            const octaveOffset = Math.floor((rootSemitone + interval) / 12);
            const noteName = noteNames[semitone];
            const octave = 4 + octaveOffset;

            return {
                name: noteName,
                octave: octave,
                fullName: noteName + octave,
                index: index,
                isBlackKey: BLACK_KEYS_SET.has(noteName)
            };
        });
    }

    /**
     * Calculate the keyboard layout (which octaves to show)
     * Always shows 2 octaves centered on the chord's notes
     */
    calculateKeyboardLayout() {
        // Get the starting octave for our 2-octave display
        this.startOctave = this.calculateDisplayOctaves();
        this.endOctave = this.startOctave + 1; // Always show 2 octaves

        // Build list of all keys to display
        this.displayKeys = [];
        for (let oct = this.startOctave; oct <= this.endOctave; oct++) {
            for (const key of WHITE_KEYS) {
                this.displayKeys.push({ name: key, octave: oct, isBlackKey: false });
            }
        }

        // Calculate keyboard start position (centered)
        this.keyboardStartX = (this.gameWidth - this.keyboardWidth) / 2;
    }

    /**
     * Calculate hitbox positions for each note in the chord
     */
    calculateNoteHitboxes() {
        const whiteKeyPositions = {};
        let xPos = this.keyboardStartX;

        // Map each white key to its X position
        for (let oct = this.startOctave; oct <= this.endOctave; oct++) {
            for (const key of WHITE_KEYS) {
                const keyId = key + oct;
                whiteKeyPositions[keyId] = xPos;
                xPos += this.whiteKeyWidth;
            }
        }

        // Assign hitbox for each chord note
        // IMPORTANT: We want bass note (index 0) to reach the player FIRST
        // Since barriers scroll DOWN (Y increases over time), the note with the
        // HIGHEST yOffset will reach the player first (because it starts further down).
        // So we REVERSE the order: bass note gets the highest yOffset
        const lastIndex = this.notes.length - 1;
        this.notes.forEach((note, index) => {
            // Reverse: first note (bass) gets highest yOffset so it reaches player first
            note.yOffset = (lastIndex - index) * this.staggerDistance;

            if (note.isBlackKey) {
                // Black key position - between two white keys
                const baseNote = this.getBaseWhiteKey(note.name);
                const whiteKeyX = whiteKeyPositions[baseNote + note.octave];

                if (whiteKeyX !== undefined) {
                    note.x = whiteKeyX + this.whiteKeyWidth - this.blackKeyWidth / 2;
                    note.width = this.blackKeyWidth;
                    note.height = this.barrierHeight * 0.7;
                } else {
                    // Fallback if white key not found
                    note.x = this.gameWidth / 2;
                    note.width = this.blackKeyWidth;
                    note.height = this.barrierHeight * 0.7;
                }
            } else {
                // White key position
                const whiteKeyX = whiteKeyPositions[note.name + note.octave];

                if (whiteKeyX !== undefined) {
                    note.x = whiteKeyX + this.whiteKeyWidth / 2;
                    note.width = this.whiteKeyWidth - 2;
                    note.height = this.barrierHeight;
                } else {
                    // Fallback
                    note.x = this.gameWidth / 2;
                    note.width = this.whiteKeyWidth;
                    note.height = this.barrierHeight;
                }
            }
        });
    }

    /**
     * Get the white key that a black key sits after
     */
    getBaseWhiteKey(blackKeyName) {
        const mapping = {
            'C#': 'C', 'Db': 'C',
            'D#': 'D', 'Eb': 'D',
            'F#': 'F', 'Gb': 'F',
            'G#': 'G', 'Ab': 'G',
            'A#': 'A', 'Bb': 'A'
        };
        return mapping[blackKeyName] || 'C';
    }

    /**
     * Update barrier positions and animation
     */
    update(dt) {
        // Move barriers down toward player
        this.baseY += this.baseSpeed * this.speed * dt;
        this.animTime += dt;

        // Update shatter particles
        this.shatterParticles = this.shatterParticles.filter(p => {
            p.life -= dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vy += 400 * dt; // Gravity
            p.rotation += p.rotationSpeed * dt;
            return p.life > 0;
        });

        // Auto-clear wrong state
        this.noteStates = this.noteStates.map(state =>
            state === NoteState.WRONG ? NoteState.INTACT : state
        );
    }

    /**
     * Render all barrier strips and the keyboard background
     */
    render(ctx, assistMode = false) {
        ctx.save();

        // Render each note as a separate barrier at its depth
        for (let i = 0; i < this.notes.length; i++) {
            const note = this.notes[i];
            const barrierY = this.baseY + note.yOffset;

            // Skip if off-screen
            if (barrierY < -this.barrierHeight - 20 || barrierY > 650) continue;

            // Render the full keyboard strip at this Y
            this.renderKeyboardStrip(ctx, barrierY, i, assistMode);
        }

        // Render shatter particles
        this.renderParticles(ctx);

        ctx.restore();
    }

    /**
     * Render a single keyboard strip barrier
     * Only the chord note at this position is the "target"
     */
    renderKeyboardStrip(ctx, barrierY, noteIndex, assistMode) {
        const note = this.notes[noteIndex];
        const state = this.noteStates[noteIndex];
        const isNext = noteIndex === this.getNextNoteIndex();

        // Draw shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.fillRect(this.keyboardStartX + 3, barrierY + 3, this.keyboardWidth, this.barrierHeight);

        // Draw keyboard background
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(this.keyboardStartX, barrierY, this.keyboardWidth, this.barrierHeight);

        // Draw white keys
        let xPos = this.keyboardStartX;
        for (let oct = this.startOctave; oct <= this.endOctave; oct++) {
            for (const key of WHITE_KEYS) {
                const isTargetKey = !note.isBlackKey && note.name === key && note.octave === oct;
                const isShattered = isTargetKey && state === NoteState.SHATTERED;
                const isWrong = isTargetKey && state === NoteState.WRONG;

                // Key color
                let fillColor = '#e8e8e8'; // Default white key
                let borderColor = '#999';

                if (isShattered) {
                    fillColor = 'rgba(78, 204, 163, 0.3)'; // Green tint for gap
                    borderColor = '#4ecca3';
                } else if (isWrong) {
                    fillColor = '#ff6b6b';
                    borderColor = '#ff4444';
                } else if (isTargetKey) {
                    // This is the target key to tap!
                    if (isNext && assistMode) {
                        fillColor = '#ffff66'; // Bright yellow for next target
                    } else {
                        fillColor = '#ffffcc'; // Light yellow for target
                    }
                    borderColor = '#ffaa00';
                }

                // Draw key
                ctx.fillStyle = fillColor;
                ctx.fillRect(xPos + 1, barrierY, this.whiteKeyWidth - 2, this.barrierHeight);

                // Border
                ctx.strokeStyle = borderColor;
                ctx.lineWidth = isTargetKey && !isShattered ? 2 : 1;
                ctx.strokeRect(xPos + 1, barrierY, this.whiteKeyWidth - 2, this.barrierHeight);

                // 3D highlight
                if (!isShattered) {
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
                    ctx.fillRect(xPos + 3, barrierY + 2, this.whiteKeyWidth - 6, 3);
                }

                // Note label (assist mode or target)
                if ((isTargetKey || assistMode) && !isShattered) {
                    ctx.fillStyle = '#333';
                    ctx.font = `bold ${this.octaveRange === 2 ? 9 : 11}px monospace`;
                    ctx.textAlign = 'center';
                    ctx.fillText(key, xPos + this.whiteKeyWidth / 2, barrierY + this.barrierHeight - 6);
                }

                // Glow effect for next target
                if (isTargetKey && isNext && !isShattered) {
                    ctx.strokeStyle = '#4ecca3';
                    ctx.lineWidth = 3;
                    ctx.shadowColor = '#4ecca3';
                    ctx.shadowBlur = 15;
                    ctx.strokeRect(xPos - 1, barrierY - 2, this.whiteKeyWidth + 2, this.barrierHeight + 4);
                    ctx.shadowBlur = 0;
                }

                xPos += this.whiteKeyWidth;
            }
        }

        // Draw black keys on top
        xPos = this.keyboardStartX;
        const blackKeyPattern = [true, true, false, true, true, true, false]; // C#, D#, skip, F#, G#, A#, skip

        for (let oct = this.startOctave; oct <= this.endOctave; oct++) {
            for (let i = 0; i < WHITE_KEYS.length; i++) {
                if (blackKeyPattern[i]) {
                    const blackKeyName = this.getBlackKeyName(WHITE_KEYS[i]);
                    const isTargetKey = note.isBlackKey &&
                        (note.name === blackKeyName || note.name === this.getEnharmonic(blackKeyName)) &&
                        note.octave === oct;
                    const isShattered = isTargetKey && state === NoteState.SHATTERED;
                    const isWrong = isTargetKey && state === NoteState.WRONG;

                    const blackX = xPos + this.whiteKeyWidth - this.blackKeyWidth / 2;
                    const blackHeight = this.barrierHeight * 0.65;

                    // Color
                    let fillColor = '#1a1a1a';
                    let borderColor = '#333';

                    if (isShattered) {
                        fillColor = 'rgba(78, 204, 163, 0.5)';
                        borderColor = '#4ecca3';
                    } else if (isWrong) {
                        fillColor = '#cc4444';
                        borderColor = '#ff4444';
                    } else if (isTargetKey) {
                        if (isNext && assistMode) {
                            fillColor = '#666600';
                        } else {
                            fillColor = '#444400';
                        }
                        borderColor = '#ffaa00';
                    }

                    // Draw key
                    ctx.fillStyle = fillColor;
                    ctx.fillRect(blackX, barrierY, this.blackKeyWidth, blackHeight);

                    ctx.strokeStyle = borderColor;
                    ctx.lineWidth = isTargetKey && !isShattered ? 2 : 1;
                    ctx.strokeRect(blackX, barrierY, this.blackKeyWidth, blackHeight);

                    // Highlight
                    if (!isShattered) {
                        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
                        ctx.fillRect(blackX + 2, barrierY + 2, this.blackKeyWidth - 4, 2);
                    }

                    // Label
                    if ((isTargetKey || assistMode) && !isShattered) {
                        ctx.fillStyle = '#ccc';
                        ctx.font = `bold ${this.octaveRange === 2 ? 7 : 9}px monospace`;
                        ctx.textAlign = 'center';
                        const displayName = blackKeyName.replace('#', '\u266F');
                        ctx.fillText(displayName, blackX + this.blackKeyWidth / 2, barrierY + blackHeight - 4);
                    }

                    // Launch pad indicator for black keys (shows it's a trampoline!)
                    if (isTargetKey && !isShattered) {
                        ctx.fillStyle = '#4ecca3';
                        ctx.beginPath();
                        ctx.moveTo(blackX + this.blackKeyWidth / 2 - 6, barrierY + blackHeight - 8);
                        ctx.lineTo(blackX + this.blackKeyWidth / 2, barrierY + blackHeight - 14);
                        ctx.lineTo(blackX + this.blackKeyWidth / 2 + 6, barrierY + blackHeight - 8);
                        ctx.fill();
                    }

                    // Glow
                    if (isTargetKey && isNext && !isShattered) {
                        ctx.strokeStyle = '#4ecca3';
                        ctx.lineWidth = 2;
                        ctx.shadowColor = '#4ecca3';
                        ctx.shadowBlur = 12;
                        ctx.strokeRect(blackX - 1, barrierY - 1, this.blackKeyWidth + 2, blackHeight + 2);
                        ctx.shadowBlur = 0;
                    }
                }
                xPos += this.whiteKeyWidth;
            }
        }

        // Draw barrier edges (danger zone indicators)
        ctx.fillStyle = 'rgba(255, 100, 100, 0.7)';
        ctx.fillRect(this.keyboardStartX - 12, barrierY, 8, this.barrierHeight);
        ctx.fillRect(this.keyboardStartX + this.keyboardWidth + 4, barrierY, 8, this.barrierHeight);

        // Draw note name label on side (shows what note this barrier represents)
        if (state !== NoteState.SHATTERED) {
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 12px monospace';
            ctx.textAlign = 'right';
            ctx.fillText(note.fullName, this.keyboardStartX - 16, barrierY + this.barrierHeight / 2 + 4);
        }
    }

    /**
     * Get the black key name for a white key (the black key that follows)
     */
    getBlackKeyName(whiteKey) {
        const mapping = {
            'C': 'C#', 'D': 'D#', 'F': 'F#', 'G': 'G#', 'A': 'A#'
        };
        return mapping[whiteKey] || '';
    }

    /**
     * Get enharmonic equivalent
     */
    getEnharmonic(note) {
        const enharmonics = {
            'C#': 'Db', 'Db': 'C#',
            'D#': 'Eb', 'Eb': 'D#',
            'F#': 'Gb', 'Gb': 'F#',
            'G#': 'Ab', 'Ab': 'G#',
            'A#': 'Bb', 'Bb': 'A#'
        };
        return enharmonics[note] || note;
    }

    /**
     * Render shatter particles
     */
    renderParticles(ctx) {
        for (const p of this.shatterParticles) {
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rotation);
            ctx.fillStyle = p.color;
            ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
            ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
            ctx.restore();
        }
    }

    /**
     * Check if a tap hits the correct note
     */
    checkNoteTap(tapX, tapY) {
        const nextIndex = this.getNextNoteIndex();
        if (nextIndex < 0) return { hit: false };

        // Check each note's barrier
        for (let i = 0; i < this.notes.length; i++) {
            if (this.noteStates[i] === NoteState.SHATTERED) continue;

            const note = this.notes[i];
            const barrierY = this.baseY + note.yOffset;

            // Check if tap is within this barrier's Y range
            const height = note.isBlackKey ? this.barrierHeight * 0.65 : this.barrierHeight;
            if (tapY < barrierY - 5 || tapY > barrierY + height + 5) continue;

            // Check if tap is within the note's X range
            const halfWidth = note.width / 2;
            const padding = 12; // Touch padding

            if (tapX >= note.x - halfWidth - padding && tapX <= note.x + halfWidth + padding) {
                // Hit detected!
                const isCorrect = (i === nextIndex);

                return {
                    hit: true,
                    correct: isCorrect,
                    noteIndex: i,
                    note: note.fullName,
                    isBlackKey: note.isBlackKey
                };
            }
        }

        return { hit: false };
    }

    /**
     * Get the index of the next note to hit (in order from bass to treble)
     */
    getNextNoteIndex() {
        for (let i = 0; i < this.notes.length; i++) {
            if (this.noteStates[i] !== NoteState.SHATTERED) {
                return i;
            }
        }
        return -1;
    }

    /**
     * Get the Y position of the next unbroken barrier (for runner collision)
     */
    getNextBarrierY() {
        const nextIndex = this.getNextNoteIndex();
        if (nextIndex < 0) return null;

        return this.baseY + this.notes[nextIndex].yOffset;
    }

    /**
     * Get the Y position of the CLOSEST note in this chord (bass note = index 0)
     * This is used to determine when the runner can move - they must wait for
     * the entire chord's closest barrier to pass, not just the current target note.
     */
    getClosestBarrierY() {
        // Bass note (index 0) has the highest yOffset, so it's closest to the player
        // This returns the position of the closest barrier regardless of which notes are broken
        if (this.notes.length === 0) return null;
        return this.baseY + this.notes[0].yOffset;
    }

    /**
     * Check if runner would collide with an unbroken barrier
     */
    checkRunnerCollision(runnerY, runnerHeight = 60) {
        const nextIndex = this.getNextNoteIndex();
        if (nextIndex < 0) return false;

        const barrierY = this.baseY + this.notes[nextIndex].yOffset;
        const barrierBottom = barrierY + this.barrierHeight;

        // Runner collides if the barrier has scrolled down to their position
        // Runner is at runnerY, barrier bottom is at barrierBottom
        return barrierBottom >= runnerY - runnerHeight / 2;
    }

    /**
     * Shatter a note (correct hit)
     */
    shatterNote(index) {
        if (index < 0 || index >= this.notes.length) return;

        this.noteStates[index] = NoteState.SHATTERED;

        // Create satisfying shatter particles
        const note = this.notes[index];
        const barrierY = this.baseY + note.yOffset;
        const color = note.isBlackKey ? '#333' : '#ddd';

        for (let i = 0; i < 20; i++) {
            this.shatterParticles.push({
                x: note.x + (Math.random() - 0.5) * note.width,
                y: barrierY + (Math.random()) * (note.height || this.barrierHeight),
                vx: (Math.random() - 0.5) * 250,
                vy: -80 - Math.random() * 120,
                size: 3 + Math.random() * 8,
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.5) * 12,
                life: 0.6 + Math.random() * 0.4,
                maxLife: 1.0,
                color: color
            });
        }
    }

    /**
     * Flash a note red (wrong hit)
     */
    flashWrong(index) {
        if (index < 0 || index >= this.notes.length) return;
        this.noteStates[index] = NoteState.WRONG;

        setTimeout(() => {
            if (this.noteStates[index] === NoteState.WRONG) {
                this.noteStates[index] = NoteState.INTACT;
            }
        }, 200);
    }

    /**
     * Check if all notes have been shattered
     */
    isComplete() {
        return this.noteStates.every(state => state === NoteState.SHATTERED);
    }

    /**
     * Check if the entire barrier has scrolled off screen
     */
    isOffScreen() {
        // With reversed yOffset, the FIRST note (bass) now has the highest yOffset
        // So we check the first note's position (it's the last one to leave the screen)
        const firstNoteY = this.baseY + this.notes[0].yOffset;
        return firstNoteY > 700;
    }

    /**
     * Get all chord notes for audio playback
     */
    getChordNotes() {
        return this.notes.map(n => n.fullName);
    }

    /**
     * Get chord display name
     */
    getChordName() {
        return `${this.chordData.root} ${this.chordData.type}`;
    }
}

export { NoteState };
