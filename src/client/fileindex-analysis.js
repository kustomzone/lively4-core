/*
 * File Index for Static Analysis and Searching
 *
 * #TODO How do we get this a) into a web worker and b) trigger this for changed files
 * 
 */
import Dexie from "src/external/dexie.js"
import Strings from "src/client/strings.js"
import babelDefault from 'systemjs-babel-build';
const babel = babelDefault.babel;
import * as cop from "src/client/ContextJS/src/contextjs.js";

export default class FileIndex {

  static current() {
    // FileIndex._current = null
    if (!this._current) {
      this._current = new FileIndex("analysis_file_cache")
    }
    return this._current
  }

  toString() {
    return "["+this.name+":FileIndex]"
  }

  clear() {
    this.db.files.clear()   
    this.db.modules.clear()
    this.db.classes.clear()
    this.db.links.clear()
    this.db.versions.clear()
    // this.db.delete() 
  }

  constructor(name) {
    this.name = name
    this.db = this.fileCacheDB()
  }

  fileCacheDB() {
    var db = new Dexie(this.name);

    db.version("1").stores({
        files: 'url,name,type,version,modified,options,title,tags,*classes,*functions,*links',
        modules: 'url,*dependencies',
        links: '[link+url], link, url, location, status',
        classes: '[name+url], name, url, size, *methods', 
        versions: '[commitId+class+method+url], class, method, date, action, user,  url, commitId'
    }).upgrade(function () {
    })
    return db 
  }

  async toArray() {
    return this.db.files.where("name").notEqual("").toArray()
  }

  async update() {
    await this.updateTitleAndTags()
    await this.updateAllModuleSemantics()
    await this.updateAllLinks()
    await this.updateAllLatestVersionHistories()
  }
  
  async updateTitleAndTags() {
    return this.showProgress("update title", () => {
      return this.db.files.where("name").notEqual("").modify((ea) => {
         this.extractTitleAndTags(ea)
      });
    })
  }

