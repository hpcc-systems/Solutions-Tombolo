import React, { Component } from "react";
import {
  Modal, Tabs, Form, Input, Select, Button, Table, AutoComplete,
  Tag, message, Drawer, Row, Col, Spin, Radio, Checkbox
} from 'antd/lib';
import AssociatedDataflows from "./AssociatedDataflows"
import { authHeader, handleError } from "../common/AuthHeader.js"
import { fetchDataDictionary } from "../common/CommonUtil.js"
import {omitDeep} from '../common/CommonUtil.js';
import EditableTable from "../common/EditableTable.js"
import { MarkdownEditor } from "../common/MarkdownEditor.js"
import { AgGridReact } from 'ag-grid-react';
import { hasEditPermission } from "../common/AuthUtil.js";
import {eclTypes} from '../common/CommonUtil';
import 'ag-grid-community/dist/styles/ag-grid.css';
import 'ag-grid-community/dist/styles/ag-theme-balham.css';
import { connect } from 'react-redux';
import BreadCrumbs from "../common/BreadCrumbs";
import { SearchOutlined  } from '@ant-design/icons';
import { assetsActions } from '../../redux/actions/Assets';

const TabPane = Tabs.TabPane;
const Option = Select.Option;
const { confirm } = Modal;
const layoutGrid=undefined;
const { TextArea } = Input;

class FileDetails extends Component {

  constructor(props) {
    super(props);
  }

  state = {
    visible: true,
    confirmLoading: false,
    pagination: {},
    loading: false,
    sourceFiles:[],
    selectedSourceFile:"",
    availableLicenses:[],
    rules:[],
    selectedRowKeys:[],
    clusters:[],
    consumers:[],
    selectedCluster: this.props.clusterId ? this.props.clusterId : "",
    fileSearchSuggestions:[],
    drawerVisible: false,
    fileDataColHeaders:[],
    fileDataContent: [],
    showFileProfile: false,
    fileProfile: [],
    profileHTMLAssets:[],
    dataTypes:[],
    complianceTags:[],
    complianceDetails:[],
    fileSearchErrorShown: false,
    filesCount: 0,
    autoCompleteSuffix: <SearchOutlined />,
    scopeDisabled: false,
    dataDefinitions: [],
    initialDataLoading: false,
    file: {
      id:"",
      title:"",
      name:"",
      clusterId:"",
      description:"",
      scope:"",
      serviceUrl:"",
      qualifiedPath:"",
      consumer:"",
      owner:"",
      supplier:"",
      fileType:"thor_file",
      isSuperFile:"",
      layout:[],
      licenses:[],
      relations:[],
      fileFieldRelations:[],
      validations:[],
      inheritedLicensing:[],
      groupId: ''
    }
  }

  componentDidMount() {
    if(this.props.application && this.props.application.applicationId) {
      //this.props.onRef(this);
      this.getFileCount();
      this.getFileDetails();
      this.getClusters();
      this.fetchDataTypeDetails();
      this.fetchDataDefinitions();
    }
  }

  clearState() {
    this.setState({
      ...this.state,
      sourceFiles: [],
      complianceTags:[],
      fileDataContent:[],
      fileDataColHeaders:[],
      scopeDisabled: false,
      file: {
        ...this.state.file,
        id: '',
        title: '',
        name:'',
        description: '',
        scope:'',
        serviceUrl: '',
        qualifiedPath: '',
        consumer:'',
        owner:'',
        supplier:'',
        fileType: 'thor_file',
        isSuperFile: '',
        layout: [],
        licenses: [],
        relations: [],
        fileFieldRelations: [],
        validations: []
      }
    });

  }

  fetchDataTypeDetails() {
    var self=this;
    fetch("/api/file/read/dataTypes", {
        headers: authHeader()
    })
    .then((response) => {
      if(response.ok) {
        return response.json();
      }
      handleError(response);
    })
    .then(data => {
      self.setState({
        dataTypes: data
      });
    }).catch(error => {
      console.log(error);
    });
  }

  async fetchDataDefinitions() {
    try {
      let dataDefn = await fetchDataDictionary(this.props.application.applicationId);
      this.setState({
        dataDefinitions: dataDefn
      });
    } catch (err) {
      console.log(err)
    }
  }

  getFileCount() {
    fetch("/api/file/read/file_list?app_id="+this.props.application.applicationId, {
       headers: authHeader()
    })
    .then((response) => {
        if(response.ok) {
          return response.json();
        }
        handleError(response);
    })
    .then(data => {
      this.setState({
        filesCount: data ? data.length : 0
      });
    }).catch(error => {
      console.log(error);
    });
  }

