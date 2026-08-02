/**
 * A resize-safe counter driven by requestAnimationFrame and performance.now().
 *
 * Ticks are derived from elapsed wall-clock time, so large frame gaps caused by
 * viewport emulation or devtools resizes are fully replayed instead of stalling
 * the consumer state.
 *
 * @param {object}   [options]
 * @param {number}   [options.from=0]                  Counter start value (inclusive)
 * @param {number}   [options.to=180]                  Counter end value (exclusive; resets to `from` after reaching this)
 * @param {number}   [options.duration=1]              Milliseconds per tick
 * @param {number}   [options.iterations=Infinity]     Number of full counter cycles to run
 * @param {Function} options.callback                  Invoked on each tick with `{ count }`; `this` is bound to the returned controller
 * @returns {{cancel: Function, pause: Function, play: Function, count: number, running: boolean}}
 */
export default function Counter({
    from       = 0,
    to         = 180,
    duration   = 1,
    iterations = Infinity,
    callback,
} = {}) {

    if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) {
        throw new TypeError('"Counter" expects numeric "from" and "to" values where to > from.');
    }

    if (!Number.isFinite(duration) || duration <= 0) {
        throw new TypeError('"Counter" expects "duration" to be a positive number.');
    }

    if (typeof callback !== 'function') {
        throw new TypeError('"Counter" expects "callback" to be a function.');
    }

    const totalIterations = iterations === Infinity ? Infinity : Math.max(0, Math.floor(iterations));

    let count = from;
    let rafId = null;
    let startTime = 0;
    let processedTicks = 0;
    let completedIterations = 0;
    let pausedAt = 0;
    let running = false;

    const controller = {
        cancel() {
            if (rafId !== null) {
                cancelAnimationFrame(rafId);
                rafId = null;
            }

            running = false;
            pausedAt = 0;
        },
        pause() {
            if (!running) return;

            running = false;
            pausedAt = performance.now();

            if (rafId !== null) {
                cancelAnimationFrame(rafId);
                rafId = null;
            }
        },
        play() {
            if (running || completedIterations >= totalIterations) {
                return;
            }

            const now = performance.now();
            if (startTime === 0) {
                startTime = now;
            } else if (pausedAt !== 0) {
                startTime += now - pausedAt;
                pausedAt = 0;
            }

            running = true;
            rafId = requestAnimationFrame(trackTime);
        },
        get count() {
            return count;
        },
        get running() {
            return running;
        },
    };

    function trackTime(now) {
        if (!running) {
            return;
        }

        const elapsed = now - startTime;
        const targetTick = Math.floor(elapsed / duration);

        while (processedTicks < targetTick && completedIterations < totalIterations) {
            processedTicks += 1;
            count += 1;

            if (count === to) {
                count = from;
                completedIterations += 1;

                if (completedIterations >= totalIterations) {
                    controller.cancel();
                    return;
                }
            }

            callback.call(controller, { count });
        }

        rafId = requestAnimationFrame(trackTime);
    }

    controller.play();
    return controller;

}
