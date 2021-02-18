const express = require('express');
const router = express.Router();
let mongoose = require('mongoose');
var models  = require('../../models');
let Sequelize = require('sequelize');
let Job = models.job;
let JobFile = models.jobfile;
let JobParam = models.jobparam;
let File = models.file;
let FileLayout = models.file_layout;
let FileValidation = models.file_validation;
let DataflowGraph = models.dataflowgraph;
let Dataflow = models.dataflow;
let AssetDataflow = models.assets_dataflows;
const hpccUtil = require('../../utils/hpcc-util');
const validatorUtil = require('../../utils/validator');
const { body, query, validationResult } = require('express-validator');


/**
  Updates Dataflow graph by
    - removing any nodes that are removed from the Job
    - removing edges to those nodes
    - finally de-duping nodes and edges array
**/
let updateDataFlowGraph = (applicationId, dataflowId, nodes, edges, filesToBeRemoved) => {
  return new Promise((resolve, reject) => {
    DataflowGraph.findOrCreate({
      where: {application_id:applicationId, dataflowId:dataflowId},
      defaults: {
        application_id: applicationId,
        nodes: JSON.stringify(nodes),
        edges: JSON.stringify(edges),
        dataflowId: dataflowId
      }
    }).then(function(result) {
      graphId = result[0].id;
      if(!result[1]) {
        return DataflowGraph.findOne({where: {application_id:applicationId, dataflowId:dataflowId}});
      }
    }).then((dataflowGraph) => {
      let currentNodes = JSON.parse(dataflowGraph.nodes);
      let currentEdges = JSON.parse(dataflowGraph.edges);

      //remove any file nodes (source/output) that are no longer available in the job
      if(filesToBeRemoved && filesToBeRemoved.length > 0) {
        for(var currentNodeIdx = currentNodes.length - 1; currentNodeIdx > -1; currentNodeIdx--) {
          if(filesToBeRemoved.filter(fileToBeRemoved => fileToBeRemoved.file_id == currentNodes[currentNodeIdx].fileId).length > 0) {
            //remove edge;
            for(var currentEdgeIdx=currentEdges.length - 1; currentEdgeIdx > -1; currentEdgeIdx--) {
              if(currentEdges[currentEdgeIdx].source == currentNodes[currentNodeIdx].id || currentEdges[currentEdgeIdx].target == currentNodes[currentNodeIdx].id) {
                currentEdges.splice(currentEdgeIdx, 1);
              }
            }
            //remove node
            currentNodes.splice(currentNodeIdx, 1);
          }
        }
      }

      //remove any duplicate nodes
      nodes = nodes.filter((node, nodeIdx) => {
        let duplicate = false;
        for (var i=0; i<currentNodes.length; i++) {
          //duplicate node found
          //console.log(currentNode.id, currentNode.title, currentNode.type, node.id, node.title, node.type);
          console.log(nodes[nodeIdx].title, currentNodes[i].title, i)
          if(currentNodes[i].id == nodes[nodeIdx].id && currentNodes[i].type == nodes[nodeIdx].type) {
            console.log("found duplicate")
            duplicate = true;
            edges = edges.map((edge) => {
              if(edge.source == nodes[nodeIdx].id) {
                edge.source = currentNodes[i].id
              }

              if(edge.target == nodes[nodeIdx].id) {
                edge.target = currentNodes[i].id
              }
              return edge;
            })
          }
        }

        return !duplicate;
      })

      //dedup edges. duplicate nodes are already taken care above
      currentEdges = currentEdges.concat(edges);
      let dedupedEdges = [];
      currentEdges.forEach((currentEdge) => {
        let edgeExists = dedupedEdges.filter(dedupEdge => {
          return (dedupEdge.source == currentEdge.source && dedupEdge.target == currentEdge.target)
        })
        if(edgeExists.length == 0) {
          dedupedEdges.push(currentEdge)
        }
      })

      currentNodes = currentNodes.concat(nodes);
      //currentEdges = currentEdges.concat(edges);
      DataflowGraph.update({
        application_id: applicationId,
        nodes: JSON.stringify(currentNodes),
        edges: JSON.stringify(dedupedEdges),
        dataflowId: dataflowId
      }, {where:{application_id:applicationId, dataflowId:dataflowId}}).then((dataflowGraphUpdate) => {
        if(dataflowGraphUpdate) {
          resolve({'nodes':currentNodes, 'edges':dedupedEdges});
        }

      })
    }).catch((err) => {
      console.log(err)
      reject(err);
    })
  });
}