  getFileDetails() {
    if(this.props.selectedAsset && this.props.selectedAsset.id != '' && !this.props.isNew) {
      this.setState({
        initialDataLoading: true
      });
      fetch("/api/file/read/file_details?file_id="+this.props.selectedAsset.id+"&app_id="+this.props.application.applicationId, {
        headers: authHeader()
      }
      )
      .then((response) => {
        if(response.ok) {
          return response.json();
        }
        handleError(response);
      })
      .then(data => {
        this.setState({
          initialDataLoading: false,
        });
        if(data && data.basic) {
          this.setState({
            ...this.state,
            sourceFiles: data.sourceFiles,
            scopeDisabled: true,
            file: {
              ...this.state.file,
              id: data.basic.id,
              title: data.basic.title,
              name: data.basic.name,
              clusterId: data.basic.cluster_id,
              description: data.basic.description,
              groupId: data.basic.groupId,
              scope: data.basic.scope,
              serviceUrl: data.basic.serviceUrl,
              qualifiedPath: data.basic.qualifiedPath,
              owner: data.basic.owner,
              consumer: data.basic.consumer,
              supplier: data.basic.supplier,
              fileType: (data.basic.fileType == '' || data.basic.fileType == 'flat' ? 'thor_file' : data.basic.fileType),
              isSuperFile: data.basic.isSuperFile,
              layout: data.file_layouts,
              licenses: data.file_licenses,
              relations: data.file_relations,
              fileFieldRelations: data.file_field_relations,
              validations: data.file_validations
            }
          });
        } else {
          message.config({top:130})
          message.error("Could not retrieve data for this file. Please check if the file is valid")
        }
        return data;
      })
      .then(data => {
        this.getLicenses();
        return data;
      })
      .then(data => {
        if(data.basic) {
          this.getFileData(data.basic.name, data.basic.cluster_id);
        }
        return data;
      })
      .then(data => {
        this.getConsumers();
        return data;
      })
      .then(data => {
        if(data.basic && data.basic.id && this.props.selectedDataflow) {
          this.getInheritedLicenses(data.basic.id, this.props.selectedNodeId, this.props.selectedDataflow.id);
        }
        return data;
      })
      .then(data => {
        this.getRules();
      })
      .then(data => {
        this.getClusters();

      })
      .catch(error => {
        console.log(error);
      });
    }
  }

  showModal = () => {
    this.setState({
      visible: true,
    });
    this.clearState();
    this.getConsumers();
    this.getFileDetails();
    this.getClusters();
    if(this.props.isNew) {
      this.getScope();
    }
  }

  onDrawerClose = () => {
    this.setState({
      drawerVisible: false,
    });
  };

  onDrawerOpen = () => {
    this.setState({
      drawerVisible: true,
    });
  };

  handleOk = async (e) => {
    let _self = this;
    e.preventDefault();

    try {
      let saveResponse = await _self.saveFileDetails();
      setTimeout(() => {
        _self.setState({
          visible: false,
          confirmLoading: false,
        });
        //_self.props.onRefresh(saveResponse);
        _self.props.history.push('/' + this.props.application.applicationId + '/assets')
      }, 2000);
    } catch(e) {
      console.log(e)
      _self.setState({
        confirmLoading: false,
      });
    }
  };

  handleDelete = () => {
    let _self=this;
    confirm({
      title: 'Delete file?',
      content: 'Are you sure you want to delete this file?',
      onOk() {
        var data = JSON.stringify({fileId: _self.props.selectedAsset, application_id: _self.props.application.applicationId});
        fetch("/api/file/read/delete", {
          method: 'post',
          headers: authHeader(),
          body: data
        }).then((response) => {
          if(response.ok) {
            return response.json();
          }
          handleError(response);
        })
        .then(result => {
          //if called from Graph.js
          if(_self.props.onDelete) {
            _self.props.onDelete(_self.props.currentlyEditingNode)
          } else {
            _self.props.onRefresh();
          }
          message.success("File deleted sucessfully");
          _self.setState({
            visible: false,
            confirmLoading: false,
          });
        }).catch(error => {
          console.log(error);
          message.error("There was an error deleting the file");
        });
      },
      onCancel() {},
    });
  }

  getLicenses() {
    fetch("/api/file/read/licenses", {
      headers: authHeader()
    }).then((response) => {
        if(response.ok) {
          return response.json();
        }
        handleError(response);
      })
      .then(data => {
        this.setState({
          ...this.state,
          availableLicenses: data
        });

        this.setState({
          ...this.state,
          selectedRowKeys: this.state.file.licenses.map(license => license.id)
        });
      }).catch(error => {
        console.log(error);
      });
  }

  getRules() {
    fetch("/api/file/read/rules", {
      headers: authHeader()
    }).then((response) => {
        if(response.ok) {
          return response.json();
        }
        handleError(response);
      })
      .then(data => {
        let rules = data.map(item => item.name);
        rules.unshift("")
        this.setState({
          ...this.state,
          rules: rules
        });
      }).catch(error => {
        console.log(error);
      });
  }

  getInheritedLicenses(fileId, nodeId, dataflowId) {
    let licensesUrl = "/api/file/read/inheritedLicenses?fileId=" + fileId + "&app_id=" +
      this.props.applicationId + "&id=" + nodeId + '&dataflowId=' + dataflowId;
    fetch(licensesUrl, {
      headers: authHeader()
    }).then((response) => {
        if(response.ok) {
          return response.json();
        }
        handleError(response);
    })
    .then(data => {
      this.setState({
        ...this.state,
        file: {
          ...this.state.file,
          inheritedLicensing: data
        }
      });
    }).catch(error => {
      console.log(error);
    });
  }

