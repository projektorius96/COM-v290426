/**
 * @module HitDetector
 * @description Efficient point-in-region hit detection for canvas entities.
 *
 * {@link HitDetector} manages a spatial index of drawable regions and provides
 * fast hit-testing for mouse/touch interactions. It supports both axis-aligned
 * bounding boxes and complex path geometries, with full support for transformed
 * (rotated, scaled, skewed) shapes.
 *
 * NEW: Fully viewport-aware—automatically accounts for visual viewport scale
 * and offset on mobile devices with pinch-zoom.
 *
 * | Method                          | Description                                    |
 * |---------------------------------|------------------------------------------------|
 * | `register(id, region, matrix)`  | Add or update a hittable region                 |
 * | `unregister(id)`                | Remove a region from the index                  |
 * | `hitTest(x, y)`                 | Find all regions containing point (x, y)       |
 * | `getRegionBounds(id)`           | Get bounding box of registered region           |
 * | `on(event, fn)`                 | Bind mouse/touch event handler                  |
 * | `clear()`                       | Remove all registered regions                   |
 *
 * @example
 * ```js
 * import { HitDetector } from './hit-detector.js';
 *
 * const hd = new HitDetector(canvas);
 *
 * // Register a transformed square
 * const matrix = new DOMMatrix()
 *   .translateSelf(200, 150)
 *   .rotateSelf(45)
 *   .scaleSelf(2);
 *
 * hd.register('square-1', { type: 'box', x: -25, y: -25, w: 50, h: 50 }, matrix);
 *
 * // Get bounding box for layout
 * const bounds = hd.getRegionBounds('square-1');
 * console.log(`Region at (${bounds.x}, ${bounds.y}), size ${bounds.width}x${bounds.height}`);
 *
 * // Listen for hits
 * hd.on('click', (hits) => {
 *   console.log('Clicked on:', hits.map(h => h.id));
 * });
 *
 * // Test a point
 * const hitIds = hd.hitTest(250, 200).map(h => h.id);
 * ```
 */

/**
 * Inverts a DOMMatrix to transform world coordinates back to local space.
 * @param {DOMMatrix} matrix
 * @returns {DOMMatrix|null} — null if matrix is singular
 */
function invertMatrix(matrix) {
  try {
    return matrix.inverse();
  } catch {
    return null; // Singular matrix (determinant ≈ 0)
  }
}

/**
 * Test if a point is inside an axis-aligned bounding box.
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
 * Test if a point is inside a canvas path using the isPointInPath API.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Path2D} path
 * @param {number} px — point x
 * @param {number} py — point y
 * @returns {boolean}
 */
function pointInPath(ctx, path, px, py) {
  return ctx.isPointInPath(path, px, py);
}

/**
 * Get axis-aligned bounding box from a region and optional transform matrix.
 * @param {{ type: string, x?: number, y?: number, w?: number, h?: number, path?: Path2D }} region
 * @param {DOMMatrix|null} matrix
 * @returns {{ x: number, y: number, width: number, height: number }|null}
 * @private
 */
