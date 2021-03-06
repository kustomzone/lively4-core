import scriptManager from  "src/client/script-manager.js";
// import * as persistence from  "src/client/persistence.js";
import Morph from "src/components/widgets/lively-morph.js";
import {pt} from '../graphics.js';
import { through } from "utils";

// import html from "scr/client/html.js"

// store promises of loaded and currently loading templates
export var loadingPromises = {};

// #MetaNote #UserCase this is an example for preserving module internal state while reloading a module
var _templates;
var _prototypes;
var _proxies;
var _templatePaths;
var _templatePathsCache;
var _templatePathsCacheTime;

var _templateFirstLoadTimes = {}

// for compatibility
export function register(componentName, template, prototype) {
  return ComponentLoader.register(componentName, template, prototype);
}

/* #FutureWork should interactive state change of "(module) global" state be preserved while reloading / developing modules
    ComponentLoader.foo = 3
    ComponentLoader.foo

#Discussion

pro) expected in Smalltalk-like developent and live-programmning experience
contra) gap between development-time and runtime (those manualy changes could make something work that without it won't...)

synthese) if modules and classes are also objects that can have run-time-specific state they should be migrated the same as objects. 

*/


export default class ComponentLoader {

  static get templates() {
    if (!_templates) _templates = {};
    return _templates;
  }

  static get prototypes() {
    if (!_prototypes) _prototypes = {};
    return _prototypes;
  }

  static get proxies() {
     if (!_proxies) _proxies = {};
    return _proxies;
  }

  static protypeToComponentName(prototype) {
    if (!prototype || !prototype.constructor) return
    var prototypeName =  prototype.constructor.name
    return _.keys(this.prototypes).find(name => {
      var otherProto = this.prototypes[name]
      var constructor = otherProto && otherProto.constructor;
      return constructor && (constructor.name ===  prototypeName)});
  }

  static updatePrototype(prototype) {
    var componentName = this.protypeToComponentName(prototype)
    if (componentName) {
      this.prototypes[componentName] = prototype
      this.proxies[componentName].__proto__ = prototype
    }
  }

  static async onCreatedCallback(object, componentName) {
    // if (persistence.isCurrentlyCloning()) {
    //   return;
    // }

    // #Depricated
    var shadow = object.createShadowRoot();
    // #NotWorkingYet as expected...
    // var shadow = object.attachShadow({mode: 'open'});
    
    // clone the template again, so when more elements are created,
    // they get their own copy of elements
    var clone = document.importNode(ComponentLoader.templates[componentName], true);
    // #TODO replace the "template" reference with an indirection that can be changed from the outside,
    // e.g. var clone = document.importNode(this.templates[componentName], true);
    // but beeing able to modify it, because we have a reference should suffice at the moment...

    shadow.appendChild(clone);

    // attach lively4scripts from the shadow root to this
    scriptManager.attachScriptsFromShadowDOM(object);
    
    // attach lively4script from the instance
    scriptManager.findLively4Script(object, false);

    if (ComponentLoader.prototypes[componentName].createdCallback) {
      ComponentLoader.prototypes[componentName].createdCallback.call(object);
    }

    // load any unknown elements, which this component might introduce
    await ComponentLoader.loadUnresolved(object, true, "onCreated " + componentName).then((args) => {
      // lively.fillTemplateStyles(object.shadowRoot, "source: " + componentName).then(() => {
        // call the initialize script, if it exists
      
        if (typeof object.initialize === "function") {
          object.initialize();
        }
        // console.log("dispatch created " +componentName )
        // console.log("Identitity: " + (window.LastRegistered === object))
        
        object.dispatchEvent(new Event("created"));
      // })
      if (_templateFirstLoadTimes[componentName]) {
        console.log('Component first load time: ' + ((performance.now() - _templateFirstLoadTimes[componentName]) / 1000).toFixed(3) + "s " + componentName + " ")
        _templateFirstLoadTimes[componentName] = null;
      }
    }).catch( e => {
      console.error(e); 
      return e
    });
  }
  
  static onAttachedCallback(object, componentName) {
    // if (ComponentLoader.proxies[componentName]) {
    //   console.log("[component loader] WARNING: no proxy for " + componentName )
    //   return 
    // }

    if (object.attachedCallback && 
      ComponentLoader.proxies[componentName].attachedCallback != object.attachedCallback) {
        object.attachedCallback.call(object);
    }
    if (ComponentLoader.prototypes[componentName].attachedCallback) {
      ComponentLoader.prototypes[componentName].attachedCallback.call(object);
    }
  }
  
