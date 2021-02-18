const express = require('express');
const router = express.Router();
const crypto = require('crypto');
var request = require('request');
var requestPromise = require('request-promise');
const dbUtil = require('../../utils/db');
const hpccUtil = require('../../utils/hpcc-util');
const validatorUtil = require('../../utils/validator');
var models  = require('../../models');
var Cluster = models.cluster;
let algorithm = 'aes-256-ctr';
let hpccJSComms = require("@hpcc-js/comms")
var http = require('http');
const { body, query, oneOf, validationResult } = require('express-validator');
const ClusterWhitelist = require('../../cluster-whitelist');

router.post('/filesearch', [
  body('keyword')
    .matches(/^[a-zA-Z]{1}[a-zA-Z0-9_:.\-]*$/).withMessage('Invalid keyword')
], function (req, res) {
	const errors = validationResult(req).formatWith(validatorUtil.errorFormatter);
  if (!errors.isEmpty()) {
    return res.status(422).json({ success: false, errors: errors.array() });
  }
  console.log('clusterid: '+req.body.clusterid);

	hpccUtil.getCluster(req.body.clusterid).then(function(cluster) {
		let results = [];
		try {
			let clusterAuth = hpccUtil.getClusterAuth(cluster);
			let contentType = req.body.indexSearch ? "key" : "";
			console.log("contentType: "+contentType);
			let dfuService = new hpccJSComms.DFUService({ baseUrl: cluster.thor_host + ':' + cluster.thor_port, userID:(clusterAuth ? clusterAuth.user : ""), password:(clusterAuth ? clusterAuth.password : "")});
			dfuService.DFUQuery({"LogicalName":"*"+req.body.keyword+"*", ContentType:contentType}).then(response => {
				if(response.DFULogicalFiles && response.DFULogicalFiles.DFULogicalFile && response.DFULogicalFiles.DFULogicalFile.length > 0) {
					let searchResults = response.DFULogicalFiles.DFULogicalFile;
					searchResults.forEach((logicalFile) => {
						results.push({"text": logicalFile.Name, "value":logicalFile.Name});
					});
					//remove duplicates
					results = results.filter((elem, index, self) => self.findIndex(
    						(t) => {return (t.text === elem.text)}) === index)
				}
				res.json(results);
			});
		} catch(err) {
			console.log(err);
			res.status(500).send({"success":"false", "message": "Error occured during search."});
		}
  }).catch(err => {
  	console.log('Cluster not reachable: '+JSON.stringify(err));
  	res.status(500).send({"success":"false", "message": "Search failed. Please check if the cluster is running."});
  });
});

router.post('/querysearch', [
  body('keyword')
    .matches(/^[a-zA-Z]{1}[a-zA-Z0-9_:.\-]*$/).withMessage('Invalid keyworkd')
], function (req, res) {
	const errors = validationResult(req).formatWith(validatorUtil.errorFormatter);
  if (!errors.isEmpty()) {
    return res.status(422).json({ success: false, errors: errors.array() });
  }
	hpccUtil.getCluster(req.body.clusterid).then(function(cluster) {
		let clusterAuth = hpccUtil.getClusterAuth(cluster);
		let wsWorkunits = new hpccJSComms.WorkunitsService({ baseUrl: cluster.thor_host + ':' + cluster.thor_port, userID:(clusterAuth ? clusterAuth.user : ""), password:(clusterAuth ? clusterAuth.password : ""), type: "get" }),
			  querySearchAutoComplete = [];

		wsWorkunits.WUListQueries({"QueryName":"*"+req.body.keyword+"*", "QuerySetName": "roxie", "Activated": true}).then(response => {
			console.log(response)
	  	if(response.QuerysetQueries) {
	  		querySearchResult = response.QuerysetQueries.QuerySetQuery;

				querySearchResult.forEach((querySet, index) => {
						querySearchAutoComplete.push({"text" : querySet.Name, "value" : querySet.Name});
				});

				querySearchAutoComplete = querySearchAutoComplete.filter((elem, index, self) => self.findIndex(
					(t) => {return (t.text === elem.text)}) === index)

			}
			res.json(querySearchAutoComplete);
    }).catch(err => {
    	console.log('Error occured while querying : '+JSON.stringify(err));
    	res.status(500).send({"success":"false", "message": "Search failed. Error occured while querying."});
    });
	}).catch(err => {
  	console.log('Cluster not reachable: '+JSON.stringify(err));
  	res.status(500).send({"success":"false", "message": "Search failed. Please check if the cluster is running."});
  });
});


