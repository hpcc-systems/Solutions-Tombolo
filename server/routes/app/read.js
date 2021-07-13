const express = require('express');
const router = express.Router();
const assert = require('assert');[]
var path = require('path');
var fs = require('fs');
var models  = require('../../models');
let UserApplication = models.user_application;
let Application = models.application;
let File = models.file;
let FileLayout = models.file_layout;
let FileLicense = models.file_license;
let FileValidation = models.file_validation;
let Index = models.indexes;
let IndexKey = models.index_key;
let IndexPayload = models.index_payload;
let Job = models.job;
let JobFile = models.jobfile;
let JobParam = models.jobparam;
let Query = models.query;
let QueryField = models.query_field;
let Dataflow = models.dataflow;
let DataflowGraph = models.dataflowgraph;

const validatorUtil = require('../../utils/validator');
const { body, query, validationResult } = require('express-validator');
const NotificationModule = require('../notifications/email-notification');
const authServiceUtil = require('../../utils/auth-service-utils');
let Sequelize = require('sequelize');
const Op = Sequelize.Op;

router.get('/app_list', (req, res) => {
  console.log("[app/read.js] - App route called");

  try {
    models.application.findAll({order: [['updatedAt', 'DESC']]}).then(function(applications) {
        res.json(applications);
    })
    .catch(function(err) {
      console.log(err);
      return res.status(500).json({ success: false, message: "Error occured while getting application list" });
    });
  } catch (err) {
    console.log('err', err);
    return res.status(500).json({ success: false, message: "Error occured while getting application list" });
  }
});
router.get('/appListByUserId', (req, res) => {
  console.log("[app/read.js] -  Get app list for user id ="+ req.query.user_id);

  try {
    models.application.findAll({where:{
      [Op.or]: [
        {"$user_id$":req.query.user_id},
        {"$user_id$": req.query.user_name}
      ]
    }, order: [['updatedAt', 'DESC']],
    include: [UserApplication]
        }).then(function(applications) {
        res.json(applications);
    })
    .catch(function(err) {
      console.log(err);
      return res.status(500).json({ success: false, message: "Error occured while getting application list" });
    });
  } catch (err) {
    console.log('err', err);
    return res.status(500).json({ success: false, message: "Error occured while getting application list" });
  }
});

router.get('/app', [
  query('app_id')
    .isUUID(4).withMessage('Invalid application id')
], (req, res) => {
  const errors = validationResult(req).formatWith(validatorUtil.errorFormatter);
  if (!errors.isEmpty()) {
    return res.status(422).json({ success: false, errors: errors.array() });
  }
  console.log("[app/read.js] - App route called: "+req.query.app_id);

  try {
    models.application.findOne({
        where: {"id":req.query.app_id}
    }).then(function(application) {
        res.json(application);
    })
    .catch(function(err) {
      console.log(err);
      return res.status(500).json({ success: false, message: "Error occured while getting application details" });
    });
  } catch (err) {
    console.log('err', err);
    return res.status(500).json({ success: false, message: "Error occured while getting application details" });
  }
});

router.post('/newapp', [
  body('user_id')
    .optional({checkFalsy:true})
    .matches(/^[a-zA-Z]{1}[a-zA-Z0-9_:.\-]*$/).withMessage('Invalid user_id'),
  body('title')
    .matches(/^[a-zA-Z]{1}[a-zA-Z0-9_:.\-]*$/).withMessage('Invalid title'),
  body('description')
    .optional({checkFalsy:true}),
  body('creator')
    .matches(/^[a-zA-Z]{1}[a-zA-Z0-9_:.\-]*$/).withMessage('Invalid creator'),
],function (req, res) {
  const errors = validationResult(req).formatWith(validatorUtil.errorFormatter);
  if (!errors.isEmpty()) {
    return res.status(422).json({ success: false, errors: errors.array() });
  }
  try {
    if(req.body.id == '') {
      models.application.create({"title":req.body.title, "description":req.body.description, "creator": req.body.creator}).then(function(application) {
        if(req.body.user_id)
          models.user_application.create({"user_id":req.body.user_id, "application_id":application.id}).then(function(userapp) {
          res.json({"result":"success", "id": application.id});
        });
      else
          res.json({"result":"success", "id": application.id});
      });
    } else {
      models.application.update(req.body, {where:{id:req.body.id}}).then(function(result){
          res.json({"result":"success", "id": result.id});
      })
    }
  } catch (err) {
    console.log('err', err);
    return res.status(500).json({ success: false, message: "Error occured while creating application" });
  }
});