/**
  Creates File associated with a Job and forms the node and edges objects for it to be passed on to the Dataflow Graph.
  New files are created and nodes/edges added accordingly.
  For Existing files, only node/edge data is updated - This is basically done to avoid duplicate nodes in the dataflow. if a job uses input files
  from previous job, instead of creating a new set of files, the dataflow will be updated showing a path from the input files from previous jobs to
  the new job
**/
let updateFileRelationship = (jobId, job, files, filesToBeRemoved) => {
  let fieldsToUpdate={}, promises=[], nodes = [], edges = [];
  return new Promise((resolve, reject) => {
    let query = 'select f.id, f.name, jf.file_type from file f, jobfile jf where '+
      'f.application_id = (:applicationId) AND '+
      'f.name =(:fileName) AND '+
      'f.dataflowId = (:dataflowId) AND '+
      'jf.job_id = (:job_id) and jf.file_type = (:file_type) group by f.id';

    files.forEach((file, idx) => {
      promises.push(
        hpccUtil.fileInfo(file.name, job.basic.clusterId).then((fileInfo) => {
          let replacements = { applicationId: job.basic.application_id, fileName: fileInfo.name, dataflowId:job.basic.dataflowId, job_id: jobId, file_type: file.file_type};
          return models.sequelize.query(query, {
            type: models.sequelize.QueryTypes.SELECT,
            replacements: replacements
          }).then((existingFile) => {
            //file does not exists or exists with a different type
            if(existingFile.length == 0) {
             return File.create({
                "application_id": job.basic.application_id,
                "title": fileInfo.fileName,
                "name": fileInfo.name,
                "cluster_id": job.basic.clusterId,
                "description": fileInfo.description,
                "fileType": fileInfo.fileType,
                "isSuperFile": fileInfo.isSuperFile,
                "qualifiedPath": fileInfo.pathMask,
                "dataflowId": job.basic.dataflowId,
                "scope": fileInfo.scope
              }).then(async (fileCreated) => {
                let assetsDataflowCreated = await AssetDataflow.create({
                  assetId: fileCreated.id,
                  dataflowId: job.basic.dataflowId
                });
                //update file_id in JobFile
                console.log(fileCreated.id, job.basic.id, file.file_type, fileInfo.name);
                let jobFileUpdated = await JobFile.update({
                  file_id: fileCreated.id
                }, {where: {application_id: job.basic.application_id, job_id: job.basic.jobId, file_type: file.file_type, name: fileInfo.name}})

                let id=fileCreated.id, edge={};
                console.log('jobFile: '+JSON.stringify(file));
                let posX = file.file_type == 'input' ? job.mousePosition[0] - 75  : parseInt(job.mousePosition[0]) + 75;
                let posY = file.file_type == 'input' ? job.mousePosition[1] - (45 * idx) : job.mousePosition[1] - (45 * idx);
                nodes.push({
                  "title": fileInfo.fileName,
                  "id": fileCreated.id,
                  "x": posX,
                  "y": posY,
                  "type": "File",
                  "fileId": fileCreated.id
                })
                if(file.file_type == 'input') {
                  edge = {"source":fileCreated.id,"target":job.basic.id};
                } else if(file.file_type == 'output') {
                  edge = {"source":job.basic.id,"target":fileCreated.id};
                }
                edges.push(edge);

                fieldsToUpdate = {"file_id": fileCreated.id, "application_id" : job.basic.application_id};
                let fileLayoutToSave = hpccUtil.updateCommonData(fileInfo.layout, fieldsToUpdate);
                return FileLayout.bulkCreate(fileLayoutToSave, {updateOnDuplicate: ["name", "type", "displayType", "displaySize", "textJustification", "format","data_types", "isPCI", "isPII", "isHIPAA", "description", "required"]}).then((fileLayout) => {
                  let fileValidationsToSave = hpccUtil.updateCommonData(fileInfo.validations, fieldsToUpdate);
                  return FileValidation.bulkCreate(
                    fileValidationsToSave,
                    {updateOnDuplicate: ["name", "ruleType", "rule", "action", "fixScript"]}
                  )
                })
              })
            } else {
              let id=existingFile[0].id;
              let posX = file.file_type == 'input' ? job.mousePosition[0] - 75  : parseInt(job.mousePosition[0]) + 75;
              let posY = file.file_type == 'input' ? job.mousePosition[1] - (45 * idx) : job.mousePosition[1] - (45 * idx);
              //check if same node already exists in the workflow

              nodes.push({
                "title": fileInfo.fileName,
                "id": existingFile[0].id,
                "x": posX,
                "y": posY,
                "type": "File",
                "fileId": existingFile[0].id
              })
              if(file.file_type == 'input') {
                edge = {"source":existingFile[0].id,"target":job.basic.id};
              } else if(file.file_type == 'output') {
                edge = {"source":job.basic.id,"target":existingFile[0].id};
              }
              edges.push(edge);
            }
         }).catch(err => {
          console.log('error occured: '+err)
          reject(err);
         })
      })
     )
    })
    Promise.all(promises).then(() => {
      console.log("job and files created....")
      updateDataFlowGraph(job.basic.application_id, job.basic.dataflowId, nodes, edges, filesToBeRemoved).then((dataflowGraph) => {
        resolve(dataflowGraph)
      });
    })
  })
}

