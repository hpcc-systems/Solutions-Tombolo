const dbUtil = require('./db');
var request = require('request');
var requestPromise = require('request-promise');
var models  = require('../models');
var Cluster = models.cluster;
let hpccJSComms = require("@hpcc-js/comms");
const crypto = require('crypto');
let algorithm = 'aes-256-ctr';

exports.fileInfo = (fileName, clusterId) => {
	console.log('fileName: '+fileName+', '+clusterId);
	return new Promise((resolve, reject) => {
		module.exports.getCluster(clusterId).then(function(cluster) {
				let clusterAuth = module.exports.getClusterAuth(cluster);
				let dfuService = new hpccJSComms.DFUService({ baseUrl: cluster.thor_host + ':' + cluster.thor_port, userID:(clusterAuth ? clusterAuth.user : ""), password:(clusterAuth ? clusterAuth.password : "")});
				dfuService.DFUInfo({"Name":fileName}).then(response => {
			  	var processFieldValidations = function(fileLayout) {
	      		var fieldsValidations=[];
	      		fileLayout.forEach(function(field, idx) {
	      			//fields[idx] = field.trim().replace(";","");
	      			var validations = {
		      			"name" : field.name,
		      			"ruleType" : '',
		      			"rule" : '',
		      			"action" : '',
		      			"fixScript" : ''
		      		}
	      			fieldsValidations.push(validations);
	      			//console.log(fields[idx]);
	      		});
	      		return fieldsValidations;
	      	}
	      	var fileInfo = {};
	    		getFileLayout(cluster, fileName, response.FileDetail.Format).then(function(fileLayout) {
	      		fileInfo = {
	      			"name" : response.FileDetail.Name,
	      			"fileName" : response.FileDetail.Filename,
	      			"description" : response.FileDetail.Description,
	      			"scope": response.FileDetail.Name.substring(0, response.FileDetail.Name.lastIndexOf('::')),
	      			"pathMask" : response.FileDetail.PathMask,
	      			"isSuperfile" : response.FileDetail.isSuperfile,
	      			"fileType": response.FileDetail.ContentType,
	      			"layout" : fileLayout,
	      			"validations" : []
	      		}
	      	 	resolve(fileInfo);
	    		})

			  });
			});
	}).catch((err) => {
    console.log('err', err);
    reject(err);
	})
}

exports.getJobInfo = (clusterId, jobWuid, jobType) => {
  let sourceFiles=[], outputFiles=[], jobInfo = {};
  return new Promise((resolve, reject) => {
    module.exports.getCluster(clusterId).then(function(cluster) {
      request.get({
        url: cluster.thor_host + ':' + cluster.thor_port +'/WsWorkunits/WUInfo.json?Wuid='+jobWuid,
        auth : module.exports.getClusterAuth(cluster)
      }, function(err, response, body) {
        if (err) {
          console.log('ERROR - ', err);
          reject(err);
        } else {
          var result = JSON.parse(body);
          if(result.Exceptions) {
            reject(result.Exceptions.Exception);
          }
          if(jobType == 'Query Build') {
            let clusterAuth = module.exports.getClusterAuth(cluster);
            let wuService = new hpccJSComms.WorkunitsService({ baseUrl: cluster.thor_host + ':' + cluster.thor_port, userID:(clusterAuth ? clusterAuth.user : ""), password:(clusterAuth ? clusterAuth.password : "")});
            wuService.WUListQueries({"WUID":jobWuid}).then(response => {
              if(response.QuerysetQueries && response.QuerysetQueries.QuerySetQuery && response.QuerysetQueries.QuerySetQuery.length > 0) {
                wuService.WUQueryDetails({"QueryId":response.QuerysetQueries.QuerySetQuery[0].Id, "QuerySet":"roxie"}).then(queryDetails => {
                  queryDetails.LogicalFiles.Item.forEach((logicalFile)  => {
                    sourceFiles.push({"name":logicalFile})
                  })
                  jobInfo = {
                    "sourceFiles": sourceFiles,
                    "outputFiles": [],
                    "Jobname": result.WUInfoResponse.Workunit.Jobname,
                    "description": result.WUInfoResponse.Workunit.Description,
                    "ecl": result.WUInfoResponse.Workunit.Query.Text,
                    "entryBWR": result.WUInfoResponse.Workunit.Jobname,
                    "wuid": result.WUInfoResponse.Workunit.Wuid
                  }
                  resolve(jobInfo);
                })
              } else {
                resolve(jobInfo)
              }
            });
          } else {
            if(result.WUInfoResponse && result.WUInfoResponse.Workunit) {
              var wuInfoResponse = result.WUInfoResponse.Workunit, fileInfo = {};
              if(wuInfoResponse.SourceFiles && wuInfoResponse.SourceFiles.ECLSourceFile) {
                wuInfoResponse.SourceFiles.ECLSourceFile.forEach((sourceFile) => {
                  sourceFiles.push({"name":sourceFile.Name});
                });

              }
              if(wuInfoResponse.Results && wuInfoResponse.Results.ECLResult) {
                let files = wuInfoResponse.Results.ECLResult.filter((result) => {
                  return result.FileName != ""
                })
                files.forEach((file) => {
                  outputFiles.push({"name":file.FileName});
                })
              }

              jobInfo = {
                "sourceFiles": sourceFiles,
                "outputFiles": outputFiles,
                "Jobname": result.WUInfoResponse.Workunit.Jobname,
                "description": result.WUInfoResponse.Workunit.Description,
                "ecl": result.WUInfoResponse.Workunit.Query.Text,
                "entryBWR": result.WUInfoResponse.Workunit.Jobname,
                "wuid": result.WUInfoResponse.Workunit.Wuid
              };
              resolve(jobInfo);
            }

          }
        }
      });
    });
  });
}

