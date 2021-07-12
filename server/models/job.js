'use strict';
module.exports = (sequelize, DataTypes) => {
  const job = sequelize.define('job', {
    id: {
      primaryKey: true,
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      allowNull: false,
      autoIncrement: false
    },
    application_id: DataTypes.STRING,
    author: DataTypes.STRING,
    contact: DataTypes.STRING,
    description: DataTypes.TEXT,
    ecl: DataTypes.TEXT,
    entryBWR: DataTypes.STRING,
    gitRepo: DataTypes.STRING,
    jobType: DataTypes.STRING,
    title: DataTypes.STRING,
    name: DataTypes.STRING,
    cluster_id: DataTypes.STRING,
    scriptPath: DataTypes.STRING,
    sprayFileName: DataTypes.STRING,
    sprayDropZone: DataTypes.STRING,
    sprayedFileScope: DataTypes.STRING
  }, {paranoid: true, freezeTableName: true});
  job.associate = function(models) {
    job.hasMany(models.jobfile,{
      foreignKey:'job_id',
      onDelete: 'CASCADE',
      hooks: true
    });
    job.hasMany(models.jobparam,{
      foreignKey:'job_id',
      onDelete: 'CASCADE',
      hooks: true
    });
    job.belongsToMany(models.job, {
      through: 'dependent_jobs',
      as: 'dependsOnJobs',
      foreignKey: 'dependsOnJobId',
      otherKey: 'jobId'
    });
    job.belongsToMany(models.dataflow, {
      through: 'assets_dataflows',
      as: 'dataflows',
      foreignKey: 'assetId',
      otherKey: 'dataflowId'
    });
    job.belongsTo(models.application, {
      foreignKey: 'application_id'
    });
    job.belongsTo(models.groups, {
      through: 'assets_groups',
      as: 'groups',
      foreignKey: 'assetId',
      otherKey: 'groupId'
    });
  };
  return job;
};