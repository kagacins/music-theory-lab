/**
 * TeethBarrier - A row of piano key "teeth" in 3D perspective
 *
 * Barriers start in the distance (high Z) and approach the player (Z decreases).
 * They scale up as they get closer, creating a 3D effect.
 */

const NOTE_NAMES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const BLACK_KEYS = new Set(['C#', 'Db', 'D#', 'Eb', 'F#', 'Gb', 'G#', 'Ab', 'A#', 'Bb']);

const BASE_WIDTH = 400;

export class TeethBarrier {
    constructor(targetNoteName, startZ, chordData, isLastInChord) {
        this.z = startZ;  // Z depth: 0 = at player, 1 = at horizon
        this.chordData = chordData;
        this.chordName = `${chordData.root} ${chordData.type}`;
        this.isLastInChord = isLastInChord;

        // Parse target note
        this.targetNote = this.parseNote(targetNoteName);

        // State
        this.isCleared = false;
        this.isShattered = false;
        this.wrongFlash = 0;
        this.shatterParticles = [];
        this.speedBoost = 1.0;  // Multiplier for barrier speed (increases when cleared)

        // Base dimensions (will be scaled by perspective)
        // HUGE keys for the extremely low camera angle
        this.baseWidth = 400;
        this.baseHeight = 250;  // Very tall keys for easy clicking

        // Calculate key positions for 2 octaves (C4-B5)
        this.keys = this.buildKeyboard();
        this.assignTargetKey();
    }