router.post('/jobsearch', [
  body('keyword')
    .matches(/^[a-zA-Z]{1}[a-zA-Z0-9_:.\-]*$/).withMessage('Invalid keyword')
], function (req, res) {
	const errors = validationResult(req).formatWith(validatorUtil.errorFormatter);
  if (!errors.isEmpty()) {
    return res.status(422).json({ success: false, errors: errors.array() });
  }
	hpccUtil.getCluster(req.body.clusterid).then(function(cluster) {
		let url = cluster.thor_host + ':' + cluster.thor_port +'/WsWorkunits/WUQuery.json?Jobname=*'+req.body.keyword+'*';
        request.get({
		  url: url,
		  auth : hpccUtil.getClusterAuth(cluster)
		}, function(err, response, body) {
		  if (err) {
			console.log('ERROR - ', err);
			return response.status(500).send('Error');
	      }
	      else {
	      	var result = JSON.parse(body);
	      	if(result.WUQueryResponse && result.WUQueryResponse.Workunits != undefined) {
	      		var jobSearchAutoComplete = [], workunits = result.WUQueryResponse.Workunits.ECLWorkunit;

				workunits.forEach((workunit, index) => {
					//dont add any duplicates
					var exists = jobSearchAutoComplete.filter(function(job) {
						return workunit.Jobname == job.text;
					});
					if(exists != undefined && exists.length == 0) {
						jobSearchAutoComplete.push({"text" : workunit.Jobname, "value" : workunit.Wuid});
					}
				});
	      	 	res.json(jobSearchAutoComplete);
	      	} else {
	      		res.json([]);
	      	}
	      }
      	});
    }).catch(err => {
    	console.log('Cluster not reachable: '+JSON.stringify(err));
    	res.status(500).send({"success":"false", "message": "Search failed. Please check if the cluster is running."});
    });
});

router.get('/getClusters', function (req, res) {
  try {
		Cluster.findAll().then(function(clusters) {
			res.json(clusters);
		})
		.catch(function(err) {
        console.log(err);
    });
  } catch (err) {
      console.log('err', err);
  }
});

router.get('/getClusterWhitelist', function (req, res) {
  try {
		res.json(ClusterWhitelist.clusters);
  } catch (err) {
      console.log('err', err);
  }
});

router.get('/getCluster', function (req, res) {
  console.log('in /getCluster');
  try {
		Cluster.findOne(
			{where: {id:req.query.cluster_id}}
		).then(function(clusters) {
			res.json(clusters);
		})
	.catch(function(err) {
        console.log(err);
    });
  } catch (err) {
      console.log('err', err);
  }
});


