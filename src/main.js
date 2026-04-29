import './style.css'
import { bootExamples } from '../implementation/examples/index.js';

void function main(){
  bootExamples({
    root: document.getElementById('app')
  });
}();
