/**
 * vark_integration.js
 * Loads CursorTracker as an ES module and feeds results into app.js
 * via the window.onVarkUpdate callback.
 */
import { CursorTracker } from '../cursor_tracker.js';

const tracker = new CursorTracker({
    contentSelector: '.ns-main-content, .ns-ka-center, .ns-reading-content',
});

tracker.start();

// Classify every 15 s; first meaningful result arrives after minSessionMs (5 s)
setInterval(() => {
    const result = tracker.classify();
    if (typeof window.onVarkUpdate === 'function') {
        window.onVarkUpdate(result);
    }
}, 15_000);
