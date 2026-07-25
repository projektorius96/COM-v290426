import { Line, syncHitRegion } from "./line-view.js";

export default class {

    static Line = Line;
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
                q1: [0, 1, (90 * 1)],
                q2: [0, 1, (90 * 2)],
                q3: [0, 1, (90 * 3)],
                q4: [0, 1, (90 * 4)],
            }
        }
    )
;

export {
    Helpers
}