import './style.css'
import Views from '../implementation/views/index.js';
import { setRange } from '../implementation/utils.js';
import { Stage } from '../implementation/index.js';
import { userConfig } from '../implementation/user-config.js';
import { ResponsiveCanvas as Layer } from './responsive-canvas.js';

void function main() {

  Stage
  .init({
    container: document.getElementById('app')
  })
  .on(({stage})=>{
    Views.Line.draw({
      container: new Layer({stage, gridConfig: userConfig.grid})
      , 
      options: {
        points: [
          ...setRange(0, 1, 90*4).map( (coord)=>(coord = {x: coord, y: coord}) )
        ],
        color: 'green', lineWidth: 4 
      }
    });
  });

}();