  static onDetachedCallback(object, componentName) {
    // if (ComponentLoader.proxies[componentName]) {
    //   console.log("[component loader] WARNING: no proxy for " + componentName )
    //   return 
    // }
    
    if (object.detachedCallback 
    && ComponentLoader.proxies[componentName].detachedCallback != object.detachedCallback) {
      object.detachedCallback.call(object);
    } else if (ComponentLoader.prototypes[componentName].detachedCallback) {
      ComponentLoader.prototypes[componentName].detachedCallback.call(object);
    }
  }
  
  // this function registers a custom element,
  // it is called from the bootstap code in the component templates
  static register(componentName, template, prototype) {
    var proto = prototype || Object.create(Morph.prototype);

    // For reflection and debugging
    this.templates[componentName] = template;
    this.prototypes[componentName] = proto;
    this.proxies[componentName] = Object.create(proto) // not changeable
  
    lively.fillTemplateStyles(template, "source: " + componentName).then( () => {

  
      // FOR DEBUGGING
      // if (!window.createdCompontents)
      //   window.createdCompontents = {}
      // window.createdCompontents[componentName] = []
  
      // #Mystery #Debugging #ExperienceReport
      // Task was to figure out why the created callback is called several times when loading the
      // componen for the first time? E.g 5 ace editors for the container, where 2 are actually needed
      // maybe they are also called for the template documents that we store?
      // e.g. lively-editor (+ 1 ace + lively-version (+1 ace)) + lively-version (1 ace)
      // that would actually account for the missing three instances
      // It is Saturday night... past midnight and I finnally have at least an hypothesis, 
      // where I was debugging in the dark the last 3 hours.
      // I got burned so hard by the "created" event that was thrown at me even if not myself 
      // was created but if a child of mine was created too... and we did not expected such behavior
      // that this time I wanted to find out what was going on here. Even though it seemed to 
      // be not a problem
      
      this.proxies[componentName].createdCallback = function() {
        // window.createdCompontents[componentName].push(this)  
        // console.log("[components] call createdCallback for " + componentName, this)
        ComponentLoader.onCreatedCallback(this, componentName, this)
      }
      this.proxies[componentName].attachedCallback = function() {
        ComponentLoader.onAttachedCallback(this, componentName)
      };
      this.proxies[componentName].detachedCallback = function() {
         ComponentLoader.onDetachedCallback(this, componentName)
      };
  
      // don't store it just in a lexical scope, but make it available for runtime development
  
      document.registerElement(componentName, {
        prototype: this.proxies[componentName]
      });
    })
  }

  // this function creates the bootstrap script for the component templates
  static createRegistrationScript(componentId) {
    var script = document.createElement("script");
    script.className = "registrationScript";
    script.innerHTML = "lively.registerTemplate()";
    return script;
  }

