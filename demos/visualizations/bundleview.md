# BundleView 

<script>
import FileIndex from "src/client/fileindex.js"
import files from "src/client/files.js"
import moment from "src/external/moment.js";


import d3 from "src/external/d3.v3.js"

(async () => {
  var now = Date.now()
  
  
  var url = lively4url + "/src/client/"
  var tree = await files.fileTree(url)

  function visit(d, cb) {
    cb(d)
    d.children && d.children.forEach(ea => visit(ea,cb))
  }

  var urlMap = new Map()
  var idCounter = 1
  
  visit(tree, d => {
    d.attributes = {}
    d.id = idCounter++
    urlMap.set(d.url, d)
  })
  
  
  
  
  // connect our dababase entries with visualization data nodes
  await FileIndex.current().db.files.each(eaFile => {
    var d = urlMap.get(eaFile.url)
    if (d) {
      d.index = eaFile
      d.attributes.size = Number(d.index.size)
      d.label = d.name
    }
  })
  
  var div = await lively.create("div")
  div.style.position = "relative"
  div.style.width = "800px"
  div.style.height = "800px"
  
  var treemap = await lively.create("d3-bundleview")


  //   const flareJSON = await fetch('https://raw.githubusercontent.com/onsetsu/d3-bundleview/master/example/flare-compat.json').then(r => r.json());
  // treemap.display(flareJSON);

  var relations = []
  Object.values(System.loads).forEach(load => {
    load.dependencies.forEach((dependency) => {
      var depKey = System.normalizeSync(dependency, load.key)
      var sourceNode =  urlMap.get(load.key)
      var targetNode =  urlMap.get(depKey)
      if (!sourceNode || !targetNode) {
        if (!sourceNode)
          console.log("could not find node" + load.key )
        if (!targetNode)
          console.log("could not find node" + depKey )

      } else {
        console.log("add relation " + sourceNode.id + " -> " + targetNode.id)
        relations.push({
          source: sourceNode.id,
          target: targetNode.id,
        })
      }
    })
  })

  treemap.setData({nodes: tree, relations: relations})
  
  treemap.style.backgroundColor = "lightgray"
  
  // positioning hack.... we make our coordinate system much easier by this
  lively.setPosition(treemap, lively.pt(0,0))
  treemap.style.width = "100%"
  treemap.style.height = "100%"
  
  div.appendChild(treemap)

  // var maxSize = 0
  // visit(treemap.treeData, ea => {
  //   if(ea.size) {
  //     maxSize = Math.max(maxSize, Number(ea.size))
  //   }
  // })

  // var color = d3.scaleLinear().domain([0,25])
  //       .interpolate(d3.interpolateHcl)
  //       .range([d3.rgb("#FFFFFF"), d3.rgb('#9A9A9A')]);


  treemap.dataSize = function(d) {
    
    // return color(d.data.index && d.data.index.tags ? d.data.index.tags.length : 0)
    if (d.data && d.data.index && d.data.index.size) {
      return (Number(d.data.index.size) * 0.001) + 5
    }
    return 5
  }

//   treemap.dataColor = function(d) {
//     // return color(d.data.index && d.data.index.tags ? d.data.index.tags.length : 0)
//     if (d.data && d.data.index) {
//       var time = moment(d.data.index.modified)
//       var days = (now - time._d.getTime()) / 1000 / 60 / 60 / 24

//       return color(days)
//     }
//   }
  
  treemap.dataClick = function(d, evt) {
    if (evt.shiftKey) {
      lively.openInspector(d)
    
    } else {
      lively.openBrowser(d.url) // d.data.url vs d.url (separating vs merging data into node) #Discussion #D3 
    }
  }

  // treemap.updateViz()

  return div
})()
</script>