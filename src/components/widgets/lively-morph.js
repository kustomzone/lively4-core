/*
 * Morph is a HtmlElement replacement with some API enhanncements
 */
 
export default class Morph extends HTMLDivElement {
  
  /* 
   * Access subelments by name
   * shortcut for querySelector and shadowRoot.querySelector t
   * #FeatureIdea -- In Livel3, it could it also be used to look for owners and siblings  
   */ 
  get(selector) {
    return this.getSubmorph(selector);
  }

  // #Depricated, please use either "get" or "querySelector" directly
  getSubmorph(selector) {
    var morph = this.querySelector(selector);
    if (!morph && this.shadowRoot) {
      morph = this.shadowRoot.querySelector(selector);
    }
    return morph;
  }

  set windowTitle(string){
    this._windowTitle = string;
    // #TODO replace with connections
    if (this.parentElement && this.parentElement.titleSpan) { // check for window?
      this.parentElement.setAttribute("title", string);
    }
  }
  
  get windowTitle(){
    return this._windowTitle;
  }

  set windowIcon(string){
    this._windowIcon = string;
    // #TODO replace with connections
    if (this.parentElement && this.parentElement.titleSpan) { // check for window?
      this.parentElement.setAttribute("icon", string);
    }
  }
  
  get windowIcon(){
    return this._windowIcon;
  }

  getAllSubmorphs(selector) {
    var morphs = Array.from(this.querySelectorAll(selector));
    if (this.shadowRoot) {
      morphs = morphs.concat(Array.from(this.shadowRoot.querySelectorAll(selector)));
    }
    
    // morphs can contain null, if either none was found in this or this.shadowRoot
    return morphs.filter(m => m);
  }
  
  withAttributeDo(name, func) {
    var value = this.getAttribute(name) 
    if (value !== undefined && value !== null) {
      func(value)
    }
  }

  registerButtons() {
    // Just an experiment for having to write lesser code.... which ended up in having more code here ;-) #Jens
    Array.from(this.shadowRoot.querySelectorAll('button')).forEach(node => {
      var name = node.id;
      var funcName = name.replace(/^./, c => 'on'+ c.toUpperCase());
      // console.log('register button ' + name)
      node.addEventListener("click", evt => {
        if (this[funcName] instanceof Function) {
          this[funcName](evt);
        } else {
          alert('No callback: ' +  funcName);
        }
      });
    });
  }
  
  toString() {
    return "[" + this.constructor.name + "]"
  }
  
  getJSONAttribute(name) {
    let str = this.getAttribute(name);
    if(str) { return JSON.parse(str); }
    return null;
  }
  
  setJSONAttribute(name, json) {
    this.setAttribute(name, JSON.stringify(json));
    return json;
  } 
}
