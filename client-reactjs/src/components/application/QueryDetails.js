import React, { Component } from "react";
import { Modal, Tabs, Form, Input, Icon,  Select, AutoComplete, Spin, message, Button, Radio } from 'antd/lib';
import { authHeader, handleError } from "../common/AuthHeader.js"
import { hasEditPermission } from "../common/AuthUtil.js";
import AssociatedDataflows from "./AssociatedDataflows"
import EditableTable from "../common/EditableTable.js"
import { fetchDataDictionary, eclTypes, omitDeep } from "../common/CommonUtil.js"
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/dist/styles/ag-grid.css';
import 'ag-grid-community/dist/styles/ag-theme-balham.css';
import { MarkdownEditor } from "../common/MarkdownEditor.js"
import { connect } from 'react-redux';
const TabPane = Tabs.TabPane;
const Option = Select.Option;
const { confirm } = Modal;
message.config({top:130})
class QueryDetails extends Component {
  constructor(props) {
    super(props);
  }

  state = {
    visible: true,
    confirmLoading: false,
    pagination: {},
    loading: false,
    sourceFiles:[],
    availableLicenses:[],
    selectedRowKeys:[],
    clusters:[],
    selectedCluster:"",
    querySearchSuggestions:[],
    querySearchErrorShown:false,
    autoCompleteSuffix: <Icon type="search" className="certain-category-icon" />,
    dataDefinitions:[],
    query: {
      id:"",
      title:"",
      name:"",
      description:"",
      groupId: "",
      url: "",
      primaryService:"",
      backupService:"",
      gitrepo:"",
      type:"roxie_query",
      input: [],
      output: []
    }
  }

  componentDidMount() {
    //this.props.onRef(this);
    this.getQueryDetails();
    this.fetchDataDefinitions();
  }

  /*shouldComponentUpdate(nextProps, nextState) {
    console.log("shouldComponentUpdate")
    if(this.state.clusters.length == nextState.clusters.length) {
      return false;
    } else {
      return true;
    }
  }*/

