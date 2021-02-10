import { message } from 'antd/lib';
import { authHeader, handleError } from "./AuthHeader.js"

export function handleJobDelete(jobId, applicationId) {
  return new Promise((resolve) => {
	  var data = JSON.stringify({jobId: jobId, application_id: applicationId});
	  fetch("/api/job/delete", {
	    method: 'post',
	    headers: authHeader(),
	    body: data
	  }).then((response) => {
	    if(response.ok) {
	      resolve(response.json());
	    } else {
	    	handleError(response);
	    }
	  }).catch(error => {
	    console.log(error);
	    message.error("There was an error deleting the Job file");
	  });
	});
}

export function handleIndexDelete(indexId, applicationId) {
  return new Promise((resolve) => {
	  var data = JSON.stringify({indexId: indexId, application_id: applicationId});
	  fetch("/api/index/read/delete", {
	    method: 'post',
	    headers: authHeader(),
	    body: data
	  }).then((response) => {
	    if(response.ok) {
	      resolve(response.json());
	    } else {
	    	handleError(response);
	    }
	  }).catch(error => {
	    console.log(error);
	    message.error("There was an error deleting the Index file");
	  });
	});
}

 export function handleQueryDelete(queryId, applicationId) {
  return new Promise((resolve) => {
	  var data = JSON.stringify({queryId: queryId, application_id: applicationId});
	  fetch("/api/query/delete", {
	    method: 'post',
	    headers: authHeader(),
	    body: data
	  }).then((response) => {
	    if(response.ok) {
	      resolve(response.json());
	    } else {
	    	handleError(response);
	    }
	  }).catch(error => {
	    console.log(error);
	    message.error("There was an error deleting the Query");
	  });
	});
}

export function handleFileDelete (fileId, applicationId) {
  return new Promise((resolve) => {
    var data = JSON.stringify({fileId: fileId, application_id: applicationId});
    fetch("/api/file/read/delete", {
      method: 'post',
      headers: authHeader(),
      body: data
    }).then((response) => {
      if(response.ok) {
        resolve(response.json());
      } else {
      	handleError(response);
      }
    }).catch(error => {
      console.log(error);
      message.error("There was an error deleting the file");
    });
  });
}

export function handleFileInstanceDelete (fileInstanceId) {
	console.log(fileInstanceId)
  return new Promise((resolve) => {
    var data = JSON.stringify({id: fileInstanceId});
    fetch("/api/fileinstance/delete", {
      method: 'post',
      headers: authHeader(),
      body: data
    }).then((response) => {
      if(response.ok) {
        resolve(response.json());
      } else {
      	handleError(response);
      }
    }).catch(error => {
      console.log(error);
      message.error("There was an error deleting the file");
    });
  });
}

export function handleSubProcessDelete (subProcessId, applicationId) {
  return new Promise((resolve) => {
    var data = JSON.stringify({dataflowId: subProcessId, applicationId: applicationId});
    fetch("/api/dataflow/delete", {
      method: 'post',
      headers: authHeader(),
      body: data
    }).then((response) => {
      if(response.ok) {
        resolve(response.json());
      } else {
      	handleError(response);
      }
    }).catch(error => {
      console.log(error);
      message.error("There was an error deleting the file");
    });
  });
}

export function updateGraph(assetId, applicationId, selectedDataflow) {
  return new Promise((resolve) => {
	  var data = JSON.stringify({id: assetId, application_id: applicationId, dataflowId: selectedDataflow.id});
	  fetch("/api/dataflowgraph/deleteAsset", {
	    method: 'post',
	    headers: authHeader(),
	    body: data
	  }).then((response) => {
	    if(response.ok) {
	      resolve(response.json());
	    }
	  }).catch(error => {
	    console.log(error);
	    message.error("There was an error updating the graph");
	  });
	});
}

export function changeVisibility(assetId, applicationId, selectedDataflow, hide) {
  return new Promise((resolve) => {
    var data = JSON.stringify({id: assetId, application_id: applicationId, dataflowId: selectedDataflow.id, hide: hide});
    fetch("/api/dataflowgraph/changeNodeVisibility", {
      method: 'post',
      headers: authHeader(),
      body: data
    }).then((response) => {
      if(response.ok) {
        resolve(response.json());
      }
    }).catch(error => {
      console.log(error);
      message.error("There was an error updating the graph");
    });
  });
}