/**
 * Measure Isolation Editing Module
 *
 * Provides a "blown up" editor for editing single measures with intuitive
 * slot-based note placement.
 *
 * Features:
 * - 32nd-note slot granularity for precise placement
 * - Both clefs and multiple voices
 * - Chord building (polyphony within voices)
 * - Optimal rest filling for empty slots
 * - Tie boundary validation
 * - Live preview
 */

export { SlotGrid, SLOT_TYPES, SLOTS_PER_BEAT, durationToSlots, slotsToDuration } from './SlotGrid.js';
export { MeasureIsolationEditor, getMeasureIsolationEditor, openMeasureIsolationEditor } from './MeasureIsolationEditor.js';
