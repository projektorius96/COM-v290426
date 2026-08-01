/**
 * @module ResponsiveCanvas
 * @description Responsive canvas module inspired by Vekt.js-light's GRIDCELL_DIM pattern.
 *
 * The canvas automatically fills its container, resizes with the viewport,
 * and provides a grid-based coordinate system where all measurements are
 * expressed in GRIDCELL_DIM units — making the entire coordinate system
 * responsive to viewport changes.
 *
 * NEW: Supports visual viewport tracking for mobile pinch-zoom and accurate
 * bounding box calculations across layout and visual coordinate spaces.
 *
 * NEW: Each canvas instance receives an ID for layer identification.
 * By default, that ID is bound globally to `canvas.id`, stored as `canvas.__canvasId`,
 * and also accessible via the `id` getter.
 *
 * NEW: When global binding is enabled, DOM-resolved canvas elements also expose
 * read-only bridge getters (`canvas.grid`, `canvas.ctx`, `canvas.visualViewport`).
 *
 * @example
 * ```js
 * import { ResponsiveCanvas } from './responsive-canvas.js';
 *
 * const rc = new ResponsiveCanvas({
 *   stage: document.getElementById('app'),
 *   gridConfig: { scale: 20 }
 * });
 *
 * console.log(rc.id); // → "layer-1" (auto-generated string ID)
 *
 * rc.onRender((ctx, grid) => {
 *   // grid.GRIDCELL_DIM — responsive unit size in device pixels
 *   // grid.centerX / grid.centerY — center of canvas (in device pixels)
 *   // grid.cols / grid.rows — how many grid cells fit
 *   // grid.visualViewport — visual viewport info (for mobile)
 *   ctx.fillRect(grid.centerX - grid.GRIDCELL_DIM, grid.centerY - grid.GRIDCELL_DIM,
 *                grid.GRIDCELL_DIM * 2, grid.GRIDCELL_DIM * 2);
 * });
 *
 * // Opt out of global DOM ID binding (keeps instance getter + __canvasId only)
 * const localOnly = new ResponsiveCanvas({
 *   stage: document.getElementById('app'),
 *   globalId: false
 * });
 * ```
 */

/**
 * Static counter for auto-incrementing canvas IDs.
 * @private
 */
let canvasIdCounter = 0;
const AUTO_CANVAS_ID_PREFIX = 'layer-';
const allocatedCanvasIds = new Set();

/**
 * Normalize an ID value to a DOM-safe string value.
 * @param {string|number} value
 * @returns {string}
 */
function normalizeCanvasId(value) {
  return String(value);
}

/**
 * Create the next deterministic auto-generated canvas ID.
 * It advances monotonically and skips IDs already present in the current document.
 * @returns {string}
 */
function getNextAutoCanvasId() {
  let candidate = '';
  do {
    canvasIdCounter += 1;
    candidate = `${AUTO_CANVAS_ID_PREFIX}${canvasIdCounter}`;
  } while (allocatedCanvasIds.has(candidate) || document.getElementById(candidate));
  return candidate;
}

/**
 * Ensure an ID is unique for this runtime and optionally in the current document.
 * Reserves and returns the selected ID.
 * @param {string} id
 * @param {object} [options]
 * @param {boolean} [options.checkDom=true]
 * @returns {string}
 */
function reserveUniqueCanvasId(id, { checkDom = true } = {}) {
  const isTaken = (value) => (
    allocatedCanvasIds.has(value) || (checkDom && !!document.getElementById(value))
  );

  if (!isTaken(id)) {
    allocatedCanvasIds.add(id);
    return id;
  }

  let suffix = 2;
  let candidate = `${id}-${suffix}`;
  while (isTaken(candidate)) {
    suffix += 1;
    candidate = `${id}-${suffix}`;
  }

  allocatedCanvasIds.add(candidate);
  return candidate;
}

/**
 * Force a number to the nearest even integer.
 * Prevents sub-pixel rendering artifacts on canvas.
 * @param {number} n
 * @returns {number}
 */
function toEven(n) {
  const rounded = Math.round(n);
  return rounded % 2 === 0 ? rounded : rounded + 1;
}

/**
 * Get the effective viewport dimensions, accounting for visual viewport
 * on mobile devices with pinch-zoom support.
 * @returns {{ width: number, height: number, scale: number, offsetLeft: number, offsetTop: number }}
 */