let findFilesRemovedFromJob = (currentFiles, filesFromCluster) => {
  let filesTobeRemoved = [];
  currentFiles.forEach((currentFile) => {
    let existingFile = filesFromCluster.filter(fileFromCluster => (fileFromCluster.type == currentFile.type && fileFromCluster.name == currentFile.name));
    if(existingFile.length == 0) {
      filesTobeRemoved.push(currentFile);
    }
  })
  return filesTobeRemoved;
}

/**
  This method updates the JobFile table based on the changes happend to the Job
  It also identifies the files that are removed from the Job, so the nodes & edges can be removed
**/
let updateJobDetails = (applicationId, jobId, jobReqObj, autoCreateFiles) => {
  let fieldsToUpdate = {"job_id"  : jobId, "application_id" : applicationId};
  return new Promise(async (resolve, reject) => {
    let filesToBeRemoved = [];
    let jobFiles = await JobFile.findAll({where:{ job_id: jobId, application_id:applicationId }, raw:true})
    //find files that are removed from the Job and remove them from JobFile table
    if(jobFiles && jobFiles.length > 0) {
      filesToBeRemoved = findFilesRemovedFromJob(jobFiles, jobReqObj.files);

      let idsOfFilesToBeRemoved = filesToBeRemoved.map(fileToBeRemoved => fileToBeRemoved.id);

      var deleteFiles = await JobFile.destroy({
        where:{ id: {[Sequelize.Op.in]:idsOfFilesToBeRemoved}, application_id:applicationId }});
    }

    //create new JobFile entries, if new files are added to the job
    var jobFileToSave = updateCommonData(jobReqObj.files, fieldsToUpdate);
    jobReqObj.files.forEach(async (file) => {
      let jobFileCreated = await JobFile.findOrCreate({
        where: {job_id: jobId, application_id: applicationId, file_type: file.file_type, name: file.name},
        defaults: {
          job_id: jobId,
          application_id: applicationId,
          file_type: file.file_type,
          name: file.name
        }
      });
    })

     var jobParamsToSave = updateCommonData(jobReqObj.params, fieldsToUpdate);
     JobParam.destroy({where:{application_id:applicationId, job_id: jobId}}).then((deleted) => {
        return JobParam.bulkCreate(jobParamsToSave)
      }).then(function(jobParam) {
        if(autoCreateFiles) {
          updateFileRelationship(jobId, jobReqObj, jobReqObj.files, filesToBeRemoved).then((results) => {
            resolve({"result":"success", "title":jobReqObj.basic.title, "jobId":jobId, "dataflow":results})
          });
        } else {
          resolve({"result":"success", "title":jobReqObj.basic.title, "jobId":jobId})
        }
      }).catch((err) => {
          reject(err)
      })
  })
}

