import Morph from './Morph.js';
import {babel} from 'systemjs-babel-build';
import SyntaxChecker from 'src/client/syntax.js'
import traceBabelPlugin from "./lively-continuous-editor-plugin.js"

// import localsBabelPlugin from 'babel-plugin-locals'

//import lively from './../src/client/lively.js';

export default class ContinuousEditor extends Morph {

  initialize() {
    this.windowTitle = "Continuous Editor";  
    this.get("#source").setURL("https://lively-kernel.org/lively4/lively4-jens/demos/hello.js")
    this.get("#source").loadFile()

    lively.html.registerButtons(this);

    this.get("#traceInspector").hideWorkspace()
    this.get("#objectInspector").hideWorkspace()

    this.get("#traceInspector").addEventListener("select-object", 
      evt => this.selectCallTraceNode(evt.detail.object))

    this.editorComp().doSave = () => {
      this.get("#source").saveFile();
      this.runCode();      
    };
    
    this.editorComp().addEventListener("change", evt => 
      SyntaxChecker.checkForSyntaxErrorsCodeMirror(this.editor()));

    this.editorComp().addEventListener("change", evt => 
      this.onSourceChange(evt));


    this.editorComp().addEventListener("editor-loaded", evt => 
      this.dispatchEvent(new CustomEvent("initialize")));

  }
  
  hideMarker(markId) {
    var marker = this.editorComp().shadowRoot.querySelector("." + markId)
    if (marker) marker.style.backgroundColor = ''
    
    var traceNode = this.get("#traceView").querySelector("#" + markId)
    if (traceNode ) {
       traceNode.classList.remove("selected")
    }
  }
  
  showMarker(markId) {
    if (this.lastMarkId) {
      this.hideMarker(this.lastMarkId)
    }
    this.lastMarkId = markId
    var marker = this.editorComp().shadowRoot.querySelector("." + markId)
    if (marker) marker.style.backgroundColor = 'rgba(0,0,255,0.5)'

    var traceNode = this.get("#traceView").querySelector("#" + markId)
    if (traceNode ) {
      traceNode.classList.add("selected")
    }
  }
  
  selectCallTraceNode(node) {
    this.selectedNode = node
    if (node.markId) {
      this.showMarker(node.markId)
    }
  }

  editorComp() {
    return this.get("#source").get("lively-code-mirror");
  }
  
  editor() {
    return this.editorComp().editor
  }
  
  onSourceChange(evt) {
    this.runCode()
  }
  
  async runCode() {
    this.ast = null; // clear
    this.get("#log").innerHTML = ""
    var src = this.editor().getValue();
  
    // this.get("#astInspector").inspect(this.ast)
    try {
      var src = this.editor().getValue();
      this.result = babel.transform(src, {
        babelrc: false,
        plugins: [traceBabelPlugin],
        presets: [],
        filename: undefined,
        sourceFileName: undefined,
        moduleIds: false,
        sourceMaps: false,
        compact: false,
        comments: true,
        code: true,
        ast: true,
        resolveModuleSource: undefined
      })
    } catch(err) {
      this.get("#log").innerHTML = "" + err
    }
    
    try {
      // lively.notify("output: " + this.result.code)
      var result =  eval('' +this.result.code);
      // this.get("#result").textContent += "-> " + result;       
    } catch(err) {
        
      // this.get("#source").currentEditor().getSession().setAnnotations(err.stack.split('\n')
      //   .filter(line => line.match('runCode???'))
      //   .map(line => {
      //     let [row, column] = line
      //       .replace(/.*<.*>:/, '')
      //       .replace(/\)/, '')
      //       .split(':')
      //     return {
      //       row: parseInt(row) - 1, column: parseInt(column), text: err.message, type: "error"
      //     }
      //   }));
      this.get("#log").textContent = "" + err
    } finally {
    
    }
    if (window.__tr_last_ast__)   {
      this.ast = window.__tr_last_ast__
      this.clearMarkers()
      this.traceRoot = this.ast.calltrace
      this.get("#traceInspector").inspect(this.ast)

      this.markCallTree(this.traceRoot)
      this.updateTraceView(this.traceRoot)
      this.updateMarkerResults(this.traceRoot)
    }
  }

  updateTraceView(tree) {
    this.get("#traceView").innerHTML = ""
    this.printTraceNode(this.get("#traceView"), tree)
  }

  astNode(id) {
    return this.ast.node_map[id] 
  }
  
  nodeToString(call) {
    var astnode = this.astNode(call.id) 
    var label = ""
    if (astnode.id) {
      label += astnode.id.name +""
    } else if (astnode.left && astnode.left.name) {
      label += astnode.left.name + ""
    } else if (astnode.argument && astnode.operator) {
        label += astnode.argument.name + "";
    } else if (astnode) {
        label += astnode.type;
    } 
    if (call.value !== undefined)
      label += "="  + call.value;
    return label
  }