function getEffectiveViewport() {
  if (window.visualViewport) {
    return {
      width: window.visualViewport.width,
      height: window.visualViewport.height,
      scale: window.visualViewport.scale,
      offsetLeft: window.visualViewport.offsetLeft,
      offsetTop: window.visualViewport.offsetTop,
    };
  }
  // Fallback for browsers without visualViewport support
  return {
    width: window.innerWidth,
    height: window.innerHeight,
    scale: 1,
    offsetLeft: 0,
    offsetTop: 0,
  };
}

export class ResponsiveCanvas {
  /** @type {HTMLCanvasElement} */
  #canvas;
  /** @type {CanvasRenderingContext2D} */
  #ctx;
  /** @type {HTMLElement} */
  #container;
  /** @type {number} */
  #scale;
  /** @type {string} */
  #id;
  /** @type {Function|null} */
  #renderCallback = null;
  /** @type {{ GRIDCELL_DIM: number, centerX: number, centerY: number, cols: number, rows: number, dpr: number, visualViewport: object }} */
  #grid = {};
  /** @type {object|null} */
  #visualViewport = null;
  /** @type {object} */
  #globalGridSnapshot = Object.freeze({});
  /** @type {object|null} */
  #globalVisualViewportSnapshot = null;
  /** @type {object} */
  userConfig = {};

  /**
   * @param {object} options
   * @param {HTMLElement} options.stage — DOM element that will host the canvas
   * @param {string|number} [options.id] — optional custom ID (normalized to string)
   * @param {boolean} [options.globalId=true] — when true, bind ID and bridge getters on canvas element for global DOM access
   * @param {object} [options.gridConfig={}] — grid configuration
   * @param {number} [options.gridConfig.scale=20] — number of grid cells that fit across the width
   * @param {string} [options.gridConfig.color='rgba(128,128,128,0.25)'] — grid line color
   * @param {boolean} [options.gridConfig.dotted=false] — whether grid is dotted
   * @param {number} [options.gridConfig.lineWidth=1] — grid line width
   */
  constructor({ stage: container, id = undefined, globalId = true, gridConfig = {} }) {
    const requestedId = id !== undefined
      ? normalizeCanvasId(id)
      : getNextAutoCanvasId();

    this.#id = reserveUniqueCanvasId(requestedId, { checkDom: globalId });

    this.userConfig = {
      grid: {
        color: gridConfig.color ?? 'rgba(128,128,128,0.25)',
        dotted: gridConfig.dotted ?? false,
        lineWidth: gridConfig.lineWidth ?? 1,
        scale: gridConfig.scale ?? 20,
      },
    };

    this.#container = container;
    this.#scale = this.userConfig.grid.scale;

    this.#canvas = document.createElement('canvas');
    if (globalId) {
      this.#canvas.id = this.#id;
      Object.defineProperties(this.#canvas, {
        grid: {
          configurable: true,
          enumerable: false,
          get: () => this.#globalGridSnapshot,
        },
        ctx: {
          configurable: true,
          enumerable: false,
          get: () => this.#ctx,
        },
        visualViewport: {
          configurable: true,
          enumerable: false,
          get: () => this.#globalVisualViewportSnapshot,
        },
      });
    }
    // Store the same ID on the canvas element itself for HitDetector to access
    this.#canvas.__canvasId = this.#id;

    this.#canvas.style.display = 'block';
    this.#canvas.style.width = '100%';
    this.#canvas.style.height = '100%';
    this.#container.style.overflow = 'hidden';
    this.#container.style.width = '100vw';
    this.#container.style.height = '100vh';
    this.#container.style.margin = '0';
    this.#container.style.padding = '0';
    this.#container.appendChild(this.#canvas);

    this.#ctx = this.#canvas.getContext('2d', {willReadFrequently: true});

    this.#resize();

    // Listen to window resize
    window.addEventListener('resize', () => {
      this.#resize();
      this.#draw();
    });

