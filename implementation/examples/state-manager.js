/**
 * @module StateManager
 * @description User-friendly wrapper around CanvasRenderingContext2D `.save()` / `.restore()`.
 *
 * Managing canvas state manually is error-prone — it's easy to forget a
 * matching `.restore()`, or to nest saves incorrectly.  {@link StateManager}
 * provides a small, convenient API to make this safe and readable.
 *
 * | Method                     | Description                                              |
 * |----------------------------|----------------------------------------------------------|
 * | `withState(fn)`            | Run `fn` inside a save/restore pair (auto-restores)      |
 * | `withTransform(cfg, fn)`   | Apply transforms + run `fn` inside a save/restore pair   |
 * | `save()` / `restore()`     | Manual save/restore with depth tracking                  |
 * | `depth`                    | Current save-stack depth                                 |
 * | `restoreAll()`             | Pop every remaining save off the stack                   |
 *
 * @example
 * ```js
 * import { StateManager } from './state-manager.js';
 *
 * const sm = new StateManager(ctx);
 *
 * // ---- Auto save/restore ----
 * sm.withState((ctx) => {
 *   ctx.fillStyle = 'red';
 *   ctx.fillRect(0, 0, 100, 100);
 * });
 * // ctx.fillStyle is back to whatever it was before
 *
 * // ---- Shorthand: transform + draw in one call ----
 * sm.withTransform(
 *   { translateX: 200, translateY: 100, rotation: 30 },
 *   (ctx) => {
 *     ctx.fillStyle = 'blue';
 *     ctx.fillRect(-25, -25, 50, 50);
 *   }
 * );
 * ```
 */

/** degrees → radians */
function degToRad(deg) {
  return (deg * Math.PI) / 180;
}

export class StateManager {
  /** @type {CanvasRenderingContext2D} */
  #ctx;
  /** @type {number} */
  #depth = 0;

  /**
   * @param {CanvasRenderingContext2D} ctx
   */
  constructor(ctx) {
    this.#ctx = ctx;
  }

  /* ------------------------------------------------------------------ */
  /*  Manual save / restore                                              */
  /* ------------------------------------------------------------------ */

  /**
   * Push the current canvas state onto the stack.
   * @returns {StateManager}
   */
  save() {
    this.#ctx.save();
    this.#depth++;
    return this;
  }

  /**
   * Pop the most-recently-saved state.
   * @returns {StateManager}
   */
  restore() {
    if (this.#depth > 0) {
      this.#ctx.restore();
      this.#depth--;
    }
    return this;
  }

  /** Current depth of the save stack. */
  get depth() {
    return this.#depth;
  }

  /**
   * Restore **all** remaining saved states (safety net).
   * @returns {StateManager}
   */
  restoreAll() {
    while (this.#depth > 0) {
      this.restore();
    }
    return this;
  }

  /* ------------------------------------------------------------------ */
  /*  Convenience wrappers                                               */
  /* ------------------------------------------------------------------ */

  /**
   * Execute `fn` inside a save / restore pair.
   * The context is automatically restored even if `fn` throws.
   *
   * @param {(ctx: CanvasRenderingContext2D) => void} fn
   * @returns {StateManager}
   *
   * @example
   * ```js
   * sm.withState((ctx) => {
   *   ctx.globalAlpha = 0.5;
   *   ctx.fillRect(0, 0, 100, 100);
   * });
   * // globalAlpha is automatically restored
   * ```
   */
  withState(fn) {
    this.save();
    try {
      fn(this.#ctx);
    } finally {
      this.restore();
    }
    return this;
  }

  /**
   * Apply a set of transforms, run `fn`, then auto-restore.
   *
   * Supported transform keys (all optional):
   *   `translateX`, `translateY`, `rotation` (degrees),
   *   `scaleX`, `scaleY`, `skewX` (degrees), `skewY` (degrees)
   *
   * @param {object} cfg
   * @param {(ctx: CanvasRenderingContext2D) => void} fn
   * @returns {StateManager}
   *
   * @example
   * ```js
   * sm.withTransform(
   *   { translateX: 300, translateY: 200, rotation: 45, scaleX: 2 },
   *   (ctx) => {
   *     ctx.strokeRect(-30, -30, 60, 60);
   *   }
   * );
   * ```
   */
  withTransform(cfg, fn) {
    const {
      translateX = 0,
      translateY = 0,
      rotation = 0,
      scaleX = 1,
      scaleY = 1,
      skewX = 0,
      skewY = 0,
    } = cfg;

    this.save();
    try {
      const ctx = this.#ctx;

      // Build composite matrix: translate → rotate → skew → scale
      const m = new DOMMatrix();
      m.translateSelf(translateX, translateY);
      m.rotateSelf(rotation);
      m.skewXSelf(skewX);
      m.skewYSelf(skewY);
      m.scaleSelf(scaleX, scaleY);

      ctx.transform(m.a, m.b, m.c, m.d, m.e, m.f);
      fn(ctx);
    } finally {
      this.restore();
    }
    return this;
  }
}