router.post('/createFileRelation', [
  body('jobId').optional({checkFalsy:true}).isUUID(4).withMessage('Invalid job id'),
  body('clusterId').optional({checkFalsy:true}).isUUID(4).withMessage('Invalid cluster id'),
  body('dataflowId').optional({checkFalsy:true}).isUUID(4).withMessage('Invalid dataflowId'),
  body('currentlyEditingId').optional({checkFalsy:true}).isInt().withMessage('Invalid currentlyEditingId'),
  body('mousePosition').optional({checkFalsy:true}).isString().withMessage('Invalid mousePostion')
], (req, res) => {
  const errors = validationResult(req).formatWith(validatorUtil.errorFormatter);
  if (!errors.isEmpty()) {
    return res.status(422).json({ success: false, errors: errors.array() });
  }

  Job.findOne({where: {id: req.body.jobId}, include:[JobFile]}).then(async (savedJob) => {
    let jobUpdated = await Job.update({
      dataflowId: req.body.dataflowId
    }, {where: {id: req.body.jobId}});

    let mousePos = req.body.mousePosition.split(',');
    let job = {};
    job.basic = {
      "title": savedJob.name,
      "id": req.body.currentlyEditingId,
      "x": parseInt(mousePos[0]),
      "y": parseInt(mousePos[1]),
      "clusterId": savedJob.cluster_id,
      "application_id": req.body.application_id,
      "dataflowId": req.body.dataflowId,
      "jobId": req.body.jobId
    }
    job.mousePosition = mousePos;
    updateFileRelationship(req.body.jobId, job, savedJob.jobfiles).then((results) => {
      res.json(results);
    })
  }).catch((err) => {
    console.log(err);
    return res.status(500).send("Error occured while file relation");
  })
});

router.post('/refreshDataflow', [
  body('dataflowId').isUUID(4).withMessage('Invalid dataflow id'),
  body('application_id').isUUID(4).withMessage('Invalid application id'),
], async (req, res) => {
  //#1 - get jobs associated with a dataflow
  //#2 - iterate through jobs and get latest info from cluster and update jobfile table
  //#3 - once job file is updated, for each job, call updateFileRelationsship
  let promises=[];
  let dataflowGraph = await DataflowGraph.findOne({where: {dataflowId: req.body.dataflowId}});
  let nodes = JSON.parse(dataflowGraph.nodes);

  Job.findAll({where: {dataflowId: req.body.dataflowId, application_id: req.body.application_id}}).then((jobs) => {
    jobs.forEach((job) => {
      promises.push(hpccUtil.getJobWuidByName(job.cluster_id, job.name).then((wuid) => {
        return hpccUtil.getJobInfo(job.cluster_id, wuid, job.jobType).then((jobInfo) => {
          let jobObj = {}, jobFiles=[];
          let dataflowJobNode = nodes.filter(node => node.jobId == job.id);
          let sourceFiles = jobInfo.sourceFiles.map((sourceFile) => ({name: sourceFile.name, file_type: "input"}));
          jobFiles = jobFiles.concat(sourceFiles);
          let outputFiles = jobInfo.outputFiles.map(outputFile => ({name: outputFile.name, file_type: "output"}));
          jobFiles = jobFiles.concat(outputFiles);
          jobObj.files = jobFiles;
          jobObj.params = [];
          jobObj.basic = {
            "title": job.name,
            "id": dataflowJobNode[0].id,
            "clusterId": job.cluster_id,
            "application_id": req.body.application_id,
            "dataflowId": req.body.dataflowId,
            "jobId": job.id
          }
          jobObj.mousePosition = [dataflowJobNode[0].x, dataflowJobNode[0].y];
          return updateJobDetails(req.body.application_id, job.id, jobObj, true);
        })
      }))
    })

    Promise.all(promises).then(async () => {
      console.log("refresh completed....")
      let dataflowGraph = await DataflowGraph.findOne({where: {dataflowId: req.body.dataflowId}});
      let newNodes = JSON.parse(dataflowGraph.nodes);
      console.log(nodes.length, newNodes.length);
      res.json({"result": "success"});
    })
  })

})

