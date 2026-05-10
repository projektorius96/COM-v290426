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

    Views.Square.draw({
        container: new Layer({ stage, gridConfig: userConfig.grid })
    })

    Views.Line.draw({
            container: new Layer({ stage, gridConfig: userConfig.grid })
            ,
            options: {
                points: [
                    ...setRange(0, 1, 90 * 4).map((coord) => (coord = { x: coord, y: coord }))
                ],
                color: COLOR.green, lineWidth: 4
            }
        });
    });
    
}

const { ID, COLOR } = PRINT;