  getClusters() {
    fetch("/api/hpcc/read/getClusters", {
      headers: authHeader()
    })
    .then((response) => {
      if(response.ok) {
        return response.json();
      }
      handleError(response);
    })
    .then(clusters => {
      this.setState({
        ...this.state,
        clusters: clusters
      });
    }).catch(error => {
      console.log(error);
    });
  }

  async getConsumers() {
    fetch("/api/consumer/consumers", {
      headers: authHeader()
    })
    .then((response) => {
      if(response.ok) {
        return response.json();
      }
      handleError(response);
    })
    .then(consumers => {
      this.setState({
        ...this.state,
        consumers: consumers
      });
    }).catch(error => {
      console.log(error);
    });
  }

  searchFiles(searchString) {
    if(searchString.length <= 3)
      return;
    this.setState({
      ...this.state,
      autoCompleteSuffix : <Spin/>,
      fileSearchErrorShown: false
    });

    var data = JSON.stringify({clusterid: this.state.selectedCluster, keyword: searchString});
    fetch("/api/hpcc/read/filesearch", {
      method: 'post',
      headers: authHeader(),
      body: data
    }).then((response) => {
      if(response.ok) {
        return response.json();
      } else {
        throw response;
      }
    })
    .then(suggestions => {
      this.setState({
        ...this.state,
        fileSearchSuggestions: suggestions,
        autoCompleteSuffix: <SearchOutlined />
      });
    }).catch(error => {
      if(!this.state.fileSearchErrorShown) {
        error.json().then((body) => {
          message.config({top:130})
          message.error(body.message);
        });
        this.setState({
          ...this.state,
          fileSearchErrorShown: true,
          autoCompleteSuffix: <SearchOutlined />
        });
      }

    });
  }

  async onFileSelected(selectedSuggestion) {
    /*let fileExists = await this.fileAlreadyExists(selectedSuggestion);
    if(fileExists) {
      message.config({top:150})
      message.error("File "+selectedSuggestion+" already exists in this application. Please select another file.");
      return;
    }*/
    fetch("/api/hpcc/read/getFileInfo?fileName="+selectedSuggestion+"&clusterid="+this.state.selectedCluster, {
      headers: authHeader()
    })
    .then((response) => {
      if(response.ok) {
        return response.json();
      }
      handleError(response);

    })
    .then(fileInfo => {
      this.setState({
        ...this.state,
        sourceFiles: [],
        scopeDisabled: true,
        file: {
          ...this.state.file,
          //id: fileInfo.name,
          title: fileInfo.name.substring(fileInfo.name.lastIndexOf("::") + 2),
          name: fileInfo.name,
          clusterId: this.state.selectedCluster,
          description: fileInfo.description,
          scope: fileInfo.scope,
          qualifiedPath: fileInfo.pathMask,
          owner: fileInfo.owner,
          consumer: fileInfo.consumer,
          supplier: fileInfo.supplier,
          //fileType: fileInfo.fileType,
          isSuperFile: fileInfo.isSuperfile ? 'true' : 'false',
          layout: fileInfo.layout,
          fileFieldRelations: this.getFieldNames(fileInfo.layout),
          validations: fileInfo.validations
        }
      })
      return fileInfo;
    })
    .then(data => {
      return this.getLicenses();
    })
    .then(licenses => {
      return this.getFiles();
    })
    .then(files => {
      return this.getFileData(selectedSuggestion,this.state.selectedCluster);
    })
    .then(files => {
      //this.getFileProfile(selectedSuggestion);
      this.getRules();
    })
    .catch(error => {
      console.log(error);
      message.config({top:150})
      message.error("There was an error getting file information from the cluster. Please try again")
    });
  }

  getFiles() {
    fetch("/api/file/read/file_ids?app_id="+this.props.application.applicationId, {
      headers: authHeader()
    })
    .then((response) => {
      if(response.ok) {
        return response.json();
      }
      handleError(response);
    })
    .then(files => {
      this.setState({
        ...this.state,
        sourceFiles: files
      });
    }).catch(error => {
      console.log(error);
    });
  }

  async fileAlreadyExists(selectedSuggestion) {
    var exists = false;
    await fetch("/api/file/read/file_ids?app_id="+this.props.application.applicationId, {
      headers: authHeader()
    })
    .then((response) => {
      if(response.ok) {
        return response.json();
      }
      handleError(response);
    })
    .then(files => {
      exists=files.filter(file => file.name == selectedSuggestion).length > 0;
    })
    .catch(error => {
      console.log(error);
    });
    return exists;
  }

  getFieldNames(layout) {
    var fields = [];
    layout.forEach(function (item, idx) {
      fields.push({"field":item.name, "source_field":"", "requirements": ""});
    });
    return fields;
  }

  saveFileDetails() {
    return new Promise((resolve, reject) => {
      fetch('/api/file/read/savefile', {
        method: 'post',
        headers: authHeader(),
        body: JSON.stringify({
          isNew : this.props.isNew,
          id: this.state.file.id,
          file : this.populateFileDetails()
        })
      }).then(function(response) {
        if(response.ok) {
          return response.json();
        }
        handleError(response);
        reject();
      }).then(function(data) {
        resolve(data);
      });
    })
  }

