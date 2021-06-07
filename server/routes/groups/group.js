const express = require("express");
const router = express.Router();
const validatorUtil = require("../../utils/validator");

const { body, query, oneOf, validationResult } = require("express-validator");
let Sequelize = require("sequelize");
const Op = Sequelize.Op;
var models = require("../../models");
let Groups = models.groups;
let Index = models.indexes;
let File = models.file;
let Query = models.query;
let Job = models.job;
let AssetsGroups = models.assets_groups;

let createGroupHierarchy = (groups) => {
  let recursivelyPopulateGroup = (parentLevelGroup, parentKey) => {
    let childGroupHierarchy = [];
    //recursively find all children
    let children = groups.filter(
      (group) => group.parent_group == parentLevelGroup.id
    );
    children.forEach((childGroup, idx) => {
      let key = parentKey + "-" + idx;
      childGroupHierarchy.push({
        title: childGroup.name,
        id: childGroup.id,
        key: key,
        children: recursivelyPopulateGroup(childGroup, key),
      });
    });

    return childGroupHierarchy;
  };

  return new Promise((resolve, reject) => {
    let groupHierarchy = [];
    //find groups with no parents (those directly under root group)
    let parentLevelGroups = groups.filter((group) => group.parent_group == "");
    parentLevelGroups.forEach((parentLevelGroup, parentIdx) => {
      let key = "0-0-" + parentIdx;
      groupHierarchy.push({
        title: parentLevelGroup.name,
        id: parentLevelGroup.id,
        key: key,
        children: recursivelyPopulateGroup(parentLevelGroup, key),
      });
    });
    //add the whole hierarchy under root group
    resolve([
      {
        title: "Groups",
        key: "0-0",
        children: groupHierarchy,
      },
    ]);
  });
};

router.get(
  "/details",
  [
    query("app_id").isUUID(4).withMessage("Invalid app id"),
    query("group_id").isInt().withMessage("Invalid group id"),
  ],
  (req, res) => {
    const errors = validationResult(req).formatWith(
      validatorUtil.errorFormatter
    );
    if (!errors.isEmpty()) {
      return res.status(422).json({ success: false, errors: errors.array() });
    }
    Groups.findOne({
      where: { application_id: req.query.app_id, id: req.query.group_id },
    })
      .then(function (group) {
        res.json(group);
      })
      .catch(function (err) {
        console.log(err);
      });
  }
);

router.get(
  "/",
  [query("app_id").isUUID(4).withMessage("Invalid app id")],
  (req, res) => {
    const errors = validationResult(req).formatWith(
      validatorUtil.errorFormatter
    );
    if (!errors.isEmpty()) {
      return res.status(422).json({ success: false, errors: errors.array() });
    }
    Groups.findAll({
      where: { application_id: req.query.app_id },
      order: [["name", "ASC"]],
    })
      .then(function (groups) {
        createGroupHierarchy(groups).then((groupHierarchy) => {
          res.json(groupHierarchy);
        });
      })
      .catch((err) => {
        console.log(err);
      });
  }
);

let getChildGroups = (appId, groupId) => {
  return new Promise((resolve, reject) => {
    let childGroups = [],
      whereClause = {};
    if (groupId && groupId != undefined) {
      whereClause.application_id = appId;
      whereClause.parent_group = groupId;
    } else {
      whereClause.application_id = appId;
      whereClause.parent_group = { [Op.or]: [null, ""] };
    }
    Groups.findAll({ where: whereClause, order: [["name", "ASC"]] })
      .then((groups) => {
        groups.forEach((group) => {
          childGroups.push({
            type: "Group",
            id: group.id,
            name: group.name,
            description: group.description,
            createdAt: group.createdAt,
          });
        });
        resolve(childGroups);
      })
      .catch((err) => {
        reject(err);
      });
  });
};

