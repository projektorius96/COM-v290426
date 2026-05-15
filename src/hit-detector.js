/**
 * @module HitDetector
 * @description Ultra-efficient spatial hit detection for canvas entities.
 *
 * {@link HitDetector} provides fast point-in-region testing with support for:
 *   - Axis-aligned bounding boxes (AABB)
 *   - Filled path geometries via `isPointInPath`
 *   - Stroked path geometries via `isPointInStroke`
 *   - Fully transformed geometries (rotation, scale, skew) via DOMMatrix
 *
 * Features:
 *   - **Viewport-aware**: Automatically accounts for visual viewport scale/offset (mobile pinch-zoom)
 *   - **Canvas-aware**: Auto-detects canvas ID from ResponsiveCanvas instances
 *   - **Hierarchical events**: Handlers fire in registration order (back-to-front)
 *   - **Chainable API**: All registration methods return `this` for method chaining
 *
 * | Method                          | Returns  | Description                                    |
 * |---------------------------------|----------|------------------------------------------------|
 * | `register(id, region, matrix)`  | HitDetector | Add or update a hittable region              |
 * | `unregister(id)`                | HitDetector | Remove a region                                |
 * | `hitTest(x, y)`                 | Array    | Get all regions containing point               |
 * | `getRegionBounds(id)`           | Object   | Get bounding box of region                     |
 * | `getAllRegionBounds()`          | Array    | Get all region bounding boxes                  |
 * | `on(event, fn)`                 | HitDetector | Register event handler                       |
 * | `off(event)`                    | HitDetector | Unregister event handler                     |
 * | `clear()`                       | HitDetector | Remove all regions                            |
 *
 * @example
 * ```js
 * import { HitDetector } from './hit-detector.js';
 * import { ResponsiveCanvas } from './responsive-canvas.js';
 *
 * const rc = new ResponsiveCanvas({ stage: document.getElementById('app'), gridConfig: { scale: 20 } });
 * const hd = new HitDetector(rc.canvas);
 *
 * // Box region
 * hd.register('btn-play', { type: 'box', x: 0, y: 0, w: 100, h: 50 });
 *
 * // Filled circle path
 * const circlePath = new Path2D();
 * circlePath.arc(0, 0, 50, 0, Math.PI * 2);
 * hd.register('circle', { type: 'path', path: circlePath }, new DOMMatrix().translateSelf(200, 150));
 *
 * // Stroked line
 * const linePath = new Path2D();
 * linePath.moveTo(0, 0);
 * linePath.lineTo(100, 100);
 * hd.register('line-1', { type: 'stroke', path: linePath });
 *
 * // Event handling (hits ordered back-to-front)
 * hd.on('click', (hits) => {
 *   hits.forEach(hit => {
 *     console.log(`Clicked: ${hit.id} (canvas: ${hit.canvasId})`);
 *   });
 * });
 * ```
 */

/**
 * Safely invert a DOMMatrix for coordinate transformation.
 * @param {DOMMatrix} matrix
 * @returns {DOMMatrix|null} — null if singular
 */
function invertMatrix(matrix) {
  try {
    return matrix.inverse();
  } catch {
    return null;
  }
}

/**
 * Point-in-axis-aligned-box test.
 * @param {number} px — point x
 * @param {number} py — point y
 * @param {number} bx — box min x
 * @param {number} by — box min y
 * @param {number} bw — box width
 * @param {number} bh — box height
 * @returns {boolean}
 */
function pointInBox(px, py, bx, by, bw, bh) {
  return px >= bx && px < bx + bw && py >= by && py < by + bh;
}

/**
 * Compute axis-aligned bounding box of a region (optionally transformed).
 * @param {{ type: string, x?: number, y?: number, w?: number, h?: number, path?: Path2D }} region
 * @param {DOMMatrix|null} matrix
 * @returns {{ x: number, y: number, width: number, height: number }|null}
 */
