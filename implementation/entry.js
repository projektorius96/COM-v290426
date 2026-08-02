import { setRange, PRINT } from './utils.js';
import UserConfig from './user-config.json' with {type: 'json'};
import Stage from './stage.js';
import Views, { Helpers } from './views/index.js';
import Counter from './counter.js';

/**
 * @description USEFUL ALIASED (TYPED) PROXY GETTERS each returning a string.
 * @example COLOR.red - will print 'red',  where (typeof 'red' === 'string');
 */
const { ID, COLOR, UI_EVENT } = PRINT;

/**
 * @implementation
 * @example - This is where you implement your own rendering logic (implementation entry point)
 */
export default function ({Layer, HitDetector}) {
    
    Stage
    .init({
        container: document.getElementById(ID.app)
    })
    .on(({ stage }) => {

        const 
            gridLayer = Reflect.construct(Layer, [{ id: ID.grid, stage, gridConfig: UserConfig.grid }])
            ;

        Views.Grid.draw({
            container: gridLayer,
        });

        gridLayer.onRender(()=>{

        const lineLayer = Reflect.construct(Layer, [{ stage, gridConfig: UserConfig.grid }]);
        function drawLine(overridenOptions = {}) {
            
            // Draw Japan flag
            Views.Line.draw({
                container: lineLayer,
                options: {
                    showGrid: true,
                    points: [],
                    scale: [2, 2],
                    color: COLOR.red,
                    lineWidth: 3,
                    opacity: 1,
                    ...overridenOptions
                },
                // Called at the end of every render (initial + every resize repaint)
                onAfterRender: ({container, options}) => {
                    // Do some finalization work here,.. 
                    // ..except calling {container.render()} itself - that would halt your runtime due to recursive calls!
                }
            });


        }
        drawLine(null);

        /* gridLayer.onRender(( context, grid )=>{ */

            const
                allPoints = setRange(...Helpers.QUADRANT.Q4).map((coord) => ({ x: coord, y: coord }))
                ,
                to = (allPoints.length + 1)
                ;

            Counter({
                from: 0,
                to,
                duration: 1,
                callback({ count }) {

                    /**
                     * @override
                     */
                    drawLine({
                        points: [...allPoints.slice(0, count)]
                    });

                }
            });

        /* }) */

        })

        

    });
    
}