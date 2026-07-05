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