function computeRegionBounds(region, matrix) {
  if (region.type === 'box') {
    const box = {
      x: region.x || 0,
      y: region.y || 0,
      width: region.w || 0,
      height: region.h || 0,
    };

    if (!matrix) return box;

    // Transform all four corners and compute new AABB
    const corners = [
      new DOMPoint(box.x, box.y),
      new DOMPoint(box.x + box.width, box.y),
      new DOMPoint(box.x + box.width, box.y + box.height),
      new DOMPoint(box.x, box.y + box.height),
    ];

    const transformed = corners.map(p => p.matrixTransform(matrix));
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    transformed.forEach(p => {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    });

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }

  // Path2D bounds are indeterminate without rendering
  return null;
}

export class HitDetector {
  /** @type {HTMLCanvasElement} */
  #canvas;
  /** @type {CanvasRenderingContext2D} */
  #ctx;
  /** @type {string|number} */
  #canvasId;
  /** @type {Map<string, { region: object, matrix: DOMMatrix|null, invMatrix: DOMMatrix|null }>} */
  #index = new Map();
  /** @type {Map<string, Function>} */
  #handlers = new Map();
  /** @type {number} */
  #strokeWidth = 1;

  /**
   * @param {HTMLCanvasElement} canvas — canvas to attach to (typically from ResponsiveCanvas)
   * @param {object} [options]
   * @param {string|number} [options.canvasId] — override canvas ID (auto-detected from canvas.__canvasId if not provided)
   * @param {number} [options.strokeWidth=1] — stroke width for stroke-based hit testing
   */
  constructor(canvas, { canvasId, strokeWidth = 1 } = {}) {
    this.#canvas = canvas;
    this.#ctx = canvas.getContext('2d');
    this.#canvasId = canvasId !== undefined ? canvasId : canvas.__canvasId || null;
    this.#strokeWidth = strokeWidth;

    this.#setupEventListeners();
  }

  /* ================================================================== */
  /*  Accessors                                                         */
  /* ================================================================== */

  /** The canvas ID this detector is attached to. */
  get canvasId() {
    return this.#canvasId;
  }

  /** The underlying canvas element. */
  get canvas() {
    return this.#canvas;
  }

  /** Get the current stroke width for stroke-based hit testing. */
  get strokeWidth() {
    return this.#strokeWidth;
  }

  /**
   * Set the stroke width for stroke-based hit testing.
   * Useful for adjusting hit "thickness" on stroked paths.
   */
  set strokeWidth(width) {
    this.#strokeWidth = width;
  }

  /* ================================================================== */
  /*  Registration                                                      */
  /* ================================================================== */

  /**
   * Register a hittable region with optional transformation.
   *
   * **Region types:**
   * - `{ type: 'box', x, y, w, h }` — axis-aligned rectangle
   * - `{ type: 'path', path: Path2D }` — filled geometry (isPointInPath)
   * - `{ type: 'stroke', path: Path2D }` — stroked geometry (isPointInStroke)
   *
   * If a `matrix` is provided, the point is transformed to local space before testing.
   *
   * @param {string} id — unique identifier
   * @param {object} region — region descriptor
   * @param {DOMMatrix} [matrix] — optional transform matrix
   * @returns {HitDetector} — for method chaining
   */
  register(id, region, matrix = null) {
    const invMatrix = matrix ? invertMatrix(matrix) : null;
    this.#index.set(id, { region, matrix, invMatrix });
    return this;
  }

  /**
   * Unregister a region by ID.
   * @param {string} id
   * @returns {HitDetector}
   */
  unregister(id) {
    this.#index.delete(id);
    return this;
  }

  /**
   * Clear all registered regions.
   * @returns {HitDetector}
   */
  clear() {
    this.#index.clear();
    return this;
  }

  /* ================================================================== */
  /*  Hit Testing                                                       */
  /* ================================================================== */

