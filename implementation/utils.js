/**
 * @param {Number} start              - range lower bound
 * @param {Number} step               - range step
 * @param {Number} end                - range upper bound
 * @param {Boolean} [isIncluded=true] - `isIncluded === true ? [start:end] : [start:end)`, where `[]` denotes "closed", and `()` "open" range (interval)
 * @param {Array} [skip=Array]        - let's say you need dashed polygon (more precisely - a dashed line)
 * @returns {Array}                     one-dimensional array holding a range
 */
export function setRange(start, step, end, isIncluded=true, skip = []) {
    
    const range = [];
    
    loop1: for (start; start < end + isIncluded; start += step) {


        loop2: for (let items of skip) {


            if (items == start) {


                continue loop1;


            }


        }


        range.push(start)


    }


    return range;


}

/**
 * @param {Number} deg - angle degrees, hence `"deg"`
 * @returns takes a the input and converts it to raw number in radians
 */
export function degToRad(deg) {
    return (
        deg * (Math.PI / 180)
    )
}

/* === MISC. === */

const Print = new Proxy(
    Object.create(null)
    ,
    {
        get(nil, key) {
            return `${key}`;
        }
    }
)

export const PRINT = Object.assign(
    Object.create(null)
    ,
    {
        [Print.COLOR] : Print,
        [Print.ID] : Print,
    }
)