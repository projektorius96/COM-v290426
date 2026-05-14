export default class Stage {

    static init({ container }) {

        // Initiating the Stage (entry point)
        const stage = document.createElement('div');
            container.appendChild(stage);

        Object.assign(stage, { on: this.on.bind(null, stage) })

        // DEV_NOTE # we must return "this" (stage) in order to chain calls in a row, e.g. init().on().etc() without a need of variable reference.
        return stage;

    }

    static on(stage, callback) {

        callback({ stage });

    }

}