  /**
   * Get all regions containing the given point (world-space).
   * Returns results in registration order (insertion order, back-to-front).
   *
   * **Viewport-aware**: Automatically accounts for visual viewport zoom (mobile).
   *
   * @param {number} worldX — world-space x coordinate
   * @param {number} worldY — world-space y coordinate
   * @returns {Array<{ id: string, region: object, matrix: DOMMatrix|null, canvasId: string|number }>}
   */
  hitTest(worldX, worldY) {
    const hits = [];
    const zoomScale = window.visualViewport?.scale || 1;
    const adjustedX = worldX / zoomScale;
    const adjustedY = worldY / zoomScale;

    for (const [id, { region, matrix, invMatrix }] of this.#index) {
      let localX = adjustedX;
      let localY = adjustedY;

      if (invMatrix) {
        const p = new DOMPoint(adjustedX, adjustedY);
        const transformed = p.matrixTransform(invMatrix);
        localX = transformed.x;
        localY = transformed.y;
      }

      if (this.#testRegion(region, localX, localY)) {
        hits.push({ id, region, matrix, canvasId: this.#canvasId });
      }
    }

    return hits;
  }

  /**
   * Get bounding box (world-space) of a registered region.
   * Returns null for Path2D regions (bounds indeterminate without rendering).
   *
   * @param {string} id
   * @returns {object|null} — `{ x, y, width, height }` or null
   */
  getRegionBounds(id) {
    const entry = this.#index.get(id);
    if (!entry) return null;
    return computeRegionBounds(entry.region, entry.matrix);
  }

  /**
   * Get bounding boxes for all registered box regions.
   * Skips Path2D regions (bounds indeterminate).
   *
   * @returns {Array<{ id: string, bounds: object }>}
   */
  getAllRegionBounds() {
    const results = [];
    for (const [id, { region, matrix }] of this.#index) {
      const bounds = computeRegionBounds(region, matrix);
      if (bounds) {
        results.push({ id, bounds });
      }
    }
    return results;
  }

  /**
   * Internal: test if point is inside a region.
   * @private
   */
  #testRegion(region, px, py) {
    if (region.type === 'box') {
      return pointInBox(px, py, region.x, region.y, region.w, region.h);
    } else if (region.type === 'path') {
      return this.#ctx.isPointInPath(region.path, px, py);
    } else if (region.type === 'stroke') {
      this.#ctx.lineWidth = this.#strokeWidth;
      return this.#ctx.isPointInStroke(region.path, px, py);
    }
    return false;
  }

  /* ================================================================== */
  /*  Event Handling                                                    */
  /* ================================================================== */

  /**
   * Register an event handler.
   *
   * The handler receives an array of hit regions in registration order.
   *
   * **Supported events:** `'click'`, `'mousemove'`, `'mouseenter'`, `'mouseleave'`, `'touchstart'`, `'touchmove'`, `'touchend'`
   *
   * @param {string} eventType
   * @param {(hits: Array) => void} fn
   * @returns {HitDetector}
   */
  on(eventType, fn) {
    this.#handlers.set(eventType, fn);
    return this;
  }

  /**
   * Unregister an event handler.
   * @param {string} eventType
   * @returns {HitDetector}
   */
  off(eventType) {
    this.#handlers.delete(eventType);
    return this;
  }

  /**
   * Internal: setup DOM event listeners on the canvas.
   * @private
   */
  #setupEventListeners() {
    const handleEvent = (eventType, clientX, clientY) => {
      const handler = this.#handlers.get(eventType);
      if (!handler) return;

      const rect = this.#canvas.getBoundingClientRect();
      const worldX = clientX - rect.left;
      const worldY = clientY - rect.top;

      const hits = this.hitTest(worldX, worldY);
      handler(hits);
    };

    this.#canvas.addEventListener('click', (e) => {
      handleEvent('click', e.clientX, e.clientY);
    });

    this.#canvas.addEventListener('mousemove', (e) => {
      handleEvent('mousemove', e.clientX, e.clientY);
    });

    this.#canvas.addEventListener('mouseenter', (e) => {
      handleEvent('mouseenter', e.clientX, e.clientY);
    });

    this.#canvas.addEventListener('mouseleave', () => {
      const handler = this.#handlers.get('mouseleave');
      if (handler) handler([]);
    });

    this.#canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length > 0) {
        const touch = e.touches[0];
        handleEvent('touchstart', touch.clientX, touch.clientY);
      }
    });

    this.#canvas.addEventListener('touchmove', (e) => {
      if (e.touches.length > 0) {
        const touch = e.touches[0];
        handleEvent('touchmove', touch.clientX, touch.clientY);
      }
    });

    this.#canvas.addEventListener('touchend', () => {
      const handler = this.#handlers.get('touchend');
      if (handler) handler([]);
    });
  }
}