  getFileData = (fileName, clusterId) => {
    var _self = this;
    var cluster = this.state.selectedCluster ? this.state.selectedCluster : clusterId;
    if(cluster) {
      fetch('/api/hpcc/read/getData?fileName='+fileName+'&clusterid='+cluster, {
        headers: authHeader()
      }).then(function(response) {
          if(response.ok) {
            return response.json();
          }
          handleError(response);
      }).then(function(rows) {
        if(rows.length > 0) {
          _self.setState({
            fileDataColHeaders: Object.keys(rows[0]),
            fileDataContent: rows
          });
        }
      }).catch(error => {
        console.log(error);
      })
    }
  };

  getFileProfile = (fileName) => {
    var _self = this;
    //fetch('/api/hpcc/read/getFileProfile?fileName='+fileName+'&clusterid='+this.state.selectedCluster, {
      fetch('/api/hpcc/read/getFileProfileHTML?fileName='+fileName+'&clusterid='+this.state.selectedCluster, {
      headers: authHeader()
    }).then(function(response) {
        if(response.ok) {
          return response.json();
        }
        handleError(response);
    }).then(function(rows) {
      if(rows.length > 0) {
        _self.setState({
          showFileProfile: true,
          fileProfile: rows,
          profileHTMLAssets: rows
        });
      }
    })
  };

  setLayoutData = (data) => {
    this.setState({
      ...this.state,
      file: {
        ...this.state.file,
        layout: data,
      }
    })
  };

  setValidationData = (data) => {
    this.setState({
      ...this.state,
      file: {
        ...this.state.file,
        validations: data,
      }
    })
  };

  populateFileDetails() {
    var applicationId = this.props.application.applicationId;
    var fileDetails = {"app_id":applicationId};
    var fileLayout={}, license = {};
    var file_basic = {
      //"id" : this.state.file.id,
      "title" : this.state.file.title,
      "name" : (!this.state.file.name || this.state.file.name == '') ? this.state.file.title : this.state.file.name,
      "cluster_id": this.state.file.clusterId,
      "description" : this.state.file.description,
      "scope": this.state.file.scope,
      "serviceUrl" : this.state.file.serviceUrl,
      "qualifiedPath" : this.state.file.qualifiedPath,
      "owner": this.state.file.owner,
      "consumer": this.state.file.consumer,
      "supplier": this.state.file.supplier,
      "fileType" : this.state.file.fileType,
      "isSuperFile" : this.state.file.isSuperFile,
      "application_id" : applicationId,
      "dataflowId" : this.props.selectedDataflow ? this.props.selectedDataflow.id : '',
    };
    let groupId = this.props.groupId ? this.props.groupId : this.state.file.groupId;
    if(groupId) {
      file_basic.groupId = groupId;
    }
    fileDetails.basic = file_basic;
    fileDetails.fields = this.state.file.layout;
    var selectedLicenses={};
    if(this.licenseGridApi && this.licenseGridApi.getSelectedNodes() != undefined) {
      selectedLicenses = this.licenseGridApi.getSelectedNodes().map(function(node) {
        return {"name" : node.data.name, "url": node.data.url}
      });
    }
    fileDetails.license = selectedLicenses;

    var fieldRelation = this.state.file.fileFieldRelations;
    var sourceFiles = fieldRelation.map(function(key,value){
      if(key["source_field"] != null && key["source_field"] != undefined) {
        return key["source_field"].split(".").shift();
      }
    });
    sourceFiles = this.state.file.relations;
    sourceFiles = sourceFiles.map(function(value){
        return JSON.parse("{\"id\":\""+value.id+"\"}");
    })
    //file relationship
    fileDetails.relation = sourceFiles;

    //field relationship
    fileDetails.fileFieldRelation = this.state.file.fileFieldRelations;

    //validations
    fileDetails.validation = this.state.file.validations;

    console.log(fileDetails);

    return fileDetails;
  }

  handleCancel = () => {
    this.setState({
      visible: false,
    });
    //this.props.onClose();
    this.props.history.push('/' + this.props.application.applicationId + '/assets')
  }

  onClusterSelection = (value) => {
    this.props.dispatch(assetsActions.clusterSelected(value));
    this.setState({
      selectedCluster: value,
    });
  };

  onConsumerSelection = (value) => {
    this.setState({...this.state, file: {...this.state.file, consumer: value }}, () => console.log(this.state.file.consumer));
  };

  onOwnerSelection = (value) => {
    this.setState({...this.state, file: {...this.state.file, owner: value }}, () => console.log(this.state.file.owner));
  };

  onSupplierSelection = (value) => {
    this.setState({...this.state, file: {...this.state.file, supplier: value }}, () => console.log(this.state.file.supplier));
  };

  onChange = (e) => {
    this.setState({...this.state, file: {...this.state.file, [e.target.name]: e.target.value }});
  };

  onCheckbox = (e) => {
    this.setState({...this.state, file: {...this.state.file, [e.target.name]: e.target.checked }});
  };

  onFieldRelationsChange = (newValue) => {
    this.setState({...this.state, file: {...this.state.file, fileFieldRelations: JSON.parse(newValue) }});
  };

  handleFieldRelationsChange = (data) => {
    this.setState({
      ...this.state,
      file: {
        ...this.state.file,
        fileFieldRelations: data
      }
    });
  };