  printTraceNode(parent, call) {
    
    var astnode = this.astNode(call.id) 
    
    var node = document.createElement("div");
    node.setAttribute("class", "traceNode")
    
    var label = this.nodeToString(call);
    
    node.innerHTML = "<div class='traceLabel'> " + label +"</div>"
    node.setAttribute("title", "" + astnode.type)
    
    node.id = call.markId
    node.addEventListener("click", (evt) => {
      this.selectCallTraceNode(call)
      evt.stopPropagation()
    })

    parent.appendChild(node)
    call.children.forEach( ea => {
      this.printTraceNode(node, ea)
    })
  }

  clearMarkers() {
    this.lastMarkCounter = 0
    this.editor().getAllMarks()
      .filter(ea => ea.isTraceMark)
      .forEach(ea => ea.clear())
  }

  markCallTree(call) {
    var ast_node = this.astNode(call.id)

    if (ast_node && ast_node.start && ast_node.end) {
      if (!call.markId) call.markId = 'tracemark' + this.lastMarkCounter++

      var editor = this.editor()
      editor.markText( 
        {line: ast_node.loc.start.line - 1, ch: ast_node.loc.start.column}, 
        {line: ast_node.loc.end.line - 1, ch: ast_node.loc.end.column}, 
        {
          isTraceMark: true,
          className: "marked " +  call.markId,
          css: "background-color: rgba(0,0,255,0.05)",
          title: ast_node.type
        })
    } 
    call.children.forEach(ea => {
      this.markCallTree(ea)
    })
  }

  updateMarkerResults(node) {
    this.editor().clearGutter("rightgutter")
    var parentBounds = this.getBoundingClientRect()
    this.updateMarkerResultsEach(this.get('#markerLayer'), node, parentBounds)
  }
  
  addMarkerResult(line, text, node) {
    var editor = this.editor()
    var gutterMarkers = editor.lineInfo(line).gutterMarkers;
    var markerLine = gutterMarkers && gutterMarkers.rightgutter
    if (!markerLine) {
        var markerLine = document.createElement("div")
        markerLine.style.backgroundColor = "rgb(240,240,240)"
        markerLine.style.fontSize = "8pt"
        markerLine.classList.add("markerLine")  // markerLine    
        editor.setGutterMarker(line, "rightgutter", markerLine)
    }
    var resultNode = document.createElement("span");
    resultNode.classList.add("markerResult")
    resultNode.classList.add(node.markId)
    
    // node.code + " = " +
    resultNode.textContent =  text
    
    resultNode.id = node.markId
    resultNode.addEventListener("click", (evt) => {
        this.selectCallTraceNode(node)
        evt.stopPropagation()
    })
    markerLine.appendChild(resultNode)
  }
  
  updateMarkerResultsEach(markerLayer, node, parentBounds) {
    var ast_node = this.astNode(node.id)
    if (ast_node.type == "UpdateExpression") {
      this.addMarkerResult(ast_node.loc.start.line - 1, 
        ast_node.argument.name + "=" + node.value + ";", node)
    }
    if (ast_node.type == "VariableDeclarator") {
      this.addMarkerResult(ast_node.loc.start.line - 1, 
        ast_node.id.name + "=" + node.value + ";", node)
    }
    if (ast_node.type == "AssignmentExpression") {
      this.addMarkerResult(ast_node.loc.start.line - 1, 
        ast_node.left.name + "=" + node.value + ";", node)
    }
    if (ast_node.type == "CallExpression") {
      this.addMarkerResult(ast_node.loc.start.line - 1, 
        ast_node.callee.name + "("+ ast_node.arguments.map( ea => {
          var eaCall = this.findBroadCallNode(ea.traceid, node) 
          return eaCall && eaCall.value 
        }).join(",")+")=>" + node.value + ";", node)
    }
    node.children.forEach(ea => this.updateMarkerResultsEach(markerLayer, ea, parentBounds))
  }
  
  findBroadCallNode(id, node) {
    return this.findBroadCallNodes(id, [node], new Map())
  }

  findBroadCallNodes(id, nodes, visited) {
    while(nodes.length > 0) {
      var ea = nodes.shift()  
      if (ea.id == id) return ea
      ea.children.forEach(child => {
        if (!visited.get(child)) {
          nodes.push(child)
        }
      })
    }
    return null
  }

  livelyMigrate(other) {
    this.addEventListener("initialize", () => {
      this.get("#source").setURL(other.get("#source").getURL())
      this.editor().setValue(other.editor().getValue())
      // this.editor().selection.setRange(other.editor().selection.getRange())
      // var viewState = other.get("#traceInspector").getViewState()
      
      // #TODO time dependency... on what should we wait here?
      setTimeout(() => this.runCode(),200)
      
      // this.get("#traceInspector").setViewState(viewState)
    })
  }
  
}
