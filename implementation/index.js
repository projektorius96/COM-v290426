// === WRAPPER-DEFINED IMPORTS ===
import { ResponsiveCanvas } from '../src/responsive-canvas.js';

// === USER-DEFINED IMPORTS ===
import Views from './views/index.js';

export class Stage {

    static init({ container }) {

        // Canvas host
        const stage = document.createElement('div');
        container.appendChild(stage);

        // // Clear previous canvases (layers)
        // stage.innerHTML = '';

        Object.assign(stage, { on: this.on.bind(null, stage) })

        // DEV_NOTE # we must return "this" (stage) in order to chain calls in a row, e.g. init().on().etc() without a need of variable reference.
        return stage;

    }

    static on(stage, callback) {

        callback({ stage });

    }

}
