/**
 * @module example-state
 * @description Demonstrates the StateManager — safe save/restore wrappers.
 *
 * Three separate drawings are rendered, each inside its own state scope,
 * proving that style / transform changes do not leak between them.
 *
 * Usage:
 * ```js
 * import { runStateExample } from './example-state.js';
 * runStateExample(document.getElementById('app'));
 * ```
 */

import { ResponsiveCanvas } from './responsive-canvas.js';
import { StateManager }     from './state-manager.js';

/**
 * Run the state-management demo inside the given container.
 * @param {HTMLElement} container
 */
export function runStateExample(container) {
  const rc = new ResponsiveCanvas(container, { scale: 20 });

  rc.onRender((ctx, grid) => {
    rc.drawGrid({ strokeStyle: 'rgba(0,0,0,0.06)' });

    const sm   = new StateManager(ctx);
    const unit = grid.GRIDCELL_DIM;
    const dpr  = grid.dpr;
    const cx   = grid.centerX;
    const cy   = grid.centerY;

    // ------------------------------------------------------------------
    //  Example 1 — withState: isolated fill style
    // ------------------------------------------------------------------
    sm.withState((c) => {
      c.fillStyle = 'tomato';
      c.globalAlpha = 0.7;
      c.fillRect(cx - unit * 4, cy - unit * 2, unit * 2, unit * 2);

      // Label
      c.globalAlpha = 1;
      c.fillStyle = '#333';
      c.font = `${Math.round(12 * dpr)}px monospace`;
      c.fillText('withState (red, alpha 0.7)', cx - unit * 4, cy - unit * 2.5);
    });
    // ctx.fillStyle and globalAlpha are restored here ✓

    // ------------------------------------------------------------------
    //  Example 2 — withTransform: translate + rotate inside safe scope
    // ------------------------------------------------------------------
    sm.withTransform(
      { translateX: cx, translateY: cy, rotation: 25, scaleX: 1.5 },
      (c) => {
        c.fillStyle = 'dodgerblue';
        c.fillRect(-unit, -unit * 0.5, unit * 2, unit);
      },
    );
    // transform is restored here ✓

    // ------------------------------------------------------------------
    //  Example 3 — nested withState calls (depth tracking)
    // ------------------------------------------------------------------
    sm.withState((c) => {
      // depth === 1
      c.fillStyle = 'seagreen';
      c.globalAlpha = 0.5;
      c.fillRect(cx + unit * 1, cy - unit * 2, unit * 2, unit * 2);

      sm.withState((c2) => {
        // depth === 2
        c2.fillStyle = 'gold';
        c2.globalAlpha = 1;
        c2.fillRect(cx + unit * 1.5, cy - unit * 1.5, unit, unit);
      });
      // depth back to 1; gold & alpha=1 are gone
      // still seagreen + alpha=0.5 here
      c.fillRect(cx + unit * 3.5, cy - unit * 2, unit * 2, unit * 2);
    });
    // depth === 0

    // ------------------------------------------------------------------
    //  Proof: draw text with DEFAULT style (black, alpha=1) — proves
    //  that no earlier state leaked out.
    // ------------------------------------------------------------------
    ctx.fillStyle = '#222';
    ctx.font = `bold ${Math.round(13 * dpr)}px sans-serif`;
    ctx.fillText(
      `State depth after all scopes: ${sm.depth} (should be 0)`,
      12 * dpr,
      grid.height - 16 * dpr,
    );

    // ------------------------------------------------------------------
    //  Section labels
    // ------------------------------------------------------------------
    ctx.save();
    ctx.fillStyle = '#555';
    ctx.font = `${Math.round(11 * dpr)}px monospace`;
    ctx.fillText('Ex 2: withTransform (translated + rotated + scaled)', cx - unit * 3, cy + unit * 2);
    ctx.fillText('Ex 3: nested withState (green → gold overlay → green again)', cx + unit * 1, cy - unit * 2.5);
    ctx.restore();
  });
}
