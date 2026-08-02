import { setRange, PRINT } from './utils.js';
import UserConfig from './user-config.json' with {type: 'json'};
import Stage from './stage.js';
import Views, { Helpers } from './views/index.js';
/* import Counter from './counter.js'; */

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

        const 
            gridLayer = Reflect.construct(Layer, [{ id: ID.grid, stage, gridConfig: UserConfig.grid }])
            ,
            circleLayer = Reflect.construct(Layer, [{ stage, gridConfig: UserConfig.grid }])
            ;

        Views.Grid.draw({
            container: gridLayer,
        });

        gridLayer.onRender(()=>{

            Views.Line.draw({
                container: circleLayer,
                options: {
                    points: [...setRange(...Helpers.QUADRANT.Q4).map((coords)=> coords = {x: coords, y: coords} )],
                    scale: [1, 1],
                    color: COLOR.red,
                    lineWidth: 20,
                    opacity: 1,
                },
                // Called at the end of every render (initial + every resize repaint)
                onAfterRender: ({container, options}) => {
                    console.log(Math.random())
                }
            });
            
        })

    });
    
}