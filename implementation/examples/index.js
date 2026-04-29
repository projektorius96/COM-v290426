/**
 * @module examples/index
 * @description Entry point for all implementation examples.
 *
 * Import one of the example runners and call it with a container element:
 *
 * ```js
 * import { runResponsiveExample } from './example-responsive.js';
 * import { runTransformsExample } from './example-transforms.js';
 * import { runStateExample }      from './example-state.js';
 * import { runHitExample }        from './example-hit.js';
 * ```
 *
 * This file wires up a simple demo selector so all four can be
 * previewed in the browser via `npm run dev`.
 */

import { runResponsiveExample } from './example-responsive.js';
import { runTransformsExample } from './example-transforms.js';
import { runStateExample }      from './example-state.js';

// Re-export modules for external consumers
export { ResponsiveCanvas } from './responsive-canvas.js';
export { TransformNode }    from './transform-node.js';
export { StateManager }     from './state-manager.js';
export { HitDetector }      from './hit-detector.js';

/* -------------------------------------------------------------------- */
/*  Demo selector UI                                                     */
/* -------------------------------------------------------------------- */

const demos = {
  responsive: { label: '1 — Responsive Canvas (GRIDCELL_DIM)', run: runResponsiveExample },
  transforms: { label: '2 — Affine Transforms (Rotation, Skew, Reflect, Translate)', run: runTransformsExample },
  state:      { label: '3 — State Management (save / restore)', run: runStateExample },
};

/**
 * Boot the demo selector.
 * Call from the app entry point:
 * ```js
 * import { bootExamples } from '../implementation/examples/index.js';
 * bootExamples(document.getElementById('app'));
 * ```
 * @param {HTMLElement} root
 */
export function bootExamples({root, entry = 'responsive' /** @see "demos.responsive" */}) {
  // // Toolbar
  // const toolbar = document.createElement('nav');
  // Object.assign(toolbar.style, {
  //   position: 'fixed',
  //   top: '0',
  //   left: '0',
  //   right: '0',
  //   zIndex: '9999',
  //   display: 'flex',
  //   gap: '8px',
  //   padding: '8px 12px',
  //   background: 'rgba(255,255,255,0.92)',
  //   borderBottom: '1px solid #ddd',
  //   fontFamily: 'system-ui, sans-serif',
  //   fontSize: '13px',
  // });

  // Canvas host
  const canvasHost = document.createElement('div');
  // DEV_NOTE: see <root>/src/style.css
  // Object.assign(canvasHost.style, {
  //   position: 'absolute',
  //   top: '0',
  //   left: '0',
  //   width: '100vw',
  //   height: '100vh',
  // });

  root.appendChild(canvasHost);
  // root.appendChild(toolbar);

  // Object.entries(demos).forEach(([key, { label }]) => {
  //   const btn = document.createElement('button');
  //   btn.textContent = label;
  //   btn.dataset.key = key;
  //   Object.assign(btn.style, {
  //     cursor: 'pointer',
  //     border: '1px solid #aaa',
  //     borderRadius: '4px',
  //     padding: '4px 10px',
  //     background: '#f5f5f5',
  //   });
  //   btn.addEventListener('click', () => activate(key));
  //   toolbar.appendChild(btn);
  // });

  // Default to responsive demo
  activate({canvasHost, key: entry});
}

function activate({canvasHost, key}) {
  // Clear previous canvas
  canvasHost.innerHTML = '';
  demos[key].run(canvasHost);

  // // Highlight active button
  // toolbar.querySelectorAll('button').forEach((btn) => {
  //   btn.style.fontWeight = btn.dataset.key === key ? 'bold' : 'normal';
  //   btn.style.textDecoration = btn.dataset.key === key ? 'underline' : 'none';
  // });
}