  onLayoutChange = (newValue) => {
    this.setState({...this.state, file: {...this.state.file, layout: JSON.parse(newValue) }});
  };

  onSourceFileSelection = (value) => {
    this.setState({
      selectedSourceFile: value,
    });
  };

  onAddSourceFile = (event) => {
    var relationsUpdated = this.state.file.relations;
    relationsUpdated.push({"id":this.state.selectedSourceFile});
    this.setState({
        ...this.state,
        file: {
          ...this.state.file,
          relations: relationsUpdated
        }
      });
    this.setState({
      selectedSourceFile: '',
    });

    setTimeout(() => {
    }, 200);
  };

  deleteSourceFile(index) {
    var relationsUpdated = this.state.file.relations.filter((x,i) => x.id != index)
    this.setState({
      ...this.state,
      file: {
        ...this.state.file,
        relations: relationsUpdated
      }
    }, function() {

    });
  };

  onValidationEdit = (cellInfo, value) => {
    const fileValidations = [this.state.file.validations];
    if(typeof value == 'string')
      fileValidations[0][cellInfo.index][cellInfo.column.id] = value;
    else if(typeof value == 'object')
       fileValidations[0][cellInfo.index][cellInfo.column.id] = value.target.value;
  };

  onLayoutGridReady = (params) => {
    var _self=this, selectedDataTypes=[], compliance=[];
    _self.layoutGrid = params.api;
    _self.layoutGrid.sizeColumnsToFit();

    //populate the compliance info
    _self.layoutGrid.forEachNode(function(node, index) {
      if(node.data.data_types && node.data.data_types != null) {
        selectedDataTypes.push(node.data.data_types);
      }
    });
    fetch('/api/controlsAndRegulations/getComplianceByDataType?dataType='+selectedDataTypes.join(","), {
      headers: authHeader()
    }).then(function(response) {
        if(response.ok) {
          return response.json();
        }
        handleError(response);
    }).then(function(data) {
      if(data && data.length > 0) {
        data.forEach((element) => {
          compliance.push(element);
        })
        _self.setState({
          complianceTags:compliance,
        });

      }
    }).catch(error => {
      console.log(error);
    });
  };

  onGridReady = (params) => {
    let gridApi = params.api;
    gridApi.sizeColumnsToFit();
  };

  onLicenseGridReady = (params) => {
    this.licenseGridApi = params.api;
    this.licenseGridApi.sizeColumnsToFit();
    var _self=this;
    this.licenseGridApi.forEachNode(function(node, index) {
      if(_self.state.file.licenses.filter(license => license.name == node.data.name).length > 0) {
        _self.licenseGridApi.selectNode(node, true);
      }
    });
  };

  dataTypechange = (prop) => {
    var _self = this;
    if (prop.column.colId == "data_types" && (prop.oldValue)) {
      var compliance=[];
      var complianceDetails=[];
      compliance=_self.state.complianceTags;
      complianceDetails=_self.state.complianceDetails;
      var compToRemove = complianceDetails.filter((item) => item.id === prop.node.rowIndex);
      complianceDetails = complianceDetails.filter((item) => item.id !== prop.node.rowIndex);
      compToRemove.forEach((element)=>{
          var obj = complianceDetails.filter((item) => item.compliance === element.compliance);
          if(obj.length==0)
            compliance = compliance.filter((item) => item !== element.compliance);
      });
      _self.setState({
        complianceTags:compliance,
        complianceDetails:complianceDetails
      });
    }

    if(prop.column.colId=="data_types" && (prop.newValue)){
      var compliance=[];
      var complianceDetails=[];
      compliance=this.state.complianceTags;
      complianceDetails=this.state.complianceDetails;
      fetch('/api/controlsAndRegulations/getComplianceByDataType?dataType='+prop.newValue, {
        headers: authHeader()
      }).then(function(response) {
          if(response.ok) {
            return response.json();
          }
          handleError(response);
      }).then(function(data) {
        if(data && data.length > 0) {
          data.forEach((element) => {
            if(!compliance.includes(element)) {
              compliance.push(element);
            }
            var obj={};
            obj.id=prop.node.rowIndex;
            obj.dataType=prop.newValue;
            obj.compliance=element;
            complianceDetails.push(obj);
          })
          _self.setState({
            complianceTags:compliance,
            complianceDetails:complianceDetails
          });
        }
      }).catch(error => {
        console.log(error);
      });
    }
  };

  getScope = () => {
    let scope = (
      this.props.user.organization + "::" + this.props.applicationTitle +
      (this.state.file.title != '' ? '::' + this.state.file.title : '')
    ).toLowerCase();

    this.setState({
      ...this.state,
      file: {
        ...this.state.file,
        scope: scope
      }
    });
  };

  scopeValidator = (rule, value, callback) => {
    try {
      if(this.state.file.scope == (this.props.user.organization + "::" + this.props.applicationTitle).toLowerCase()) {
        let errMsg = "Please enter a valid scope. The convention is <Organization Name>::<Application Name>::<File Type>";
        throw new Error(errMsg);
      }
      callback();
    } catch (err) {
      callback(err);
    }
  };

