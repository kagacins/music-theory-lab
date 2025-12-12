/**
 * Notation Module - Professional VexFlow notation system
 * Part of the Phase 4.4 VexFlow Professional Notation enhancement
 *
 * This module exports all notation-related functionality for the Music Theory Lab.
 */

// Core rendering engine
export * from './vexFlowRenderer.js';
export { default as VexFlowRenderer } from './vexFlowRenderer.js';

// Grand staff rendering
export * from './grandStaff.js';
export { default as GrandStaff } from './grandStaff.js';

// Multi-system layout
export * from './staffLayouter.js';
export { default as StaffLayouter } from './staffLayouter.js';

// Measure data management
export * from './measureEditor.js';
export { default as MeasureEditor } from './measureEditor.js';

// Note formatting utilities
export * from './noteFormatter.js';
export { default as NoteFormatter } from './noteFormatter.js';

// Toolbar UI
export * from './notationToolbar.js';
export { default as NotationToolbar } from './notationToolbar.js';

// Composer integration (bridges with existing Melody Composer)
export * from './composerIntegration.js';
export { default as ComposerIntegration } from './composerIntegration.js';

// Interactive note editing
export * from './noteEditor.js';
export { default as NoteEditorModule } from './noteEditor.js';

// Initialization and wiring
export * from './notationInit.js';
export { default as NotationInit } from './notationInit.js';

/**
 * Create a complete notation system instance
 * @param {Object} options - Configuration options
 * @returns {Object} - Notation system with all components
 */
export function createNotationSystem(options = {}) {
  const {
    container,
    toolbarContainer,
    measuresPerLine = 4,
    keySignature = 'C',
    timeSignature = '4/4',
    onUpdate = () => {},
  } = options;

  // Import classes
  const { StaffLayoutManager } = require('./staffLayouter.
  const { MeasureManager } = require('./measureEditor.
  const { NotationToolbar } = require('./notationToolbar.
  const { renderGrandStaffSystem } = require('./grandStaff.

  // Create components
  const layoutManager = new StaffLayoutManager({
    measuresPerLine,
    keySignature,
  });

  const measureManager = new MeasureManager({
    keySignature,
    timeSignature,
  });

  const toolbar = new NotationToolbar({
    onDurationChange: () => render(),
    onZoomChange: (zoom) => {
      layoutManager.setZoom(zoom / 100);
      render();
    },
    onMeasuresPerLineChange: (mpl) => {
      layoutManager.setConfig({ measuresPerLine: mpl });
      render();
    },
    onUndo: () => {
      measureManager.undo();
      render();
    },
    onRedo: () => {
      measureManager.redo();
      render();
    },
    onDelete: () => {
      measureManager.deleteSelected();
      render();
    },
  });

  // Render function
  function render() {
    const measures = measureManager.getAllMeasures();

    if (container && measures.length > 0) {
      renderGrandStaffSystem(container, measures, {
        measuresPerLine: layoutManager.getConfig().measuresPerLine,
        keySignature,
        timeSignature,
      });
    }

    toolbar.setUndoRedoState(measureManager.canUndo(), measureManager.canRedo());
    onUpdate();
  }

  // Initialize
  if (toolbarContainer) {
    toolbar.create(toolbarContainer);
  }

  // Add initial measure if empty
  if (measureManager.getMeasureCount() === 0) {
    measureManager.addMeasure();
  }

  // Return public interface
  return {
    // Managers
    layout: layoutManager,
    measures: measureManager,
    toolbar,

    // Actions
    render,

    // Measure operations
    addMeasure: (index) => {
      measureManager.addMeasure(index);
      render();
    },
    removeMeasure: (index) => {
      measureManager.removeMeasure(index);
      render();
    },

    // Note operations
    addNote: (measureIndex, staff, noteData, position) => {
      measureManager.addNote(measureIndex, staff, noteData, position);
      render();
    },
    removeNote: (measureIndex, staff, noteIndex) => {
      measureManager.removeNote(measureIndex, staff, noteIndex);
      render();
    },
    updateNote: (measureIndex, staff, noteIndex, updates) => {
      measureManager.updateNote(measureIndex, staff, noteIndex, updates);
      render();
    },

    // Selection
    select: (measureIndex, staff, noteIndex) => {
      measureManager.setSelection(measureIndex, staff, noteIndex);
      render();
    },
    clearSelection: () => {
      measureManager.clearSelection();
      render();
    },

    // Import/Export
    toJSON: () => measureManager.toJSON(),
    fromJSON: (json) => {
      measureManager.fromJSON(json);
      render();
    },

    // Cleanup
    destroy: () => {
      toolbar.destroy();
    },
  };
}

export default {
  createNotationSystem,
};
