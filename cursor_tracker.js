/**
 * cursor_tracker.js — VARK-R Detection + Attention Scoring
 *
 * Passively tracks cursor behavior to detect Read/Write (R) VARK learners
 * and measure session attention. No dependencies, no build step required.
 *
 * Usage:
 *   import { CursorTracker } from "./cursor_tracker.js";
 *   const tracker = new CursorTracker();
 *   tracker.start();
 *   const result = tracker.classify();
 *   // => { vark_type: "R" | null, confidence: 0.0–1.0, attention: 0.0–1.0 }
 *   tracker.reset();
 */

export class CursorTracker {
  constructor(options = {}) {
    this._opts = {
      sampleIntervalMs: 100,
      minSessionMs: 5000,
      idleThresholdMs: 3000,
      minDxForRightward: 5,
      maxDyForSweep: 12,
      lineResetDxThreshold: -60,
      minSweepSegmentSamples: 6,
      contentSelector: "main, article, [role='main'], body",
      maxDragsPerMinute: 10,
      rScoreThreshold: 0.45,
      lineTrackingWeight: 0.65,
      dragRateWeight: 0.35,
      ...options,
    };

    // State
    this._samples = [];       // { x, y, t }
    this._drags = [];         // { duration, hDist, t }
    this._sessionStartMs = null;
    this._lastX = null;
    this._lastY = null;
    this._dragStartX = null;
    this._dragStartY = null;
    this._dragStartMs = null;

    // Bound handlers (needed for removeEventListener)
    this._onMouseDown = this._handleMouseDown.bind(this);
    this._onMouseUp = this._handleMouseUp.bind(this);
    this._intervalId = null;
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  start() {
    if (this._sessionStartMs !== null) return; // guard against double-start
    this._sessionStartMs = Date.now();
    this._lastX = null;
    this._lastY = null;

    // Sample cursor position at fixed interval
    this._intervalId = setInterval(() => {
      if (this._lastX !== null) {
        this._samples.push({ x: this._lastX, y: this._lastY, t: Date.now() });
      }
    }, this._opts.sampleIntervalMs);

    // Track current cursor position via mousemove
    this._onMouseMove = (e) => {
      this._lastX = e.clientX;
      this._lastY = e.clientY;
    };
    document.addEventListener("mousemove", this._onMouseMove);
    document.addEventListener("mousedown", this._onMouseDown);
    document.addEventListener("mouseup", this._onMouseUp);
  }

  classify() {
    const sessionMs = this._sessionMs();
    const { minSessionMs } = this._opts;

    if (sessionMs < minSessionMs || this._samples.length < 20) {
      return { vark_type: null, confidence: 0.0, attention: 0.0 };
    }

    const line_tracking_score = this._computeLineTrackingScore();
    const drag_rate = this._computeDragRate(sessionMs);
    const r_score = this._opts.lineTrackingWeight * line_tracking_score
                  + this._opts.dragRateWeight * drag_rate;

    const vark_type = r_score > this._opts.rScoreThreshold ? "R" : null;
    const confidence = Math.min(1.0, r_score);
    const attention = this._computeAttention(sessionMs);

    return { vark_type, confidence, attention };
  }

  reset() {
    clearInterval(this._intervalId);
    this._intervalId = null;

    if (this._onMouseMove) {
      document.removeEventListener("mousemove", this._onMouseMove);
    }
    document.removeEventListener("mousedown", this._onMouseDown);
    document.removeEventListener("mouseup", this._onMouseUp);

    this._samples = [];
    this._drags = [];
    this._sessionStartMs = null;
    this._lastX = null;
    this._lastY = null;
    this._dragStartX = null;
    this._dragStartY = null;
    this._dragStartMs = null;
    this._onMouseMove = null;
  }

  // ─── Event Handlers ───────────────────────────────────────────────────────

  _handleMouseDown(e) {
    this._dragStartX = e.clientX;
    this._dragStartY = e.clientY;
    this._dragStartMs = Date.now();
  }

  _handleMouseUp(e) {
    if (this._dragStartMs === null) return;

    const duration = Date.now() - this._dragStartMs;
    const hDist = Math.abs(e.clientX - this._dragStartX);

    if (hDist > 20 && duration > 80 && duration < 5000) {
      this._drags.push({ duration, hDist, t: Date.now() });
    }

    this._dragStartX = null;
    this._dragStartY = null;
    this._dragStartMs = null;
  }

  // ─── Scoring Algorithms ───────────────────────────────────────────────────

  /**
   * Line Tracking Score (R-signal, weight 0.65)
   * Detects left-to-right reading sweeps with line-reset movements.
   */
  _computeLineTrackingScore() {
    const samples = this._samples;
    if (samples.length < 2) return 0;

    const {
      minDxForRightward,
      maxDyForSweep,
      lineResetDxThreshold,
      minSweepSegmentSamples,
    } = this._opts;

    let rightwardRun = 0;
    let validSweepSamples = 0;
    let totalPairs = samples.length - 1;

    for (let i = 1; i < samples.length; i++) {
      const dx = samples[i].x - samples[i - 1].x;
      const dy = Math.abs(samples[i].y - samples[i - 1].y);

      if (dx >= minDxForRightward && dy <= maxDyForSweep) {
        // Rightward step (reading movement)
        rightwardRun++;
        validSweepSamples++;
      } else if (dx <= lineResetDxThreshold && rightwardRun >= minSweepSegmentSamples) {
        // Line reset after a valid reading sweep
        validSweepSamples++; // count the reset as part of valid reading behavior
        rightwardRun = 0;
      } else {
        rightwardRun = 0;
      }
    }

    return totalPairs > 0 ? Math.min(1.0, validSweepSamples / totalPairs) : 0;
  }

  /**
   * Drag Rate (R-signal, weight 0.35)
   * Highlights / text selection behavior.
   */
  _computeDragRate(sessionMs) {
    const minutes = sessionMs / 60000;
    if (minutes === 0) return 0;
    const dragsPerMinute = this._drags.length / minutes;
    return Math.min(1.0, dragsPerMinute / this._opts.maxDragsPerMinute);
  }

  /**
   * Attention Score (independent of VARK)
   * Combines idle fraction, content-area dwell, and drag engagement.
   */
  _computeAttention(sessionMs) {
    const idle_fraction = this._computeIdleFraction(sessionMs);
    const content_fraction = this._computeContentFraction();
    const dragBonus = Math.min(1.0, (this._drags.length * 0.03) / 0.15);

    return Math.min(
      1.0,
      0.55 * (1 - idle_fraction) + 0.30 * content_fraction + 0.15 * dragBonus
    );
  }

  /**
   * Fraction of session time spent idle (gap > idleThresholdMs between samples).
   */
  _computeIdleFraction(sessionMs) {
    if (sessionMs === 0 || this._samples.length < 2) return 1;

    const { idleThresholdMs } = this._opts;
    let idleMs = 0;

    for (let i = 1; i < this._samples.length; i++) {
      const gap = this._samples[i].t - this._samples[i - 1].t;
      if (gap > idleThresholdMs) {
        idleMs += gap;
      }
    }

    return Math.min(1.0, idleMs / sessionMs);
  }

  /**
   * Fraction of samples that fall inside the content element's bounding rect.
   */
  _computeContentFraction() {
    const samples = this._samples;
    if (samples.length === 0) return 0.5;

    const el = document.querySelector(this._opts.contentSelector);
    if (!el) {
      console.warn(
        `CursorTracker: content element not found for selector "${this._opts.contentSelector}". Using neutral 0.5.`
      );
      return 0.5;
    }

    const rect = el.getBoundingClientRect();
    let inside = 0;

    for (const s of samples) {
      if (
        s.x >= rect.left &&
        s.x <= rect.right &&
        s.y >= rect.top &&
        s.y <= rect.bottom
      ) {
        inside++;
      }
    }

    return inside / samples.length;
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  _sessionMs() {
    if (this._sessionStartMs === null) return 0;
    return Date.now() - this._sessionStartMs;
  }
}