let getKeywordsForQuery = (keywords) => {
  if (typeof keywords !== "string") return;

  if (keywords.startsWith("*") && keywords.endsWith("*")) {
    //keywords = '%'+keywords.substring(1, keywords.length -1)+'%';
    keywords = keywords.substring(1, keywords.length - 1);
  } else if (keywords.startsWith("*")) {
    //keywords = '%'+keywords.substring(1, keywords.length)+'%';
    keywords = keywords.substring(1, keywords.length) + "$";
  } else if (keywords.endsWith("*")) {
    //keywords = keywords.substring(0, keywords.length-1)+'%';
    keywords = "^" + keywords.substring(0, keywords.length - 1);
  } else if (keywords.startsWith('"') && keywords.endsWith('"')) {
    //keywords = '%'+keywords.substring(1, keywords.length -1)+'%';
    keywords = "/^" + keywords.substring(1, keywords.length - 1) + "$/";
  } else if (keywords.indexOf(" ") > 0) {
    keywords = keywords.split(" ").join("|");
    console.log("space: " + keywords);
  } else {
    //keywords = '%'+keywords+'%';
    keywords = keywords;
  }
  console.log(keywords);
  return keywords;
};

let prepareWhereClause = (keywords) => {
  let whereClause = {};
  //multiple keywords - https://github.com/sequelize/sequelize/issues/10940#issuecomment-655563737
  if (keywords instanceof Array) {
    whereClause = {
      [Op.or]: [
        { name: { [Op.regexp]: keywords.join("|") } },
        { title: { [Op.regexp]: keywords.join("|") } },
        { description: { [Op.regexp]: keywords.join("|") } },
      ],
    };
  } else {
    whereClause = {
      [Op.or]: [
        { name: { [Op.like]: keywords } },
        { title: { [Op.like]: keywords } },
        { description: { [Op.like]: keywords } },
      ],
    };
  }
  return whereClause;
};

router.get(
  "/assets",
  [
    query("app_id").isUUID(4).withMessage("Invalid app id"),
    query("group_id")
      .optional({ checkFalsy: true })
      .isInt()
      .withMessage("Invalid group id"),
  ],
  (req, res) => {
    const errors = validationResult(req).formatWith(
      validatorUtil.errorFormatter
    );
    if (!errors.isEmpty()) {
      return res.status(422).json({ success: false, errors: errors.array() });
    }
    let finalAssets = [];
    if (req.query.group_id && req.query.group_id != undefined) {
      Groups.findAll({
        where: {
          application_id: req.query.app_id,
          id: req.query.group_id,
        },
        include: [
          {
            model: File,
            as: "files",
            attributes: ["id", "name", "title", "description", "createdAt"],
          },
          {
            model: Job,
            as: "jobs",
            attributes: ["id", "name", "title", "description", "createdAt"],
          },
          {
            model: Query,
            as: "queries",
            attributes: ["id", "name", "title", "description", "createdAt"],
          },
          {
            model: Index,
            as: "indexes",
            attributes: ["id", "name", "title", "description", "createdAt"],
          },
        ],
        order: [["name", "ASC"]],
      })
        .then(async (assets) => {
          let childGroups = await getChildGroups(
            req.query.app_id,
            req.query.group_id
          );
          assets[0].files.forEach((file) => {
            finalAssets.push({
              type: "File",
              id: file.id,
              name: file.name,
              title: file.title,
              description: file.description,
              createdAt: file.createdAt,
            });
          });
          assets[0].jobs.forEach((job) => {
            finalAssets.push({
              type: "Job",
              id: job.id,
              name: job.name,
              title: job.title,
              description: job.description,
              createdAt: job.createdAt,
            });
          });
          assets[0].indexes.forEach((index) => {
            finalAssets.push({
              type: "Index",
              id: index.id,
              name: index.name,
              title: index.title,
              description: index.description,
              createdAt: index.createdAt,
            });
          });
          assets[0].queries.forEach((query) => {
            finalAssets.push({
              type: "Query",
              id: query.id,
              name: query.name,
              title: query.title,
              description: query.description,
              createdAt: query.createdAt,
            });
          });

          finalAssets.sort(comparator);
          finalAssets = childGroups.concat(finalAssets);
          res.json(finalAssets);
        })
        .catch(function (err) {
          console.log(err);
        });
    } else {
      let promises = [],
        finalGroups = [];
      //if group_id is not passed, this could be a root dir. pull all assets for that app_id

      promises.push(
        File.findAll({
          where: {
            application_id: req.query.app_id,
            [Op.and]: Sequelize.literal(
              "not exists (select * from assets_groups where assets_groups.assetId = file.id)"
            ),
          },
        }).then((files) => {
          files.forEach((file) => {
            finalAssets.push({
              type: "File",
              id: file.id,
              name: file.name,
              title: file.title,
              description: file.description,
              createdAt: file.createdAt,
            });
          });
        })
      );

      promises.push(
        Index.findAll({
          where: {
            application_id: req.query.app_id,
            [Op.and]: Sequelize.literal(
              "not exists (select * from assets_groups where assets_groups.assetId = indexes.id)"
            ),
          },
        }).then((indexes) => {
          indexes.forEach((index) => {
            finalAssets.push({
              type: "Index",
              id: index.id,
              name: index.name,
              title: index.title,
              description: index.description,
              createdAt: index.createdAt,
            });
          });
        })
      );

      promises.push(
        Job.findAll({
          where: {
            application_id: req.query.app_id,
            [Op.and]: Sequelize.literal(
              "not exists (select * from assets_groups where assets_groups.assetId = job.id)"
            ),
          },
          attributes: ["id", "name", "title", "description", "createdAt"],
        }).then((jobs) => {
          jobs.forEach((job) => {
            finalAssets.push({
              type: "Job",
              id: job.id,
              name: job.name,
              title: job.title,
              description: job.description,
              createdAt: job.createdAt,
            });
          });
        })
      );

      promises.push(
        Query.findAll({
          where: {
            application_id: req.query.app_id,
            [Op.and]: Sequelize.literal(
              "not exists (select * from assets_groups where assets_groups.assetId = query.id)"
            ),
          },
        }).then((queries) => {
          queries.forEach((query) => {
            finalAssets.push({
              type: "Query",
              id: query.id,
              name: query.name,
              title: query.title,
              description: query.description,
              createdAt: query.createdAt,
            });
          });
        })
      );

      promises.push(
        Groups.findAll({
          where: {
            application_id: req.query.app_id,
            parent_group: { [Op.or]: [null, ""] },
          },
          order: [["name", "ASC"]],
        }).then((groups) => {
          groups.forEach((group) => {
            finalGroups.push({
              type: "Group",
              id: group.id,
              name: group.name,
              description: group.description,
              createdAt: group.createdAt,
            });
          });
        })
      );

      Promise.all(promises).then(() => {
        console.log("1-all assets retrieved....");
        finalAssets.sort(comparator);

        finalAssets = finalGroups.concat(finalAssets);
        res.json(finalAssets);
      });
    }
  }
);

