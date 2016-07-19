import Morph from './Morph.js';
import Files from "src/client/files.js";
import * as search from "src/client/search/search.js";


export default class IndexManager extends Morph {

  initialize() {
    this.windowTitle = "Index Manager";
    this.serverList = this.getSubmorph("#server-table");
    this.dropboxList = this.getSubmorph("#dropbox-table");

    $(this.getSubmorph(".container")).on("click", ".refresh-button", evt => {
      let target = evt.currentTarget;
      this.refreshIndex(target.dataset.mountType, target.dataset.path);
    });

    $(this.getSubmorph(".container")).on("click", ".create-button", evt => {
      let target = evt.currentTarget;
      this.createIndex(target.dataset.mountType, target.dataset.path);
    });

    let mountRequest = new Request("https://lively4/sys/mounts");
    Promise.all([
      fetch(mountRequest).then(resp => {
        return resp.json();
      }).then(mounts => {
        this.appendDropboxes(mounts.filter(m => { return m.name === "dropbox" }));
      }),
      this.appendServerRepos()
    ]).then(() => {
      let availableMounts = search.getAvailableMounts();
      Object.keys(availableMounts.dropbox).forEach(path => {
        this.refreshIndex("dropbox", path);
      });
      this.refreshIndex("server", "/" + window.location.pathname.split("/")[1]);
    });


  }

  appendDropboxes(mounts) {
    mounts.forEach(mount => {
      this.dropboxList.innerHTML += this.getEntryFor("dropbox", mount.path);
    });
  }

  appendServerRepos() {
    return Files.statFile(lively4url + "/..").then(res => {
    	return JSON.parse(res);
    }).then(jsonRes => {
    	return jsonRes.contents.filter(file => {
    		return file.type === "directory";
    	}).map(dir => {
    		return "/" + dir.name;
    	}).forEach(path => {
    	  this.serverList.innerHTML += this.getEntryFor("server", path);
    	});
    });
  }

  getEntryFor(mountType, path) {
    return `<tr>
        <td>${path}</td>
        <td><i id=${path.slice(1)}-status>unknown</i></td>
        <td>
          <button data-path=${path} data-mount-type=${mountType} class="refresh-button"><i class="fa fa-refresh" aria-hidden="true"></i></button>
          <button data-path=${path} data-mount-type=${mountType} class="create-button"><i class="fa fa-plus" aria-hidden="true"></i></button>
        </td>
      </tr>`
  }

  createIndex(mountType, path) {
    console.log("create index at", mountType, path);
    let statusText = this.getSubmorph(`#${path.slice(1)}-status`);
    statusText.innerHTML = "waiting...";
    search.loadIndex(mountType, path).then(() => {
      this.refreshIndex(mountType, path);
    });
  }

  refreshIndex(mountType, path) {
    let statusText = this.getSubmorph(`#${path.slice(1)}-status`);
    statusText.innerHTML = "waiting...";
    console.log("refresh index at", mountType, path);
    search.getStatus(mountType, path).then(status => {
      statusText.innerHTML = status;
    });
  }

}
