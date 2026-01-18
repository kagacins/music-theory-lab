/**
 * CompositionStudioHelp.js - Help/Guide Modal for Composition Studio
 *
 * Provides a comprehensive guide on how to use the Composition Studio features
 * including note entry, selection, editing, ties/slurs, time signatures, etc.
 */

// Track active help dialog for cleanup
let activeHelpDialog = null;

// Help content sections
const HELP_SECTIONS = [
    {
        id: 'basics',
        title: 'Getting Started',
        icon: '🎵',
        content: `
            <div class="space-y-3">
                <div class="bg-indigo-50 p-3 rounded-lg border-l-4 border-indigo-500">
                    <h4 class="font-semibold text-indigo-800 mb-1">Entering Notes</h4>
                    <p class="text-sm text-gray-700"><kbd class="kbd">Alt/Option + Click</kbd> on the staff to place a note at that pitch.</p>
                    <p class="text-xs text-gray-500 mt-1">The note's duration is determined by the currently selected duration in the sidebar.</p>
                </div>
                <div class="bg-purple-50 p-3 rounded-lg border-l-4 border-purple-500">
                    <h4 class="font-semibold text-purple-800 mb-1">Selecting Notes</h4>
                    <p class="text-sm text-gray-700"><strong>Single note:</strong> Click directly on any note to select it.</p>
                    <p class="text-sm text-gray-700 mt-1"><strong>Multiple notes:</strong> Hold <kbd class="kbd">Shift + Click</kbd> to add notes to your selection.</p>
                </div>
                <div class="bg-emerald-50 p-3 rounded-lg border-l-4 border-emerald-500">
                    <h4 class="font-semibold text-emerald-800 mb-1">Deleting Notes</h4>
                    <p class="text-sm text-gray-700">Select a note and press <kbd class="kbd">Delete</kbd> or <kbd class="kbd">Backspace</kbd> to remove it.</p>
                </div>
            </div>
        `
    },
    {
        id: 'duration',
        title: 'Changing Duration',
        icon: '⏱️',
        content: `
            <div class="space-y-3">
                <p class="text-sm text-gray-700">To change a note's duration:</p>
                <ol class="list-decimal list-inside space-y-2 text-sm text-gray-700 ml-2">
                    <li>Select the note(s) you want to change</li>
                    <li>In the <strong>Duration</strong> section of the sidebar, click a duration button:<br>
                        <span class="inline-flex gap-2 mt-1">
                            <span class="px-2 py-0.5 bg-gray-100 rounded text-lg">𝅝</span> Whole
                            <span class="px-2 py-0.5 bg-gray-100 rounded text-lg">𝅗𝅥</span> Half
                            <span class="px-2 py-0.5 bg-gray-100 rounded text-lg">♩</span> Quarter
                            <span class="px-2 py-0.5 bg-gray-100 rounded text-lg">♪</span> Eighth
                        </span>
                    </li>
                </ol>
                <div class="bg-amber-50 p-3 rounded-lg border-l-4 border-amber-500 mt-3">
                    <h4 class="font-semibold text-amber-800 mb-1">Dotted Notes</h4>
                    <p class="text-sm text-gray-700">Click the <strong>• Dot</strong> button to add a dot (+50% duration) to selected notes.</p>
                </div>
                <div class="bg-blue-50 p-3 rounded-lg border-l-4 border-blue-500">
                    <h4 class="font-semibold text-blue-800 mb-1">Converting to Rests</h4>
                    <p class="text-sm text-gray-700">Select a note and click <strong>𝄽 Rest</strong> to convert it to a rest of the same duration.</p>
                </div>
            </div>
        `
    },
    {
        id: 'editors',
        title: 'Note & Measure Editors',
        icon: '✏️',
        content: `
            <div class="space-y-3">
                <p class="text-sm text-gray-700">Click on any note to reveal a context menu with three powerful editors:</p>

                <div class="bg-indigo-50 p-3 rounded-lg border-l-4 border-indigo-500">
                    <h4 class="font-semibold text-indigo-800 mb-1">Note Editor</h4>
                    <p class="text-sm text-gray-700">Edit properties of the selected note:</p>
                    <ul class="list-disc list-inside text-sm text-gray-600 mt-1 space-y-1">
                        <li>Change pitch by clicking a new position on the mini staff</li>
                        <li>Adjust duration, add dots, or convert to rest</li>
                        <li>Add articulations (staccato, accent, etc.)</li>
                        <li>Apply accidentals (sharp, flat, natural)</li>
                    </ul>
                </div>

                <div class="bg-purple-50 p-3 rounded-lg border-l-4 border-purple-500">
                    <h4 class="font-semibold text-purple-800 mb-1">Measure Editor (Isolated Mode)</h4>
                    <p class="text-sm text-gray-700">Edit a single measure in isolation - perfect for precise note placement!</p>
                    <div class="mt-2 bg-white p-2 rounded border text-sm">
                        <p class="font-medium text-gray-700 mb-1">Two ways to open:</p>
                        <ul class="list-disc list-inside text-gray-600 space-y-1">
                            <li>Click a note, then select <strong>Measure Editor</strong> from the menu</li>
                            <li>Hover over a measure and click the <strong>purple pencil icon</strong> in the upper-right corner</li>
                        </ul>
                    </div>
                    <div class="mt-2 text-sm text-gray-600">
                        <p class="font-medium text-gray-700">Benefits of Isolated Mode:</p>
                        <ul class="list-disc list-inside mt-1 space-y-1">
                            <li>Add and edit notes without affecting surrounding measures</li>
                            <li>Larger, zoomed-in view for precise placement</li>
                            <li>Clear visual of beat divisions within the measure</li>
                            <li>Changes are applied when you close the editor</li>
                        </ul>
                    </div>
                </div>

                <div class="bg-emerald-50 p-3 rounded-lg border-l-4 border-emerald-500">
                    <h4 class="font-semibold text-emerald-800 mb-1">Chord Editor</h4>
                    <p class="text-sm text-gray-700">Edit the chord bracket associated with the selected note's position:</p>
                    <ul class="list-disc list-inside text-sm text-gray-600 mt-1 space-y-1">
                        <li>Change the chord root, type, or inversion</li>
                        <li>Adjust the chord's duration (number of beats)</li>
                        <li>Access chord recommendations</li>
                    </ul>
                    <p class="text-xs text-gray-500 mt-2">Tip: You can also <strong>double-click</strong> a chord label below the staff to edit it directly.</p>
                </div>
            </div>
        `
    },
    {
        id: 'ties-slurs',
        title: 'Ties & Slurs',
        icon: '🔗',
        content: `
            <div class="space-y-3">
                <div class="bg-indigo-50 p-3 rounded-lg border-l-4 border-indigo-500">
                    <h4 class="font-semibold text-indigo-800 mb-1">Ties</h4>
                    <p class="text-sm text-gray-700">Ties connect two notes of the <strong>same pitch</strong> to create a longer duration.</p>
                    <ol class="list-decimal list-inside mt-2 text-sm text-gray-600 space-y-1">
                        <li>Select two adjacent notes of the same pitch (use <kbd class="kbd">Shift + Click</kbd>)</li>
                        <li>Find the <strong>Slurs & Ties</strong> section in the sidebar</li>
                        <li>Click the <strong>Tie</strong> button</li>
                    </ol>
                    <p class="text-xs text-gray-500 mt-2">Tied notes will be played as one continuous sound.</p>
                </div>
                <div class="bg-purple-50 p-3 rounded-lg border-l-4 border-purple-500">
                    <h4 class="font-semibold text-purple-800 mb-1">Slurs</h4>
                    <p class="text-sm text-gray-700">Slurs connect notes of <strong>different pitches</strong> to indicate they should be played smoothly (legato).</p>
                    <ol class="list-decimal list-inside mt-2 text-sm text-gray-600 space-y-1">
                        <li>Select multiple notes (can be different pitches)</li>
                        <li>Find the <strong>Slurs & Ties</strong> section in the sidebar</li>
                        <li>Click the <strong>Slur</strong> button</li>
                    </ol>
                </div>
            </div>
        `
    },
    {
        id: 'shift-operations',
        title: 'Shift Operations',
        icon: '↔️',
        content: `
            <div class="space-y-3">
                <div class="bg-red-50 p-3 rounded-lg border-l-4 border-red-500">
                    <h4 class="font-semibold text-red-800 mb-1">Shift + Delete (Remove Time)</h4>
                    <p class="text-sm text-gray-700">Removes the selected note(s) and <strong>shifts all following notes backward</strong> in time.</p>
                    <div class="mt-2 bg-white p-2 rounded border text-sm">
                        <p class="font-medium text-gray-700 mb-1">Options in the dialog:</p>
                        <ul class="list-disc list-inside text-gray-600 space-y-1 ml-2">
                            <li><strong>Both Hands:</strong> Shift notes in both treble and bass clefs</li>
                            <li><strong>This Hand Only:</strong> Only shift notes in the same clef as selected note</li>
                            <li><strong>Keep Chord Alignment:</strong> Maintains chord bracket positions</li>
                        </ul>
                    </div>
                </div>
                <div class="bg-emerald-50 p-3 rounded-lg border-l-4 border-emerald-500">
                    <h4 class="font-semibold text-emerald-800 mb-1">Shift + Arrow Keys (Insert Note)</h4>
                    <p class="text-sm text-gray-700">Inserts a C4 note adjacent to the selected note and <strong>shifts surrounding notes</strong> to make room.</p>
                    <div class="mt-2 bg-white p-2 rounded border text-sm">
                        <p class="font-medium text-gray-700 mb-1">How it works:</p>
                        <ul class="list-disc list-inside text-gray-600 space-y-1 ml-2">
                            <li><kbd class="kbd">Shift + ←</kbd> Insert a C4 note to the <strong>left</strong> of the selected note</li>
                            <li><kbd class="kbd">Shift + →</kbd> Insert a C4 note to the <strong>right</strong> of the selected note</li>
                        </ul>
                        <p class="text-xs text-gray-500 mt-2">A dialog will appear with options for duration, which hand(s) to shift, and whether to maintain chord alignment.</p>
                    </div>
                </div>
            </div>
        `
    },
    {
        id: 'time-signature',
        title: 'Time Signature',
        icon: '4️⃣',
        content: `
            <div class="space-y-3">
                <p class="text-sm text-gray-700">Change the time signature using the <strong>Time Sig</strong> dropdown in the header bar.</p>
                <div class="bg-amber-50 p-3 rounded-lg border-l-4 border-amber-500">
                    <h4 class="font-semibold text-amber-800 mb-1">What Happens When You Change Time Signature</h4>
                    <p class="text-sm text-gray-700">A dialog will appear with options:</p>
                    <div class="mt-2 bg-white p-2 rounded border text-sm">
                        <ul class="list-disc list-inside text-gray-600 space-y-2 ml-2">
                            <li><strong>Reflow Notes:</strong> Redistributes existing notes into the new measure structure. Notes that don't fit are pushed to subsequent measures.</li>
                            <li><strong>Clear & Start Fresh:</strong> Removes all notes and starts with empty measures in the new time signature.</li>
                            <li><strong>Truncate/Pad Measures:</strong> Each measure is independently adjusted - extra beats are removed, missing beats are filled with rests.</li>
                        </ul>
                    </div>
                </div>
                <div class="text-sm text-gray-600 mt-2">
                    <strong>Common time signatures:</strong>
                    <ul class="mt-1 space-y-1 ml-4">
                        <li><strong>4/4</strong> - Four quarter notes per measure (most common)</li>
                        <li><strong>3/4</strong> - Three quarter notes (waltz time)</li>
                        <li><strong>6/8</strong> - Six eighth notes (compound duple)</li>
                        <li><strong>2/4</strong> - Two quarter notes (march time)</li>
                    </ul>
                </div>
            </div>
        `
    },
    {
        id: 'beaming',
        title: 'Beaming',
        icon: '🎼',
        content: `
            <div class="space-y-3">
                <div class="bg-blue-50 p-3 rounded-lg border-l-4 border-blue-500">
                    <h4 class="font-semibold text-blue-800 mb-1">Automatic Beaming</h4>
                    <p class="text-sm text-gray-700">By default, eighth notes and shorter are automatically beamed together based on the beat grouping of the time signature.</p>
                </div>
                <div class="bg-purple-50 p-3 rounded-lg border-l-4 border-purple-500">
                    <h4 class="font-semibold text-purple-800 mb-1">Manual Beam Control</h4>
                    <p class="text-sm text-gray-700">To manually control beaming:</p>
                    <ol class="list-decimal list-inside mt-2 text-sm text-gray-600 space-y-1">
                        <li>Select the notes you want to beam together</li>
                        <li>Find the <strong>Beams</strong> section in the sidebar</li>
                        <li>Choose an option:
                            <ul class="list-disc list-inside ml-4 mt-1">
                                <li><strong>Beam Selected:</strong> Force beam selected notes together</li>
                                <li><strong>Unbeam:</strong> Break beams on selected notes</li>
                                <li><strong>Auto:</strong> Return to automatic beaming</li>
                            </ul>
                        </li>
                    </ol>
                </div>
                <div class="bg-amber-50 p-3 rounded-lg border-l-4 border-amber-500">
                    <h4 class="font-semibold text-amber-800 mb-1">Why Use Manual Beaming?</h4>
                    <ul class="list-disc list-inside text-sm text-gray-700 space-y-1">
                        <li>Show phrase groupings that cross beat boundaries</li>
                        <li>Highlight rhythmic patterns in complex passages</li>
                        <li>Match beaming conventions for specific genres or styles</li>
                    </ul>
                </div>
            </div>
        `
    },
    {
        id: 'repeats',
        title: 'Repeat Signs',
        icon: '🔁',
        content: `
            <div class="space-y-3">
                <p class="text-sm text-gray-700">Repeat signs indicate sections that should be played multiple times.</p>
                <div class="bg-indigo-50 p-3 rounded-lg border-l-4 border-indigo-500">
                    <h4 class="font-semibold text-indigo-800 mb-1">Adding Repeat Signs</h4>
                    <ol class="list-decimal list-inside text-sm text-gray-600 space-y-1">
                        <li>Click on a measure to select it</li>
                        <li>Find the <strong>Repeat Signs</strong> section in the sidebar</li>
                        <li>Click <strong>Start Repeat</strong> to add a left repeat bar (||:)</li>
                        <li>Click <strong>End Repeat</strong> to add a right repeat bar (:||)</li>
                    </ol>
                </div>
                <div class="bg-purple-50 p-3 rounded-lg border-l-4 border-purple-500">
                    <h4 class="font-semibold text-purple-800 mb-1">Volta Brackets (1st/2nd Endings)</h4>
                    <p class="text-sm text-gray-700">Volta brackets indicate different endings for repeated sections.</p>
                    <ol class="list-decimal list-inside mt-2 text-sm text-gray-600 space-y-1">
                        <li>Select measures for the first ending</li>
                        <li>In the <strong>Endings</strong> section, click <strong>1st Ending</strong></li>
                        <li>Select measures for the second ending</li>
                        <li>Click <strong>2nd Ending</strong></li>
                    </ol>
                    <p class="text-xs text-gray-500 mt-2">On the first pass, play measures under "1." and repeat. On the second pass, skip to "2."</p>
                </div>
                <div class="bg-amber-50 p-3 rounded-lg border-l-4 border-amber-500">
                    <h4 class="font-semibold text-amber-800 mb-1">Expanding Volta Brackets</h4>
                    <p class="text-sm text-gray-700">To extend a volta bracket to span additional measures:</p>
                    <ol class="list-decimal list-inside mt-2 text-sm text-gray-600 space-y-1">
                        <li>Click on an existing volta bracket label (e.g., "1." or "2.")</li>
                        <li>Click the <strong>Expand →</strong> button to extend the bracket one measure to the right</li>
                        <li>Click <strong>Shrink ←</strong> to reduce the bracket by one measure</li>
                    </ol>
                    <p class="text-xs text-gray-500 mt-2">This is useful when you need multi-measure endings without re-creating the bracket.</p>
                </div>
            </div>
        `
    },
    {
        id: 'grace-notes',
        title: 'Grace Notes',
        icon: '✨',
        content: `
            <div class="space-y-3">
                <p class="text-sm text-gray-700">Grace notes are ornamental notes played quickly before the main note.</p>
                <div class="bg-emerald-50 p-3 rounded-lg border-l-4 border-emerald-500">
                    <h4 class="font-semibold text-emerald-800 mb-1">Adding Grace Notes</h4>
                    <ol class="list-decimal list-inside text-sm text-gray-600 space-y-1">
                        <li>Select the main note (the note the grace note will precede)</li>
                        <li>Find the <strong>Grace Notes</strong> section in the sidebar</li>
                        <li>Choose the grace note type:
                            <ul class="list-disc list-inside ml-4 mt-1">
                                <li><strong>Acciaccatura:</strong> Crushed note (with slash through stem) - played very quickly</li>
                                <li><strong>Appoggiatura:</strong> Leaning note (no slash) - takes time from the main note</li>
                            </ul>
                        </li>
                        <li>A dialog will appear to set the grace note pitch</li>
                    </ol>
                </div>
                <div class="bg-amber-50 p-3 rounded-lg border-l-4 border-amber-500">
                    <h4 class="font-semibold text-amber-800 mb-1">Removing Grace Notes</h4>
                    <p class="text-sm text-gray-700">Select a note with grace notes and click <strong>Remove Grace</strong> in the Grace Notes section.</p>
                </div>
            </div>
        `
    },
    {
        id: 'articulations',
        title: 'Articulations & Dynamics',
        icon: '🎭',
        content: `
            <div class="space-y-3">
                <div class="bg-indigo-50 p-3 rounded-lg border-l-4 border-indigo-500">
                    <h4 class="font-semibold text-indigo-800 mb-1">Articulations</h4>
                    <p class="text-sm text-gray-700">Articulations affect how individual notes are played:</p>
                    <div class="grid grid-cols-2 gap-2 mt-2 text-sm">
                        <div class="bg-white p-2 rounded border">
                            <span class="font-medium">. Staccato</span><br>
                            <span class="text-gray-600 text-xs">Short, detached</span>
                        </div>
                        <div class="bg-white p-2 rounded border">
                            <span class="font-medium">> Accent</span><br>
                            <span class="text-gray-600 text-xs">Emphasized attack</span>
                        </div>
                        <div class="bg-white p-2 rounded border">
                            <span class="font-medium">— Tenuto</span><br>
                            <span class="text-gray-600 text-xs">Full value, slight emphasis</span>
                        </div>
                        <div class="bg-white p-2 rounded border">
                            <span class="font-medium">^ Marcato</span><br>
                            <span class="text-gray-600 text-xs">Strong accent</span>
                        </div>
                    </div>
                </div>
                <div class="bg-purple-50 p-3 rounded-lg border-l-4 border-purple-500">
                    <h4 class="font-semibold text-purple-800 mb-1">Dynamics</h4>
                    <p class="text-sm text-gray-700">Dynamics control volume:</p>
                    <div class="flex flex-wrap gap-1 mt-2">
                        <span class="px-2 py-1 bg-white rounded border text-xs"><em>pp</em> - Very soft</span>
                        <span class="px-2 py-1 bg-white rounded border text-xs"><em>p</em> - Soft</span>
                        <span class="px-2 py-1 bg-white rounded border text-xs"><em>mp</em> - Medium soft</span>
                        <span class="px-2 py-1 bg-white rounded border text-xs"><em>mf</em> - Medium loud</span>
                        <span class="px-2 py-1 bg-white rounded border text-xs"><em>f</em> - Loud</span>
                        <span class="px-2 py-1 bg-white rounded border text-xs"><em>ff</em> - Very loud</span>
                    </div>
                </div>
            </div>
        `
    },
    {
        id: 'tips',
        title: 'Pro Tips',
        icon: '💡',
        content: `
            <div class="space-y-3">
                <div class="bg-gradient-to-r from-amber-50 to-yellow-50 p-3 rounded-lg border border-amber-200">
                    <h4 class="font-semibold text-amber-800 mb-2">Keyboard Shortcuts</h4>
                    <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                        <div><kbd class="kbd">Delete</kbd> / <kbd class="kbd">Backspace</kbd></div>
                        <div class="text-gray-600">Delete selected note</div>
                        <div><kbd class="kbd">Shift + Delete</kbd></div>
                        <div class="text-gray-600">Delete and shift time</div>
                        <div><kbd class="kbd">Shift + ←/→</kbd></div>
                        <div class="text-gray-600">Insert C4 note left/right</div>
                        <div><kbd class="kbd">Ctrl/Cmd + +/-</kbd></div>
                        <div class="text-gray-600">Zoom in/out</div>
                        <div><kbd class="kbd">Ctrl/Cmd + Scroll</kbd></div>
                        <div class="text-gray-600">Zoom with mouse wheel</div>
                    </div>
                </div>
                <div class="bg-gradient-to-r from-blue-50 to-indigo-50 p-3 rounded-lg border border-blue-200">
                    <h4 class="font-semibold text-blue-800 mb-2">Workflow Tips</h4>
                    <ul class="list-disc list-inside text-sm text-gray-700 space-y-1">
                        <li>Use the sidebar's "Jump to" dropdown to quickly navigate between tool sections</li>
                        <li>The current duration is shown at the top of the Duration section</li>
                        <li>Click measure numbers or compass icons to access the Coach and detailed measure editing</li>
                        <li>Chord brackets below the staff show harmonic structure - <strong>double-click</strong> the chord label to edit that chord</li>
                    </ul>
                </div>
                <div class="bg-gradient-to-r from-purple-50 to-indigo-50 p-3 rounded-lg border border-purple-200">
                    <h4 class="font-semibold text-purple-800 mb-2">Chord Recommendations</h4>
                    <p class="text-sm text-gray-700">Get theory-informed chord suggestions:</p>
                    <ul class="list-disc list-inside text-sm text-gray-600 ml-2 mt-1">
                        <li>Click the <strong>💡 lightbulb icon</strong> on any chord card to open recommendations</li>
                        <li>Press <kbd class="kbd">Tab</kbd> with a chord selected to open the recommendations modal</li>
                        <li>Suggestions are based on music theory principles like voice leading, common progressions, and harmonic function</li>
                    </ul>
                </div>
                <div class="bg-gradient-to-r from-emerald-50 to-green-50 p-3 rounded-lg border border-emerald-200">
                    <h4 class="font-semibold text-emerald-800 mb-2">Bottom Panel</h4>
                    <p class="text-sm text-gray-700">Use the tabs at the bottom of the screen to:</p>
                    <ul class="list-disc list-inside text-sm text-gray-600 ml-2 mt-1">
                        <li><strong>Quick Add:</strong> Quickly add chords from your library</li>
                        <li><strong>Chord Progression:</strong> View and edit your chord sequence</li>
                    </ul>
                </div>
            </div>
        `
    }
];

