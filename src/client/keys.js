'use strict';

// Livel4 Keyboard shortcuts

// Experiments for more late bound modules... that way the expots won't get frozen!
// idea

// #Duplication with shortcuts.js #TODO

// import lively from "./lively.js"; #TODO does not work anymore...

import boundEval from "src/client/bound-eval.js";
import GraphControl from "templates/graph-control.js";

export default class Keys {

  static getChar(evt) {
    return String.fromCharCode(evt.keyCode || evt.charCode);
  }

  static logEvent(evt) {
    console.log(`Pressed ${this.getChar(evt)} (shift=${evt.shiftKey}, ctrl=${evt.ctrlKey}, alt=${evt.altKey}, meta=${evt.metaKey})`);
  }

  static getTextSelection() {
    return window.getSelection().toLocaleString();
  }

  static handle(evt) {
    function handledInCodeMirror(evt) {
      return evt.path.find(node => node.tagName == "LIVELY-CODE-MIRROR");
    }
    
    // #Hack, fix a little but in ContextMenu movement...
    lively.lastScrollTop = document.scrollingElement.scrollTop;
    lively.lastScrollLeft = document.scrollingElement.scrollLeft;
    
    try {
      const char = this.getChar(evt);
      const ctrl = evt.ctrlKey || evt.metaKey;
      const { shiftKey, altKey, keyCode, charCode } = evt;
      
      const keyHandlers = [
        // #KeyboardShortcut Ctrl-K open workspace
        ["Open Workspace", ctrl && char == "K", evt => {
          lively.openWorkspace("")
        }],
        // #KeyboardShortcut Ctrl-Shift-F search throughout the whole repository
        ["Search", ctrl && shiftKey && char == "F", evt => {
          lively.openSearchWidget(this.getTextSelection(), null, evt.path[0]);
        }],
        // #KeyboardShortcut Ctrl-Shift-B open browser
        ["Open Container", shiftKey && ctrl && char == "B", evt => {
          lively.openBrowser(this.getTextSelection());
        }],
        // #KeyboardShortcut Ctrl-Shift-G open sync tool
        ["Open Sync Tool", shiftKey && ctrl && char == "G", evt => {
          // this does not work up on #Jens' windows machine
          lively.openComponentInWindow("lively-sync");
        }],
        // #KeyboardShortcut Ctrl-O open component bin
        ["Open Component Bin", ctrl && char == "O", evt => {
          lively.openComponentInWindow("lively-component-bin");
        }],
        // #KeyboardShortcut Ctrl-J open console
        ["Open Console", !shiftKey && ctrl && char == "J", evt => {
          lively.openComponentInWindow("lively-console");
        }],
        // ["Open DevDocs", ctrl && char == "H", evt => {
        //   lively.openHelpWindow(this.getTextSelection());
        // }],
        // #KeyboardShortcut Ctrl-Alt-G open graph control
        ["Open Graph Control", ctrl && altKey && char == "G", evt => {
          lively.openComponentInWindow("graph-control");
        }],
        // #KeyboardShortcut Ctrl-Alt-D open research diary        
        ["Open Research Diary", ctrl && altKey && char == "D", evt => {
          lively.openComponentInWindow("research-diary");
        }],
        // #KeyboardShortcut Ctrl-Alt-F search graph
        ["Search Graph", ctrl && altKey && char == "F", evt => {
          GraphControl.fullTextSearch(this.getTextSelection());
        }],
        // #KeyboardShortcut Ctrl-Alt-V eval and open in vivide
        ["Eval & Script in Vivide", ctrl && altKey && char == "V", async evt => {
          if (handledInCodeMirror(evt)) {
            return; // code mirror does not stop it's propagation
          }
          let str = window.getSelection().toLocaleString();
          try {
            const letsScript = await System.import('src/client/vivide/vivide.js')
              .then(m => m.letsScript);

            letsScript(await boundEval(str));
          } catch(e) {
            lively.handleError(e);
          }
        }],
        // #KeyboardShortcut ESC hide search widget
        ["Hide Search Widget", keyCode == 27, evt => {
          lively.hideSearchWidget();
        }], 
        ["Do It", ctrl && !altKey && char == "D", evt => {
          if (handledInCodeMirror(evt)) {
            return; // code mirror does not stop it's propagation
          }
          let str = window.getSelection().toLocaleString();
          lively.notify("eval: " + str)
          try {
            boundEval(str);
          } catch(e) {
            lively.handleError(e);
          }
        }],
      ];
      
      const [name, match, callback] = keyHandlers.find(([name, match]) => match) || [];
      if(callback) {
        callback(evt);
        evt.preventDefault();
      }
    } catch (err) {
      console.log("Error in handleKeyEvent" +  err);
    }
  }
}