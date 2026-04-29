/**
 * @module example-responsive
 * @description Demonstrates the responsive canvas with a GRIDCELL_DIM-based grid.
 *
 * The canvas fills the viewport and redraws automatically on resize.
 * A reference grid is drawn using GRIDCELL_DIM spacing, and a coloured
 * rectangle is placed at the centre of the canvas to prove responsiveness.
 *
 * Usage:
 * ```js
 * import { runResponsiveExample } from './example-responsive.js';
 * runResponsiveExample(document.getElementById('app'));
 * ```
 */

import { ResponsiveCanvas } from './responsive-canvas.js';

/**
 * Run the responsive-canvas demo inside the given container.
 * @param {HTMLElement} container
 */
export function runResponsiveExample(container) {
  // Create a responsive canvas with 20 grid columns (= scale)
  const rc = new ResponsiveCanvas(container, { scale: 20 });

  rc.onRender((ctx, grid) => {
    // 1. Draw the reference grid
    rc.drawGrid({ strokeStyle: 'rgba(100, 100, 100, 0.2)', dotted: false });

    const unit = grid.GRIDCELL_DIM;

    // 2. Centre cross-hair
    ctx.save();
    ctx.strokeStyle = 'crimson';
    ctx.lineWidth = 2 * grid.dpr;
    ctx.beginPath();
    ctx.moveTo(grid.centerX - unit, grid.centerY);
    ctx.lineTo(grid.centerX + unit, grid.centerY);
    ctx.moveTo(grid.centerX, grid.centerY - unit);
    ctx.lineTo(grid.centerX, grid.centerY + unit);
    ctx.stroke();
    ctx.restore();

    // 3. A rectangle whose size is expressed in GRIDCELL_DIM units (2×2 cells)
    ctx.save();
    ctx.fillStyle = 'rgba(70, 130, 180, 0.6)';
    ctx.fillRect(
      grid.centerX - unit,
      grid.centerY - unit,
      unit * 2,
      unit * 2,
    );
    ctx.restore();

    // // 4. Label
    // ctx.save();
    // ctx.fillStyle = '#333';
    // ctx.font = `${Math.round(14 * grid.dpr)}px monospace`;
    // ctx.fillText(
    //   `GRIDCELL_DIM = ${grid.CSS_GRIDCELL_DIM.toFixed(1)} CSS-px  (${grid.cols}×${grid.rows} cells)`,
    //   12 * grid.dpr,
    //   24 * grid.dpr,
    // );
    // ctx.restore();
  });
}
