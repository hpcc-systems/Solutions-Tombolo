const express = require('express');
const router = express.Router();
let mongoose = require('mongoose');
var models  = require('../../models');
let Job = models.job;
let JobFile = models.jobfile;
let JobParam = models.jobparam;
let File = models.file;
let FileLayout = models.file_layout;
let FileValidation = models.file_validation;
let DataflowGraph = models.dataflowgraph;
let Dataflow = models.dataflow;
const hpccUtil = require('../../utils/hpcc-util');
const validatorUtil = require('../../utils/validator');
const { body, query, validationResult } = require('express-validator');

let updateDataFlowGraph = (applicationId, dataflowId, nodes, edges) => {
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
      //remove any duplicate nodes
      nodes.forEach((node) => {
        currentNodes.forEach((currentNode, idx) => {
          if(currentNode.id == node.id) {
            currentNodes.splice(idx, 1);
          }
        })
      })
      currentNodes = currentNodes.concat(nodes);
      currentEdges = currentEdges.concat(edges);

      return DataflowGraph.update({
        application_id: applicationId,
        nodes: JSON.stringify(currentNodes),
        edges: JSON.stringify(currentEdges),
        dataflowId: dataflowId
      }, {where:{application_id:applicationId, dataflowId:dataflowId}}).then((dataflowGraphUpdate) => {
        resolve({'nodes':currentNodes, 'edges':currentEdges});
      })
    }).catch((err) => {
      reject(err);
    })
  });
}

let updateFileRelationship = (jobId, job, files) => {
  let fieldsToUpdate={}, promises=[], nodes = [], edges = [];

  return new Promise((resolve, reject) => {
    /*nodes.push({
      "title": job.basic.name,
      "id": job.basic.currentlyEditingId,
      "x": job.mousePosition[0],
      "y": job.mousePosition[1],
      "type": "Job",
      "jobId": jobId
    })*/
    console.log(job.basic.clusterId);
    console.log(files);
    files.forEach((file, idx) => {
      promises.push(
        hpccUtil.fileInfo(file.name, job.basic.clusterId).then((fileInfo) => {
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
          }).then((newFile) => {
            let id=Math.floor(Date.now()), edge={};
            console.log('jobFile: '+JSON.stringify(file));
            let posX = file.file_type == 'input' ? job.mousePosition[0] - 75  : parseInt(job.mousePosition[0]) + 75;
            let posY = file.file_type == 'input' ? job.mousePosition[1] - (45 * idx) : job.mousePosition[1] - (45 * idx);
            nodes.push({
              "title": fileInfo.fileName,
              "id": newFile.id,
              "x": posX,
              "y": posY,
              "type": "File",
              "fileId": newFile.id
            })
            if(file.file_type == 'input') {
              edge = {"source":newFile.id,"target":job.basic.id};
            } else if(file.file_type == 'output') {
              edge = {"source":job.basic.id,"target":newFile.id};
            }
            edges.push(edge);

            fieldsToUpdate = {"file_id": newFile.id, "application_id" : job.basic.application_id};
            let fileLayoutToSave = hpccUtil.updateCommonData(fileInfo.layout, fieldsToUpdate);
            return FileLayout.bulkCreate(fileLayoutToSave, {updateOnDuplicate: ["name", "type", "displayType", "displaySize", "textJustification", "format","data_types", "isPCI", "isPII", "isHIPAA", "description", "required"]});
           }).then((fileLayout) => {
            let fileValidationsToSave = hpccUtil.updateCommonData(fileInfo.validations, fieldsToUpdate);
            return FileValidation.bulkCreate(
              fileValidationsToSave,
              {updateOnDuplicate: ["name", "ruleType", "rule", "action", "fixScript"]}
            )
         }).then((fileValidations) => {
            console.log('file '+fileInfo.fileName+' processed...' )
         }).catch(err => {
          console.log('error occured: '+err)
          reject(err);
         })

        })
      );
    })
    console.log('resolving....');
    Promise.all(promises).then(() => {
      console.log("job and files created....")
      updateDataFlowGraph(job.basic.application_id, job.basic.dataflowId, nodes, edges).then((dataflowGraph) => {
        resolve(dataflowGraph)
      });
    });
  })
}

let updateJobDetails = (jobId, applicationId, req) => {
  let fieldsToUpdate = {"job_id"  : jobId, "application_id" : applicationId};

  return new Promise(async (resolve, reject) => {
    var deleteFiles = await JobFile.destroy({where:{ job_id: jobId, application_id:applicationId }});

    var jobFileToSave = updateCommonData(req.body.job.files, fieldsToUpdate);
    JobFile.bulkCreate(
      jobFileToSave, {updateOnDuplicate: ["file_type", "name", "description", "gitRepo"]}
    ).then(function(jobFile) {
      var jobParamsToSave = updateCommonData(req.body.job.params, fieldsToUpdate);
      JobParam.destroy({where:{application_id:applicationId, job_id: jobId}}).then((deleted) => {
      return JobParam.bulkCreate(jobParamsToSave)
    }).then(function(jobParam) {
      if(req.body.job.autoCreateFiles) {
        updateFileRelationship(jobId, req.body.job, req.body.files).then((results) => {
          console.log('results: '+JSON.stringify(results));
          resolve({"result":"success", "title":req.body.job.basic.title, "jobId":jobId, "dataflow":results})
        });
      } else {
        resolve({"result":"success", "title":req.body.job.basic.title, "jobId":jobId})
      }
    }).catch((err) => {
        reject(err)
    })
    });
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

  Job.findOne({where: {id: req.body.jobId}, include:[JobFile]}).then((savedJob) => {
    let mousePos = req.body.mousePosition.split(',');
    let job = {};
    job.basic = {
      "title": savedJob.name,
      "id": req.body.currentlyEditingId,
      "x": parseInt(mousePos[0]),
      "y": parseInt(mousePos[1]),
      "clusterId": savedJob.cluster_id,
      "application_id": req.body.application_id,
      "dataflowId": req.body.dataflowId
    }
    job.mousePosition = mousePos;
    console.log(job);
    updateFileRelationship(req.body.jobId, job, savedJob.jobfiles).then((results) => {
      console.log("createFileRelation - success for "+req.body.jobId);
      res.json(results);
    })
  }).catch((err) => {
    return res.status(500).send("Error occured while file relation");
  })
});

router.post('/saveJob', [
  body('id')
  .optional({checkFalsy:true})
    .isUUID(4).withMessage('Invalid id'),
  body('job.basic.application_id')
    .isUUID(4).withMessage('Invalid application id'),
  body('job.basic.name')
  .matches(/^[a-zA-Z]{1}[a-zA-Z0-9_.\-:]*$/).withMessage('Invalid title')
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
        updateJobDetails(result.id, applicationId, req).then((response) => {
          res.json(response);
        })
      })
    } else {
      Job.update(
        req.body.job.basic, {where:{application_id: applicationId, id:req.body.id}}
      ).then((result) => {
        updateJobDetails(req.body.id, applicationId, req).then((response) => {
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