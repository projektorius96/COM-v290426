import { degToRad, setRange } from "../utils.js";

function normalizePoints(points = []) {
    if (!Array.isArray(points) || points.length === 0) {
        return [];
    }

    if (typeof points[0] === 'object') {
        return points;
    }

    return setRange(...points).map((coord) => ({ x: coord, y: coord }));
}

export class Line {

    static draw({container, options, onAfterRender}) {

        container.onRender((ctx, grid) => {
            const points = normalizePoints(options.points);

            ctx.save();
            ctx.setTransform(1, 0, 0, 1, 0, 0);

            // Draw a square using PATH PRIMITIVES (4 lines)
            const { centerX, centerY, GRIDCELL_DIM } = grid;

            // // Draw the square using line paths
            ctx.strokeStyle = (options.color ?? 'grey');
            ctx.lineWidth =   (options.lineWidth ?? 2);
            
            ctx.opacity = (options.opacity ?? 1);
                ctx.globalAlpha = options.opacity;

            ctx.translate(centerX, centerY);
            if (options.points.length > 0) {
                options.points.forEach(({x, y})=>{
                    const [SCALE_X, SCALE_Y] = (options.scale ?? [1, 1]);
                    ctx.beginPath();
                        ctx.moveTo(0, 0);
                        ctx.lineTo(SCALE_X * GRIDCELL_DIM * Math.cos( degToRad(x) ), SCALE_Y * GRIDCELL_DIM * Math.sin( degToRad(y) ));
                    ctx.stroke();
                })
            }

            ctx.restore();

            if (typeof onAfterRender === 'function') {
                onAfterRender({container, options});
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
    normalizePoints(points).forEach(({ x, y }) => {
        path.moveTo(0, 0);
        path.lineTo(
            GRIDCELL_DIM * Math.cos(degToRad(x)),
            GRIDCELL_DIM * Math.sin(degToRad(y))
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

    if (normalizePoints(points).length === 0) {
        lineDetector.unregister('line-hitbox');
        return;
    }
    
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