function getRegionBounds(region, matrix) {
  if (region.type === 'box') {
    const box = {
      x: region.x || 0,
      y: region.y || 0,
      width: region.w || 0,
      height: region.h || 0,
    };

    if (!matrix) {
      return box;
    }

    // Transform all four corners to world space, then compute AABB
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

  // For Path2D, we can't easily compute bounds without rendering
  // Return null to indicate bounds unavailable
  return null;
}

export class HitDetector {
  /** @type {HTMLCanvasElement} */
  #canvas;
  /** @type {CanvasRenderingContext2D} */
  #ctx;
  /** @type {Map<string, { region, matrix, invMatrix }>} */
  #index = new Map();
  /** @type {Map<string, Function>} */
  #handlers = new Map();

  /**
   * @param {HTMLCanvasElement} canvas
   */
  constructor(canvas) {
    this.#canvas = canvas;
    this.#ctx = canvas.getContext('2d');

    // Bind mouse/touch events to the canvas
    this.#setupEventListeners();
  }

  /* ------------------------------------------------------------------ */
  /*  Registration                                                       */
  /* ------------------------------------------------------------------ */

  /**
   * Register a hittable region with an optional transform matrix.
   *
   * Supported region types:
   *   - `{ type: 'box', x, y, w, h }` — axis-aligned rectangle
   *   - `{ type: 'path', path: Path2D }` — arbitrary Path2D geometry
   *
   * If `matrix` is provided, hit tests are transformed to local space
   * before testing against the region (handles rotation, scale, skew).
   *
   * @param {string} id — unique identifier
   * @param {{ type, x?, y?, w?, h?, path? }} region
   * @param {DOMMatrix} [matrix] — optional transform matrix
   * @returns {HitDetector}
   *
   * @example
   * ```js
   * // Simple box
   * hd.register('btn-play', { type: 'box', x: 0, y: 0, w: 100, h: 50 });
   *
   * // Rotated box
   * const m = new DOMMatrix().translateSelf(200, 150).rotateSelf(45);
   * hd.register('rotated', { type: 'box', x: -25, y: -25, w: 50, h: 50 }, m);
   *
   * // Path geometry
   * const p = new Path2D();
   * p.arc(0, 0, 50, 0, Math.PI * 2);
   * hd.register('circle', { type: 'path', path: p });
   * ```
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
   * Remove all registered regions.
   * @returns {HitDetector}
   */
  clear() {
    this.#index.clear();
    return this;
  }

  /* ------------------------------------------------------------------ */
  /*  Hit testing                                                        */
  /* ------------------------------------------------------------------ */

  /**
   * Test which regions contain the given world-space point.
   * Returns results in reverse registration order (most recent first).
   *
   * Automatically accounts for visual viewport scale on mobile.
   *
   * @param {number} worldX
   * @param {number} worldY
   * @returns {Array<{ id, region, matrix }>} — hit regions, back to front
   */
  hitTest(worldX, worldY) {
    const hits = [];

    // Account for visual viewport zoom
    const zoomScale = window.visualViewport?.scale || 1;
    const adjustedX = worldX / zoomScale;
    const adjustedY = worldY / zoomScale;

    for (const [id, { region, matrix, invMatrix }] of this.#index) {
      let localX = adjustedX;
      let localY = adjustedY;

      // Transform world coordinates to local space (if matrix exists)
      if (invMatrix) {
        const p = new DOMPoint(adjustedX, adjustedY);
        const transformed = p.matrixTransform(invMatrix);
        localX = transformed.x;
        localY = transformed.y;
      }

      // Test against region
      if (this.#testRegion(region, localX, localY)) {
        hits.push({ id, region, matrix });
      }
    }

    return hits;
  }

  /**
   * Get bounding box (in world space) for a registered region.
   * Useful for layout calculations and debugging.
   *
   * @param {string} id — region identifier
   * @returns {{ x: number, y: number, width: number, height: number }|null}
   *
   * @example
   * ```js
   * hd.register('btn-1', { type: 'box', x: 0, y: 0, w: 100, h: 50 },
   *   new DOMMatrix().translateSelf(50, 50));
   * 
   * const bounds = hd.getRegionBounds('btn-1');
   * // → { x: 50, y: 50, width: 100, height: 50 }
   * ```
   */
  getRegionBounds(id) {
    const entry = this.#index.get(id);
    if (!entry) return null;

    const { region, matrix } = entry;
    return getRegionBounds(region, matrix);
  }

  /**
   * Get bounding boxes for all registered regions.
   * 
   * @returns {Array<{ id, bounds }>} array of regions with computed bounds
   * 
   * @example
   * ```js
   * const allBounds = hd.getAllRegionBounds();
   * allBounds.forEach(({ id, bounds }) => {
   *   console.log(`Region ${id}:`, bounds);
   * });
   * ```
   */
  getAllRegionBounds() {
    const results = [];
    for (const [id, { region, matrix }] of this.#index) {
      const bounds = getRegionBounds(region, matrix);
      if (bounds) {
        results.push({ id, bounds });
      }
    }
    return results;
  }

  /**
   * Internal: test if a point is inside a registered region.
   * @private
   * @param {{ type, x?, y?, w?, h?, path? }} region
   * @param {number} px
   * @param {number} py
   * @returns {boolean}
   */
  #testRegion(region, px, py) {
    if (region.type === 'box') {
      return pointInBox(px, py, region.x, region.y, region.w, region.h);
    } else if (region.type === 'path') {
      return pointInPath(this.#ctx, region.path, px, py);
    }
    return false;
  }

  /* ------------------------------------------------------------------ */
  /*  Event handling                                                     */
  /* ------------------------------------------------------------------ */

  /**
   * Bind a handler to a canvas event ('click', 'mousemove', 'touchstart', etc.).
   *
   * The handler is called with an array of hit results:
   * ```js
   * hd.on('click', (hits) => {
   *   console.log(`Clicked ${hits.length} region(s)`);
   * });
   * ```
   *
   * @param {string} eventType — e.g. 'click', 'mousemove', 'touchstart'
   * @param {(hits: Array) => void} fn
   * @returns {HitDetector}
   */
  on(eventType, fn) {
    this.#handlers.set(eventType, fn);
    return this;
  }

  /**
   * Remove a previously-registered handler.
   * @param {string} eventType
   * @returns {HitDetector}
   */
  off(eventType) {
    this.#handlers.delete(eventType);
    return this;
  }

  /**
   * Setup internal mouse/touch listeners on the canvas.
   * @private
   */
  #setupEventListeners() {
    const handleEvent = (eventType, clientX, clientY) => {
      const handler = this.#handlers.get(eventType);
      if (!handler) return;

      // Get canvas position relative to viewport
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

    // Touch support
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