  extractTitleAndTags(file) {
    if (!file.content) return;
    file.title = file.content.split("\n")[0].replace(/## /,"")
    file.tags = Strings.matchAll('(?: )(#[A-Za-z0-9]+)(?=[ \n])(?! ?{)', file.content)
      .map(ea => ea[1])
  }
  
  async updateAllModuleSemantics() {
     this.db.transaction('rw', this.db.files, this.db.modules, () => {
      return this.db.files.where("type").equals("file").toArray()
    }).then((files) => {
      files.forEach(file => {
        this.addModuleSemantics(file)
      })
    })
  }
  
  async addModuleSemantics(file) {
    if (file.name && file.name.match(/\.js$/)) { 
      var result = this.extractModuleSemantics(file)
      this.updateModule(file, result)
      this.updateClasses(file, result)
    }
  }
  
  extractModuleSemantics(file) {
    var ast = this.parseSource(file.url, file.content)
    var results = this.parseModuleSemantics(ast)
    return results;
  }
  
  async updateClasses(file, semantics) {
    if (!semantics || !semantics.classes) {
      return
    }
    
    this.db.transaction("rw", this.db.classes, () => {
      for(var clazz of semantics.classes) {
        clazz.url = file.url
        this.db.classes.put(clazz)        
      }
    })
  } 

  async updateModule(file, semantics) {
    if (!semantics || !semantics.dependencies) {
      return
    }
    var resolvedDependencies = new Array()
    for(const dependency of semantics.dependencies) {
      var resolvedDependency = await System.resolve(dependency, file.url)
      resolvedDependencies.push(resolvedDependency)
    }
    var module = {
      url: file.url,
      dependencies: resolvedDependencies
    }
    
    this.db.transaction("rw", this.db.modules, () => {
      this.db.modules.put(module)
    })
  }
  
  async updateAllLinks() {
     /*this.db.transaction('rw', this.db.files, () => {
      return this.db.files.where("type").equals("file").toArray().then((files) => {
        files.forEach((file) => {
          this.addLinks(file)   
        })
      })
    })*/
    
    this.db.transaction('rw', this.db.files, () => {
      return this.db.files.where("type").equals("file").each(async(file) => {
        await this.addLinks(file) 
      })
    })
  }
  
  async addLinks(file) {
    this.extractLinks(file).then(links => {
      this.db.transaction("rw!", this.db.links, () => {
        if (links) {
          this.db.links.bulkPut(links)
        }
      })
    })
  }
  
 async extractLinks(file) {   
    if (!file || !file.content) {
      return [];
    }
    var links = new Array()
    var extractedLinks =  file.content.match(/(((http(s)?:\/\/)(w{3}[.])?)([a-z0-9\-]{1,63}(([\:]{1}[0-9]{4,})|([.]{1}){1,}([a-z]{2,})){1,})([\_\/\#\-[a-zA-Z0-9]*)?[#.?=%;a-z0-9]*)/g)
    
    if(!extractedLinks) {
      return [];
    }
    for (const extractedLink of extractedLinks) {
      var link = {
        link: extractedLink,
        location: extractedLink.includes(window.location.hostname) ? "internal" : "external",
        url: file.url,
        status: await this.validateLink(extractedLink)
      }
      links.push(link)   
    }
   return links;
 }
  
 async validateLink(link) { 
  return await fetch(link, { 
    method: "GET", 
    mode: 'no-cors', 
    redirect: "follow"
  })
  .then((response) => {
    if (response.type === "basic") { // internal link
      if (response.ok) {
        return "alive"
      } else {
        return "dead"
      } 
    } else if (response.type === "opaque") { // external link
      return "alive"
    }
  })
  .catch((error) => {console.log(error, "Link: " + link); return "dead"})
  }
    
  async updateAllLatestVersionHistories() {
     this.db.transaction('rw', this.db.files, this.db.versions, () => {
      return this.db.files.where("type").equals("file").toArray()
    }).then((files) => {
      files.forEach(file => {
        if(file.name && file.name.match(/\.js$/))
          this.addLatestVersionHistory(file.url)
      })
    })
  }
  
  async addLatestVersionHistory(file) {
    let response = await lively.files.loadVersions(file.url)
    let json = await response.json()
    let versions = json.versions
    
    // consider latest two versions
    if (!versions[0] || !versions[1]) return
    var modifications = await this.findModifiedClassesAndMethods(file.url, versions[0], versions[1])
    
    this.db.transaction("rw", this.db.versions, () => {
      this.db.versions.bulkPut(modifications)
    })
  } 
  
  async findModifiedClassesAndMethods(fileUrl, latestVersion, previousVersion) {
    let modifications = new Array()
    let latestContent = await lively.files.loadFile(fileUrl, latestVersion.version)
    let previousContent = await lively.files.loadFile(fileUrl, previousVersion.version)
    let astLastest = this.parseSource(fileUrl, latestContent)
    let astPrevious = this.parseSource(fileUrl, previousContent)

    if (!astLastest || !astPrevious) {
      return modifications
    }

    let latest = this.parseModuleSemantics(astLastest)
    let previous = this.parseModuleSemantics(astPrevious)

    // classes
    for (let classLatest of latest.classes) {
      try {
        let previousClass = previous.classes.find(clazz => clazz.name == classLatest.name);    
        if (!previousClass || (previousClass && classLatest.size !== previousClass.size)) { // added or modified class
          modifications.push({
            url: fileUrl,
            class: classLatest.name,
            method: "+null+",
            date: latestVersion.date,
            user: latestVersion.author,
            commitId: latestVersion.version,
            action: (!previousClass) ? "added" : "modified"
          })
        }
        
        // methods
        for (let methodLastest of classLatest.methods) {
          if (!previousClass) { // added method
             modifications.push({
                url: fileUrl,
                class: classLatest.name,
                method: methodLastest.name,
                date: latestVersion.date,
                user: latestVersion.author,
                commitId: latestVersion.version,
                action: "added"
              })
          } else {
            let methodPreviousClass = previousClass.methods.find(method => method.name == methodLastest.name)
            if ((!methodPreviousClass) || (methodPreviousClass && methodLastest.size !== methodPreviousClass.size) ) { // added or modified method
              modifications.push({
                url: fileUrl,
                class: classLatest.name,
                method: methodLastest.name,
                date: latestVersion.date,
                user: latestVersion.author,
                commitId: latestVersion.version,
                action: (!methodPreviousClass) ? "added" : "modified"
              })
            }
          }
        }
      
        if (!previousClass) continue;
        for (let methodPreviousClass of previousClass.methods) {
          let latestClassMethod = classLatest.methods.find(method => method.name == methodPreviousClass.name)
          if (!latestClassMethod) { // deleted method
            modifications.push({
              url: fileUrl,
              class: classLatest.name,
              method: methodPreviousClass.name,
              user: latestVersion.author,
              date: latestVersion.date,
              commitId: latestVersion.version,
              action: "deleted"
            })
          }
        }
      } catch(error) {
        console.error("Version history couldn't created for class: ", classLatest, error)
      }
    }
    return modifications 
  }
  
  parseModuleSemantics(ast) {
    let classes = []
    let dependencies = []
    babel.traverse(ast,{
      ImportDeclaration(path) {
        if(path.node.source && path.node.source.value) {
          dependencies.push(path.node.source.value)
        }
      },
      ClassDeclaration(path) {
        if (path.node.id) {
          let clazz = {
            name: path.node.id.name,
            size: path.node.end-path.node.start
          }
          let methods = []
          if (path.node.body.body) {
            path.node.body.body.forEach(function(item){
              if(item.type === "ClassMethod") {
                let method = {
                  name: item.key.name,
                  size: item.end-item.start
                }
                methods.push(method)
              }
            })
          }
          clazz.methods = methods
          classes.push(clazz)
        } 
      }
    })
    return {classes, dependencies}
  }

  async updateFunctionAndClasses() {
    return this.showProgress("extract functions and classes", () => {
      this.db.files.where("name").notEqual("").modify((file) => {
        if (file.name && file.name.match(/\.js$/)) {
          this.extractFunctionsAndClasses(file)
        }
      })
    })
  }
  
  // ********************************************************

  showProgress(label, func) {
    ShowDexieProgress.currentLabel = label
    return cop.withLayers([ShowDexieProgress], () => {
        return func()
    })
  }
  
  extractFunctionsAndClasses(file) {
    var ast = this.parseSource(file.url, file.content)
    var result = this.parseFunctionsAndClasses(ast)
    
    file.classes = result.classes
    file.functions  = result.functions
  }

  parseFunctionsAndClasses(ast) {
    var functions = []
    var classes = []
    babel.traverse(ast,{
      Function(path) {
        if (path.node.key) {
          functions.push(path.node.key.name)
        } else if (path.node.id) {
          functions.push(path.node.id.name)
        }
      },
      ClassDeclaration(path) {
        if (path.node.id) {
          classes.push(path.node.id.name)
        }
      }
    })
    return {functions, classes}
  }

  parseSource(filename, source) {
    try {
      return babel.transform(source, {
          babelrc: false,
          plugins: [],
          presets: [],
          filename: filename,
          sourceFileName: filename,
          moduleIds: false,
          sourceMaps: true,
          compact: false,
          comments: true,
          code: true,
          ast: true,
          resolveModuleSource: undefined
      }).ast
    } catch(e) {
      console.log('FileIndex, could not parse: ' + filename)
      return undefined
    }
  }

  async updateFile(url) {
    console.log("FileCache updateFile " + url)
    var stats = await fetch(url, {
      method: "OPTIONS"
    }).then(r => r.json())
    this.addFile(url, stats.name, stats.type, stats.size, stats.modified)
  } 
    
  async addFile(url, name, type, size, modified) {    
    if (url.match("/node_modules") || url.match(/\/\./) ) {
      // console.log("FileIndex ignore  " + url)
      return
    }    
    console.log("FileIndex update  " + url)

    var file = {
      url: url,
      name: name,
      size: size,
      modified: modified
    }
    
    if (name.match(/\.((css)|(js)|(md)|(txt)|(x?html))$/)) {
      if (size < 100000) {
        let response = await fetch(url)
        file.version = response.headers.get("fileversion")
        file.content = await response.text()    
      }
    }

    let fileType = url.replace(/.*\./,"")
    if(type == "directory") {
      type = "directory"
    }
    file.type = type
    
    if (file.content) {
      this.extractTitleAndTags(file) 
      this.addLinks(file)
      
      if (file.name.match(/\.js$/)) {
        this.addModuleSemantics(file)
        this.addLatestVersionHistory(file)
        this.extractFunctionsAndClasses(file)
      }      
    }
    this.db.transaction("rw", this.db.files, () => { 
      this.db.files.put(file) 
    })
  }

  async dropFile(url) {
    console.log("FileIndex drop " + url + " from index")
    this.db.transaction("rw", this.db.files, () => {
      this.db.files.delete(url)
    })
  }
  
  async updateDirectory(baseURL, showProgress, updateDeleted) {
    var json = await fetch(baseURL, {
      method: "OPTIONS",
      headers: {
        filelist  : true
      }
    }).then(r => {
      if (r.status == 200) {
        return r.json()
      } else {
        console.log("FileIndex fetch failed ", baseURL, r)
      }
    })
    if (!json) {
      console.log("FileIndex could not update " + baseURL)
      return
    }
    
    if (showProgress) {
      var progress = await lively.showProgress("add " + baseURL.replace(/\/$/,"").replace(/.*\//,""))
      var total = json.contents.length
      var i=0
    }

    var lastModified= new Map()
    var visited = new Set()
    var all = new Set()
    await this.db.files.each(file => {
      all.add(file.url)
      lastModified.set(file.url, file.modified) // #Workaround #PerformanceBug in #IndexDB 
    })
    
    try {
      for(let ea of json.contents) {
          if (showProgress) progress.value = i++ / total;

          let eaURL = baseURL.replace(/\/$/,"") + ea.name.replace(/^\./,"")
          let name = eaURL.replace(/.*\//,"")
          if (lastModified.get(eaURL) !== ea.modified) {
            await this.addFile(eaURL, name, ea.type, ea.size, ea.modified)
          }
          visited.add(eaURL)
      }
      all.forEach(eaURL => {
        if (eaURL.startsWith(baseURL) && !visited.has(eaURL)) {
          this.dropFile(eaURL)
        }
      }) 
    } finally {
      if (showProgress) progress.remove()
    } 
    console.log("FileIndex updateDirectory finished")
  }

  async addDirectory(baseURL) {
    this.updateDirectory(baseURL, true) // much faster and better
  }
    
//   async addDirectory(baseURL, depth) {
//     console.log("addDirectory " + baseURL + " "  + depth)
//     var contents = (await fetch(baseURL, {method: "OPTIONS"}).then( resp => resp.json())).contents
//     var progress = await lively.showProgress("add " + baseURL.replace(/.*\//,""))
//     var total = contents.length
//     var i=0
//     try {
//       for(let ea of contents) {
//         progress.value = i++ / total;
//         let eaURL = baseURL.replace(/\/$/,"")  + "/" + ea.name
//         let name = eaURL.replace(/.*\//,"")
//         let size = ea.size;
//         if (name.match(/^\./)) {
//           console.log("ignore hidden file " + eaURL)
//           continue
//         };

//         if (ea.type == "directory" && (depth > 0)) {
//           console.log("[file cache] decent recursively: " + eaURL )
//           this.addDirectory(eaURL, depth - 1)
//         }
//         if (await this.db.files.where("url").equals(eaURL).first()) {
//           console.log("already in cache: " + eaURL)
//         } else {
//           this.addFile(eaURL, name, ea.type,  size, ea.modified /* may be be set */)
//         }
//       }
//     } finally {
//       progress.remove()
//     }
//   }


  showAsTable() {
    var result= []
    this.db.files.each(ea => {
      result.push({
        url:ea.url,
        size: ea.size,
        title: (ea.title) ? ea.title.replace(/</g, "&lt;").slice(0,100) : "",
        tags: ea.tags,
        classes: ea.classes,
        functions: ea.functions
        })
    }).then(() => {
      var sorted = _.sortBy(result, ea => Number(ea.size)).reverse()

      lively.openComponentInWindow("lively-table").then(table => {
        table.setFromJSO(sorted)
        table.style.overflow = "auto"
        table.column("size").forEach(cell => cell.classList.add("number"))
      })
      console.log("result: " + result.length)
    })
  }
}

cop.layer(self, "ShowDexieProgress").refineClass(FileIndex.current().db.Collection, {
  async modify(func) {
    var i = 0
    var total = await this.count()
    var progress = await lively.showProgress("update");
    if (ShowDexieProgress.currentLabel) {
      progress.textContent = ShowDexieProgress.currentLabel
    }
    var innerFunc = function(ea)  {
      progress.value = i++ / total
      func(ea)
    }
    // #TODO 'cop.proceed' does not work in the async setting...
    var result = await cop.withoutLayers([ShowDexieProgress], async () => {
      return this.modify(innerFunc)
    })
    progress.remove()
    return result
  }
})