exports.getJobWuidByName = (clusterId, jobName) => {
  return new Promise((resolve, reject) => {
    module.exports.getCluster(clusterId).then(function(cluster) {
      request.get({
        url: cluster.thor_host + ':' + cluster.thor_port +'/WsWorkunits/WUQuery.json?Jobname='+jobName,
        auth : module.exports.getClusterAuth(cluster)
      }, function(err, response, body) {
        if (err) {
          console.log('ERROR - ', err);
          reject(err);
        } else {
          var result = JSON.parse(body);
          if(result.Exceptions) {
            reject(err);
          }
          if(result.WUQueryResponse
            && result.WUQueryResponse.Workunits
            && result.WUQueryResponse.Workunits.ECLWorkunit
            && result.WUQueryResponse.Workunits.ECLWorkunit.length > 0) {
            //return the first wuid assuming that is the latest one
            resolve(result.WUQueryResponse.Workunits.ECLWorkunit[0].Wuid);
          } else {
            resolve(null);
          }
        }
      });
    });
  });

}

let getFileLayout = (cluster, fileName, format) =>  {
	var layoutResults = [];
	if(format == 'csv') {
		return requestPromise.get({
		  url: cluster.thor_host + ':' + cluster.thor_port +'/WsDfu/DFURecordTypeInfo.json?Name='+fileName,
		  auth : module.exports.getClusterAuth(cluster)
		}).then(function(response) {
			var result = JSON.parse(response);
			if (result.DFURecordTypeInfoResponse != undefined) {
				if(result.DFURecordTypeInfoResponse.jsonInfo.fields != undefined) {
					result.DFURecordTypeInfoResponse.jsonInfo.fields.forEach((field, idx) => {
						layoutResults.push({
							"id": idx,
							"name" : field.name
						})
					})

					return layoutResults;
				}

			}
		})
	} else {
		return requestPromise.get({
		  url: cluster.thor_host + ':' + cluster.thor_port +'/WsDfu/DFUGetFileMetaData.json?LogicalFileName='+fileName,
		  auth : module.exports.getClusterAuth(cluster)
		}).then(function(response) {
			  var result = JSON.parse(response);
	    	if(result.DFUGetFileMetaDataResponse != undefined) {
				  var fileInfoResponse = result.DFUGetFileMetaDataResponse.DataColumns.DFUDataColumn, fileInfo = {};
	      		fileInfoResponse.forEach(function(column, idx) {
	      			if(column.ColumnLabel !== '__fileposition__') {
		      			var layout = {
		      				"id": idx,
			      			"name" : column.ColumnLabel,
			      			"type" : column.ColumnType,
			      			"eclType" : column.ColumnEclType,
			      			"displayType" : '',
			      			"displaySize" : '',
			      			"textJustification" : 'right',
			      			"format" : '',
			      			"isPCI" : 'false',
			      			"isPII" : 'false',
							"isHIPAA":'false',
							"required": 'false'
			      		}
			      		if(column.DataColumns != undefined) {
			      			var childColumns = [];
			      			column.DataColumns.DFUDataColumn.forEach(function(childColumn, idx) {
			      				var childColumnObj = {
			      					"id": idx,
			      					"name" : childColumn.ColumnLabel,
					      			"type" : childColumn.ColumnType,
					      			"eclType" : childColumn.ColumnEclType,
					      			"displayType" : '',
					      			"displaySize" : '',
					      			"textJustification" : 'right',
					      			"format" : '',
					      			"isPCI" : 'false',
					      			"isPII" : 'false',
									"isHIPAA":'false',
									"required": 'false'
			      				}
			      				childColumns.push(childColumnObj);

			      			});
			      			layout.children = childColumns;
			      		}
			      		layoutResults.push(layout);
			      	}
	      		});
			  }
	    	return layoutResults;
	  })
		.catch(function (err) {
      console.log('error occured: '+err);
  	});
	}

}

exports.getClusterAuth = (cluster) => {
	let auth = {};
	if(cluster.username && cluster.hash) {
		auth.user = cluster.username,
		auth.password = cluster.hash
		return auth;
	} else {
		return null;
	}
}

exports.getCluster = (clusterId) => {
	return Cluster.findOne( {where: {id:clusterId}} ).then(async function(cluster) {
		if(cluster.hash) {
			cluster.hash = crypto.createDecipher(algorithm,dbUtil.secret).update(cluster.hash,'hex','utf8');
		}
		let isReachable = await module.exports.isClusterReachable(cluster.thor_host, cluster.thor_port, cluster.username, cluster.password);
		if(isReachable)	 {
			return cluster;
		} else {
			throw new Error("Cluster not reachable...");
		}

	})
	.catch(function(err) {
        console.log(err);
    });
}

exports.isClusterReachable = async (clusterHost, port, username, password) => {
	let auth = null;
	if(username && password) {
		auth = {};
		auth.user = username,
		auth.password = password
	}
	return new Promise((resolve, reject) => {
		request.get({
		  url:clusterHost+":"+port,
		  auth : auth,
		  timeout: 3000
		},
		function (error, response, body) {
	    if (!error && response.statusCode == 200) {
	      resolve(true);
	    } else {
	    	console.log(error);
	    	resolve(false);
	    }
	  })
	});
 }

 exports.updateCommonData = (objArray, fields) => {
    if(objArray.length>0){
    Object.keys(fields).forEach(function (key, index) {
        objArray.forEach(function(obj) {
            obj[key] = fields[key];
        });
    });
    }
    return objArray;
}