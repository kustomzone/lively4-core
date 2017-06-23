import Morph from "./Morph.js"

import { Graph } from 'src/client/triples/triples.js';
import lively from 'src/client/lively.js';

export default class AddTriple extends Morph {
  async initialize() {
    this.windowTitle = "Add Triple";

    this.spo.forEach(({ selector, label, placeholder }) => {
      let input = this.get(selector);
      input.setLabel(label);
      input.setPlaceholder(placeholder);
      input.onEnter = () => this.save();
    });
  }
  
  /** subject, predicate, object */
  get spo() {
    return [{
      label: 'Subject',
      placeholder: 'subject',
      debugLabel: 'subject',
      selector: '#subject'
    }, {
      label: 'Predicate',
      placeholder: 'predicate',
      debugLabel: 'predicate',
      selector: '#predicate'
    }, {
      label: 'Object',
      placeholder: 'object',
      debugLabel: 'object',
      selector: '#object'
    }]
  }
  
  focus() { this.get('#subject').focus(); }
  async save() {
    this.spo.forEach(({ selector, debugLabel }) => {
      if(this.get(selector).getValue() === '') {
        lively.notify(`${debugLabel} not specified!`, null, 2, null, 'red');
        throw new RangeError(`No ${debugLabel} specified in Add Triple.`);
      }
    });
    
    const subjectURLString = this.get('#subject').getURLString();
    const predicateURLString = this.get('#predicate').getURLString();
    const objectURLString = this.get('#object').getURLString();
    
    let graph = await Graph.getInstance();
    await graph.createTriple(
      subjectURLString,
      predicateURLString,
      objectURLString
    );
    
    this.afterSubmit()
  }
  
  // TODO: employ nice event-based approach or AOP/COP
  afterSubmit() {}
}
