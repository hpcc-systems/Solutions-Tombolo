import React, { Component } from "react";
import { Modal, Tabs, Form, Input, Icon,  Select, Button, Table, AutoComplete, Tag, message, Drawer } from 'antd/lib';
import TreantJSTree from "./TreantJSTree";
import ReactTable from "react-table";
import "react-table/react-table.css";
import FileRelations from "./FileRelations"
import DataProfileTable from "./DataProfileTable"
import DataProfileHTML from "./DataProfileHTML"
import { authHeader, handleError } from "../common/AuthHeader.js"

const TabPane = Tabs.TabPane;
const Option = Select.Option;

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
    selectedRowKeys:[],
    clusters:[],
    selectedCluster:"",
    fileSearchSuggestions:[],
    drawerVisible: false,
    fileDataColHeaders:[],
    fileDataContent: [],
    showFileProfile: false,
    fileProfile: [],
    profileHTMLAssets:[],
    file: {
      id:"",
      title:"",
      name:"",
      clusterId:"",
      description:"",
      primaryService:"",
      backupService:"",
      qualifiedPath:"",
      fileType:"",
      isSuperFile:"",
      layout:[],
      licenses:[],
      relations:[],
      fileFieldRelations:[],
      validations:[]
    }
  }

  componentDidMount() {
    this.props.onRef(this);
    this.getFileDetails();
  }

  clearState() {
    this.setState({
      ...this.state,
      sourceFiles: [],
      file: {
        ...this.state.file,
        id: '',
        title: '',
        name:'',
        description: '',
        primaryService: '',
        backupService: '',
        qualifiedPath: '',
        fileType: '',
        isSuperFile: '',
        layout: [],
        licenses: [],
        relations: [],
        fileFieldRelations: [],
        validations: []
      }
    });

  }

  getFileDetails() {
    if(this.props.selectedFile && !this.props.isNewFile) {
      fetch("/api/file/read/file_details?file_id="+this.props.selectedFile+"&app_id="+this.props.applicationId, {
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
          ...this.state,
          sourceFiles: data.sourceFiles,
          file: {
            ...this.state.file,
            id: data.basic.id,
            title: data.basic.title,
            name: data.basic.name,
            clusterId: data.basic.cluster_id,
            description: data.basic.description,
            primaryService: data.basic.primaryService,
            backupService: data.basic.backupService,
            qualifiedPath: data.basic.qualifiedPath,
            fileType: data.basic.fileType,
            isSuperFile: data.basic.isSuperFile,
            layout: data.file_layouts,
            licenses: data.file_licenses,
            relations: data.file_relations,
            fileFieldRelations: data.file_field_relations,
            validations: data.file_validations
          }
        });
        return data;
      })
      .then(data => {
        this.getLicenses();
        return data;
      })
      .then(data => {
        this.getFileData(data.basic.name, data.basic.cluster_id);
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
    this.getFileDetails();
    if(this.props.isNewFile) {
      this.getClusters();
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

  handleOk = () => {
    this.setState({
      confirmLoading: true,
    });

    this.saveFileDetails();

    setTimeout(() => {
      this.setState({
        visible: false,
        confirmLoading: false,
      });
      this.props.onRefresh();
    }, 2000);
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

  searchFiles(searchString) {
    if(searchString.length <= 3)
      return;
    var data = JSON.stringify({clusterid: this.state.selectedCluster, keyword: searchString});
    fetch("/api/hpcc/read/filesearch", {
      method: 'post',
      headers: authHeader(),
      body: data
    }).then((response) => {
      if(response.ok) {
        return response.json();
      }
      handleError(response);
    })
    .then(suggestions => {
      this.setState({
        ...this.state,
        fileSearchSuggestions: suggestions
      });
    }).catch(error => {
      console.log(error.text);
      message.error("There was error while searching files from the cluster");
    });
  }

  async onFileSelected(selectedSuggestion) {
    let fileExists = await this.fileAlreadyExists(selectedSuggestion);
    if(fileExists) {
      message.config({top:150})
      message.error("File "+selectedSuggestion+" already exists in this application. Please select another file.");
      return;
    }
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
        file: {
          ...this.state.file,
          id: fileInfo.name,
          title: fileInfo.title,
          name: fileInfo.name,
          clusterId: this.state.selectedCluster,
          description: fileInfo.description,
          qualifiedPath: fileInfo.pathMask,
          fileType: fileInfo.fileType,
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
      this.getFileData(selectedSuggestion,this.state.selectedCluster);
    })
    .then(files => {
      //this.getFileProfile(selectedSuggestion);
    })
    .catch(error => {
      console.log(JSON.stringify(error));
      message.error("There was an error getting file information from the cluster. Please try again")
    });
  }

  getFiles() {
    fetch("/api/file/read/file_ids?app_id="+this.props.applicationId, {
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
    await fetch("/api/file/read/file_ids?app_id="+this.props.applicationId, {
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
    fetch('/api/file/read/savefile', {
      method: 'post',
      headers: authHeader(),
      body: JSON.stringify({isNewFile : this.props.isNewFile, file : this.populateFileDetails()})
    }).then(function(response) {
        if(response.ok) {
          return response.json();
        }
        handleError(response);
    }).then(function(data) {
      console.log('Saved..');
    });
  }

  getFileData = (fileName, clusterId) => {
    var _self = this;
    var cluster = this.state.selectedCluster ? this.state.selectedCluster : clusterId;
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
    }).then(function(data) {
    });
  }

  populateFileDetails() {
    var applicationId = this.props.applicationId;
    var fileDetails = {"app_id":applicationId};
    var fileLayout={}, license = {};
    var file_basic = {
      //"id" : this.state.file.id,
      "title" : this.state.file.title,
      "name" : this.state.file.name,
      "cluster_id": this.state.file.clusterId,
      "description" : this.state.file.description,
      "primaryService" : this.state.file.primaryService,
      "backupService" : this.state.file.backupService,
      "qualifiedPath" : this.state.file.qualifiedPath,
      "fileType" : this.state.file.fileType,
      "isSuperFile" : this.state.file.isSuperFile,
      "application_id" : applicationId
    };
    fileDetails.basic = file_basic;

    fileDetails.layout = this.state.file.layout;

    fileDetails.license = this.state.file.licenses;

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
    this.props.onClose();
  }

  onClusterSelection = (value) => {
    this.setState({
      selectedCluster: value,
    });
  }

  onChange = (e) => {
    this.setState({...this.state, file: {...this.state.file, [e.target.name]: e.target.value }});
  }

  onFieldRelationsChange = (newValue) => {
    this.setState({...this.state, file: {...this.state.file, fileFieldRelations: JSON.parse(newValue) }});
  }

  handleFieldRelationsChange = (data) => {
    this.setState({
      ...this.state,
      file: {
        ...this.state.file,
        fileFieldRelations: data
      }
    });
  }

  onLayoutChange = (newValue) => {
    this.setState({...this.state, file: {...this.state.file, layout: JSON.parse(newValue) }});
  }

  onSourceFileSelection = (value) => {
    this.setState({
      selectedSourceFile: value,
    });
  }

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
  }


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
  }

  onValidationEdit = (cellInfo, value) => {
    const fileValidations = [this.state.file.validations];
    if(typeof value == 'string')
      fileValidations[0][cellInfo.index][cellInfo.column.id] = value;
    else if(typeof value == 'object')
       fileValidations[0][cellInfo.index][cellInfo.column.id] = value.target.value;
  }

  onSelectedRowKeysChange = (selectedRowKeys) => {
    var newLicensesSelected = this.state.file.licenses;
    newLicensesSelected = this.state.availableLicenses.filter(el => selectedRowKeys.includes(el.id));
    this.setState({
      ...this.state,
      selectedRowKeys: selectedRowKeys,
      file: {
        ...this.state.file,
        licenses: newLicensesSelected
      }
    });
  }

  render() {
    const { visible, confirmLoading, sourceFiles, availableLicenses, selectedRowKeys, clusters, fileSearchSuggestions, fileDataContent, fileProfile, showFileProfile } = this.state;
    const modalTitle = "File Details" + (this.state.file.title ? " - " + this.state.file.title : " - " +this.state.file.name);
    const formItemLayout = {
      labelCol: {
        xs: { span: 2 },
        sm: { span: 5 },
      },
      wrapperCol: {
        xs: { span: 2 },
        sm: { span: 10 },
      },
    };

    const layoutColumns = [{
      title: 'Name',
      dataIndex: 'name',
      width: '20%',
    },
    {
      title: 'Type',
      dataIndex: 'type'
    },
    {
      title: 'Display Size',
      dataIndex: 'displaySize'
    },
    {
      title: 'Display Type',
      dataIndex: 'displayType'
    },
    {
      title: 'Text Justification',
      dataIndex: 'textJustification'
    },
    {
      title: 'Format',
      dataIndex: 'format'
    },
    {
      title: 'SPII',
      dataIndex: 'isSPII'
    },
    {
      title: 'PII',
      dataIndex: 'isPII'
    }];

    const profileDataColumns = [{
      title: 'Field',
      dataIndex: 'attribute',
      width: '10%'
    },
    {
      title: 'Type',
      dataIndex: 'given_attribute_type',
      width: '20%'
    },
    {
      title: 'Best Type',
      dataIndex: 'best_attribute_type',
      width: '20%'
    },
    {
      title: 'Rec Count',
      dataIndex: 'rec_count',
      width: '20%'
    },
    {
      title: 'Fill Count',
      dataIndex: 'fill_count',
      width: '20%'
    },
    {
      title: 'Fill Rate',
      dataIndex: 'fill_rate',
      width: '20%'
    },
    {
      title: 'Cardinality',
      dataIndex: 'cardinality',
      width: '20%'
    },
    {
      title: 'Cardinality Breakdown',
      dataIndex: 'cardinality_breakdown',
      width: '20%'
    },
    {
      title: 'Modes',
      dataIndex: 'modes',
      width: '20%'
    },
    {
      title: 'Popular Patterns',
      dataIndex: 'popular_patterns',
      width: '20%'
    },
    {
      title: 'Rare Patterns',
      dataIndex: 'rare_patterns'
    }]

    const licenseColumns = [{
      title: '',
      dataIndex: 'name',
      render: (text, row) => <a href={row.url}>{text}</a>
    }];

    const validationTableColumns = [{
      Header: 'Name',
      accessor: 'name',
      width: '20%',
    },
    {
      Header: 'Rule Type',
      accessor: 'ruleType',
      width: '20%',
      Cell: cellInfo => (
        <Select style={{ width: 220 }} defaultValue={cellInfo.row.ruleType} onChange={(value) => this.onValidationEdit(cellInfo, value)} placeholder="Rule Type" >
          <Option key='field'>field</Option>
          <Option key='aggregate'>aggregate</Option>
        </Select>
      )
    },
    {
      Header: 'Rule',
      accessor: 'rule',
      width: '20%',
      Cell: cellInfo => (
        <Select style={{ width: 220 }} defaultValue={cellInfo.row.rule} onChange={(value) => this.onValidationEdit(cellInfo, value)} placeholder="Rule" >
          <Option key='not null'>not null</Option>
          <Option key='in'>in</Option>
          <Option key='!='>!=</Option>
          <Option key='>'>></Option>
        </Select>
      )
    },
    {
      Header: 'Action',
      accessor: 'action',
      width: '20%',
      Cell: cellInfo => (
        <Select style={{ width: 220 }} defaultValue={cellInfo.row.action} onChange={(value) => this.onValidationEdit(cellInfo, value)} placeholder="Action" >
          <Option key='drop'>drop</Option>
          <Option key='fix'>fix</Option>
          <Option key='alert'>alert</Option>
        </Select>
      )
    },{
      Header: 'Fix Script',
      accessor: 'fixScript',
      width: '20%',
      Cell: cellInfo => (
        <Input style={{ width: 220 }} defaultValue={cellInfo.row.fixScript} onChange={(e) => this.onValidationEdit(cellInfo, e)} placeholder="fix script" />
      )
    }];

    const fileDataColumns = () => {
      const columns = [];
      this.state.fileDataColHeaders.forEach(function(column) {
        columns.push({"title":column, "dataIndex": column});
      });
      return columns;
    }


    const {title,name, description, primaryService, backupService, qualifiedPath, fileType, isSuperFile, layout, relations, fileFieldRelations, validations} = this.state.file;
    const rowSelection = {
      selectedRowKeys,
      onChange: this.onSelectedRowKeysChange
    };

    const expandedRowRender = () => {
      const columns = [
        { title: 'modes',
          children: [
            {title: 'value',  dataIndex: ["modes","Row", "value"]},
            {title: 'rec_count',  dataIndex: ["modes","Row", "rec_count"]}
          ]
        },
        { title: 'popular_patterns',
          children: [
            {title: 'data_pattern',  dataIndex: 'popular_patterns.Row.data_pattern'},
            {title: 'rec_count',  dataIndex: 'popular_patterns.Row.rec_count'},
            {title: 'example',  dataIndex: 'popular_patterns.Row.example'}
          ]
        }
      ];

      return (
        <Table
          columns={columns}
          dataSource={fileProfile.popular_patterns.Row}
          pagination={false}
        />
      );
    };
    //render only after fetching the data from the server
    if(!title && !this.props.selectedFile && !this.props.isNewFile) {
      return null;
    }

    return (
      <div>
        <Modal
          title={modalTitle}
          visible={visible}
          onOk={this.handleOk}
          confirmLoading={confirmLoading}
          onCancel={this.handleCancel}
          bodyStyle={{height:"580px"}}
          destroyOnClose={true}
          width="1200px"
        >
        <Tabs
          defaultActiveKey="1"
        >
          <TabPane tab="Basic" key="1">

           <Form layout="vertical">
            {this.props.isNewFile ?
            <div>
            <Form.Item {...formItemLayout} label="Cluster">
               <Select placeholder="Select a Cluster" onChange={this.onClusterSelection} style={{ width: 190 }}>
                {clusters.map(cluster => <Option key={cluster.id}>{cluster.name}</Option>)}
              </Select>
            </Form.Item>

            <Form.Item {...formItemLayout} label="File">
              <AutoComplete
                className="certain-category-search"
                dropdownClassName="certain-category-search-dropdown"
                dropdownMatchSelectWidth={false}
                dropdownStyle={{ width: 300 }}
                size="large"
                style={{ width: '100%' }}
                dataSource={fileSearchSuggestions}
                onChange={(value) => this.searchFiles(value)}
                onSelect={(value) => this.onFileSelected(value)}
                placeholder="Search files"
                optionLabelProp="value"
              >
                <Input suffix={<Icon type="search" className="certain-category-icon" />} />
              </AutoComplete>
            </Form.Item>
            </div>
              : null
            }
            <Form.Item {...formItemLayout} label="Title">
                <Input id="file_title" name="title" onChange={this.onChange} defaultValue={title} value={title} placeholder="Title" />
            </Form.Item>
            <Form.Item {...formItemLayout} label="Name">
                <Input id="file_name" name="name" onChange={this.onChange} defaultValue={name} value={name} placeholder="Name" disabled />
            </Form.Item>
            <Form.Item {...formItemLayout} label="Description">
                <Input id="file_desc" name="description" onChange={this.onChange} defaultValue={description} value={description} placeholder="Description" />
            </Form.Item>
            <Form.Item {...formItemLayout} label="Primary Service">
                <Input id="file_primary_svc" name="primaryService" onChange={this.onChange} defaultValue={primaryService} value={primaryService} placeholder="Primary Service" />
            </Form.Item>
            <Form.Item {...formItemLayout} label="Backup Service">
                <Input id="file_bkp_svc" name="backupService" onChange={this.onChange} defaultValue={backupService} value={backupService} placeholder="Backup Service" />
            </Form.Item>
            <Form.Item {...formItemLayout} label="Path">
                <Input id="file_path" name="qualifiedPath" onChange={this.onChange} defaultValue={qualifiedPath} value={qualifiedPath} placeholder="Path" />
            </Form.Item>
            <Form.Item {...formItemLayout} label="File Type">
                <Input id="file_type" name="fileType" onChange={this.onChange} defaultValue={fileType} value={fileType} placeholder="File Type" />
            </Form.Item>
            <Form.Item {...formItemLayout} label="Is Super File">
                <Input id="file_issuper_file" name="isSuperFile" onChange={this.onChange} defaultValue={isSuperFile} value={isSuperFile} placeholder="Is Super File" />
            </Form.Item>

          </Form>

          </TabPane>
          <TabPane tab="Layout" key="3">
              <Table
                columns={layoutColumns}
                rowKey={record => record.name}
                dataSource={layout}
                pagination={{ pageSize: 10 }} scroll={{ y: 380 }}
              />
          </TabPane>
          <TabPane tab="Permissable Purpose" key="4">
            <div>
                <Table
                  rowSelection={rowSelection}
                  columns={licenseColumns}
                  rowKey={record => record.id}
                  dataSource={availableLicenses}
                />
              </div>
          </TabPane>
          <TabPane tab="Scrubs" key="5">
            <div>
                <ReactTable
                  data={validations}
                  defaultSorted={[
                    {
                      id: "name",
                      desc: false
                    }
                  ]}
                  columns={validationTableColumns}
                  className="-striped -highlight"
                  defaultPageSize={10}
                  style={{height:"500px"}}
                />
              </div>
          </TabPane>
          <TabPane tab="File Preview" key="6">
            <div>
                <Table
                  columns={fileDataColumns()}
                  dataSource={fileDataContent}
                  pagination={{ pageSize: 10 }} scroll={{ y: 380 }}
                />
              </div>
          </TabPane>
          {showFileProfile ?
            <TabPane tab="Data Profile" key="7" >
              <div>
                  {/*<DataProfileTable data={this.state.fileProfile}/>*/}
                  <DataProfileHTML htmlAssets={this.state.profileHTMLAssets}/>
                </div>
            </TabPane>
            : "" }
        </Tabs>
        </Modal>
      </div>
    );
  }
}
const FileDetailsForm = Form.create()(FileDetails);
export default FileDetailsForm;
