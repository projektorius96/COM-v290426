# Implementation Examples

> All modules live under `implementation/examples/` and use **zero** external
> dependencies beyond Vite (the existing dev-server / bundler).

---

## Modules

| File | Purpose |
|------|---------|
| `responsive-canvas.js` | Responsive canvas powered by a **GRIDCELL_DIM**-based grid (inspired by [Vekt.js-light](https://github.com/projektorius96/Vekt.js-light)) |
| `transform-node.js` | User-friendly affine-transformation API (inspired by [Konva.js](https://github.com/konvajs/konva)) |
| `state-manager.js` | Safe `save()` / `restore()` wrapper with depth tracking |
| `hit-detector.js` | Efficient point-in-region hit detection with transform support |
| `index.js` | Re-exports + interactive demo selector |

---

## 1. Responsive Canvas (`responsive-canvas.js`)

Creates a `<canvas>` that **fills the viewport**, automatically **resizes** with
the window, and exposes a **GRIDCELL_DIM**-based coordinate system so that all
measurements scale uniformly.

```js
import { ResponsiveCanvas } from './responsive-canvas.js';

const rc = new ResponsiveCanvas(document.getElementById('app'), { scale: 20 });

rc.onRender((ctx, grid) => {
  // grid.GRIDCELL_DIM  — responsive unit size (device-pixels)
  // grid.centerX/Y     — canvas centre
  // grid.cols / rows   — how many cells fit on screen
  rc.drawGrid();                               // optional reference grid

  ctx.fillStyle = 'steelblue';
  ctx.fillRect(
    grid.centerX - grid.GRIDCELL_DIM,
    grid.centerY - grid.GRIDCELL_DIM,
    grid.GRIDCELL_DIM * 2,
    grid.GRIDCELL_DIM * 2,
  );
});
```

Key concepts:

* **`scale`** — number of grid columns; `GRIDCELL_DIM = containerWidth / even(scale)`.
* The backing-store is sized for `devicePixelRatio` so text and lines stay sharp
  on HiDPI displays.
* `onRender(callback)` is re-invoked on every `resize` event.

---

## 2. Affine Transformations (`transform-node.js`)

A lightweight, **Konva-style** API for the four standard affine transforms:

| Transform | Method(s) |
|-----------|-----------|
| **Translation** | `.x(px)`, `.y(px)` |
| **Rotation** | `.rotation(degrees)` |
| **Skewing** | `.skewX(degrees)`, `.skewY(degrees)` |
| **Reflection** | `.reflectX()`, `.reflectY()`, `.reflectOrigin()` |
| Scaling | `.scaleX(n)`, `.scaleY(n)` |

All setters are **chainable** and transformations are applied in a fixed order:
**translate → offset → rotate → skew → scale → un-offset**.

### (a) Rotation

```js
import { TransformNode } from './transform-node.js';

const rect = new TransformNode(ctx, (c) => {
  c.fillStyle = 'steelblue';
  c.fillRect(-40, -20, 80, 40);
});

rect.x(200).y(150).rotation(45).render();
```

### (b) Skewing

```js
const skewed = new TransformNode(ctx, (c) => {
  c.fillStyle = 'darkorange';
  c.fillRect(-40, -20, 80, 40);
});

skewed.x(400).y(150).skewX(30).render();
```

### (c) Reflection

```js
const arrow = new TransformNode(ctx, (c) => {
  c.fillStyle = 'seagreen';
  c.fillRect(-40, -20, 80, 40);
  // draw small direction indicator …
});

// Mirror horizontally (across Y-axis)
arrow.x(200).y(300).reflectX().render();

// Mirror vertically (across X-axis)
arrow.x(400).y(300).reflectY().render();

// Point-reflect through origin (180° rotation)
arrow.x(600).y(300).reflectOrigin().render();
```

### (d) Translation

```js
const box = new TransformNode(ctx, (c) => {
  c.fillStyle = 'mediumpurple';
  c.fillRect(-25, -25, 50, 50);
});

box.x(100).y(100).render();   // position 1
box.x(300).y(200).render();   // position 2
```

---

## 3. State Management (`state-manager.js`)

Wraps `CanvasRenderingContext2D.save()` / `.restore()` in a safe, user-friendly
API with automatic depth tracking.

### `withState(fn)` — auto save/restore

```js
import { StateManager } from './state-manager.js';

const sm = new StateManager(ctx);

sm.withState((c) => {
  c.fillStyle = 'red';
  c.globalAlpha = 0.5;
  c.fillRect(0, 0, 100, 100);
});
// fillStyle and globalAlpha are automatically restored here ✓
```

### `withTransform(config, fn)` — transform + draw in one call

```js
sm.withTransform(
  { translateX: 300, translateY: 200, rotation: 45, scaleX: 2 },
  (c) => {
    c.strokeRect(-30, -30, 60, 60);
  },
);
// transform is restored ✓
```

### Nested scopes

```js
sm.withState((c) => {
  c.fillStyle = 'green';
  // sm.depth === 1

  sm.withState((c2) => {
    c2.fillStyle = 'gold';
    // sm.depth === 2
  });
  // sm.depth === 1, back to green
});
// sm.depth === 0
```

### Safety helpers

| API | Description |
|-----|-------------|
| `sm.depth` | Current save-stack depth |
| `sm.restoreAll()` | Pop **all** remaining saves (safety net) |

---

## 4. Hit Detection (`hit-detector.js`)

Provides efficient point-in-region hit detection for interactive canvas
applications. Supports both axis-aligned bounding boxes and arbitrary Path2D
geometries, with full support for transformed (rotated, scaled, skewed) shapes.

### Core API

| Method | Description |
|--------|-------------|
| `register(id, region, matrix)` | Add a hittable region with optional transform |
| `hitTest(x, y)` | Find all regions containing a point |
| `on(event, fn)` | Bind mouse/touch handlers |
| `unregister(id)` | Remove a region |
| `clear()` | Remove all regions |

### (a) Simple bounding box

```js
import { HitDetector } from './hit-detector.js';

const hd = new HitDetector(canvas);

// Register a clickable button
hd.register('btn-play', { type: 'box', x: 50, y: 50, w: 100, h: 40 });

hd.on('click', (hits) => {
  if (hits.some(h => h.id === 'btn-play')) {
    console.log('Play button clicked!');
  }
});
```

### (b) Transformed geometry (rotated square)

```js
// Build a transform matrix
const matrix = new DOMMatrix()
  .translateSelf(200, 150)
  .rotateSelf(45)
  .scaleSelf(2);

// Register with transform
hd.register('rotated-square', {
  type: 'box',
  x: -25,
  y: -25,
  w: 50,
  h: 50
}, matrix);

// Hit tests automatically transform world coordinates to local space
const hits = hd.hitTest(220, 170);
console.log(hits.map(h => h.id)); // → ['rotated-square']
```

### (c) Complex path geometry

```js
// Define a circular region
const circlePath = new Path2D();
circlePath.arc(0, 0, 50, 0, Math.PI * 2);

hd.register('circle-target', {
  type: 'path',
  path: circlePath
});

hd.on('mousemove', (hits) => {
  if (hits.some(h => h.id === 'circle-target')) {
    canvas.style.cursor = 'pointer';
  } else {
    canvas.style.cursor = 'default';
  }
});
```

### Key concepts

* **Registration order matters**: later registrations are "on top" and tested first.
* **Transform support**: Use DOMMatrix to define rotation, scale, skew, translation.
  Hit tests are automatically transformed to local space via matrix inversion.
* **Mouse & touch**: Built-in event listeners for `click`, `mousemove`, `touchstart`,
  `touchmove`, `touchend`, etc.
* **Multi-hit**: `hitTest(x, y)` returns **all** regions at a point, back-to-front.

---

## Running the demos

```bash
npm run dev          # starts Vite dev-server
```

Open the browser — a toolbar at the top lets you switch between the four
example demos:

1. **Responsive Canvas** — GRIDCELL_DIM grid + centred rectangle
2. **Affine Transforms** — four columns showing rotation, skew, reflection, translation
3. **State Management** — nested scopes with depth verification
4. **Hit Detection** — interactive shape selection and hover effects

