/**
 * @module ResponsiveCanvas
 * @description Responsive canvas module inspired by Vekt.js-light's GRIDCELL_DIM pattern.
 *
 * The canvas automatically fills its container, resizes with the viewport,
 * and provides a grid-based coordinate system where all measurements are
 * expressed in GRIDCELL_DIM units — making the entire coordinate system
 * responsive to viewport changes.
 *
 * @example
 * ```js
 * import { ResponsiveCanvas } from './responsive-canvas.js';
 *
 * const rc = new ResponsiveCanvas(document.getElementById('app'), { scale: 20 });
 *
 * rc.onRender((ctx, grid) => {
 *   // grid.GRIDCELL_DIM — responsive unit size in CSS pixels
 *   // grid.centerX / grid.centerY — center of canvas (in device pixels)
 *   // grid.cols / grid.rows — how many grid cells fit
 *   ctx.fillRect(grid.centerX - grid.GRIDCELL_DIM, grid.centerY - grid.GRIDCELL_DIM,
 *                grid.GRIDCELL_DIM * 2, grid.GRIDCELL_DIM * 2);
 * });
 * ```
 */

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

export class ResponsiveCanvas {
  /** @type {HTMLCanvasElement} */
  #canvas;
  /** @type {CanvasRenderingContext2D} */
  #ctx;
  /** @type {HTMLElement} */
  #container;
  /** @type {number} */
  #scale;
  /** @type {Function|null} */
  #renderCallback = null;
  /** @type {{ GRIDCELL_DIM: number, centerX: number, centerY: number, cols: number, rows: number, dpr: number }} */
  #grid = {};

  /**
   * @param {HTMLElement} container — DOM element that will host the canvas
   * @param {object}  [options]
   * @param {number}  [options.scale=20] — number of grid cells that fit across the width
   */
  constructor(container, { scale = 20 } = {}) {
    this.#container = container;
    this.#scale = scale;

    this.#canvas = document.createElement('canvas');
    this.#canvas.style.display = 'block';
    this.#canvas.style.width = '100%';
    this.#canvas.style.height = '100%';
    this.#container.style.overflow = 'hidden';
    this.#container.style.width = '100vw';
    this.#container.style.height = '100vh';
    this.#container.style.margin = '0';
    this.#container.style.padding = '0';
    this.#container.appendChild(this.#canvas);

    this.#ctx = this.#canvas.getContext('2d');

    this.#resize();

    window.addEventListener('resize', () => {
      this.#resize();
      this.#draw();
    });
  }

  /* ------------------------------------------------------------------ */
  /*  Private helpers                                                    */
  /* ------------------------------------------------------------------ */

  #resize() {
    const dpr = window.devicePixelRatio || 1;
    const cssWidth = this.#container.clientWidth;
    const cssHeight = this.#container.clientHeight;

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
    });
  }

  #draw() {
    if (typeof this.#renderCallback === 'function') {
      this.#ctx.clearRect(0, 0, this.#canvas.width, this.#canvas.height);
      this.#renderCallback(this.#ctx, this.#grid);
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Public API                                                        */
  /* ------------------------------------------------------------------ */

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
   * Draw a reference grid (useful for debugging / alignment).
   *
   * @param {object}  [options]
   * @param {string}  [options.strokeStyle='rgba(128,128,128,0.25)']
   * @param {boolean} [options.dotted=false]
   * @param {number}  [options.lineWidth=1]
   */
  drawGrid({ strokeStyle = 'rgba(128,128,128,0.25)', dotted = false, lineWidth = 1 } = {}) {
    const ctx = this.#ctx;
    const { GRIDCELL_DIM, width, height, dpr } = this.#grid;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth * dpr;

    if (dotted) {
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
