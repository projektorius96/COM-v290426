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

    // Line layer
    const lineLayer = new Layer({ stage, gridConfig: userConfig.grid });
    Views.Line.draw({
        container: lineLayer,
        options: {
            points: [...setRange(0, 1, 90 * 4).map((coord) => (coord = { x: coord, y: coord }))],
            color: COLOR.green,
            lineWidth: 4  // ← Remember this value!
        }
    });

    const lineDetector = new HitDetector(lineLayer.canvas);
    const linePath = new Path2D();
    linePath.moveTo(0, 0);
    linePath.lineTo(360, 360);

    lineDetector.register('line-hitbox',
        { type: 'stroke', path: linePath },
        null,
        { lineWidth: 4, lineCap: 'round', lineJoin: 'round' }  // ← Match the drawn state!
    );

    lineDetector.on('click', (hits) => {
        console.log('Line clicked:', hits);
    });

});
    
}

const { ID, COLOR } = PRINT;