  // this function loads all unregistered elements, starts looking in lookupRoot,
  // if lookupRoot is not set, it looks in the whole document.body,
  // if deep is set, it also looks into shadow roots
  static loadUnresolved(lookupRoot, deep, debuggingHint) {
    lookupRoot = lookupRoot || document.body;

    var selector = ":unresolved";
    var unresolved = []
    
    // check if lookupRoot is unresolved
    if (lookupRoot.parentElement) {
      var unresolvedSiblingsAndMe =  lookupRoot.parentElement.querySelectorAll(selector);
      if (_.includes(unresolvedSiblingsAndMe, lookupRoot )) {
        unresolved.push(lookupRoot)
      }
    }
    
    // find all unresolved elements looking downwards from lookupRoot
    var unresolved = unresolved.concat(Array.from(lookupRoot.querySelectorAll(selector)));
    if (deep) {
      var deepUnresolved = findUnresolvedDeep(lookupRoot);
      unresolved = unresolved.concat(deepUnresolved);
    }

    function findUnresolvedDeep(root) {
      var shadow = root.shadowRoot;
      if (!shadow) {
        return [];
      }

      var result = Array.from(shadow.querySelectorAll(selector));

      Array.from(shadow.children).forEach((child) => {
        result = result.concat(findUnresolvedDeep(child));
      });

      return result;
    }

    // helper set to filter for unique tags
    var unique = new Set();

    var promises = unresolved.filter((el) => {
      // filter for unique tag names
      if (!el.nodeName || el.nodeName.toLowerCase() == "undefined") return false;
      var name = el.nodeName.toLowerCase();
      return !unique.has(name) && unique.add(name);
    })
    .map(async (el) => {
      var name = el.nodeName.toLowerCase();
      if (loadingPromises[name]) {
        // the loading was already triggered
        return loadingPromises[name];
      }

      // create a promise that resolves once el is completely created
      var createdPromise = new Promise((resolve, reject) => {
        el.addEventListener("created", (evt) => {
          evt.stopPropagation();
          resolve(evt);
        });
      });

      // trigger loading the template of the unresolved element
      loadingPromises[name] = createdPromise;
      
      loadingPromises[name].name = name + " " + Date.now()
      
      let didInsertTag = await this.loadByName(name);
      
      if(!didInsertTag) {
        if(lively.notify) {
          lively.notify("Component Loader", `Template ${name} could not be loaded.`, 3, null, "yellow");
        }
        delete loadingPromises[name];
        return null;
      }

      return createdPromise;
    })
    .filter(promise => promise != null);

    // return a promise that resolves once all unresolved elements from the unresolved-array
    // are completely created
    return new Promise( (resolve, reject) => {
      
      // fuck promises!!!! I hate them. There is one promise pending.... but just does not fail. It just hangs around doing nothing! #Jens
      promises.forEach( p => {
        p.then( r => {
          p.finished = true;
        }, er => console.log("ERROR in promise: " + p.name))
        
      })
      window.setTimeout( function() {
        var unfinished = false;
        var unfinishedPromise;
        promises.forEach( p => {
          if (!p.finished) {
            unfinishedPromise = p
            unfinished = true;
          }
        })
        if (unfinished) {
          resolve("timeout") // "(if) the fuel gauge breaks, call maintenance. If they are not there in 20 minutes, fuck it."
          
          lively.notify("Timout due to unresolved promises, while loading " + unfinishedPromise.name + " context: " + debuggingHint )
        }
      }, 10 * 1000)

      Promise.all(promises).then( result => resolve(), err => {
          console.log("ERROR loading component ", err)
      })
    })
  }
  
  
  static resetTemplatePathCache() {
    _templatePathsCache = undefined
    _templatePathsCacheTime = undefined
  }

  static async getTemplatePathContent(path) {
    // return  await fetch(path, { method: 'OPTIONS' }).then(resp => resp.json());
    
    if (!_templatePathsCache) {
      _templatePathsCache = {}
      _templatePathsCacheTime = {}
    } 
    let cacheInvalidationTime = 60 * 5 * 1000;
    let cached = _templatePathsCache[path]
    let time = _templatePathsCacheTime[path]
    if (cached && ((Date.now() - time) < cacheInvalidationTime)) return cached
    
    let resultPromise =  fetch(path, { method: 'OPTIONS' }).then(resp => {
      if (resp.status !== 200) return undefined
      return resp.json()
    });
    _templatePathsCacheTime[path] = Date.now()
    _templatePathsCache[path] = new Promise(async (resolve, reject) => {
      let result = await resultPromise;
      if (result) {
          resolve({contents: result.contents});
        return cached 
      }
    })
    return resultPromise 
  }
  
  static getTemplatePaths() {
    if (!_templatePaths) {
      _templatePaths = [
        lively4url + '/templates/',
        lively4url + '/src/components/',
        lively4url + '/src/components/widgets/',
        lively4url + '/src/components/tools/',
        lively4url + '/src/components/halo/',
        lively4url + '/src/components/demo/',
        lively4url + '/src/components/draft/',
        lively4url + '/src/components/d3/',
        lively4url + '/src/client/vivide/components/',
        lively4url + '/src/client/reactive/components/',
        lively4url + '/src/client/triples/components/',
        lively4url + '/src/client/pen-editor/components/',
        lively4url + '/src/babylonian-programming-editor/',
        lively4url + '/src/babylonian-programming-editor/demos/canvas/',
        lively4url + '/src/babylonian-programming-editor/demos/todo/',
      ]; // default
    } 
    return _templatePaths
  }

  static addTemplatePath(path) {
    if (!lively.files.isURL(path)) {
      path = lively.location.href.replace(/[^/]*$/, path)
    }
    var all = this.getTemplatePaths()
    if (!all.includes(path)) {
      all.push(path)
    }
  }

