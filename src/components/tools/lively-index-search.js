import Morph from 'src/components/widgets/lively-morph.js';

// import lively from 'src/client/lively.js';

import FileIndex from "src/client/fileindex.js"


export default class IndexSearch extends Morph {
  initialize() {
    this.windowTitle = "File Search";
    this.registerButtons();
    this.get("lively-separator").toggleCollapse()
    // this.get("lively-editor").hideToolbar();
    
    lively.html.registerInputs(this);
    

    ['#searchInput'].forEach(selector => {
      lively.addEventListener("lively-search", this.get(selector), "keyup", (evt) => { 
          if(evt.keyCode == 13) { 
            try {
              this.onSearchButton(); 
            } catch(e) {
              console.error(e);
            }
          }
      });
    });
      
    var search = this.getAttribute("search");
    if(search) {
      this.get("#searchInput").value = search;
      this.searchFile();
    }
  }

  focus() {
    this.get("#searchInput").focus();
  }
  clearLog(s) {
    this.get("#searchResults").innerHTML="";
  }

  async showSearchResult(url, lineAndColumn) {
    var editor =  this.get("#editor")
    
    // unhide editor, when it is needed
    if (editor.style.flexGrow < 0.01) { // #Hack
      this.get("lively-separator").toggleCollapse()    
    }
    
    editor.setURL(url)
    await editor.loadFile()
    
    var codeMirror = await editor.awaitEditor()
    codeMirror.setSelection(
      {line: lineAndColumn.line, ch: lineAndColumn.column},
      {line: lineAndColumn.line, ch: lineAndColumn.column + 
        (lineAndColumn.selection ? + lineAndColumn.selection.length : 0)})
    codeMirror.focus()
    codeMirror.scrollIntoView(codeMirror.getCursor(), 200)
    
    
  }

  browseSearchResult(url, pattern) {
    return lively.openBrowser(url, true, pattern, undefined, /* lively.findWorldContext(this)*/);
  }

  onSearchResults(list) {
    for (var ea of list) {
      let pattern = ea.text;
      let url = ea.url;
      let item = document.createElement("tr");
      let filename = ea.file.replace(/.*\//,"")
      let lineAndColumn = {
        line: ea.line, 
        column: ea.column,
        selection: ea.selection }
      item.innerHTML = `<td class="filename"><a>${filename}</a></td>
        <td class="line">${ea.line + 1}:</td>
        <td><span ="pattern">${
        pattern.replace(/</g,"&lt;")}</span></td>`;
      let link = item.querySelector("a");
      link.href = ea.file;
      link.url = url
      link.title = ea.file
      var self = this
      link.onclick = (evt) => {
        if (evt.shiftKey) {
          this.browseSearchResult(url, lineAndColumn);
        } else {
          this.showSearchResult(url, lineAndColumn);
        }
        return false;
      };
      this.get("#searchResults").appendChild(item);
    }
  }

  onSearchButton() {
    this.setAttribute("search", this.get("#searchInput").value);
    this.searchFile();
  }
  
  onReplaceButton() {
    this.replaceInFiles(
      this.get("#searchInput").value,
      this.get("#replaceInput").value)
  }
  
  onEnableReplaceButton() {
    if (this.getAttribute("replace") == "true") {
      this.setAttribute("replace", "false")
    } else {
      this.setAttribute("replace", "true")
    }
  }
  
  getSearchURL() {
    // return "https://lively-kernel.org/lively4S2/_search/files" // #DEV
    if (document.location.host == "livelykernel.github.io")
      return "https://lively-kernel.org/lively4/_search/files";
    else
      return lively4url + "/../_search/files";
  }
  

  async searchFile(text) {
    this.clearLog()
    if (text) {
      this.setAttribute("search", text); // #TODO how to specify data-flow / connections...
      this.get("#searchInput").value = text;
    }
    // if (this.searchInProgres) return;
    var search = this.get("#searchInput").value;
    if (search.length < 2) {
      this.log("please enter a longer search string");
      this.searchInProgres = false;
      return; 
    }
    this.clearLog();
    this.get("#searchResults").innerHTML = "searching ..." + JSON.stringify(search);
    let start = Date.now();
    var list = await this.searchFilesList(search )
    this.searchInProgres = false;
    this.clearLog();
    //this.log('found');
    this.log(`finished in ${Date.now() - start}ms`);
    this.onSearchResults(list);
  }

  async searchFilesList(pattern) {
    this.searchInProgres = true;
    

    var search = new RegExp(pattern)
    var result = []
    var searchTime = await lively.time(async () => {
      var root = lively4url; // there are other files in our cache... too 
      return FileIndex.current().db.files.each(file => {
        if (file.url.startsWith(root) && file.content) {
          var m = file.content.match(search)
          if (m) {
            result.push({file: file, match: m})
          }
        }
      })  
    })
    
    var list = []
    result.forEach( ea => {
      console.log("found " + ea.file.url)
      var lines = ea.file.content.split("\n")
      lines.forEach((eaLine, index) => {
        var m = eaLine.match(pattern)
        if (m) {
          var lineNumber = index
          // var lineNumber = index + 1 // first line is "1"
          list.push({
            file: ea.file.url.toString().replace(/[.*\/]/,""), 
            url: ea.file.url.toString(),
            line: lineNumber,
            column: m.index,
            text: eaLine,
            selection: m[0]
          })          
        }
      })
    })
    this.files = list
    this.searchInProgres = false;
    return list
  }

  log(s) {
    var entry = <tr><td class="logentry" colspan="2">{s}</td></tr>
    this.get("#searchResults").appendChild(entry)
  }
  
 
  livelyMigrate(other) {
    this.get("#searchInput").value =  other.get("#searchInput").value
  }
  
}
