/**
 * @module TransformNode
 * @description User-friendly affine transformation API inspired by Konva.js.
 *
 * Each {@link TransformNode} wraps a drawing routine and exposes chainable
 * setters for the standard 2-D affine transformations:
 *
 * | Method            | Description                                            |
 * |-------------------|--------------------------------------------------------|
 * | `.x(px)`          | Translate along the X axis                             |
 * | `.y(px)`          | Translate along the Y axis                             |
 * | `.rotation(deg)`  | Rotate around the node's position (degrees)            |
 * | `.skewX(deg)`     | Horizontal skew (degrees)                              |
 * | `.skewY(deg)`     | Vertical skew (degrees)                                |
 * | `.scaleX(factor)` | Horizontal scale (use `-1` for X-axis reflection)      |
 * | `.scaleY(factor)` | Vertical scale (use `-1` for Y-axis reflection)        |
 * | `.reflectX()`     | Reflect across the Y axis (`scaleX(-1)`)               |
 * | `.reflectY()`     | Reflect across the X axis (`scaleY(-1)`)               |
 * | `.reflectOrigin()`| Point-reflect through the origin                       |
 * | `.offset({x,y})`  | Set transform origin offset (before rotation/scale)    |
 *
 * Transformations are applied in the standard order:
 *   **translate → rotate → skew → scale**
 *
 * @example
 * ```js
 * import { TransformNode } from './transform-node.js';
 *
 * const rect = new TransformNode(ctx, (ctx) => {
 *   ctx.fillStyle = 'steelblue';
 *   ctx.fillRect(-50, -25, 100, 50);
 * });
 *
 * rect
 *   .x(200).y(150)
 *   .rotation(45)
 *   .render();
 * ```
 */

/** Convert degrees → radians */
function degToRad(deg) {
  return (deg * Math.PI) / 180;
}

export class TransformNode {
  /** @type {CanvasRenderingContext2D} */
  #ctx;
  /** @type {(ctx: CanvasRenderingContext2D) => void} */
  #drawFn;

  // Transform state (all values are "user units", degrees where noted)
  #translateX = 0;
  #translateY = 0;
  #rotationDeg = 0;
  #skewXDeg = 0;
  #skewYDeg = 0;
  #scaleXVal = 1;
  #scaleYVal = 1;
  #offsetX = 0;
  #offsetY = 0;

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {(ctx: CanvasRenderingContext2D) => void} drawFn — drawing commands
   */
  constructor(ctx, drawFn) {
    this.#ctx = ctx;
    this.#drawFn = drawFn;
  }

  /* ------------------------------------------------------------------ */
  /*  Chainable setters                                                  */
  /* ------------------------------------------------------------------ */

  /**
   * Set or get the X translation.
   * @param {number} [val]
   * @returns {TransformNode|number}
   */
  x(val) {
    if (val === undefined) return this.#translateX;
    this.#translateX = val;
    return this;
  }

  /**
   * Set or get the Y translation.
   * @param {number} [val]
   * @returns {TransformNode|number}
   */
  y(val) {
    if (val === undefined) return this.#translateY;
    this.#translateY = val;
    return this;
  }

  /**
   * Set or get rotation in degrees.
   * @param {number} [deg]
   * @returns {TransformNode|number}
   */
  rotation(deg) {
    if (deg === undefined) return this.#rotationDeg;
    this.#rotationDeg = deg;
    return this;
  }

  /**
   * Set or get horizontal skew in degrees.
   * @param {number} [deg]
   * @returns {TransformNode|number}
   */
  skewX(deg) {
    if (deg === undefined) return this.#skewXDeg;
    this.#skewXDeg = deg;
    return this;
  }

  /**
   * Set or get vertical skew in degrees.
   * @param {number} [deg]
   * @returns {TransformNode|number}
   */
  skewY(deg) {
    if (deg === undefined) return this.#skewYDeg;
    this.#skewYDeg = deg;
    return this;
  }

  /**
   * Set or get horizontal scale factor.
   * @param {number} [val]
   * @returns {TransformNode|number}
   */
  scaleX(val) {
    if (val === undefined) return this.#scaleXVal;
    this.#scaleXVal = val;
    return this;
  }

  /**
   * Set or get vertical scale factor.
   * @param {number} [val]
   * @returns {TransformNode|number}
   */
  scaleY(val) {
    if (val === undefined) return this.#scaleYVal;
    this.#scaleYVal = val;
    return this;
  }

  /**
   * Shorthand: reflect across the Y axis (mirror horizontally).
   * @returns {TransformNode}
   */
  reflectX() {
    this.#scaleXVal = -1;
    return this;
  }

  /**
   * Shorthand: reflect across the X axis (mirror vertically).
   * @returns {TransformNode}
   */
  reflectY() {
    this.#scaleYVal = -1;
    return this;
  }

  /**
   * Shorthand: point-reflect through the origin (rotate 180°).
   * @returns {TransformNode}
   */
  reflectOrigin() {
    this.#scaleXVal = -1;
    this.#scaleYVal = -1;
    return this;
  }

  /**
   * Set the transform-origin offset (applied before rotation & scale).
   * @param {{ x?: number, y?: number }} offset
   * @returns {TransformNode}
   */
  offset({ x = 0, y = 0 } = {}) {
    this.#offsetX = x;
    this.#offsetY = y;
    return this;
  }

  /* ------------------------------------------------------------------ */
  /*  Rendering                                                          */
  /* ------------------------------------------------------------------ */

  /**
   * Build the composite DOMMatrix for the current transform state.
   *
   * Order: translate → offset → rotate → skew → scale → un-offset
   *
   * @returns {DOMMatrix}
   */
  getMatrix() {
    const m = new DOMMatrix();

    // 1. Translate to position
    m.translateSelf(this.#translateX, this.#translateY);

    // 2. Move to transform-origin
    m.translateSelf(this.#offsetX, this.#offsetY);

    // 3. Rotate
    m.rotateSelf(this.#rotationDeg);

    // 4. Skew
    m.skewXSelf(this.#skewXDeg);
    m.skewYSelf(this.#skewYDeg);

    // 5. Scale (also used for reflections)
    m.scaleSelf(this.#scaleXVal, this.#scaleYVal);

    // 6. Move back from transform-origin
    m.translateSelf(-this.#offsetX, -this.#offsetY);

    return m;
  }

  /**
   * Render the node: saves context → applies transforms → calls drawFn → restores.
   * @returns {TransformNode}
   */
  render() {
    const ctx = this.#ctx;
    const matrix = this.getMatrix();

    ctx.save();
    ctx.transform(matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f);
    this.#drawFn(ctx);
    ctx.restore();

    return this;
  }

  /**
   * Reset all transform properties to their defaults.
   * @returns {TransformNode}
   */
  reset() {
    this.#translateX = 0;
    this.#translateY = 0;
    this.#rotationDeg = 0;
    this.#skewXDeg = 0;
    this.#skewYDeg = 0;
    this.#scaleXVal = 1;
    this.#scaleYVal = 1;
    this.#offsetX = 0;
    this.#offsetY = 0;
    return this;
  }
}
