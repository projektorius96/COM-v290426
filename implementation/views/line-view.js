import { degToRad } from "../utils.js";

export class Line {

    static draw({container, options = { points: [], color: 'grey', lineWidth: 2 }, onAfterRender}) {

        container.onRender((ctx, grid) => {

            // Draw reference grid (optional)
            container.drawGrid();

            // Draw a square using PATH PRIMITIVES (4 lines)
            const { centerX, centerY, GRIDCELL_DIM } = grid;

            // // Draw the square using line paths
            ctx.strokeStyle = options.color;
            ctx.lineWidth = options.lineWidth;

            ctx.translate(centerX, centerY);
            if (options.points?.length > 0) {
                options.points.forEach(({x, y}, i)=>{
                    ctx.beginPath();
                            ctx.moveTo(0, 0);
                            ctx.lineTo(GRIDCELL_DIM * Math.cos( degToRad(x) ), GRIDCELL_DIM * Math.sin( degToRad(y) ));
                        ctx.stroke();
                })
            }

            if (typeof onAfterRender === 'function') {
                onAfterRender(ctx, grid);
            }

        });

    }

}

/**
 * Build a Path2D that mirrors exactly what Line.draw renders for the current grid.
 * Each spoke goes from (0,0) to (GRIDCELL_DIM·cos θ, GRIDCELL_DIM·sin θ).
 * The path is defined in local (center-translated) space; the DOMMatrix carries
 * the translate(centerX, centerY) that maps it to canvas/physical-pixel space.
 */
function buildLinePath({grid, points, lineWidth, utils}) {
    const { centerX, centerY, GRIDCELL_DIM } = grid;
    const path = new Path2D();
    utils.setRange(...points).forEach((coord) => {
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
function syncHitRegion({grid, points, lineWidth, deps}) {

    const 
        { lineDetector, utils } = deps
        ,
        { PRINT } = utils
        ,
        { TYPE, OPTIONS } = PRINT 
        ;
    
    const { path, matrix } = buildLinePath({grid, points, utils});
    lineDetector.register(
        'line-hitbox',
        { type: TYPE.stroke, path },
        matrix,
        { lineCap:OPTIONS.round, lineJoin:OPTIONS.round, lineWidth }
    );

}

export {
    syncHitRegion
}