router.post('/saveJob', [
  body('id')
  .optional({checkFalsy:true})
    .isUUID(4).withMessage('Invalid id'),
  body('job.basic.application_id')
    .isUUID(4).withMessage('Invalid application id'),
  body('job.basic.name')
  .matches(/^[a-zA-Z]{1}[a-zA-Z0-9_.\-:]*$/).withMessage('Invalid title'),
], (req, res) => {
  const errors = validationResult(req).formatWith(validatorUtil.errorFormatter);
  if (!errors.isEmpty()) {
      return res.status(422).json({ success: false, errors: errors.array() });
  }
  console.log("[saveJob] - Get file list for app_id = " + req.body.job.basic.application_id + " isNewJob: "+req.body.isNew);
  var jobId='', applicationId=req.body.job.basic.application_id, fieldsToUpdate={}, nodes=[], edges=[];
  try {

    if(req.body.isNew) {
      Job.create(
        req.body.job.basic
      ).then((result) => {
        updateJobDetails(applicationId, result.id, req.body.job, req.body.job.autoCreateFiles).then((response) => {
          res.json(response);
        })
      })
    } else {
      Job.update(
        req.body.job.basic, {where:{application_id: applicationId, id:req.body.id}}
      ).then((result) => {
        updateJobDetails(applicationId, result.id, req.body.job, req.body.job.autoCreateFiles).then((response) => {
          res.json(response);
        })
      })
    }
  } catch (err) {
    console.log('err', err);
  }
});

router.get('/job_list', [
  query('app_id')
    .isUUID(4).withMessage('Invalid application id'),
], (req, res) => {
  const errors = validationResult(req).formatWith(validatorUtil.errorFormatter);
  if (!errors.isEmpty()) {
      return res.status(422).json({ success: false, errors: errors.array() });
  }
  console.log("[job list/read.js] - Get job list for app_id = " + req.query.app_id);
  try {
    Job.findAll({where:{"application_Id":req.query.app_id}, include:['dataflows'], order: [['createdAt', 'DESC']]}).then(function(jobs) {
        res.json(jobs);
    })
    .catch(function(err) {
        console.log(err);
    });
  } catch (err) {
      console.log('err', err);
  }
});


router.get('/job_details', [
  query('app_id')
    .isUUID(4).withMessage('Invalid application id'),
  query('job_id')
    .isUUID(4).withMessage('Invalid job id'),
], (req, res) => {
  const errors = validationResult(req).formatWith(validatorUtil.errorFormatter);
  if (!errors.isEmpty()) {
      return res.status(422).json({ success: false, errors: errors.array() });
  }
  console.log("[job_details] - Get job list for app_id = " + req.query.app_id + " query_id: "+req.query.job_id);
  let jobFiles = [];
  try {
    Job.findOne({where:{"application_id":req.query.app_id, "id":req.query.job_id}, include: [JobFile, JobParam]}).then(async function(job) {
      var jobData = job.get({ plain: true });
      for(jobFileIdx in jobData.jobfiles) {
          var jobFile = jobData.jobfiles[jobFileIdx];
          var file = await File.findOne({where:{"application_id":req.query.app_id, "id":jobFile.file_id}});
          if(file != undefined) {
              jobFile.description = file.description;
              jobFile.groupId = file.groupId;
              jobFile.title = file.title;
              jobFile.name = file.name;
              jobFile.fileType = file.fileType;
              jobFile.qualifiedPath = file.qualifiedPath;
              jobData.jobfiles[jobFileIdx] = jobFile;
          }
      }
      return jobData;
    }).then(function(jobData) {
        res.json(jobData);
    })
    .catch(function(err) {
        console.log(err);
    });
  } catch (err) {
      console.log('err', err);
  }
});

router.post('/delete', [
  body('application_id')
    .isUUID(4).withMessage('Invalid application id'),
  body('jobId')
    .isUUID(4).withMessage('Invalid job id'),
], (req, res) => {
  const errors = validationResult(req).formatWith(validatorUtil.errorFormatter);
  if (!errors.isEmpty()) {
      return res.status(422).json({ success: false, errors: errors.array() });
  }
  console.log("[delete/read.js] - delete job = " + req.body.jobId + " appId: "+req.body.application_id);
  Job.destroy(
      {where:{"id": req.body.jobId, "application_id":req.body.application_id}}
  ).then(function(deleted) {
      JobFile.destroy(
          {where:{ job_id: req.body.jobId }}
      ).then(function(jobFileDeleted) {
          JobParam.destroy(
              {where:{ job_id: req.body.jobId }}
          ).then(function(jobParamDeleted) {
              res.json({"result":"success"});
          });
      });
  }).catch(function(err) {
      console.log(err);
  });
});

function updateCommonData(objArray, fields) {
    Object.keys(fields).forEach(function (key, index) {
        objArray.forEach(function(obj) {
            obj[key] = fields[key];
        });
    });
    return objArray;
}

module.exports = router;