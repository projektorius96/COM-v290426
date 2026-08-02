import { Line, syncHitRegion } from "./line-view.js";
import { Grid } from "./grid-view.js";

export default class {

    static Line = Line;
    static Grid = Grid;
    static {
        Object.assign(this.Line, {
            syncHitRegion
        })
    }

}

const 
    NULL = Object.create(null)
    ,
    Helpers = 
    Object.assign(
        NULL
        , 
        {
            QUADRANT: {
                Q0: [0, 1, (90 * 0)],
                Q1: [0, 1, (90 * 1)],
                Q2: [0, 1, (90 * 2)],
                Q3: [0, 1, (90 * 3)],
                Q4: [0, 1, (90 * 4)],
            }
        }
    )
;

export {
    Helpers
}