  addLayoutRow = (e) => {
    this.state.file.layout = [{'name':""}];
    //this.layoutGrid.applyTransaction({add: [{'name':""}]})
    this.layoutGrid.refreshCells();
  };

  fileTypeChange = (e) => {
    this.setState({
      ...this.state,
      file: {
        ...this.state.file,
        fileType: e.target.value
      }
    });
  };

  render() {
    const {
      visible, confirmLoading, sourceFiles, availableLicenses,
      selectedRowKeys, clusters, consumers, fileSearchSuggestions,
      fileDataContent, fileProfile, showFileProfile, scopeDisabled
    } = this.state;
    const modalTitle = "File Details" + (this.state.file.title ? " - " + this.state.file.title : " - " +this.state.file.name);
    const VIEW_DATA_PERMISSION='View PII';
    const editingAllowed = hasEditPermission(this.props.user) || !this.props.viewMode;
    const formItemLayout = {
      labelCol: { span: 2 },
      wrapperCol: { span: 8 }
    };

    const twoColformItemLayout = {
      labelCol: { span: 6 },
      wrapperCol: { span: 12 }
    };

    const threeColformItemLayout = {
      labelCol: { span: 6 },
      wrapperCol: { span: 12 }
    };

    const layoutColumns = [{
      title: 'Field',
      dataIndex: 'name',
      sort: "asc",
      editable: editingAllowed,
      width: '25%'
    }, {
      title: 'Type',
      dataIndex: 'type',
      editable: editingAllowed,
      celleditor: "select",
      celleditorparams: {
        values: eclTypes.sort()
      },
      showdatadefinitioninfield: true,
      width: '18%'
    }, {
      title: 'ECL Type',
      dataIndex: 'eclType',
      editable: editingAllowed,
      showdatadefinitioninfield: true
    }, {
      title: 'Description',
      dataIndex: 'description',
      editable: editingAllowed,
      width: '15%'
    }, {
      title: 'Required',
      editable: editingAllowed,
      dataIndex: 'required',
      celleditor: "select",
      celleditorparams: {
        values: ["false", "true"]
      },
      width: '10%'
    }, {
      title: 'Information Type',
      dataIndex: 'data_types',
      editable: editingAllowed,
      celleditor: "select",
      width: '15%',
      celleditorparams: {
        values: this.state.dataTypes.sort()
      }
    }];

    const validationRuleColumns = [{
      title: 'Field',
      dataIndex: 'rule_field',
      celleditor: 'select',
      editable: editingAllowed,
      width: '15%',
      celleditorparams: {
        values: this.state.fileDataColHeaders
      }
    }, {
      title: 'Rule Name',
      dataIndex: 'rule_name',
      editable: editingAllowed,
      width: '15%'
    }, {
      title: 'Rule',
      dataIndex: 'rule_test',
      editable: editingAllowed,
      width: '15%'
    }, {
      title: 'Fix',
      dataIndex: 'rule_fix',
      editable: editingAllowed,
      width: '15%'
    }];

    const { complianceTags } = this.state;
    const licenseColumns = [{
      field: 'name',
      cellRenderer: function(params) {
         return '<a href='+params.data.url+' target="_blank">'+ params.value+'</a>'
      },
      headerCheckboxSelection: true,
      headerCheckboxSelectionFilteredOnly: true,
      checkboxSelection: true
    }, {
      field: 'description',
      cellRenderer: function(params) {
         return params.value != null ? params.value : ''
      }
    }];

    const fileDataColumns = () => {
      const columns = [];
      var _self=this;
      this.state.fileDataColHeaders.forEach(function(column) {
        let colObj;
        //iterate through each Row[]
        if(_self.state.fileDataContent[0][column]["Row"] != undefined) {
          colObj = {"headerName":column};
          let children=[];
          Object.keys(_self.state.fileDataContent[0][column]["Row"][0]).forEach(function(key) {
            children.push({"headerName":key, "valueGetter": "data." + column + ".Row[0]."+ key})
          })
          colObj.children = children;
        } else if(_self.state.fileDataContent[0][column] instanceof Object) {
          colObj = {"headerName":column};
          let children=[];
          Object.keys(_self.state.fileDataContent[0][column]).forEach(function(key) {
            children.push({"headerName":key, "field": column + "."+ key})
          })
          colObj.children = children;
        } else {
          colObj = {"headerName":column, "field": column};
        }
        columns.push(colObj);
      });
      return columns;
    };

    const InheritedLicenses = (licenses) => {
      if(licenses.relation && licenses.relation.length > 0) {
        const licenseItems = licenses.relation.map((license) =>
          <Tag color="red" key={license}>{license}</Tag>
        );
        return (
          <div style={{paddingBottom:"5px"}}><b>Inherited Licenses:</b> {licenseItems}</div>
        );
      } else {
        return null;
      }
    };

    const ComplianceInfo = (complianceTags) => {
      if(complianceTags.tags && complianceTags.tags.length > 0) {
        const tagElem = complianceTags.tags.map((tag, index) =>
            <Tag color="red" key={tag}>{tag}</Tag>
        );
        return (
          <div style={{paddingBottom:"5px"}}><b>Compliance:</b> {tagElem}</div>
        );
      } else {
        return null;
      }
    };

    const {
      title, name, description, scope, serviceUrl, qualifiedPath, consumer, owner, fileType,
      isSuperFile, layout, relations, fileFieldRelations, validations, inheritedLicensing
    } = this.state.file;
    const selectedCluster = clusters.filter(cluster => cluster.id == this.props.clusterId);

    const rowSelection = {
      selectedRowKeys,
      onChange: this.onSelectedRowKeysChange
    };
    //const modalHeight = !this.props.isNew ? "425px" : "550px";
    const modalHeight = "570px";

    const getNodeChildDetails = (rowItem) => {
      if (rowItem.children) {
        return {
          group: true,
          // open C be default
          expanded: false,
          // provide ag-Grid with the children of this group
          children: rowItem.children,
          // the key is used by the default group cellRenderer
          key: rowItem.type
        };
      } else {
        return null;
      }
    }
    //render only after fetching the data from the server
    if(!title && !this.props.selectedAsset && !this.props.isNew) {
      console.log("not rendering");
      return null;
    }

    return (
      <React.Fragment>
        <div style={{"paddingTop": "55px"}}>
          {/*<BreadCrumbs applicationId={this.props.application.applicationId} applicationTitle={this.props.application.applicationTitle}/>*/}
          {!this.props.isNew?
            <div className="loader">
              <Spin spinning={this.state.initialDataLoading} size="large" />
            </div> : null}
          <Tabs
            defaultActiveKey="1"
          >
            <TabPane tab="Basic" key="1">
               <Form {...formItemLayout} labelAlign="left">
                <div>
                <Form.Item label="Type">
                  <Radio.Group onChange={this.fileTypeChange} value={this.state.file.fileType}>
                    <Radio value={'thor_file'}>Thor File</Radio>
                    <Radio value={'csv'}>CSV</Radio>
                    <Radio value={'json'}>JSON</Radio>
                    <Radio value={'xml'}>XML</Radio>
                  </Radio.Group>
                </Form.Item>
                {this.state.file.fileType == 'thor_file' ?
                  <React.Fragment>
                    <Form.Item label="Cluster">
                      <Select placeholder="Select a Cluster" value={(selectedCluster.length > 0 ? selectedCluster[0].id : null)} disabled={!editingAllowed} onChange={this.onClusterSelection} style={{ width: 190 }}>
                        {clusters.map(cluster => <Option key={cluster.id}>{cluster.name}</Option>)}
                      </Select>
                    </Form.Item>

                    <Form.Item label="File">
                      <AutoComplete
                        className="certain-category-search"
                        dropdownClassName="certain-category-search-dropdown"
                        dropdownMatchSelectWidth={false}
                        dropdownStyle={{ width: 300 }}
                        style={{ width: '100%' }}
                        onSearch={(value) => this.searchFiles(value)}
                        onSelect={(value) => this.onFileSelected(value)}
                        placeholder="Search files"
                        disabled={!editingAllowed}
                      >
                        {fileSearchSuggestions.map((suggestion) => (
                          <Option key={suggestion.text} value={suggestion.value}>
                            {suggestion.text}
                          </Option>
                        ))}
                      </AutoComplete>
                    </Form.Item>
                  </React.Fragment>
                  :
                  null}

                </div>
                <Form.Item label="Title" rules={[{ required: true, message: 'Please enter a title!' }]}>
                  <Input id="file_title" name="title" onChange={this.onChange} placeholder="Title" value={title} disabled={!editingAllowed}/>
                </Form.Item>
                <Form.Item label="Name">
                  <Input id="file_name" name="name" onChange={this.onChange} placeholder="Name" defaultValue={name} value={name} disabled={true} />
                </Form.Item>
                <Form.Item label="Scope" rules={[
                  {
                    required: true
                  }, {
                    validator: this.scopeValidator
                  }
                ]}>
                  <Input id="file_scope" name="scope" onChange={this.onChange} placeholder="Scope" value={scope} disabled={scopeDisabled || !editingAllowed}/>
                </Form.Item>
                <Form.Item label="Description">
                  <MarkdownEditor id="file_desc" name="description" onChange={this.onChange} targetDomId="fileDescr" value={description} disabled={!editingAllowed}/>
                </Form.Item>
                <Form.Item label="Service URL">
                    <Input id="file_primary_svc" name="serviceUrl" onChange={this.onChange} defaultValue={serviceUrl} value={serviceUrl} placeholder="Service URL" disabled={!editingAllowed}/>
                </Form.Item>
                <Row type="flex">
                  <Col span={8} order={1}>
                    <Form.Item label="Path" {...threeColformItemLayout}>
                        <Input id="file_path" name="qualifiedPath" onChange={this.onChange} defaultValue={qualifiedPath} value={qualifiedPath} placeholder="Path" disabled={!editingAllowed}/>
                    </Form.Item>
                  </Col>
                  <Col span={8} order={1}>
                    <Form.Item {...threeColformItemLayout} label="Is Super File">
                      <Checkbox id="file_issuper_file" name="isSuperFile" onChange={this.onCheckbox} checked={isSuperFile===true} disabled={!editingAllowed}/>
                    </Form.Item>
                  </Col>
                </Row>

                <Row type="flex">
                  <Col span={8} order={1}>
                    <Form.Item {...threeColformItemLayout} label="Supplier">
                       <Select id="supplier" value={(this.state.file.supplier != '') ? this.state.file.supplier : "Select a supplier"} placeholder="Select a supplier" onChange={this.onSupplierSelection} style={{ width: 190 }} disabled={!editingAllowed}>
                        {consumers.map(consumer => consumer.assetType=="Supplier" ? <Option key={consumer.id}>{consumer.name}</Option> : null)}
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col span={8} order={2}>
                    <Form.Item {...threeColformItemLayout} label="Consumer">
                       <Select id="consumer" value={(this.state.file.consumer != '') ? this.state.file.consumer : "Select a consumer"} placeholder="Select a consumer" onChange={this.onConsumerSelection} style={{ width: 190 }} disabled={!editingAllowed}>
                        {consumers.map(consumer => consumer.assetType == 'Consumer' ? <Option key={consumer.id}>{consumer.name}</Option> : null)}
                      </Select>
                    </Form.Item>
                  </Col>

                  <Col span={8} order={3}>
                    <Form.Item {...threeColformItemLayout} label="Owner">
                       <Select id="owner" value={(this.state.file.owner != '') ? this.state.file.owner : "Select an Owner"} placeholder="Select an Owner" onChange={this.onOwnerSelection} style={{ width: 190 }} disabled={!editingAllowed}>
                        {consumers.map(consumer => consumer.assetType == 'Owner' ? <Option key={consumer.id}>{consumer.name}</Option> : null)}
                      </Select>
                    </Form.Item>
                  </Col>

                </Row>
              </Form>

            </TabPane>
            <TabPane tab="Layout" key="3">
                <ComplianceInfo tags={complianceTags}/>
                <div
                  className="layout_tbl"
                  style={{
                  width: '100%' }}
                >
                  <EditableTable
                    columns={layoutColumns}
                    dataSource={layout}
                    ref={node => (this.layoutTable = node)}
                    fileType={this.state.file.fileType}
                    editingAllowed={editingAllowed}
                    dataDefinitions={this.state.dataDefinitions}
                    showDataDefinition={true}
                    setData={this.setLayoutData}/>
                </div>
            </TabPane>
            <TabPane tab="Permissable Purpose" key="4">
              <InheritedLicenses relation={inheritedLicensing}/>
              <div
                  className="ag-theme-balham"
                  style={{
                  height: '400px',
                  width: '100%' }}
                >
                  <AgGridReact
                    columnDefs={licenseColumns}
                    rowData={availableLicenses}
                    defaultColDef={{resizable: true, sortable: true}}
                    onGridReady={this.onLicenseGridReady}
                    rowSelection="multiple"
                    suppressRowClickSelection={editingAllowed}>
                  </AgGridReact>
                </div>
            </TabPane>
            <TabPane tab="Validation Rules" key="5">
              <div
                  className="ag-theme-balham"
                  style={{
                  height: '415px',
                  width: '100%' }}
                >
                  <EditableTable
                    columns={validationRuleColumns}
                    dataSource={validations}
                    ref={node => (this.validationTable = node)}
                    editingAllowed={editingAllowed}
                    dataDefinitions={this.state.dataDefinitions}
                    showDataDefinition={true}
                    setData={this.setValidationData}/>
                </div>
            </TabPane>
            {this.props.user && this.props.user.permissions && this.props.user.permissions.includes(VIEW_DATA_PERMISSION) ?
              <TabPane tab="File Preview" key="6">
                <div
                    className="ag-theme-balham"
                    style={{
                    height: '415px',
                    width: '100%' }}>
                    {<AgGridReact
                      columnDefs={fileDataColumns()}
                      rowData={fileDataContent}
                      onGridReady={this.onGridReady}
                      defaultColDef={{resizable: true}}
                      >
                    </AgGridReact>}
                    {}
                  </div>
              </TabPane>
            : null}

            {!this.props.isNew ?
              <TabPane tab="Dataflows" key="7">
                <AssociatedDataflows assetName={name} assetType={'File'}/>
              </TabPane> : null}
          </Tabs>
        </div>
        {!this.props.viewMode ?
          <div className="button-container">
            <Button key="danger" type="danger" onClick={this.handleDelete}>Delete</Button>
            <Button key="back" onClick={this.handleCancel}>
              Cancel
            </Button>
            <Button key="submit" disabled={!editingAllowed} type="primary" loading={confirmLoading} onClick={this.handleOk}>
              Save
            </Button>
          </div>
        : null}
      </React.Fragment>
    );
  }
}

export class BooleanCellRenderer extends Component {
    constructor(props) {
        super(props)
    }

    render() {
        return (
            <span>
                {this.props.value}
            </span>
        );
    }
}

function mapStateToProps(state) {
    const { selectedAsset, newAsset={}, clusterId } = state.assetReducer;
    const { user } = state.authenticationReducer;
    const { application } = state.applicationReducer;

    const {isNew=false, groupId='' } = newAsset;
    return {
      user,
      selectedAsset,
      application,
      isNew,
      groupId,
      clusterId
    };
}

const FileDetailsForm = connect(mapStateToProps)(FileDetails);
export default FileDetailsForm;