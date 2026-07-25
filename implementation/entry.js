import { setRange, degToRad, PRINT } from './utils.js';
import UserConfig from './user-config.json' with {type: 'json'};
import Stage from './stage.js';
import Views, { Helpers } from './views/index.js';

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

        // Hit detection state
        let isClicked = false;

        // Line layer
        const 
            lineLayer = new Layer({ stage, id: ID.layer_top, gridConfig: UserConfig.grid })
            ,
            lineDetector = new HitDetector(lineLayer.canvas)
            ;

        function drawLine({color, points, lineWidth}) {

            Views.Line.draw({
                container: lineLayer,
                options: {
                    points: [...setRange(...points).map((coord) => (coord = { x: coord, y: coord }))],
                    color,
                    lineWidth,
                },
                // Called at the end of every render (initial + every resize repaint)
                onAfterRender: (ctx, grid) => Views.Line.syncHitRegion({grid, points, lineWidth, deps: { lineDetector, utils: { PRINT, setRange } }})
            });

        }

        // INITIAL *CALL
        const sharedPoints = [...Helpers.QUADRANT.q3]
        drawLine({
            points: sharedPoints
            , 
            color: COLOR.magenta
            , 
            lineWidth: 4
        });

        lineDetector.on(UI_EVENT.click, (hits) => {
            if (hits.length === 0) return; // click missed all registered stroke shapes

            isClicked = !isClicked;
            const { width, height, ctx: context } = document.getElementById(ID.layer_top);
                context.resetTransform();
                context.clearRect(0, 0, width, height);
                
                // RE-*CALL
                drawLine({
                    points: sharedPoints
                    ,
                    lineWidth: 4 
                    ,

                    /**
                     * @override
                     */
                    color: (isClicked ? COLOR.blue : COLOR.magenta)
                });
        });

    });
    
}