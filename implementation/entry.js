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

    lineDetector.register('line-hitbox',
        { type: 'stroke', path: new Path2D },
        null,
        { lineWidth: 4, lineCap: 'round', lineJoin: 'round' }  // ← Match the drawn state!
    );

    let isClicked = false;
    lineDetector.on('click', (hits) => {

        isClicked = !isClicked;

        const { width, height } = lineLayer.canvas;
            lineLayer.ctx.resetTransform();
            lineLayer.ctx.clearRect(0, 0, width, height);
            
            /**
             * @override Views.Line.draw
             */
            Views.Line.draw({
                container: lineLayer,
                options: {
                    points: [...setRange(0, 1, 90 * 4).map((coord) => (coord = { x: coord, y: coord }))],
                    color: ( isClicked ? COLOR.magenta : COLOR.green  ),
                    lineWidth: 4  // ← Remember this value!
                }
            });

    });

});
    
}

const { ID, COLOR } = PRINT;