    /**
     * Parse note name like "C4" or "F#5"
     */
    parseNote(noteName) {
        const match = noteName.match(/^([A-G][#b]?)(\d+)$/);
        if (!match) return { name: noteName, octave: 4, isBlackKey: false };

        return {
            name: match[1],
            octave: parseInt(match[2]),
            fullName: noteName,
            isBlackKey: BLACK_KEYS.has(match[1])
        };
    }

    /**
     * Build 2-octave keyboard layout (relative positions 0-1)
     */
    buildKeyboard() {
        const keys = [];
        const whiteKeyCount = 14; // 7 keys * 2 octaves
        const whiteKeyWidth = 1 / whiteKeyCount;
        let position = 0;

        for (let octave = 4; octave <= 5; octave++) {
            for (let i = 0; i < NOTE_NAMES.length; i++) {
                const noteName = NOTE_NAMES[i];

                // White key (position is center of key, 0-1 range)
                keys.push({
                    name: noteName,
                    octave: octave,
                    fullName: noteName + octave,
                    relativeX: position + whiteKeyWidth / 2,
                    relativeWidth: whiteKeyWidth * 0.9,
                    isBlackKey: false,
                    isTarget: false
                });

                // Black key (except after E and B)
                if (noteName !== 'E' && noteName !== 'B') {
                    const blackName = noteName + '#';
                    keys.push({
                        name: blackName,
                        octave: octave,
                        fullName: blackName + octave,
                        relativeX: position + whiteKeyWidth,
                        relativeWidth: whiteKeyWidth * 0.6,
                        isBlackKey: true,
                        isTarget: false
                    });
                }

                position += whiteKeyWidth;
            }
        }

        return keys;
    }

    /**
     * Mark the target key
     */
    assignTargetKey() {
        for (const key of this.keys) {
            if (this.matchesNote(key, this.targetNote)) {
                key.isTarget = true;
                this.targetNote.relativeX = key.relativeX;
                break;
            }
        }
    }

    /**
     * Check if key matches target note (handles enharmonics)
     */
    matchesNote(key, target) {
        if (key.octave !== target.octave) return false;
        if (key.name === target.name) return true;

        const enharmonics = {
            'C#': 'Db', 'Db': 'C#',
            'D#': 'Eb', 'Eb': 'D#',
            'F#': 'Gb', 'Gb': 'F#',
            'G#': 'Ab', 'Ab': 'G#',
            'A#': 'Bb', 'Bb': 'A#'
        };

        return enharmonics[key.name] === target.name;
    }

    /**
     * Update barrier - move toward player (z decreases)
     * @param {boolean} isActive - Whether this is the current active barrier
     */
    update(dt, speed, isActive = false) {
        // Apply speed boost (accelerates when cleared or catching up)
        this.z -= speed * this.speedBoost * dt;

        // Cleared barriers accelerate past player
        if (this.isCleared && this.speedBoost < 5.0) {
            this.speedBoost += dt * 8;  // Ramp up quickly
        }
        // Active barriers slow back down to normal speed so player can react
        else if (isActive && !this.isCleared && this.speedBoost > 1.0) {
            this.speedBoost = Math.max(1.0, this.speedBoost - dt * 4);  // Slow down
        }

        // Update wrong flash
        if (this.wrongFlash > 0) {
            this.wrongFlash -= dt * 3;
        }

        // Update shatter particles
        this.shatterParticles = this.shatterParticles.filter(p => {
            p.life -= dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vy += 400 * dt;
            p.scale *= 0.98;
            return p.life > 0;
        });
    }

    /**
     * Check if a click hits a key (in screen coordinates)
     */
    checkClick(clickX, clickY, zToScreen) {
        const { y: screenY, scale } = zToScreen(this.z);

        // Calculate screen dimensions
        const screenWidth = this.baseWidth * scale;
        const screenHeight = this.baseHeight * scale;
        const screenX = (BASE_WIDTH - screenWidth) / 2;

        // Check if click is in barrier's Y range (generous padding for easier clicking)
        const yPadding = 25 * scale;
        if (clickY < screenY - screenHeight / 2 - yPadding || clickY > screenY + screenHeight / 2 + yPadding) {
            return { hit: false };
        }

        // First, check if click is on the TARGET key (priority)
        const targetKey = this.keys.find(k => k.isTarget);
        if (targetKey) {
            const keyX = screenX + targetKey.relativeX * screenWidth;
            const keyWidth = targetKey.relativeWidth * screenWidth;
            const halfWidth = keyWidth / 2 + 8 * scale;

            if (clickX >= keyX - halfWidth && clickX <= keyX + halfWidth) {
                const absoluteX = (BASE_WIDTH - this.baseWidth) / 2 + targetKey.relativeX * this.baseWidth;
                return {
                    hit: true,
                    correct: true,
                    note: targetKey.fullName,
                    isBlackKey: targetKey.isBlackKey,
                    x: absoluteX
                };
            }
        }

        // Then check black keys (they're visually on top)
        for (const key of this.keys) {
            if (!key.isBlackKey) continue;
            const keyX = screenX + key.relativeX * screenWidth;
            const keyWidth = key.relativeWidth * screenWidth;
            const halfWidth = keyWidth / 2 + 8 * scale;

            if (clickX >= keyX - halfWidth && clickX <= keyX + halfWidth) {
                const absoluteX = (BASE_WIDTH - this.baseWidth) / 2 + key.relativeX * this.baseWidth;
                return {
                    hit: true,
                    correct: false,
                    note: key.fullName,
                    isBlackKey: key.isBlackKey,
                    x: absoluteX
                };
            }
        }

        // Finally check white keys
        for (const key of this.keys) {
            if (key.isBlackKey) continue;
            const keyX = screenX + key.relativeX * screenWidth;
            const keyWidth = key.relativeWidth * screenWidth;
            const halfWidth = keyWidth / 2 + 8 * scale;

            if (clickX >= keyX - halfWidth && clickX <= keyX + halfWidth) {
                const absoluteX = (BASE_WIDTH - this.baseWidth) / 2 + key.relativeX * this.baseWidth;
                return {
                    hit: true,
                    correct: false,
                    note: key.fullName,
                    isBlackKey: key.isBlackKey,
                    x: absoluteX
                };
            }
        }

        return { hit: false };
    }

    /**
     * Check keyboard press
     */
    checkKeyPress(noteName) {
        const targetName = this.targetNote.name;

        // Check direct match or enharmonic
        const enharmonics = {
            'C#': 'Db', 'Db': 'C#',
            'D#': 'Eb', 'Eb': 'D#',
            'F#': 'Gb', 'Gb': 'F#',
            'G#': 'Ab', 'Ab': 'G#',
            'A#': 'Bb', 'Bb': 'A#'
        };

        const isCorrect = noteName === targetName || enharmonics[noteName] === targetName;

        // Calculate X position for the target note
        const absoluteX = (BASE_WIDTH - this.baseWidth) / 2 + this.targetNote.relativeX * this.baseWidth;

        return {
            correct: isCorrect,
            note: this.targetNote.fullName,
            isBlackKey: this.targetNote.isBlackKey,
            x: absoluteX
        };
    }

    /**
     * Shatter the barrier
     */
    shatter() {
        this.isShattered = true;
        this.isCleared = true;

        // Create particles
        const targetKey = this.keys.find(k => k.isTarget);
        if (targetKey) {
            for (let i = 0; i < 12; i++) {
                this.shatterParticles.push({
                    x: BASE_WIDTH / 2 + (targetKey.relativeX - 0.5) * this.baseWidth,
                    y: 0, // Will be set during render
                    vx: (Math.random() - 0.5) * 150,
                    vy: (Math.random() - 0.5) * 100,
                    life: 0.5 + Math.random() * 0.3,
                    size: 4 + Math.random() * 6,
                    scale: 1,
                    color: targetKey.isBlackKey ? '#333' : '#fff'
                });
            }
        }
    }

    /**
     * Flash wrong
     */
    flashWrong() {
        this.wrongFlash = 1;
    }

    /**
     * Mark as cleared
     */
    markCleared() {
        this.isCleared = true;
    }

    /**
     * Render the barrier with 3D perspective
     * @param {boolean} isActive - Whether this barrier is the active/clickable one
     */
    render(ctx, theme, zToScreen, isActive = false) {
        const { y: screenY, scale } = zToScreen(this.z);

        // Calculate screen dimensions
        const screenWidth = this.baseWidth * scale;
        const screenHeight = this.baseHeight * scale;
        const screenX = (BASE_WIDTH - screenWidth) / 2;

        // Render particles first (behind barrier)
        this.renderParticles(ctx, screenY, scale);

        // Dim barriers that aren't the current one
        let opacity = isActive || this.isShattered ? 1.0 : 0.4;
        ctx.globalAlpha = opacity;

        // Draw barrier shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fillRect(screenX, screenY - screenHeight / 2 + 3 * scale, screenWidth, screenHeight);

        // Draw ALL keys (white first, then black)
        // If shattered, the target key becomes a "hole" but rest of keyboard stays
        for (const key of this.keys) {
            if (!key.isBlackKey) {
                this.renderKey(ctx, key, screenX, screenY, screenWidth, screenHeight, scale, theme, isActive);
            }
        }

        for (const key of this.keys) {
            if (key.isBlackKey) {
                this.renderKey(ctx, key, screenX, screenY, screenWidth, screenHeight, scale, theme, isActive);
            }
        }

        // Draw target glow (only for active barrier that hasn't been shattered yet)
        if (isActive && !this.isShattered) {
            const targetKey = this.keys.find(k => k.isTarget);
            if (targetKey) {
                const keyX = screenX + targetKey.relativeX * screenWidth;
                const keyWidth = targetKey.relativeWidth * screenWidth;
                const keyHeight = targetKey.isBlackKey ? screenHeight * 0.65 : screenHeight;
                const keyY = screenY - screenHeight / 2;

                // Pulsing glow effect
                const pulse = 0.7 + Math.sin(Date.now() / 150) * 0.3;

                ctx.strokeStyle = theme.accent;
                ctx.lineWidth = 4 * scale;
                ctx.shadowColor = theme.accent;
                ctx.shadowBlur = 20 * scale * pulse;
                ctx.strokeRect(keyX - keyWidth / 2 - 2, keyY - 2, keyWidth + 4, keyHeight + 4);
                ctx.shadowBlur = 0;
            }
        }

        ctx.globalAlpha = 1;
    }

    /**
     * Render a single key
     */
    renderKey(ctx, key, screenX, screenY, screenWidth, screenHeight, scale, theme, isActive = false) {
        const keyX = screenX + key.relativeX * screenWidth;
        const keyWidth = key.relativeWidth * screenWidth;
        const keyHeight = key.isBlackKey ? screenHeight * 0.65 : screenHeight;
        const keyY = screenY - screenHeight / 2;

        // If this is the target key and barrier is shattered, draw a HOLE instead
        if (key.isTarget && this.isShattered) {
            // Draw the hole (dark opening with green glow)
            ctx.fillStyle = '#050510';
            ctx.fillRect(keyX - keyWidth / 2, keyY, keyWidth, keyHeight);

            // Green glow around the hole
            ctx.strokeStyle = theme.accent;
            ctx.lineWidth = 2 * scale;
            ctx.shadowColor = theme.accent;
            ctx.shadowBlur = 8 * scale;
            ctx.strokeRect(keyX - keyWidth / 2, keyY, keyWidth, keyHeight);
            ctx.shadowBlur = 0;
            return;
        }

        // Determine color for solid key
        let fillColor;
        if (key.isTarget && this.wrongFlash > 0) {
            fillColor = theme.danger;
        } else if (key.isBlackKey) {
            // Target black key is brighter when active
            fillColor = key.isTarget && isActive ? '#555' : '#1a1a1a';
        } else {
            // Target white key is highlighted yellow when active
            fillColor = key.isTarget && isActive ? '#ffffa0' : '#f0f0f0';
        }

        // Draw key
        ctx.fillStyle = fillColor;
        ctx.fillRect(keyX - keyWidth / 2, keyY, keyWidth, keyHeight);

        // Border
        ctx.strokeStyle = key.isBlackKey ? '#000' : '#888';
        ctx.lineWidth = 1;
        ctx.strokeRect(keyX - keyWidth / 2, keyY, keyWidth, keyHeight);

        // 3D highlight for white keys
        if (!key.isBlackKey && scale > 0.2) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.fillRect(keyX - keyWidth / 2 + 2 * scale, keyY + 2 * scale, keyWidth - 4 * scale, 4 * scale);
        }

        // Note label for target (larger and more visible)
        if (key.isTarget && isActive && scale > 0.3) {
            ctx.fillStyle = key.isBlackKey ? '#fff' : '#333';
            ctx.font = `bold ${Math.max(12, 18 * scale)}px monospace`;
            ctx.textAlign = 'center';
            ctx.fillText(key.name, keyX, keyY + keyHeight - 10 * scale);
        }
    }

    /**
     * Render shatter particles
     */
    renderParticles(ctx, baseY, scale) {
        for (const p of this.shatterParticles) {
            ctx.fillStyle = p.color;
            ctx.globalAlpha = p.life * 2;
            const size = p.size * scale * p.scale;
            ctx.fillRect(p.x - size / 2, baseY + p.y - size / 2, size, size);
        }
        ctx.globalAlpha = 1;
    }
}