    // Monitor visual viewport changes (pinch-zoom, mobile viewport)
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', () => {
        this.#handleVisualViewportChange();
      });
      window.visualViewport.addEventListener('scroll', () => {
        this.#handleVisualViewportChange();
      });
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Private helpers                                                    */
  /* ------------------------------------------------------------------ */

  /**
   * Handle visual viewport changes (pinch-zoom, mobile interactions).
   * @private
   */
  #handleVisualViewportChange() {
    this.#resize();
    this.#draw();
  }

  /**
   * Compute canvas dimensions and grid metrics.
   * @private
   */
  #resize() {
    const dpr = window.devicePixelRatio || 1;

    // Get effective viewport (respects visual viewport on mobile)
    const viewport = getEffectiveViewport();
    const cssWidth = viewport.width;
    const cssHeight = viewport.height;

    // Store visual viewport info for public access
    this.#visualViewport = {
      width: viewport.width,
      height: viewport.height,
      scale: viewport.scale,
      offsetLeft: viewport.offsetLeft,
      offsetTop: viewport.offsetTop,
    };

    this.#globalVisualViewportSnapshot = Object.freeze({ ...this.#visualViewport });

    // GRIDCELL_DIM — the fundamental responsive unit (CSS pixels)
    const GRIDCELL_DIM = cssWidth / toEven(this.#scale);

    const cols = Math.ceil(cssWidth / GRIDCELL_DIM);
    const rows = Math.ceil(cssHeight / GRIDCELL_DIM);

    // Set the backing-store size to match physical pixels
    this.#canvas.width = Math.round(cssWidth * dpr);
    this.#canvas.height = Math.round(cssHeight * dpr);

    this.#grid = Object.freeze({
      GRIDCELL_DIM: GRIDCELL_DIM * dpr, // in device-pixels (used for drawing)
      CSS_GRIDCELL_DIM: GRIDCELL_DIM,   // in CSS-pixels (informational)
      centerX: (cols * GRIDCELL_DIM * dpr) / 2,
      centerY: (rows * GRIDCELL_DIM * dpr) / 2,
      cols,
      rows,
      dpr,
      width: this.#canvas.width,
      height: this.#canvas.height,
      visualViewport: this.#globalVisualViewportSnapshot,
    });

    this.#globalGridSnapshot = Object.freeze({
      ...this.#grid,
      visualViewport: this.#globalVisualViewportSnapshot,
    });
  }

  /**
   * Internal render method.
   * @private
   */
  #draw() {
    if (typeof this.#renderCallback === 'function') {
      this.#ctx.clearRect(0, 0, this.#canvas.width, this.#canvas.height);
      this.#renderCallback(this.#ctx, this.#grid);
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Public API                                                        */
  /* ------------------------------------------------------------------ */

  /** The unique (string) ID for this canvas instance. */
  get id() {
    return this.#id;
  }

  /** The current grid metrics (read-only, frozen). */
  get grid() {
    return this.#grid;
  }

  /** The underlying CanvasRenderingContext2D. */
  get ctx() {
    return this.#ctx;
  }

  /** The underlying HTMLCanvasElement. */
  get canvas() {
    return this.#canvas;
  }

  /** Get visual viewport info (null if not supported). */
  get visualViewport() {
    return this.#visualViewport;
  }

  /**
   * Register a render callback that is invoked on every resize and
   * whenever {@link ResponsiveCanvas#render} is called manually.
   *
   * @param {(ctx: CanvasRenderingContext2D, grid: object) => void} callback
   */
  onRender(callback) {
    this.#renderCallback = callback;
    this.#draw(); // first paint
  }

  /** Manually trigger a redraw. */
  render() {
    this.#draw();
  }

  /**
   * Get bounding box of the entire canvas in visual viewport coordinates.
   * Useful for hit detection and layout calculations.
   *
   * @param {object} [options]
   * @param {boolean} [options.includeVisualViewportOffset=true] — include visual viewport scroll offset
   * @returns {{ x: number, y: number, width: number, height: number, scale: number }}
   *
   * @example
   * ```js
   * const bbox = rc.getCanvasBounds();
   * console.log(`Canvas at (${bbox.x}, ${bbox.y}), zoomed to ${bbox.scale}x`);
   * ```
   */
  getCanvasBounds({ includeVisualViewportOffset = true } = {}) {
    const rect = this.#canvas.getBoundingClientRect();
    const viewport = this.#visualViewport || getEffectiveViewport();

    return {
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height,
      scale: viewport.scale,
      viewportOffsetLeft: viewport.offsetLeft,
      viewportOffsetTop: viewport.offsetTop,
    };
  }

  /**
   * Draw a reference grid (useful for debugging / alignment).
   * Uses configuration from gridConfig passed in constructor.
   */
  drawGrid() {
    const ctx = this.#ctx;
    const { GRIDCELL_DIM, width, height, dpr } = this.#grid;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.strokeStyle = this.userConfig.grid.color;
    ctx.lineWidth = this.userConfig.grid.lineWidth * dpr;

    if (this.userConfig.grid.dotted) {
      ctx.setLineDash([2 * dpr, 4 * dpr]);
    }

    for (let x = 0; x <= width; x += GRIDCELL_DIM) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    for (let y = 0; y <= height; y += GRIDCELL_DIM) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    ctx.restore();
  }
}