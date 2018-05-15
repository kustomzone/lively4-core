import Rectangle from './rectangle.js';
import RenderStyle from './renderStyle.js';

export default class RenderContext {
  constructor(canvas) {
    this._canvas = canvas;
    this._canvasContext = canvas.getContext("2d");
    this._camera = new Rectangle(0, 0, canvas.width, canvas.height);
    this.style = new RenderStyle();
  }
  
  get canvasContext() {
    return this._canvasContext;
  }
  
  get camera() {
    return this._camera;
  }
  
  startFrame() {
    this._canvasContext.clearRect(0, 0, this._canvas.width, this._canvas.height);
  }
  
  endFrame() {
    // nothing to be seen here
  }
}