router.post('/newcluster', [

  body('thor_host').isURL({'require_protocol':true, 'require_host':true, 'allow_underscores':true }).withMessage("Invalid thor host"),
  body('roxie_host').isURL({'require_protocol':true, 'require_host':true, 'allow_underscores':true }).withMessage("Invalid roxie host"),
  body('thor_port')
    .isInt().withMessage('Invalid thor port'),
  body('roxie_port')
    .isInt().withMessage('Invalid roxie port')
	], async function (req, res) {
		const errors = validationResult(req).formatWith(validatorUtil.errorFormatter);
    if (!errors.isEmpty()) {
      return res.status(422).json({ success: false, errors: errors.array() });
    }
    try {
		var ThorReachable=false;
		var RoxieReachable=false;
		ThorReachable = await hpccUtil.isClusterReachable(req.body.thor_host, req.body.thor_port, req.body.username, req.body.password);
		RoxieReachable = await hpccUtil.isClusterReachable(req.body.roxie_host, req.body.roxie_port, req.body.username, req.body.password);
		if(ThorReachable && RoxieReachable) {
			var newCluster = {"name":req.body.name, "thor_host":req.body.thor_host, "thor_port":req.body.thor_port,
			 "roxie_host":req.body.roxie_host, "roxie_port":req.body.roxie_port};
			if (req.body.username && req.body.password) {
				newCluster.username = req.body.username;
				newCluster.hash = crypto.createCipher(algorithm, dbUtil.secret).update(req.body.password,'utf8','hex');
			}
			console.log(req.body.id);
			if(req.body.id == undefined || req.body.id == "") {
				Cluster.create(newCluster).then(function(cluster) {
					res.json({"result":"success"});
				});
			} else {
		        Cluster.update(
		        	newCluster,
		            {
		            	where: {id:req.body.id}
		        	}
		        ).then(function(application) {
		            res.json({"result":"success"});
		        });
		    }
		} else {
			return res.status(500).json({"message": "Cluster could not be reached"});
		}
    } catch (err) {
        console.log('err', err);
        return res.status(500).send({"success":"false", "message": "Error occured while adding new Cluster"});
    }
});

router.post('/removecluster', function (req, res) {
    console.log(req.body.clusterIdsToDelete);
    try {
        Cluster.destroy({ where: {id: req.body.clusterIdsToDelete}}, function(err) {})
        return res.status(200).send({"result":"success"});
    } catch (err) {
        console.log('err', err);
    }
});

router.get('/getFileInfo', [
  query('fileName')
    .matches(/^[a-zA-Z]{1}[a-zA-Z0-9_:.\-]*$/).withMessage('Invalid file name'),
  query('clusterid')
    .isUUID(4).withMessage('Invalid cluster id'),
], function (req, res) {
	const errors = validationResult(req).formatWith(validatorUtil.errorFormatter);
  if (!errors.isEmpty()) {
    return res.status(422).json({ success: false, errors: errors.array() });
  }
	console.log('fileName: '+req.query.fileName+ " clusterId: "+req.query.clusterid );
	hpccUtil.fileInfo(req.query.fileName, req.query.clusterid).then((fileInfo) => {
		res.json(fileInfo);
	}).catch((err) => {
		console.log('err', err);
	})
});


router.get('/getIndexInfo', [
  query('indexName')
    .matches(/^[a-zA-Z]{1}[a-zA-Z0-9_:.\-]*$/).withMessage('Invalid index name'),
  query('clusterid')
    .isUUID(4).withMessage('Invalid cluster id'),
],function (req, res) {
	const errors = validationResult(req).formatWith(validatorUtil.errorFormatter);
  if (!errors.isEmpty()) {
    return res.status(422).json({ success: false, errors: errors.array() });
  }
  try {
		hpccUtil.getCluster(req.query.clusterid).then(function(cluster) {
			let clusterAuth = hpccUtil.getClusterAuth(cluster);
			let dfuService = new hpccJSComms.DFUService({ baseUrl: cluster.thor_host + ':' + cluster.thor_port, userID:(clusterAuth ? clusterAuth.user : ""), password:(clusterAuth ? clusterAuth.password : "")});
			dfuService.DFUInfo({"Name":req.query.indexName}).then(response => {
    		if(response.FileDetail) {
	    		let indexInfo = {};
	    		getIndexColumns(cluster, req.query.indexName).then(function(indexColumns) {
	      		indexInfo = {
	      			"name" : response.FileDetail.Name,
	      			"fileName" : response.FileDetail.Filename,
	      			"description" : response.FileDetail.Description,
	      			"pathMask" : response.FileDetail.PathMask,
	      			"columns" : indexColumns
	      		}
	      	 	res.json(indexInfo);
	    		})
	    	} else {
	    		res.json();
	    	}
    	});
		});
  } catch (err) {
      console.log('err', err);
  }
});

