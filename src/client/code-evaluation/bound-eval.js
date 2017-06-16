import generateUUID from './../uuid.js';
import { setCode } from './../workspaces.js';
import Preferences from "./../preferences.js";

export default async function boundEval(source, thisReference, targetModule) {
  try {
    // 'this' reference
    window.__global_this__ = thisReference;
    
    // binding module
    window.__topLevelVarRecorder_ModuleName__ = targetModule;

    // source
    // TODO: we currently use a newly generated UUID on each evaluation to trick SystemJS into actually loading it (therefore, we use codeId):
    let codeId = generateUUID();
    setCode(codeId, source);
    
    var path = 'workspace:' + encodeURI(codeId)
    if (Preferences.get('DisableAExpWorkspace')) {
      path = path.replace(/^workspace/, "workspacejs")
    }
    return System.import(path)
      .then(m => {
        lively.unloadModule(path)
        return ({value: m.__result__ })});
  } catch(err) {
    return Promise.resolve({ value: err, isError: true });
  }
}
