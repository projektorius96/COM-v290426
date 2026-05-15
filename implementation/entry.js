import { setRange, PRINT } from './utils.js';
import userConfig from './user-config.json' with {type: 'json'};
import App from './app.js';
import Views from './views/index.js';

export default function ({Layer, HitDetector}) {

App
.init({
    container: document.getElementById(ID.app)
})
.on(({ stage }) => {

    // Create the first layer (Square)
    const squareLayer = new Layer({ stage, gridConfig: userConfig.grid });
    Views.Square.draw({
        container: squareLayer
    });
    
    // Create HitDetector for the square layer
    const squareDetector = new HitDetector(squareLayer.canvas);
    
    // Register a hit region for the square (adjust x, y, w, h to match your square)
    squareDetector.register('square-hitbox', {
        type: 'box',
        x: 0,
        y: 0,
        w: 200,
        h: 200
    });
    
    // Add click handler
    squareDetector.on('click', (hits) => {
        console.log('Square clicked:', hits);
        hits.forEach(hit => {
            console.log(`  - ${hit.id} (canvas: ${hit.canvasId})`);
        });
    });
    
    // Add mousemove handler for debugging
    squareDetector.on('mousemove', (hits) => {
        if (hits.length > 0) {
            console.log('Square hover:', hits.map(h => h.id).join(', '));
        }
    });

    // Create the second layer (Line)
    const lineLayer = new Layer({ stage, gridConfig: userConfig.grid });
    Views.Line.draw({
        container: lineLayer,
        options: {
            points: [
                ...setRange(0, 1, 90 * 4).map((coord) => (coord = { x: coord, y: coord }))
            ],
            color: COLOR.green, lineWidth: 4
        }
    });
    
    // Create HitDetector for the line layer
    const lineDetector = new HitDetector(lineLayer.canvas);
    
    // Register a stroked path for the line
    const linePath = new Path2D();
    linePath.moveTo(0, 0);
    linePath.lineTo(360, 360);
    lineDetector.register('line-hitbox', {
        type: 'stroke',
        path: linePath
    });
    
    // Increase stroke width for easier hitting
    lineDetector.strokeWidth = 10;
    
    // Add click handler
    lineDetector.on('click', (hits) => {
        console.log('Line clicked:', hits);
    });

});
    
}

const { ID, COLOR } = PRINT;