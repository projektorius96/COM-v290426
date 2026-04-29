/**
 * @module example-transforms
 * @description Demonstrates all four affine transformations via the TransformNode API.
 *
 * Four side-by-side panels illustrate:
 *   (a) rotation
 *   (b) skewing
 *   (c) reflection
 *   (d) translation
 *
 * Each shape is drawn through the same user-friendly, Konva-inspired API.
 *
 * Usage:
 * ```js
 * import { runTransformsExample } from './example-transforms.js';
 * runTransformsExample(document.getElementById('app'));
 * ```
 */

import { ResponsiveCanvas } from './responsive-canvas.js';
import { TransformNode }    from './transform-node.js';

/**
 * Helper: draw a labelled arrow (unit-vector style) at the origin.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} size
 * @param {string} colour
 */
function drawArrowShape(ctx, size, colour) {
  ctx.fillStyle = colour;
  ctx.strokeStyle = colour;
  ctx.lineWidth = 2;

  // body
  ctx.fillRect(-size / 2, -size / 2, size, size);

  // small direction indicator (arrow-head pointing right)
  ctx.beginPath();
  ctx.moveTo(size / 2, 0);
  ctx.lineTo(size / 2 + size * 0.35, 0);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(size / 2 + size * 0.35, 0);
  ctx.lineTo(size / 2 + size * 0.15, -size * 0.15);
  ctx.lineTo(size / 2 + size * 0.15, size * 0.15);
  ctx.closePath();
  ctx.fill();
}

/**
 * Run the transforms demo inside the given container.
 * @param {HTMLElement} container
 */
export function runTransformsExample(container) {
  const rc = new ResponsiveCanvas(container, { scale: 20 });

  rc.onRender((ctx, grid) => {
    rc.drawGrid({ strokeStyle: 'rgba(0,0,0,0.08)' });

    const unit = grid.GRIDCELL_DIM;
    const dpr  = grid.dpr;
    const cx   = grid.centerX;
    const cy   = grid.centerY;
    const size = unit * 1.5;

    // Column positions — four quadrants
    const colW = grid.width / 4;

    // ------------------------------------------------------------------
    //  (a) Rotation — 0°, 30°, 60°, 90°
    // ------------------------------------------------------------------
    const rotations = [0, 30, 60, 90];
    rotations.forEach((deg, i) => {
      const node = new TransformNode(ctx, (c) => drawArrowShape(c, size, 'steelblue'));
      node
        .x(colW * 0 + colW / 2)
        .y(cy - unit * 3 + i * unit * 2)
        .rotation(deg)
        .render();
    });

    // ------------------------------------------------------------------
    //  (b) Skewing — skewX and skewY showcase
    // ------------------------------------------------------------------
    const skews = [
      { skewXDeg: 0,  skewYDeg: 0  },
      { skewXDeg: 20, skewYDeg: 0  },
      { skewXDeg: 0,  skewYDeg: 20 },
      { skewXDeg: 20, skewYDeg: 20 },
    ];
    skews.forEach((s, i) => {
      const node = new TransformNode(ctx, (c) => drawArrowShape(c, size, 'darkorange'));
      node
        .x(colW * 1 + colW / 2)
        .y(cy - unit * 3 + i * unit * 2)
        .skewX(s.skewXDeg)
        .skewY(s.skewYDeg)
        .render();
    });

    // ------------------------------------------------------------------
    //  (c) Reflection — original, reflectX, reflectY, reflectOrigin
    // ------------------------------------------------------------------
    const reflections = [
      { label: 'original',  fn: (n) => n },
      { label: 'reflectX',  fn: (n) => n.reflectX() },
      { label: 'reflectY',  fn: (n) => n.reflectY() },
      { label: 'reflectXY', fn: (n) => n.reflectOrigin() },
    ];
    reflections.forEach((r, i) => {
      const node = new TransformNode(ctx, (c) => drawArrowShape(c, size, 'seagreen'));
      node.x(colW * 2 + colW / 2).y(cy - unit * 3 + i * unit * 2);
      r.fn(node);
      node.render();
    });

    // ------------------------------------------------------------------
    //  (d) Translation — move a shape to different positions
    // ------------------------------------------------------------------
    const positions = [
      { dx: 0,          dy: -unit * 3 },
      { dx: unit * 1.2, dy: -unit * 1 },
      { dx: -unit * 1.2, dy: unit * 1 },
      { dx: 0,          dy: unit * 3 },
    ];
    positions.forEach((p) => {
      const node = new TransformNode(ctx, (c) => drawArrowShape(c, size, 'mediumpurple'));
      node
        .x(colW * 3 + colW / 2 + p.dx)
        .y(cy + p.dy)
        .render();
    });

    // ------------------------------------------------------------------
    //  Column headers
    // ------------------------------------------------------------------
    ctx.save();
    ctx.fillStyle = '#222';
    ctx.font = `bold ${Math.round(13 * dpr)}px sans-serif`;
    ctx.textAlign = 'center';
    const headerY = unit * 1.5;
    ctx.fillText('(a) Rotation',    colW * 0 + colW / 2, headerY);
    ctx.fillText('(b) Skewing',     colW * 1 + colW / 2, headerY);
    ctx.fillText('(c) Reflection',  colW * 2 + colW / 2, headerY);
    ctx.fillText('(d) Translation', colW * 3 + colW / 2, headerY);
    ctx.restore();
  });
}