  static async searchTemplateFilename(filename) {
    
    var templatePaths =  this.getTemplatePaths()
    let templateDir = undefined;          
  
    // #IDEA, using HTTP HEAD could be faster, but is not always implemented... as ource OPTIONS is neigher
    // this method avoids the 404 in the console.log
    
    
    // the OPTIONS request seems to break karma... waits to long..
	  if (!window.__karma__) { 
      for(templateDir of templatePaths) {
        try {
          var stats = await this.getTemplatePathContent(templateDir);
          var found = stats.contents.find(ea => ea.name == filename)
        } catch(e) {
          console.log("searchTemplateFilename: could not get stats of  " + filename + " ERROR: ", e)
          found = null
        }
        if (found) {
          return templateDir + filename
        }
      }

    } else {
      // so the server did not understand OPTIONS, so lets ask for the files directly
      if (!found) {
        for(templateDir of templatePaths) {
          var found = await fetch(templateDir + filename, { method: 'GET' }) // #TODO use HEAD, after implementing it in lively4-server
            .then(resp => resp.status == 200); 
          if (found) {
            return templateDir + filename
          }  
        } 
      }      
    }
    return undefined
  }
  
  
  // this function loads a component by adding a link tag to the head
  static async loadByName(name) {
    _templateFirstLoadTimes[name] = performance.now()
    var url = await this.searchTemplateFilename(name + '.html')
    if (!url) {
      throw new Error("Could not find template for " + name)
    }
    console.log(window.lively4stamp, "load component: " + url)

    // Check  if the template will be loadable (this would e.g. fail if we were offline without cache)
    // We have to check this before inserting the link tag because otherwise we will have
    // the link tag even though the template was not properly loaded
    try {
      let response = await fetch(url, { method: 'OPTIONS'});
      if(response.ok) {
        var link = document.createElement("link");
        link.rel = "import";
        link.href = url;
        link.dataset.lively4Donotpersist = "all";
        document.head.appendChild(link);
        return true;
      } else {
        return false;
      }
    } catch (error) {
      return false;
    }
  }

  static createComponent(tagString) {
    var comp = document.createElement(tagString);
    return comp;
  }

  static async loadAndOpenComponent(componentName, immediate = () => {}) {
    var component = this.createComponent(componentName);
    
    const compPromise = this.openIn(<div />, component);
    immediate(component);
    
    return compPromise::through(comp => comp.remove());
  }
  
  static openIn(parent, component, beginning) {
    var created = false;
    var compPromise = new Promise((resolve, reject) => {
      component.addEventListener("created", (e) => {
        if (e.path[0] !== component) {
          // console.log("[components] ingnore and stop created event from child " + e.path[0].tagName);
          return 
        }
        if (created) {
          // #Just check... we had this issue before
          throw new Error("[compontents] created called twice for " + component)
        } else {
          created = true
          e.stopPropagation();
          resolve(e.target);
        }
        
      });
    });

    if (beginning) {
      parent.insertBefore(component, parent.firstChild);
    } else {
      parent.appendChild(component);
    }
    // this.loadUnresolved(parent, true, "openIn " + component);
    this.loadUnresolved(component, true, "openIn " + component);

    return compPromise;
  }

  static openInBody(component) {
    return this.openIn(document.body, component, true);
  }

  static openInWindow(component, pos, title) {
    // this will call the window's createdCallback before
    // we append the child, if the window template is already
    // loaded
    var w = this.createComponent("lively-window");
    if (pos) {
      lively.setPosition(w, pos);
    }
    w.style.opacity = 0.2
    w.appendChild(component);


    this.openInBody(w);

    // therefore, we need to call loadUnresolved again after
    // adding the child, so that it finds it and resolves it,
    // if it is currently unresolved
    var windowPromise = new Promise((resolve, reject) => {
      this.loadUnresolved(document.body, true, "openInWindow " + component).then(() => {
        w.style.opacity = 1 
        if (component.windowTitle) 
          w.setAttribute('title', '' + component.windowTitle);

        resolve(w);
      });
    });

    return windowPromise;
  }

  static openComponentBin() {
    var bin = createComponent("lively-component-bin");
    openInWindow(bin);
  }

  static reloadComponent(source) {
    var template = lively.html.parseHTML(source).find(ea => ea.localName == "template");
    if (!template) return;
    var name = template.id;
    if (!name) return;
    var templateClone = document.importNode(template.content, true);
    lively.components.templates[name] = templateClone;
    
    return lively.fillTemplateStyles(templateClone, "source: " + name).then( () => name);
  }
  
  // #Design #Draft Migration of class-side state (classes are objects themselve)
  static livelyMigrate(other) {
  
  }
}

// #Design #Draft Migration of module-side state (modules are objects themselve)
export function livelyMigrate(other) {
// Problem: we cannot look into internal "other" state, we can do this with objects but not with
// variable declarations, therefore we let our module system automigrate the module global variable state
}


_templatePathsCache = null

