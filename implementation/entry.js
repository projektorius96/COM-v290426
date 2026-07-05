import { setRange, degToRad, PRINT } from './utils.js';
import userConfig from './user-config.json' with {type: 'json'};
import App from './app.js';
import Views from './views/index.js';

export default function ({Layer, HitDetector}) {

const { ID, COLOR } = PRINT;

App
.init({
    container: document.getElementById(ID.app)
})
.on(({ stage }) => {

    // Line layer
    const lineLayer = new Layer({ stage, gridConfig: userConfig.grid });
    const lineDetector = new HitDetector(lineLayer.canvas);

    /**
     * Build a Path2D that mirrors exactly what Line.draw renders for the current grid.
     * Each spoke goes from (0,0) to (GRIDCELL_DIM·cos θ, GRIDCELL_DIM·sin θ).
     * The path is defined in local (center-translated) space; the DOMMatrix carries
     * the translate(centerX, centerY) that maps it to canvas/physical-pixel space.
     */
    function buildLinePath(grid) {
        const { centerX, centerY, GRIDCELL_DIM } = grid;
        const path = new Path2D();
        setRange(0, 1, 90 * 4).forEach((coord) => {
            path.moveTo(0, 0);
            path.lineTo(
                GRIDCELL_DIM * Math.cos(degToRad(coord)),
                GRIDCELL_DIM * Math.sin(degToRad(coord))
            );
        });
        return { path, matrix: new DOMMatrix().translateSelf(centerX, centerY) };
    }

    /**
     * Re-register the hit region after every repaint so the Path2D and transform
     * always reflect the current grid dimensions (updated on resize).
     */
    function syncHitRegion(grid) {
        const { path, matrix } = buildLinePath(grid);
        lineDetector.register(
            'line-hitbox',
            { type: 'stroke', path },
            matrix,
            { lineWidth: 4, lineCap: 'round', lineJoin: 'round' }
        );
    }

    let isClicked = false;

    function drawLine(color) {
        Views.Line.draw({
            container: lineLayer,
            options: {
                points: [...setRange(0, 1, 90 * 4).map((coord) => (coord = { x: coord, y: coord }))],
                color,
                lineWidth: 4
            },
            // Called at the end of every render (initial + every resize repaint)
            onAfterRender: (ctx, grid) => syncHitRegion(grid)
        });
    }

    drawLine(COLOR.green);

    lineDetector.on('click', (hits) => {
        if (hits.length === 0) return; // click missed all registered stroke shapes

        isClicked = !isClicked;

        const { width, height } = lineLayer.canvas;
            lineLayer.ctx.resetTransform();
            lineLayer.ctx.clearRect(0, 0, width, height);
            
            drawLine( isClicked ? COLOR.magenta : COLOR.green );
    });

});
    
}