/**
 * A reliable counter driven by the Web Animations API (WAAPI) and requestAnimationFrame.
 *
 * Unlike setInterval / setTimeout, ticks are derived from `animation.currentTime`,
 * which is synchronised with the browser rendering pipeline and automatically
 * suspended in background tabs — giving drift-free, tab-aware counting.
 *
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/KeyframeEffect|KeyframeEffect}
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/Animation|Animation}
 *
 * @param {object}   [options]
 * @param {string}   [options.id='animation-counter']  Custom-element tag name used as the animation target (must contain a hyphen)
 * @param {number}   [options.from=0]                  Counter start value (inclusive)
 * @param {number}   [options.to=180]                  Counter end value (exclusive; resets to `from` after reaching this)
 * @param {number}   [options.duration=1]              Milliseconds per tick
 * @param {number}   [options.iterations=Infinity]     WAAPI animation iteration count
 * @param {Function} options.callback                  Invoked on each tick with `{ count }`; `this` is bound to the Animation instance
 * @returns {Animation}
 */
export default function Counter({
    id         = 'animation-counter',
    from       = 0,
    to         = 180,
    duration   = 1,
    iterations = Infinity,
    callback,
} = {}) {

    // Register a lightweight custom element as the WAAPI animation target.
    if (!customElements.get(id)) {
        customElements.define(id, class extends HTMLElement {
            constructor() {
                super();
                this.id = id;
                
                this.style.cssText = 'position: absolute;';
            }
        });

        document.body.appendChild(new (customElements.get(id))());
    }

    const target = document.body.children[id];

    const effect = new KeyframeEffect(
        target,
        [{ opacity: 0 }, { opacity: 1 }],
        { duration, iterations },
    );

    const animation = new Animation(effect, document.timeline);
    animation.play();

    let count    = from;
    let lastTick = 0;
    let rafId;

    function trackTime() {
        const time = animation.currentTime;

        if (time !== null) {
            const tick = Math.floor(time / duration);

            if (tick > lastTick) {
                lastTick = tick;
                count++;

                if (count === to) {
                    count = from; // wrap back to the start of the cycle
                }

                // Fire every tick — consumers receive count === from at cycle
                // boundaries, letting them reset rendered state without flicker.
                callback.call(animation, { count });
            }
        }

        rafId = requestAnimationFrame(trackTime);
    }

    rafId = requestAnimationFrame(trackTime);

    // Stop the rAF loop when the animation is explicitly cancelled.
    animation.addEventListener('cancel', () => cancelAnimationFrame(rafId));

    return animation;

}

/* // --- Usage example ---
Counter({
    duration:   1000,
    to:         360,
    iterations: Infinity,
    callback({ count }) {
        
        // EXAMPLE # Log only odd numbers
        if (count % 2 !== 0) console.log(count);

    },
}); */