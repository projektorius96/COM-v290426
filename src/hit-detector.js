/**
 * @module HitDetector
 * @description Ultra-efficient spatial hit detection for canvas entities.
 *
 * {@link HitDetector} provides fast point-in-region testing with support for:
 *   - Axis-aligned bounding boxes (AABB)
 *   - Filled path geometries via `isPointInPath`
 *   - Stroked path geometries via a **GPU-style color-pick buffer** (OffscreenCanvas)
 *   - Fully transformed geometries (rotation, scale, skew) via DOMMatrix
 *
 * Features:
 *   - **Viewport-aware**: Automatically accounts for visual viewport scale/offset (mobile pinch-zoom)
 *   - **Canvas-aware**: Auto-detects canvas ID from ResponsiveCanvas instances
 *   - **Hierarchical events**: Handlers fire in registration order (back-to-front)
 *   - **Chainable API**: All registration methods return `this` for method chaining
 *   - **Per-shape stroke discrimination**: Each stroke region receives a unique FNV-1a-derived
 *     pick color. An off-screen pick canvas renders every stroke in its unique color; a
 *     pointer-event pixel sample resolves the hit to an exact shape ID in O(1) — regardless
 *     of how many stroked shapes share the same display canvas.
 *
 * ### Stroke hit-detection internals
 *
 * When `register()` is called with `{ type: 'stroke' }`:
 * 1. The region ID is hashed with FNV-1a to produce a deterministic 24-bit pick color.
 * 2. Collisions (two IDs mapping to the same color) are resolved by linear probing.
 * 3. An off-screen **pick canvas** (same physical dimensions as the main canvas) is
 *    lazily rebuilt: each stroke region is painted with its unique flat color and the
 *    same stroke properties (`lineWidth`, `lineCap`, etc.) that are used for display.
 * 4. On every `hitTest`, the pick canvas is sampled at the pointer's physical-pixel
 *    coordinate. The RGB value is looked up in a reverse `colorKey → id` map, returning
 *    the exact shape that was hit — or `null` for a miss.
 * 5. Hit results for stroke regions include a `colorKey` field (`"r,g,b"`) for
 *    transparency / debugging.
 *
 * | Method                          | Returns  | Description                                    |
 * |---------------------------------|----------|------------------------------------------------|
 * | `register(id, region, matrix, strokeOpts)` | HitDetector | Add or update a hittable region       |
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
 * // Stroked shape with color-pick hit detection — works per shape, even with many on one canvas!
 * const linePath = new Path2D();
 * linePath.moveTo(0, 0);
 * linePath.lineTo(100, 100);
 * hd.register('line-1', { type: 'stroke', path: linePath },
 *   new DOMMatrix().translateSelf(centerX, centerY),
 *   { lineWidth: 4, lineCap: 'round', lineJoin: 'round' }
 * );
 *
 * // Event handling — stroke hits include `colorKey` for the assigned pick color
 * hd.on('click', (hits) => {
 *   hits.forEach(hit => {
 *     console.log(`Clicked: ${hit.id} (canvas: ${hit.canvasId}, pickColor: ${hit.colorKey ?? 'n/a'})`);
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
  /** @type {Map<string, { region: object, matrix: DOMMatrix|null, invMatrix: DOMMatrix|null, strokeOpts: object }>} */
  #index = new Map();
  /** @type {Map<string, Function>} */
  #handlers = new Map();

  // ── Color-pick buffer (stroke hit detection) ──────────────────────────
  /** @type {OffscreenCanvas|HTMLCanvasElement|null} */
  #pickCanvas = null;
  /** @type {OffscreenCanvasRenderingContext2D|CanvasRenderingContext2D|null} */
  #pickCtx = null;
  /** @type {Map<string, string>} colorKey('r,g,b') → shape id */
  #colorToId = new Map();
  /** @type {Map<string, [number,number,number]>} shape id → [r, g, b] */
  #idToColor = new Map();
  /** @type {boolean} true when any stroke region changed since last pick-canvas build */
  #pickDirty = false;
  /** @type {number} number of currently registered stroke-type regions */
  #strokeCount = 0;

  /**
   * @param {HTMLCanvasElement} canvas — canvas to attach to (typically from ResponsiveCanvas)
   * @param {object} [options]
   * @param {string|number} [options.canvasId] — override canvas ID (auto-detected from canvas.__canvasId if not provided)
   */
  constructor(canvas, { canvasId } = {}) {
    this.#canvas = canvas;
    this.#ctx = canvas.getContext('2d');
    this.#canvasId = canvasId !== undefined ? canvasId : canvas.__canvasId || null;

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

  /* ================================================================== */
  /*  Registration                                                      */
  /* ================================================================== */

  /**
   * Register a hittable region with optional transformation and stroke options.
   *
   * **Region types:**
   * - `{ type: 'box', x, y, w, h }` — axis-aligned rectangle
   * - `{ type: 'path', path: Path2D }` — filled geometry (isPointInPath)
   * - `{ type: 'stroke', path: Path2D }` — stroked geometry (isPointInStroke)
   *
   * If a `matrix` is provided, the point is transformed to local space before testing.
   *
   * For stroke regions, provide `strokeOpts` matching the drawn stroke state:
   * - `lineWidth` — stroke width (MUST match the drawn width!)
   * - `lineCap` — 'butt' | 'round' | 'square'
   * - `lineJoin` — 'bevel' | 'round' | 'miter'
   * - `miterLimit` — miter length limit
   * - `lineDash` — array of dash/gap lengths
   * - `lineDashOffset` — offset into the dash pattern
   *
   * @param {string} id — unique identifier
   * @param {object} region — region descriptor
   * @param {DOMMatrix} [matrix] — optional transform matrix
   * @param {object} [strokeOpts] — optional stroke options for 'stroke' regions
   * @returns {HitDetector} — for method chaining
   *
   * @example
   * ```js
   * // Stroked path with matching stroke properties
   * const linePath = new Path2D();
   * linePath.moveTo(0, 0);
   * linePath.lineTo(100, 100);
   * hd.register('my-line', { type: 'stroke', path: linePath }, null, {
   *   lineWidth: 4,
   *   lineCap: 'round',
   *   lineJoin: 'round'
   * });
   * ```
   */
  register(id, region, matrix = null, strokeOpts = {}) {
    const prev = this.#index.get(id);
    const wasStroke = prev?.region?.type === 'stroke';
    const invMatrix = matrix ? invertMatrix(matrix) : null;
    this.#index.set(id, { region, matrix, invMatrix, strokeOpts });

    if (region.type === 'stroke') {
      this.#assignUniqueColor(id);
      if (!wasStroke) this.#strokeCount++;
      this.#pickDirty = true;
    } else if (wasStroke) {
      // Region type changed away from stroke — release its pick color
      this.#releaseColor(id);
      this.#strokeCount = Math.max(0, this.#strokeCount - 1);
      this.#pickDirty = this.#strokeCount > 0;
    }

    return this;
  }

  /**
   * Unregister a region by ID.
   * @param {string} id
   * @returns {HitDetector}
   */
  unregister(id) {
    const entry = this.#index.get(id);
    if (entry?.region?.type === 'stroke') {
      this.#releaseColor(id);
      this.#strokeCount = Math.max(0, this.#strokeCount - 1);
      this.#pickDirty = true;
    }
    this.#index.delete(id);
    return this;
  }

  /**
   * Clear all registered regions.
   * @returns {HitDetector}
   */
  clear() {
    this.#index.clear();
    this.#colorToId.clear();
    this.#idToColor.clear();
    this.#strokeCount = 0;
    this.#pickDirty = false;
    if (this.#pickCtx) {
      this.#pickCtx.clearRect(0, 0, this.#pickCanvas.width, this.#pickCanvas.height);
    }
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

    // Color-pick: O(1) per-shape stroke discrimination
    const strokeHitId = this.#strokeCount > 0
      ? this.#samplePickCanvas(adjustedX, adjustedY)
      : null;

    for (const [id, { region, matrix, invMatrix, strokeOpts }] of this.#index) {
      if (region.type === 'stroke') {
        if (strokeHitId === id) {
          const [r, g, b] = this.#idToColor.get(id);
          hits.push({ id, region, matrix, canvasId: this.#canvasId, colorKey: `${r},${g},${b}` });
        }
        continue;
      }

      let localX = adjustedX;
      let localY = adjustedY;

      if (invMatrix) {
        const p = new DOMPoint(adjustedX, adjustedY);
        const transformed = p.matrixTransform(invMatrix);
        localX = transformed.x;
        localY = transformed.y;
      }

      if (this.#testRegion(region, localX, localY, strokeOpts)) {
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
   * Stroke regions are handled via the color-pick buffer; this method covers box/path only.
   * @private
   */
  #testRegion(region, px, py, strokeOpts = {}) {
    if (region.type === 'box') {
      return pointInBox(px, py, region.x, region.y, region.w, region.h);
    } else if (region.type === 'path') {
      return this.#ctx.isPointInPath(region.path, px, py);
    }
    return false;
  }

  /* ================================================================== */
  /*  Color-pick buffer (stroke hit detection)                          */
  /* ================================================================== */

  /**
   * Compute a deterministic 24-bit base color for an ID string using FNV-1a hashing.
   * @param {string} id
   * @returns {[number, number, number]} — [r, g, b], each 0–255
   * @private
   */
  #fnv1aColor(id) {
    let hash = 0x811c9dc5;
    for (let i = 0; i < id.length; i++) {
      hash ^= id.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return [(hash >>> 16) & 0xff, (hash >>> 8) & 0xff, hash & 0xff];
  }

  /**
   * Assign a guaranteed-unique pick color to a stroke region ID.
   * Resolves hash collisions by linear probing in 24-bit color space.
   * @param {string} id
   * @returns {[number, number, number]}
   * @private
   */
  #assignUniqueColor(id) {
    if (this.#idToColor.has(id)) return this.#idToColor.get(id);

    let [r, g, b] = this.#fnv1aColor(id);
    // Reserve (0,0,0) — transparent background sentinel
    if (r === 0 && g === 0 && b === 0) r = 1;

    // Linear probe to resolve collisions
    let packed = (r << 16) | (g << 8) | b;
    let key = `${r},${g},${b}`;
    while (this.#colorToId.has(key) && this.#colorToId.get(key) !== id) {
      packed = (packed + 1) & 0xffffff;
      if (packed === 0) packed = 1; // keep clear of black
      r = (packed >>> 16) & 0xff;
      g = (packed >>> 8) & 0xff;
      b = packed & 0xff;
      key = `${r},${g},${b}`;
    }

    const color = [r, g, b];
    this.#idToColor.set(id, color);
    this.#colorToId.set(key, id);
    return color;
  }

  /**
   * Release the pick color assigned to an ID.
   * @param {string} id
   * @private
   */
  #releaseColor(id) {
    const color = this.#idToColor.get(id);
    if (!color) return;
    this.#colorToId.delete(`${color[0]},${color[1]},${color[2]}`);
    this.#idToColor.delete(id);
  }

  /**
   * Create or resize the off-screen pick canvas to match the main canvas dimensions.
   * Returns true if the canvas had to be (re)created.
   * @private
   */
  #ensurePickCanvas() {
    const w = this.#canvas.width;
    const h = this.#canvas.height;
    if (!this.#pickCanvas || this.#pickCanvas.width !== w || this.#pickCanvas.height !== h) {
      this.#pickCanvas = (typeof OffscreenCanvas !== 'undefined')
        ? new OffscreenCanvas(w, h)
        : Object.assign(document.createElement('canvas'), { width: w, height: h });
      this.#pickCtx = this.#pickCanvas.getContext('2d');
      return true;
    }
    return false;
  }

  /**
   * (Re)paint every stroke region onto the pick canvas using its unique flat pick color.
   * The stroke properties and forward transform matrix mirror the display rendering exactly.
   * @private
   */
  #rebuildPickCanvas() {
    const created = this.#ensurePickCanvas();
    if (!created) {
      this.#pickCtx.clearRect(0, 0, this.#pickCanvas.width, this.#pickCanvas.height);
    }

    for (const [id, { region, matrix, strokeOpts }] of this.#index) {
      if (region.type !== 'stroke') continue;

      const [r, g, b] = this.#idToColor.get(id);

      this.#pickCtx.save();
      // Apply the same forward transform used when drawing the shape
      if (matrix) {
        this.#pickCtx.setTransform(matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f);
      } else {
        this.#pickCtx.setTransform(1, 0, 0, 1, 0, 0);
      }

      this.#pickCtx.strokeStyle = `rgb(${r},${g},${b})`;
      if (strokeOpts.lineWidth !== undefined)    this.#pickCtx.lineWidth      = strokeOpts.lineWidth;
      if (strokeOpts.lineCap !== undefined)      this.#pickCtx.lineCap        = strokeOpts.lineCap;
      if (strokeOpts.lineJoin !== undefined)     this.#pickCtx.lineJoin       = strokeOpts.lineJoin;
      if (strokeOpts.miterLimit !== undefined)   this.#pickCtx.miterLimit     = strokeOpts.miterLimit;
      if (strokeOpts.lineDash !== undefined)     this.#pickCtx.setLineDash(strokeOpts.lineDash);
      if (strokeOpts.lineDashOffset !== undefined) this.#pickCtx.lineDashOffset = strokeOpts.lineDashOffset;

      this.#pickCtx.stroke(region.path);
      this.#pickCtx.restore();
    }

    this.#pickDirty = false;
  }

  /**
   * Sample the pick canvas at the given CSS-pixel coordinates.
   * Converts to physical pixels using the device pixel ratio, then reads the RGBA value.
   * @param {number} cssX — pointer x in CSS pixels (already zoom-adjusted)
   * @param {number} cssY — pointer y in CSS pixels (already zoom-adjusted)
   * @returns {string|null} — matched shape ID, or null for a miss
   * @private
   */
  #samplePickCanvas(cssX, cssY) {
    const w = this.#canvas.width;
    const h = this.#canvas.height;

    // Rebuild pick canvas if dirty or if the main canvas was resized
    if (this.#pickDirty || !this.#pickCanvas
        || this.#pickCanvas.width !== w || this.#pickCanvas.height !== h) {
      this.#rebuildPickCanvas();
    }

    // CSS pixel → physical pixel
    const dpr = window.devicePixelRatio || 1;
    const px = Math.round(cssX * dpr);
    const py = Math.round(cssY * dpr);

    if (px < 0 || py < 0 || px >= w || py >= h) return null;

    const pixel = this.#pickCtx.getImageData(px, py, 1, 1).data;
    if (pixel[3] === 0) return null; // fully transparent → no stroke at this point

    return this.#colorToId.get(`${pixel[0]},${pixel[1]},${pixel[2]}`) ?? null;
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