function getIndexColumns(cluster, indexName) {
	let columns={};
	return requestPromise.get({
	  url: cluster.thor_host + ':' + cluster.thor_port +'/WsDfu/DFUGetFileMetaData.json?LogicalFileName='+indexName,
	  auth : hpccUtil.getClusterAuth(cluster)
	}).then(function(response) {
      	var result = JSON.parse(response);
      	if(result.DFUGetFileMetaDataResponse != undefined) {
	      	var indexColumns = result.DFUGetFileMetaDataResponse.DataColumns.DFUDataColumn, nonkeyedColumns=[], keyedColumns=[];
	      	if(indexColumns != undefined) {
	      		indexColumns.forEach(function(column) {
				    if(column.IsKeyedColumn) {
				    	keyedColumns.push({'id':column.ColumnID, 'name':column.ColumnLabel, 'type': column.ColumnType, 'eclType':column.ColumnEclType});
					} else if(!column.IsKeyedColumn) {
				    	nonkeyedColumns.push({'id':column.ColumnID, 'name':column.ColumnLabel, 'type': column.ColumnType, 'eclType':column.ColumnEclType});
					}
				});
	      		columns.nonKeyedColumns = nonkeyedColumns;
	      		columns.keyedColumns = keyedColumns;
	      	}
	    }
      	return columns;
    })
	.catch(function (err) {
      console.log('error occured: '+err);
  	});
}

router.get('/getData', [
  query('clusterid')
    .isUUID(4).withMessage('Invalid cluster id'),
  query('fileName')
    .matches(/^[a-zA-Z]{1}[a-zA-Z0-9_:.\-]*$/).withMessage('Invalid file name')
], function (req, res) {
	const errors = validationResult(req).formatWith(validatorUtil.errorFormatter);
  if (!errors.isEmpty()) {
    return res.status(422).json({ success: false, errors: errors.array() });
  }
  try {

		hpccUtil.getCluster(req.query.clusterid).then(function(cluster) {
			let clusterAuth = hpccUtil.getClusterAuth(cluster);
			let wuService = new hpccJSComms.WorkunitsService({ baseUrl: cluster.thor_host + ':' + cluster.thor_port, userID:(clusterAuth ? clusterAuth.user : ""), password:(clusterAuth ? clusterAuth.password : "")});
			wuService.WUResult({"LogicalName":req.query.fileName, "Count":50}).then(response => {
				if(response.Result != undefined && response.Result != undefined && response.Result.Row != undefined) {
					var rows = response.Result.Row, indexInfo = {};
					if(rows.length > 0) {
						rows.shift();
						res.json(rows);
					} else {
						res.json([]);
					}
				}
				else {
      		res.json([]);
      	}
			});
		});
	} catch (err) {
      console.log('err', err);
  }
});

router.get('/getFileProfile', function (req, res) {
    try {
		hpccUtil.getCluster(req.query.clusterid).then(function(cluster) {
			request.get({
			  url: cluster.thor_host + ':' + cluster.thor_port +'/WsWorkunits/WUResult.json?LogicalName='+req.query.fileName+'.profile',
			  auth : hpccUtil.getClusterAuth(cluster)
			}, function(err, response, body) {
			  if (err) {
				console.log('ERROR - ', err);
				return response.status(500).send('Error');
		      }
		      else {
		      	var result = JSON.parse(body);
		      	if(result.Exceptions) {
		      		res.json([]);
		      	}

		      	if(result.WUResultResponse != undefined && result.WUResultResponse.Result != undefined && result.WUResultResponse.Result.Row != undefined) {
						var rows = result.WUResultResponse.Result.Row, indexInfo = {};
						if(rows.length > 0) {
							rows.forEach(function (row, index) {
								Object.keys(row).forEach(function (key) {
									if(row[key] instanceof Object) {
										if(row[key].Row) {
											row[key] = row[key].Row;
										}
									}
								});
							});
							res.json(rows);
						}

				} else {
		      		res.json();
		      	}
		      }

	      	});
		});
	} catch (err) {
        console.log('err', err);
    }
});

