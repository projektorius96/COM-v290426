import { degToRad } from "../utils.js";

export class Line {

    static draw({container, options = { points: [], color: 'grey', lineWidth: 2 }}) {

        container.onRender((ctx, grid) => {

            // Draw reference grid (optional)
            container.drawGrid();

            // Draw a square using PATH PRIMITIVES (4 lines)
            const { centerX, centerY, GRIDCELL_DIM } = grid;

            // Square dimensions
            const half = GRIDCELL_DIM; // half-side length

            // Define the four corners
            const x1 = centerX - half;
            const y1 = centerY - half;
            const x2 = centerX + half;
            const y2 = centerY - half;
            const x3 = centerX + half;
            const y3 = centerY + half;
            const x4 = centerX - half;
            const y4 = centerY + half;

            // // Draw the square using line paths
            ctx.strokeStyle = options.color;
            ctx.lineWidth = options.lineWidth;

            // Top edge
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();

            // Right edge
            ctx.beginPath();
            ctx.moveTo(x2, y2);
            ctx.lineTo(x3, y3);
            ctx.stroke();

            // Bottom edge
            ctx.beginPath();
            ctx.moveTo(x3, y3);
            ctx.lineTo(x4, y4);
            ctx.stroke();

            // Left edge
            ctx.beginPath();
            ctx.moveTo(x4, y4);
            ctx.lineTo(x1, y1);
            ctx.stroke();

        });

    }

}