/**
 * Show the Composition Studio Help modal
 */
export function showCompositionStudioHelp() {
    // Remove any existing help dialog
    if (activeHelpDialog) {
        activeHelpDialog.remove();
        activeHelpDialog = null;
    }

    // Create dialog overlay
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4';
    overlay.style.zIndex = '2147483647';
    overlay.style.pointerEvents = 'auto';
    overlay.id = 'composition-studio-help-overlay';

    // Create dialog container
    const dialog = document.createElement('div');
    dialog.className = 'bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden';

    // Header
    const header = document.createElement('div');
    header.className = 'flex-shrink-0 px-6 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 flex items-center justify-between';
    header.innerHTML = `
        <div class="flex items-center gap-3">
            <div class="p-2 bg-white/20 rounded-lg">
                <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
                </svg>
            </div>
            <div>
                <h2 class="text-xl font-bold" style="color: #ffffff !important; -webkit-text-fill-color: #ffffff !important;">
                    Composition Studio Guide
                </h2>
                <p class="text-sm text-white/80" style="-webkit-text-fill-color: rgba(255,255,255,0.8) !important;">
                    Learn how to use all the notation tools
                </p>
            </div>
        </div>
        <button id="help-close-btn" class="p-2 hover:bg-white/20 rounded-lg transition-colors" title="Close">
            <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
        </button>
    `;
    dialog.appendChild(header);

    // Content area with sidebar navigation
    const content = document.createElement('div');
    content.className = 'flex-1 flex overflow-hidden';

    // Section navigation sidebar
    const nav = document.createElement('nav');
    nav.className = 'w-56 flex-shrink-0 bg-gray-50 border-r border-gray-200 overflow-y-auto overflow-x-hidden py-2';
    nav.innerHTML = HELP_SECTIONS.map((section, index) => `
        <button class="help-nav-btn w-full px-4 py-2.5 text-left text-sm hover:bg-indigo-50 transition-colors flex items-center gap-2 ${index === 0 ? 'bg-indigo-100 text-indigo-700 font-medium' : 'text-gray-700'}"
                data-section="${section.id}">
            <span class="text-base">${section.icon}</span>
            <span>${section.title}</span>
        </button>
    `).join('');
    content.appendChild(nav);

    // Main content area
    const main = document.createElement('div');
    main.className = 'flex-1 overflow-y-auto p-6';
    main.id = 'help-content-area';
    main.innerHTML = `
        <h3 class="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span class="text-xl">${HELP_SECTIONS[0].icon}</span>
            ${HELP_SECTIONS[0].title}
        </h3>
        ${HELP_SECTIONS[0].content}
    `;
    content.appendChild(main);

    dialog.appendChild(content);

    // Footer
    const footer = document.createElement('div');
    footer.className = 'flex-shrink-0 px-6 py-3 bg-gray-50 border-t border-gray-200 flex justify-between items-center';
    footer.innerHTML = `
        <p class="text-xs text-gray-500">Press <kbd class="kbd">Esc</kbd> to close</p>
        <button id="help-done-btn" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors">
            Got it!
        </button>
    `;
    dialog.appendChild(footer);

    overlay.appendChild(dialog);

    // Add CSS for keyboard styling
    const style = document.createElement('style');
    style.textContent = `
        .kbd {
            display: inline-block;
            padding: 2px 6px;
            font-family: ui-monospace, monospace;
            font-size: 0.75rem;
            background: #f3f4f6;
            border: 1px solid #d1d5db;
            border-radius: 4px;
            box-shadow: 0 1px 0 #d1d5db;
        }
    `;
    overlay.appendChild(style);

    document.body.appendChild(overlay);
    activeHelpDialog = overlay;

    // Event handlers
    const closeDialog = () => {
        overlay.remove();
        activeHelpDialog = null;
    };

    // Close button
    overlay.querySelector('#help-close-btn').addEventListener('click', closeDialog);
    overlay.querySelector('#help-done-btn').addEventListener('click', closeDialog);

    // Click outside to close
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            closeDialog();
        }
    });

    // Escape key to close
    const escHandler = (e) => {
        if (e.key === 'Escape') {
            closeDialog();
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);

    // Navigation handlers
    nav.querySelectorAll('.help-nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const sectionId = btn.dataset.section;
            const section = HELP_SECTIONS.find(s => s.id === sectionId);
            if (!section) return;

            // Update active state
            nav.querySelectorAll('.help-nav-btn').forEach(b => {
                b.classList.remove('bg-indigo-100', 'text-indigo-700', 'font-medium');
                b.classList.add('text-gray-700');
            });
            btn.classList.add('bg-indigo-100', 'text-indigo-700', 'font-medium');
            btn.classList.remove('text-gray-700');

            // Update content
            main.innerHTML = `
                <h3 class="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <span class="text-xl">${section.icon}</span>
                    ${section.title}
                </h3>
                ${section.content}
            `;
        });
    });
}

/**
 * Close the help modal if open
 */
export function closeCompositionStudioHelp() {
    if (activeHelpDialog) {
        activeHelpDialog.remove();
        activeHelpDialog = null;
    }
}