router.get('/getFileProfileHTML', function (req, res) {
    try {
		hpccUtil.getCluster(req.query.clusterid).then(function(cluster) {
			//call DFUInfo to get workunit id
      		var wuid = req.query.dataProfileWuid;
      		//get resource url's from wuinfo
      		request.post({
			  url: cluster.thor_host + ':' + cluster.thor_port +'/WsWorkunits/WUInfo.json',
			  auth : hpccUtil.getClusterAuth(cluster),
			  headers: {'content-type' : 'application/x-www-form-urlencoded'},
			  body: "Wuid="+wuid+"&TruncateEclTo64k=true&IncludeResourceURLs=true&IncludeExceptions=false&IncludeGraphs=false&IncludeSourceFiles=false&IncludeResults=false&IncludeResultsViewNames=false&IncludeVariables=false&IncludeTimers=false&IncludeDebugValues=false&IncludeApplicationValues=false&IncludeWorkflows=false&IncludeXmlSchemas=false&SuppressResultSchemas"
			}, function(err, response, body) {
			  if (err) {
				console.log('ERROR - ', err);
				return response.status(500).send('Error');
		      }
		      else {
		      	var result = JSON.parse(body);
		      	var filterdUrl = result.WUInfoResponse.Workunit.ResourceURLs.URL.filter(function(url) {
		      		return !url.startsWith("manifest");
		      	}).map(function(url) {
	      			return cluster.thor_host + ':' + cluster.thor_port + '/WsWorkunits/' + url.replace("./report", "report");
		      	});
		      	console.log("URL's: "+JSON.stringify(filterdUrl));
		      	res.json(filterdUrl);
		      }
		  })
		});
	} catch (err) {
        console.log('err', err);
    }
});

router.get('/getQueryInfo', [
  query('clusterid')
    .isUUID(4).withMessage('Invalid cluster id'),
  query('queryName')
    .matches(/^[a-zA-Z]{1}[a-zA-Z0-9_:.\-]*$/).withMessage('Invalid query name')
],function (req, res) {
	const errors = validationResult(req).formatWith(validatorUtil.errorFormatter);
  if (!errors.isEmpty()) {
    return res.status(422).json({ success: false, errors: errors.array() });
  }
  var resultObj = {}, requestObj = [], responseObj = [];
  try {
		hpccUtil.getCluster(req.query.clusterid).then(function(cluster) {
			let clusterAuth = hpccUtil.getClusterAuth(cluster);
			let eclService = new hpccJSComms.EclService({ baseUrl: cluster.roxie_host + ':' + cluster.roxie_port, userID:(clusterAuth ? clusterAuth.user : ""), password:(clusterAuth ? clusterAuth.password : "")});
			eclService.requestJson("roxie", req.query.queryName).then(response => {
				if(response) {
					response.forEach((requestParam, idx) =>  {
						requestObj.push({"id": idx, "name":requestParam.id, "type":requestParam.type});
					});
				}
				resultObj.request = requestObj;

		  	eclService.responseJson("roxie", req.query.queryName).then(response => {
					if(response) {
						let firstKey = Object.keys(response)[0];
						response[firstKey].forEach((responseParam, idx) => {
							responseObj.push(
							{
								"id": idx,
								"name" : responseParam.id,
    						"type" : responseParam.type
							});
						});
					}
					resultObj.response = responseObj;
					res.json(resultObj);

				}).catch(function (err) {
		      console.log('error occured: '+err);
		  	});

			}).catch(function (err) {
	      console.log('error occured: '+err);
	  	});
		});
  } catch (err) {
      console.log('err', err);
  }
});

router.get('/getJobInfo', [
  query('clusterid')
    .isUUID(4).withMessage('Invalid cluster id'),
  query('jobWuid')
    .matches(/^[a-zA-Z]{1}[a-zA-Z0-9_:.\-]*$/).withMessage('Invalid workunit id')
], function (req, res) {
	const errors = validationResult(req).formatWith(validatorUtil.errorFormatter);
  if (!errors.isEmpty()) {
    return res.status(422).json({ success: false, errors: errors.array() });
  }
  try {
  	console.log('jobName: '+req.query.jobWuid);
    hpccUtil.getJobInfo(req.query.clusterid, req.query.jobWuid, req.query.jobType).then((jobInfo) => {
      res.json(jobInfo);
    })
  } catch (err) {
      console.log('err', err);
  }
});

module.exports = router;