export class Grid {

    static draw({container, options = {}, onAfterRender}) {

        container.onRender((ctx, grid) => {

            ctx.save();
            ctx.setTransform(1, 0, 0, 1, 0, 0);

            container.drawGrid();

            ctx.restore();

            if (typeof onAfterRender === 'function') {
                onAfterRender({container, options});
            }

        });

    }

}
