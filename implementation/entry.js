import { setRange, PRINT } from './utils.js';
import UserConfig from './user-config.json' with {type: 'json'};
import Stage from './stage.js';
import Views, { Helpers } from './views/index.js';
import Counter from './counter.js';

/**
 * @implementation
 * @example - This is where you implement your own rendering logic (implementation entry point)
 */
export default function ({Layer, HitDetector}) {

    /**
     * @description USEFUL ALIASED (TYPED) PROXY GETTERS each returning a string.
     * @example COLOR.red - will print 'red',  where (typeof 'red' === 'string');
     */
    const { ID, COLOR, UI_EVENT } = PRINT;
    
    Stage
    .init({
        container: document.getElementById(ID.app)
    })
    .on(({ stage }) => {

        // *"Hit detection" state
        let isClicked = false;

        // Instance of Line layer *"Hit detection"
        const 
            lineLayer = new Layer({ stage, id: ID.layer_top, gridConfig: UserConfig.grid })
            ,
            lineDetector = new HitDetector(lineLayer.canvas)
            ;

        function drawLine() {

            const options = {
                points: [],
                color: COLOR.magenta,
                lineWidth: 4,
                opacity: 0.1
            }

            Views.Line.draw({
                container: lineLayer,
                options,
                // Called at the end of every render (initial + every resize repaint)
                onAfterRender: ({ctx, grid, points, lineWidth}) => {
                    Views.Line.syncHitRegion({
                        grid,
                        points,
                        lineWidth,
                        deps: { lineDetector, utils: { PRINT, setRange } }
                    });
                }
            });

            return options;

        }

        const 
            allPoints = setRange(...Helpers.QUADRANT.Q4).map((coord) => ({ x: coord, y: coord }))
            ,
            drawState = drawLine()
            ;

        Counter({
            from: 0,
            to: allPoints.length + 1,
            duration: 10,
            callback({ count }) {                
                drawState.points = allPoints.slice(0, count);
                lineLayer.render(); // DEV_NOTE # if you've changed anything in {drawState}, you must call .render() on your target {Layer} manually!
            }
        });

        lineDetector.on(UI_EVENT.click, (hits) => {
            if (hits.length === 0) return; // click missed all registered stroke shapes
                
            isClicked = !isClicked;
            drawState.color = (isClicked ? COLOR.blue : COLOR.magenta);
            lineLayer.render(); // DEV_NOTE # if you've changed anything in {drawState}, you must call .render() on your target {Layer} manually!
            
        });

    });
    
}