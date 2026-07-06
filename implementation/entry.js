import { setRange, degToRad, PRINT } from './utils.js';
import userConfig from './user-config.json' with {type: 'json'};
import Stage from './stage.js';
import Views from './views/index.js';

/**
 * @implementation
 * @example - This is where you implement your own rendering logic (implementation entry point)
 */
export default function ({Layer, HitDetector}) {

/**
 * @description USEFUL ALIASED (TYPED) PROXY GETTERS each returning a string.
 * @example COLOR.red - will print 'red',  where (typeof 'red' === 'string');
 */
const { OPTIONS, TYPE, ID, COLOR, UI_EVENT } = PRINT;

Stage
.init({
    container: document.getElementById(ID.app)
})
.on(({ stage }) => {

    // Line layer
    const 
        lineLayer = new Layer({ stage, gridConfig: userConfig.grid })
        ,
        lineDetector = new HitDetector(lineLayer.canvas)
        ;

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
            { type: TYPE.stroke, path },
            matrix,
            { lineWidth: 4, lineCap:OPTIONS.round, lineJoin:OPTIONS.round }
        );

    }

    let isClicked = false;

    function drawLine({color}) {

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

    drawLine({color: COLOR.green});

    lineDetector.on(UI_EVENT.click, (hits) => {
        if (hits.length === 0) return; // click missed all registered stroke shapes

        isClicked = !isClicked;
        const { width, height } = lineLayer.canvas;
            lineLayer.ctx.resetTransform();
            lineLayer.ctx.clearRect(0, 0, width, height);
            
            drawLine({ color: (isClicked ? COLOR.magenta : COLOR.green) });
    });

});
    
}