router.get(
  "/assetsSearch",
  [
    query("app_id").isUUID(4).withMessage("Invalid app id"),
    query("group_id")
      .optional({ checkFalsy: true })
      .isInt()
      .withMessage("Invalid group id"),
    query("assetTypeFilter")
      .optional({ checkFalsy: true })
      .matches(/^[a-zA-Z]{1}[a-zA-Z,]*$/)
      .withMessage("Invalid assetTypeFilter"),
    query("keywords")
      .optional({ checkFalsy: true })
      .matches(/^[*"a-zA-Z]{1}[a-zA-Z0-9_ :.\-*"\"]*$/)
      .withMessage("Invalid keywords"),
  ],
  async (req, res) => {
    let replacements = {},
      query;
    let keywords = getKeywordsForQuery(req.query.keywords);
    let assetFilters = req.query.assetTypeFilter
      ? req.query.assetTypeFilter.split(",")
      : [];
    if (req.query.group_id) {
      query =
        "select assets.id, assets.name, assets.title, assets.description, assets.createdAt, assets.type, hie.name as group_name, hie.id as groupId from " +
        "(select  id, name, parent_group " +
        "from    (select * from groups " +
        "order by parent_group, id) groups_sorted, " +
        "(select @pv := (:groupId)) initialisation " +
        "where find_in_set(parent_group, @pv) and length(@pv := concat(@pv, ',', id)) > 0 or id=(:groupId)) as hie " +
        "join (";
      if (assetFilters.length == 0 || assetFilters.includes("File")) {
        query +=
          "select f.id, f.name, ag.groupId, f.title, f.description, f.createdAt, 'File' as type from file f, assets_groups ag where f.application_id = (:applicationId) and ag.assetId=f.id and (f.name REGEXP (:keyword) or f.title REGEXP (:keyword)) ";
        query +=
          assetFilters.length == 0 || assetFilters.length > 1
            ? "union all "
            : "";
      }
      if (assetFilters.length == 0 || assetFilters.includes("Query")) {
        query +=
          "select q.id, q.name, ag.groupId, q.title, q.description, q.createdAt, 'Query' as type from query q, assets_groups ag where q.application_id = (:applicationId) and ag.assetId=q.id and (q.name REGEXP (:keyword) or q.title REGEXP (:keyword)) ";
        query +=
          assetFilters.length == 0 || assetFilters.length > 1
            ? "union all "
            : "";
      }
      if (assetFilters.length == 0 || assetFilters.includes("Indexes")) {
        query +=
          "select idx.id, idx.name, ag.groupId, idx.title, idx.description, idx.createdAt, 'Index' as type  from indexes idx, assets_groups ag where idx.application_id = (:applicationId) and ag.assetId=idx.id and (idx.name REGEXP (:keyword) or idx.title REGEXP (:keyword)) ";
        query +=
          assetFilters.length == 0 || assetFilters.length > 1
            ? "union all "
            : "";
      }
      if (assetFilters.length == 0 || assetFilters.includes("Job")) {
        query +=
          "select j.id, j.name, ag.groupId, j.title, j.description, j.createdAt, 'Job' as type  from job j, assets_groups ag where j.application_id = (:applicationId) and j.id = ag.assetId and (j.name REGEXP (:keyword) or j.title REGEXP (:keyword) ) ";
        query +=
          assetFilters.length == 0 || assetFilters.length > 1
            ? "union all "
            : "";
      }
      if (assetFilters.length == 0 || assetFilters.includes("Groups")) {
        query +=
          "select g.id, g.name, g.parent_group, g.name as title, g.description, g.createdAt, 'Group' as type  from groups g where g.application_id = (:applicationId) and (g.name REGEXP (:keyword) ) ";
        query +=
          assetFilters.length == 0 || assetFilters.length > 1
            ? "union all "
            : "";
      }

      query = query.endsWith(" union all ")
        ? query.substring(0, query.lastIndexOf(" union all "))
        : query;
      console.log(query);
      query += " ) as assets on (assets.groupId = hie.id) ";
      replacements = {
        applicationId: req.query.app_id,
        groupId: req.query.group_id,
        keyword: keywords,
      };
    } else {
      query = "";
      if (assetFilters.length == 0 || assetFilters.includes("File")) {
        query +=
          "select files_res.*, g.name as group_name from (select f.id, f.name, ag.groupId, f.title, f.description, f.createdAt, 'File' as type from file f left join assets_groups ag on f.id = ag.assetId where f.application_id = (:applicationId) and  (f.name REGEXP (:keyword) or f.title REGEXP (:keyword))) as files_res left join groups g on files_res.groupId = g.id ";
        query +=
          assetFilters.length == 0 || assetFilters.length > 1
            ? "union all "
            : "";
      }
      if (assetFilters.length == 0 || assetFilters.includes("Query")) {
        query +=
          "select queries_res.*, g.name as group_name from (select q.id, q.name, ag.groupId, q.title, q.description, q.createdAt, 'Query' as type from query q left join assets_groups ag on q.id = ag.assetId where q.application_id = (:applicationId) and  (q.name REGEXP (:keyword) or q.title REGEXP (:keyword))) as queries_res left join groups g on queries_res.groupId = g.id ";
        query +=
          assetFilters.length == 0 || assetFilters.length > 1
            ? "union all "
            : "";
      }
      if (assetFilters.length == 0 || assetFilters.includes("Indexes")) {
        query +=
          "select idx_res.*, g.name as group_name from (select idx.id, idx.name, ag.groupId, idx.title, idx.description, idx.createdAt, 'Index' as type from indexes idx left join assets_groups ag on idx.id = ag.assetId where idx.application_id = (:applicationId) and  (idx.name REGEXP (:keyword) or idx.title REGEXP (:keyword))) as idx_res left join groups g on idx_res.groupId = g.id ";
        query +=
          assetFilters.length == 0 || assetFilters.length > 1
            ? "union all "
            : "";
      }
      if (assetFilters.length == 0 || assetFilters.includes("Job")) {
        query +=
          "select j_res.*, g.name as group_name from (select j.id, j.name, ag.groupId, j.title, j.description, j.createdAt, 'Job' as type from job j left join assets_groups ag on j.id = ag.assetId where j.application_id = (:applicationId) and  (j.name REGEXP (:keyword) or j.title REGEXP (:keyword))) as j_res left join groups g on j_res.groupId = g.id ";
        query +=
          assetFilters.length == 0 || assetFilters.length > 1
            ? "union all "
            : "";
      }
      if (assetFilters.length == 0 || assetFilters.includes("Groups")) {
        query +=
          "select g.id, g.name, g.parent_group as groupId, gp.name as group_name, '' as title, g.description, g.createdAt, 'Group' as type  from groups g inner join groups gp on g.parent_group = gp.id where g.application_id = (:applicationId) and g.name REGEXP (:keyword) ";
        //query += (assetFilters.length == 0 || assetFilters.length > 1) ? "union all " : "";
      }
      replacements = { applicationId: req.query.app_id, keyword: keywords };
    }
    models.sequelize
      .query(query, {
        type: models.sequelize.QueryTypes.SELECT,
        replacements: replacements,
      })
      .then((assets) => {
        res.json(assets);
      })
      .catch(function (err) {
        console.log(err);
        return res.status(500).send("Error occured while retrieving assets");
      });
  }
);

let groupExistsWithSameName = (parentGroupId, name, appId) => {
  return new Promise((resolve, reject) => {
    Groups.findAll({
      where: { parent_group: parentGroupId, name: name, application_id: appId },
    }).then((results) => {
      if (results.length > 0) {
        resolve(true);
      } else {
        resolve(false);
      }
    });
  });
};

router.post(
  "/",
  [
    body("parentGroupId")
      .optional({ checkFalsy: true })
      .isInt()
      .withMessage("Invalid parent group id"),
    body("id").optional({ checkFalsy: true }).isInt().withMessage("Invalid id"),
    body("applicationId").isUUID(4).withMessage("Invalid application id"),
    body("name")
      .matches(/^[a-zA-Z0-9_.\-:]*$/)
      .withMessage("Invalid Name"),
  ],
  async (req, res) => {
    const errors = validationResult(req).formatWith(
      validatorUtil.errorFormatter
    );
    if (!errors.isEmpty()) {
      return res.status(422).json({ success: false, errors: errors.array() });
    }
    try {
      let parentGroupId =
        req.body.parentGroupId && req.body.parentGroupId != ""
          ? req.body.parentGroupId
          : "";
      if (req.body.isNew) {
        let duplicateGroupName = await groupExistsWithSameName(
          parentGroupId,
          req.body.name,
          req.body.applicationId
        );
        if (duplicateGroupName) {
          res.status(400).send({
            message:
              "There is already a group with the same name under the parent group. Please select a different name",
          });
        } else {
          Groups.create({
            name: req.body.name,
            description: req.body.description,
            application_id: req.body.applicationId,
            parent_group: parentGroupId,
          }).then((groupCreated) => {
            res.json({ success: true, id: groupCreated.id });
          });
        }
      } else {
        Groups.findOne({
          where: { id: req.body.id, application_id: req.body.applicationId },
        }).then(async (group) => {
          let duplicateGroupName = false;
          if (group.name != req.body.name) {
            duplicateGroupName = await groupExistsWithSameName(
              group.parent_group,
              req.body.name,
              req.body.applicationId
            );
          }
          if (duplicateGroupName) {
            res.status(400).send({
              message:
                "There is already a group with the same name under the parent group. Please select a different name",
            });
          } else {
            Groups.update(
              {
                name: req.body.name,
                description: req.body.description,
              },
              { where: { id: req.body.id } }
            ).then((groupUpdated) => {
              res.json({ success: true, id: groupUpdated.id });
            });
          }
        });
      }
    } catch (err) {
      console.log(err);
      return res.status(500).send("Error occured while saving Group");
    }
  }
);

let canDeleteGroup = (group_id, appId) => {
  return new Promise((resolve, reject) => {
    Groups.findAll({
      where: { application_id: appId, id: group_id },
      include: [
        {
          model: File,
          as: "files",
          attributes: ["id", "name", "title", "description", "createdAt"],
        },
        {
          model: Job,
          as: "jobs",
          attributes: ["id", "name", "title", "description", "createdAt"],
        },
        {
          model: Query,
          as: "queries",
          attributes: ["id", "name", "title", "description", "createdAt"],
        },
        {
          model: Index,
          as: "indexes",
          attributes: ["id", "name", "title", "description", "createdAt"],
        },
      ],
      order: [["name", "ASC"]],
    }).then((groups) => {
      if (
        groups[0].files.length > 0 ||
        groups[0].jobs.length > 0 ||
        groups[0].indexes.length ||
        groups[0].queries.length
      ) {
        resolve(false);
      } else {
        Groups.findAll({
          where: { parent_group: group_id, application_id: appId },
        }).then((groups) => {
          if (groups.length > 0) {
            resolve(false);
          } else {
            resolve(true);
          }
        });
      }
    });
  });
};

router.delete(
  "/",
  [
    body("app_id").isUUID(4).withMessage("Invalid app id"),
    body("group_id").isInt().withMessage("Invalid group id"),
  ],
  async (req, res) => {
    const errors = validationResult(req).formatWith(
      validatorUtil.errorFormatter
    );
    if (!errors.isEmpty()) {
      return res.status(422).json({ success: false, errors: errors.array() });
    }
    try {
      const deleteGroup = await canDeleteGroup(
        req.body.group_id,
        req.body.app_id
      );

      if (deleteGroup) {
        Groups.destroy({
          where: { application_id: req.body.app_id, id: req.body.group_id },
        }).then((groupDeleted) => {
          res.json({ success: true });
        });
      } else {
        res.status(500).send({
          message:
            "The selected Group is not empty. Please empty the content of the group before it can be deleted",
        });
      }
    } catch (err) {
      console.log(err);
      return res.status(500).send("Error occured while deleting the Group");
    }
  }
);

router.put(
  "/move",
  [
    body("app_id").isUUID(4).withMessage("Invalid app id"),
    body("groupId").isInt().withMessage("Invalid group id"),
    body("destGroupId")
      .optional({ checkFalsy: true })
      .isInt()
      .withMessage("Invalid target group id"),
  ],
  (req, res) => {
    const errors = validationResult(req).formatWith(
      validatorUtil.errorFormatter
    );
    if (!errors.isEmpty()) {
      return res.status(422).json({ success: false, errors: errors.array() });
    }
    let parentGroup = req.body.destGroupId ? req.body.destGroupId : "";
    Groups.update(
      {
        parent_group: parentGroup,
      },
      { where: { id: req.body.groupId, application_id: req.body.app_id } }
    )
      .then((groupUpdated) => {
        res.json({ success: true });
      })
      .catch(function (err) {
        console.log(err);
        return res.status(500).send("Error occured while moving group");
      });
  }
);

// groupId: assetToMove.id,
// destGroupId: moveDestinationGroup.id,
// app_id: application.applicationId,
// assetType: assetToMove.type,
// assetId: assetToMove.id,

router.put(
  "/move/asset",
  [
    body("app_id").isUUID(4).withMessage("Invalid app id"),
    body("assetId").isInt().withMessage("Invalid asset id"),
    body("destGroupId")
      .optional({ checkFalsy: true })
      .isInt()
      .withMessage("Invalid target group id"),
    body("groupId")
      .optional({ checkFalsy: true })
      .isInt()
      .withMessage("Invalid group id"),
    body("assetType")
      .matches(/^[a-zA-Z]/)
      .withMessage("Invalid asset type"),
  ],
  (req, res) => {
    console.log(">>>> Route to move groups found");

    const errors = validationResult(req).formatWith(
      validatorUtil.errorFormatter
    );
    console.log("Error >>>", JSON.stringify(errors));
    if (!errors.isEmpty()) {
      console.log(
        ">>>> Validation error occured",
        req.body.assetId,
        req.body.groupId
      );

      return res.status(422).json({ success: false, errors: errors.array() });
    }
    let appId = req.body.app_id,
      assetId = req.body.assetId,
      groupId = req.body.groupId,
      destGroupId = req.body.destGroupId ? req.body.destGroupId : "";
    try {
      if (req.body.assetType != "Group") {
        AssetsGroups.findOrCreate({
          where: { assetId: assetId, groupId: destGroupId },
          defaults: { assetId: assetId, groupId: destGroupId },
        }).then((assetsGroupsCreated) => {
          if (req.body.groupId && req.body.groupId != "") {
            AssetsGroups.destroy({
              where: { assetId: assetId, groupId: groupId },
            }).then((existingGroupAssociationRemoved) => {
              res.json({ success: true });
            });
          } else {
            res.json({ success: true });
          }
        });
      } else {
        console.log(">>>> Group found needs update");
        Groups.update(
          { parent_group: destGroupId },
          { where: { application_id: appId, id: assetId } }
        ).then((updated) => {
          res.json({ success: true });
        });
      }
    } catch (err) {
      console.log(err);
      return res.status(500).send("Error occured while moving asset");
    }
  }
);

let comparator = (a, b) => {
  if (a.name < b.name) {
    return -1;
  }
  if (a.name > b.name) {
    return 1;
  }
  return 0;
};

module.exports = router;