router.post('/removeapp', function (req, res) {
  try {
      models.application.destroy({
          where:{id: req.body.appIdsToDelete}
      }).then(function(deleted) {
          return res.status(200).send({"result":"success"});
      });
  } catch (err) {
    console.log('err', err);
    return res.status(500).json({ success: false, message: "Error occured while removing application" });
  }
});

router.post('/saveUserApp', function (req, res) {
  console.log("[app/read.js] - saveUserApp called");
  var userAppList=req.body.users;
  try {
    UserApplication.bulkCreate(userAppList).then(async function(application) {
      let userDetail = await authServiceUtil.getUserDetails(req, userAppList[0].user_id);
      Application.findOne({where: {id:userAppList[0].application_id}}).then((application) => {
        NotificationModule.notifyApplicationShare(userDetail[0].email, application.title, req);
      })
      res.json({"result":"success"});
    });
  } catch (err) {
    console.log('err', err);
    return res.status(500).json({ success: false, message: "Error occured while saving user application mapping" });
  }
});

router.post('/export', [
  body('id').isUUID(4).withMessage('Invalid application id')
], (req, res) => {
  const errors = validationResult(req).formatWith(validatorUtil.errorFormatter);
  if (!errors.isEmpty()) {
    return res.status(422).json({ success: false, errors: errors.array() });
  } 

  try {
    let applicationExport = {};
    Application.findOne({
      where: {id: req.body.id},
    }).then(async (application) => {
      applicationExport.title = application.title,
      applicationExport.description = application.description;
      applicationExport.cluster = application.cluster;

      let files = await File.findAll({where: {application_id: application.id}, 
        include: [
          {model: FileLayout, attributes: { exclude: ['createdAt', 'updatedAt', 'id', 'application_id'] }}, 
          {model: FileLicense, attributes: { exclude: ['createdAt', 'updatedAt', 'id', 'application_id'] }}, 
          {model: FileValidation, attributes: { exclude: ['createdAt', 'updatedAt', 'id', 'application_id'] }}
        ],
        attributes: { exclude: ['createdAt', 'updatedAt', 'id', 'application_id'] }
      }); 

      let indexes = await Index.findAll({where: {application_id: application.id}, 
        include: [
          {model: IndexKey, attributes: { exclude: ['createdAt', 'updatedAt', 'id', 'application_id'] }}, 
          {model: IndexPayload, attributes: { exclude: ['createdAt', 'updatedAt', 'id', 'application_id'] }}
        ],
        attributes: { exclude: ['createdAt', 'updatedAt', 'id', 'application_id'] }
      }); 

      let queries = await Query.findAll({where: {application_id: application.id}, 
        include: [{model: QueryField, attributes: { exclude: ['createdAt', 'updatedAt', 'id', 'application_id'] }}],
        attributes: { exclude: ['createdAt', 'updatedAt', 'id', 'application_id'] }
      }); 

      let jobs = await Job.findAll({where: {application_id: application.id}, 
        include: [
          {model: JobFile, attributes: { exclude: ['createdAt', 'updatedAt', 'id', 'application_id'] }}, 
          {model: JobParam, attributes: { exclude: ['createdAt', 'updatedAt', 'id', 'application_id'] }}
        ],
        attributes: { exclude: ['createdAt', 'updatedAt', 'id', 'application_id', 'assetId'] }
      }); 

      let dataflow = await Dataflow.findAll({where: {application_id: application.id}, 
        include: [{model: DataflowGraph, attributes: { exclude: ['createdAt', 'updatedAt', 'id', 'application_id'] }}],
        attributes: { exclude: ['createdAt', 'updatedAt', 'id', 'application_id'] }
      }); 

      applicationExport.assets = {files: files, indexes: indexes, queries: queries, jobs: jobs, dataflow: dataflow};
        
      var schemaDir = path.join(__dirname, '..', '..', 'schemas');
      if (!fs.existsSync(schemaDir)){
        fs.mkdirSync(schemaDir);
      }
      var exportFile = path.join(__dirname, '..', '..', 'schemas', application.title+'-export.json');
      
      fs.appendFile(exportFile, JSON.stringify(applicationExport, null, 4), function (err) {
          if (err) return res.status(500).send("Error occured while exporting application");
          res.download(exportFile, function(err){
            if (err) {
              console.log(err);
              console.log("Error occured during download...")
              res.status(500).send("Error occured while exporting application");;
            } else {
              console.log("Download completed...")
              fs.unlink(exportFile, (err) => {
                if (err) res.status(500).send("Error occured while exporting application");;
                console.log(exportFile + ' was deleted after download');
              });
            }
          });
      });

      //res.json(applicationExport);
    })
  } catch (err) {
    console.log('err', err);
    return res.status(500).json({ success: false, message: "Error occured while removing application" });
  }
});

module.exports = router;