  getQueryDetails() {
    if(this.props.selectedAsset && !this.props.isNew) {
      fetch("/api/query/query_details?query_id="+this.props.selectedAsset.id+"&app_id="+this.props.application.applicationId, {
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
          ...this.state,
          query: {
            ...this.state.query,
            id: data.id,
            title: data.title,
            name: (data.name == '' ? data.title : data.name),
            description: data.description,
            groupId: data.groupId,
            type: data.type,
            url: data.url,
            primaryService: data.primaryService,
            backupService: data.backupService,
            input: data.query_fields.filter(field => field.field_type == 'input'),
            output: data.query_fields.filter(field => field.field_type == 'output')
          }
        });
        this.props.form.setFieldsValue({
          name: (data.name == '' ? data.title : data.name),
          title: data.title,
          description: data.description,
          url: data.url
        });
        return data;
      })
      .then(data => {
        this.setState({
          initialDataLoading: false
        });
      })
      .catch(error => {
        console.log(error);
      });
    }
    this.getClusters();
  }

  showModal = () => {
    this.setState({
      visible: true,
    });
    //this.getQueryDetails();
    /*if(this.props.isNewFile) {
      this.getClusters();
    }*/
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

  setInputFieldData = (data) => {
    let omitResults = omitDeep(data, 'id')
    this.setState({
      ...this.state,
      query: {
        ...this.state.query,
        input: omitResults,
      }
    })
  }

  setOutputFieldData = (data) => {
    let omitResults = omitDeep(data, 'id')
    this.setState({
      ...this.state,
      query: {
        ...this.state.query,
        output: omitResults,
      }
    })
  }

  handleDelete = () => {
    let _self=this;
    confirm({
      title: 'Delete file?',
      content: 'Are you sure you want to delete this Query?',
      onOk() {
        var data = JSON.stringify({queryId: _self.props.selectedAsset.id, application_id: _self.props.application.applicationId});
        fetch("/api/query/delete", {
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
          //_self.props.onRefresh();
          //_self.props.onClose();
          _self.props.history.push('/' + _self.props.application.applicationId + '/assets');
          message.success("Query deleted sucessfully");
        }).catch(error => {
          console.log(error);
          message.error("There was an error deleting the Query");
        });
      },
      onCancel() {}
    })
  }

  handleOk = (e) => {
    this.props.form.validateFields(async (err, values) => {
      if(!err) {
        this.setState({
          confirmLoading: true,
        });

        let saveResponse = await this.saveQueryDetails();

        setTimeout(() => {
          this.setState({
            visible: false,
            confirmLoading: false,
          });
          //this.props.onClose();
          //this.props.onRefresh(saveResponse);
          this.props.history.push('/' + this.props.application.applicationId + '/assets')
        }, 2000);
      }
    });
  }

  getClusters() {
    console.log('get custers');
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

  searchQueries(searchString) {
    if(searchString.length <= 3)
      return;

    this.setState({
      ...this.state,
      autoCompleteSuffix : <Spin/>
    });
    if(searchString.length <= 3)
      return;
    var data = JSON.stringify({clusterid: this.state.selectedCluster, keyword: searchString, indexSearch:true});
    fetch("/api/hpcc/read/querysearch", {
      method: 'post',
      headers: authHeader(),
      body: data
    }).then((response) => {
      if(response.ok) {
        return response.json();
      } else {
        throw response;
      }
      //handleError(response);
    })
    .then(suggestions => {
      this.setState({
        ...this.state,
        querySearchSuggestions: suggestions,
        autoCompleteSuffix: <Icon type="search" className="certain-category-icon" />
      });
    }).catch(error => {
      if(!this.state.querySearchErrorShown) {
        error.json().then((body) => {
          message.config({top:130})
          message.error(body.message);
        });
        this.setState({
          ...this.state,
          querySearchErrorShown: true
        });
      }
    });
  }

  onQuerySelected(selectedSuggestion) {
    fetch("/api/hpcc/read/getQueryInfo?queryName="+selectedSuggestion+"&clusterid="+this.state.selectedCluster, {
      headers: authHeader()
    })
    .then((response) => {
      if(response.ok) {
        return response.json();
      }
      handleError(response);
    })
    .then(queryInfo => {
      this.setState({
        ...this.state,
        sourceFiles: [],
        query: {
          ...this.state.file,
          title: selectedSuggestion,
          name: selectedSuggestion,
          description: '',
          url: '',
          path: '',
          type:"roxie_query",
          input: queryInfo.request,
          output: queryInfo.response
        }
      })
      this.props.form.setFieldsValue({
        query_title: selectedSuggestion,
        name: selectedSuggestion
      });

      return queryInfo;
    })
    .then(data => {
      //this.getQueries();
    })
    .catch(error => {
      console.log(error);
    });
  }

  getQueries() {
    fetch("/api/queries/read/file_ids?app_id="+this.props.application.applicationId, {
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

  saveQueryDetails() {
    return new Promise((resolve) => {
      fetch('/api/query/saveQuery', {
        method: 'post',
        headers: authHeader(),
        body: JSON.stringify({isNew : this.props.isNew, id: this.state.query.id, query : this.populateQueryDetails()})
      }).then(function(response) {
        if(response.ok) {
          return response.json();
        }
        handleError(response);
      }).then(function(data) {
        console.log('Saved..');
        resolve(data);
      });
    //this.populateFileDetails()
    });
  }

  populateQueryDetails() {
    var applicationId = this.props.application.applicationId;

    var inputFields = this.state.query.input.map(function(element) {
      element.field_type='input';
      return element;
    });
    var outputFields = this.state.query.output.map(function(element) {
      element.field_type='output';
      return element;
    });

    var queryDetails = {
      "basic" : {
        "application_id":applicationId,
        "title" : this.state.query.title,
        "name" : this.state.query.name,
        "description" : this.state.query.description,
        "groupId" : this.state.query.groupId,
        "url" : this.state.query.url,
        "gitRepo" : this.state.query.gitrepo,
        "primaryService" : this.state.query.primaryService,
        "backupService" : this.state.query.backupService,
        "type": this.state.query.type,
      },
      fields: inputFields.concat(outputFields)
    };

    //console.log(queryDetails);

    return queryDetails;
  }

  handleCancel = () => {
    this.setState({
      visible: false,
    });
    //this.props.onClose();
    this.props.history.push('/' + this.props.application.applicationId + '/assets')
  }

  onClusterSelection = (value) => {
    this.setState({
      selectedCluster: value,
    });
  }

  onChange = (e) => {
    this.setState({...this.state, query: {...this.state.query, [e.target.name]: e.target.value }});
  }

  onSourceFileSelection = (value) => {
    this.setState({
      selectedSourceFile: value,
    });
  }

  onQueriesTablesReady = (params) => {
    let gridApi = params.api;
    gridApi.sizeColumnsToFit();
  }

  queryTypeChange = (e) => {
    this.setState({
      ...this.state,
      query: {
        ...this.state.query,
        type: e.target.value
      }
    });
  }


  render() {
    console.log("rendering")
    const editingAllowed = hasEditPermission(this.props.user);
    const {getFieldDecorator} = this.props.form;
    const { visible, confirmLoading, sourceFiles, availableLicenses, selectedRowKeys, clusters, querySearchSuggestions } = this.state;
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

    const columns = [{
      title: 'Name',
      dataIndex: 'name',
      editable: editingAllowed
    },
    {
      title: 'Type',
      dataIndex: 'type',
      editable: editingAllowed,
      celleditor: "select",
      showdatadefinitioninfield: true,
      celleditorparams: {
        values: eclTypes.sort()
      }
    },
    {
      title: 'Possible Value',
      dataIndex: 'possibleValue',
      editable: true
    },
    {
      title: 'Value Description',
      dataIndex: 'valueDescription',
      editable: true
    }];


    const {name, title, description, primaryService, backupService, type, input, output, gitrepo, url} = this.state.query;
    const rowSelection = {
      selectedRowKeys,
      onChange: this.onSelectedRowKeysChange
    };

    //render only after fetching the data from the server
    //{console.log(title + ', ' + this.props.selectedQuery + ', ' + this.props.isNewFile)}
    {console.log('name: '+name)}

    return (
      <React.Fragment>
        <div style={{"paddingTop": "55px"}}>
        {!this.props.isNew ?
            <div className="loader">
              <Spin spinning={this.state.initialDataLoading} size="large" />
            </div> : null}
        <Tabs
          defaultActiveKey="1"
        >
          <TabPane tab="Basic" key="1">

           <Form layout="vertical">
            <div>
              <Form.Item {...formItemLayout} label="Type">
                <Radio.Group onChange={this.queryTypeChange} value={type}>
                  <Radio value={'roxie_query'}>Roxie Query</Radio>
                  <Radio value={'api'}>API/Gateway</Radio>
                </Radio.Group>
              </Form.Item>
              {type == 'roxie_query' ?
                <React.Fragment>
                <Form.Item {...formItemLayout} label="Cluster">
                   <Select placeholder="Select a Cluster" onChange={this.onClusterSelection} style={{ width: 190 }} disabled={!editingAllowed}>
                    {clusters.map(cluster => <Option key={cluster.id}>{cluster.name}</Option>)}
                  </Select>
                </Form.Item>

                <Form.Item {...formItemLayout} label="Query">
                  <AutoComplete
                    className="certain-category-search"
                    dropdownClassName="certain-category-search-dropdown"
                    dropdownMatchSelectWidth={false}
                    dropdownStyle={{ width: 300 }}
                    size="large"
                    style={{ width: '100%' }}
                    dataSource={querySearchSuggestions}
                    onChange={(value) => this.searchQueries(value)}
                    onSelect={(value) => this.onQuerySelected(value)}
                    placeholder="Search queries"
                    optionLabelProp="value"
                    disabled={!editingAllowed}
                  >
                    <Input id="autocomplete_field" suffix={this.state.autoCompleteSuffix} autoComplete="off"/>
                  </AutoComplete>
                </Form.Item>
                </React.Fragment>
              : null}
            </div>

            <Form.Item {...formItemLayout} label="Name">
              {getFieldDecorator('name')(<Input disabled={true} disabled={!editingAllowed}/>)}
            </Form.Item>

            <Form.Item {...formItemLayout} label="Title">
                {getFieldDecorator('title', {
                trigger: 'onChange',
                valuePropName: 'value',
                initialValue: this.state.query.title
              })
              (<Input id="query_title" name="title" onChange={this.onChange} placeholder="Title" disabled={!editingAllowed}/>)}
            </Form.Item>
            <Form.Item {...formItemLayout} label="Description">
              <MarkdownEditor id="query_desc" name="description" onChange={this.onChange} targetDomId="queryDescr" value={description} disabled={!editingAllowed}/>
            </Form.Item>
            <Form.Item {...formItemLayout} label="URL">
                {getFieldDecorator('url', {
                trigger: 'onChange',
                valuePropName: 'value',
                initialValue: this.state.query.url
              })(<Input id="query_url" name="url" onChange={this.onChange} placeholder="URL" disabled={!editingAllowed}/>)}
            </Form.Item>
            <Form.Item {...formItemLayout} label="Git Repo">
                {getFieldDecorator('gitrepo', {
                trigger: 'onChange',
                valuePropName: 'value',
                initialValue: this.state.query.gitrepo
              })
              (<Input id="query_gitrepo" name="gitrepo" onChange={this.onChange} placeholder="Git Repo URL" disabled={!editingAllowed}/>)}
            </Form.Item>
            {/*<Form.Item {...formItemLayout} label="Primary Service">
                <Input id="query_primary_svc" name="primaryService" onChange={this.onChange}  placeholder="Primary Service" disabled={!editingAllowed}/>
            </Form.Item>
            <Form.Item {...formItemLayout} label="Backup Service">
                <Input id="query_bkp_svc" name="backupService" onChange={this.onChange} placeholder="Backup Service" disabled={!editingAllowed}/>
            </Form.Item>*/}
            {/*<Form.Item {...formItemLayout} label="Type">
                <Input id="type" name="type" onChange={this.onChange} value={type} defaultValue={type} placeholder="Query Type" disabled={!editingAllowed}/>
            </Form.Item>*/}
          </Form>

          </TabPane>
          <TabPane tab="Input Fields" key="2">
            <div
                className="ag-theme-balham"
                style={{
                height: '415px',
                width: '100%' }}
              >
                <EditableTable
                  columns={columns}
                  dataSource={input}
                  ref={node => (this.inputFieldsTable = node)}
                  editingAllowed={editingAllowed}
                  dataDefinitions={this.state.dataDefinitions}
                  showDataDefinition={true}
                  setData={this.setInputFieldData}/>
              </div>
            </TabPane>
          <TabPane tab="Output Fields" key="3">
            <div
                className="ag-theme-balham"
                style={{
                height: '415px',
                width: '100%' }}
              >

                <EditableTable
                  columns={columns}
                  dataSource={output}
                  ref={outputTable => (this.outputFieldsTable = outputTable)}
                  editingAllowed={editingAllowed}
                  dataDefinitions={this.state.dataDefinitions}
                  showDataDefinition={true}
                  setData={this.setOutputFieldData}/>

              </div>
          </TabPane>

          {!this.props.isNew ?
            <TabPane tab="Applications" key="7">
              <AssociatedDataflows assetName={name} assetType={'Query'}/>
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

function mapStateToProps(state) {
    const { selectedAsset, newAsset={} } = state.assetReducer;
    const { user } = state.authenticationReducer;
    const { application } = state.applicationReducer;
    const {isNew=false, groupId='' } = newAsset;
    console.log(selectedAsset)
    return {
      user,
      selectedAsset,
      application,
      isNew,
      groupId
    };
}

const QueryDetailsForm = connect(mapStateToProps)(Form.create()(QueryDetails));
export default QueryDetailsForm;