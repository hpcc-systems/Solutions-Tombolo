import React, { Component } from "react";
import { Modal, Tabs, Form, Input, Icon,  Select, AutoComplete, Spin, message, Button } from 'antd/lib';
import "react-table/react-table.css";
import { authHeader, handleError } from "../common/AuthHeader.js"
import { hasEditPermission } from "../common/AuthUtil.js";
import AssociatedDataflows from "./AssociatedDataflows"
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/dist/styles/ag-grid.css';
import 'ag-grid-community/dist/styles/ag-theme-balham.css';
const TabPane = Tabs.TabPane;
const Option = Select.Option;


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
    query: {
      id:"",
      title:"",
      name:"",
      description:"",
      primaryService:"",
      backupService:"",
      gitrepo:"",
      type:"",
      input: [],
      output: []
    }
  }

  componentDidMount() {
    this.props.onRef(this);
    this.getQueryDetails();
  }

  getQueryDetails() {
    if(this.props.selectedQuery && !this.props.isNewIndex) {
      fetch("/api/query/query_details?query_id="+this.props.selectedQuery+"&app_id="+this.props.applicationId, {
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
            primaryService: data.primaryService,
            backupService: data.backupService,
            input: data.query_fields.filter(field => field.field_type == 'input'),
            output: data.query_fields.filter(field => field.field_type == 'output')
          }
        });
        this.props.form.setFieldsValue({
          query_title: data.title
        });

        return data;
      })
      .then(data => {
        //this.getQueries();
      })
      .catch(error => {
        console.log(error);
      });
    } else {
      this.getClusters();
    }
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
          this.props.onClose();
          this.props.onRefresh(saveResponse);
        }, 2000);
      }
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
          id: selectedSuggestion,
          title: selectedSuggestion,
          name: selectedSuggestion,
          description: '',
          path: '',
          input: queryInfo.request,
          output: queryInfo.response
        }
      })
      this.props.form.setFieldsValue({
        query_title: selectedSuggestion
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
    fetch("/api/queries/read/file_ids?app_id="+this.props.applicationId, {
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
        body: JSON.stringify(this.populateQueryDetails())
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
    var applicationId = this.props.applicationId;
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
        "applicationId":applicationId,
        "title" : this.state.query.title,
        "name" : this.state.query.name,
        "description" : this.state.query.description,
        "gitRepo" : this.state.query.gitrepo,
        "primaryService" : this.state.query.primaryService,
        "backupService" : this.state.query.backupService,
        "type": this.state.query.type
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
    this.props.onClose();

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

  render() {
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
      headerName: 'Name',
      field: 'field'
    },
    {
      headerName: 'Type',
      field: 'type'
    }];


    const {name, title, description, primaryService, backupService, type, input, output, gitrepo} = this.state.query;
    const rowSelection = {
      selectedRowKeys,
      onChange: this.onSelectedRowKeysChange
    };
    const editingAllowed = hasEditPermission(this.props.user);
    //render only after fetching the data from the server
    //{console.log(title + ', ' + this.props.selectedQuery + ', ' + this.props.isNewFile)}
    if(!title && !this.props.selectedQuery && !this.props.isNewFile) {
      return null;
    }

    return (
      <div>
        <Modal
          title="Query Details"
          visible={visible}
          onOk={this.handleOk}
          confirmLoading={confirmLoading}
          onCancel={this.handleCancel}
          bodyStyle={{height:"500px"}}
          destroyOnClose={true}
          width="1200px"
          footer={[
            <Button key="back" onClick={this.handleCancel}>
              Cancel
            </Button>,
            <Button key="submit" disabled={!editingAllowed} type="primary" loading={confirmLoading} onClick={this.handleOk}>
              Save
            </Button>,
          ]}
        >
        <Tabs
          defaultActiveKey="1"
        >
          <TabPane tab="Basic" key="1">

           <Form layout="vertical">
            {/*this.props.isNewFile ?*/}
            <div>
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
                <Input id="autocomplete_field" suffix={this.state.autoCompleteSuffix} />
              </AutoComplete>
            </Form.Item>
            </div>
              {/*: null
            }*/}
             <Form.Item {...formItemLayout} label="Name">
                <Input id="query_name" name="name" onChange={this.onChange} value={name} defaultValue={name} placeholder="Name" disabled={true} disabled={!editingAllowed}/>
            </Form.Item>
            <Form.Item {...formItemLayout} label="Title">
                <Input id="query_title" name="title" onChange={this.onChange} value={title} defaultValue={title} placeholder="Title" disabled={!editingAllowed}/>
            </Form.Item>
            <Form.Item {...formItemLayout} label="Description">
                <Input id="query_desc" name="description" onChange={this.onChange} value={description} defaultValue={description} placeholder="Description" disabled={!editingAllowed}/>
            </Form.Item>
            <Form.Item {...formItemLayout} label="Git Repo">
                <Input id="query_gitrepo" name="gitrepo" onChange={this.onChange} value={gitrepo} defaultValue={gitrepo} placeholder="Git Repo URL" disabled={!editingAllowed}/>
            </Form.Item>
            <Form.Item {...formItemLayout} label="Primary Service">
                <Input id="query_primary_svc" name="primaryService" onChange={this.onChange} value={primaryService} defaultValue={primaryService} placeholder="Primary Service" disabled={!editingAllowed}/>
            </Form.Item>
            <Form.Item {...formItemLayout} label="Backup Service">
                <Input id="query_bkp_svc" name="backupService" onChange={this.onChange} value={backupService} defaultValue={backupService} placeholder="Backup Service" disabled={!editingAllowed}/>
            </Form.Item>
            <Form.Item {...formItemLayout} label="Type">
                <Input id="type" name="type" onChange={this.onChange} value={type} defaultValue={type} placeholder="Query Type" disabled={!editingAllowed}/>
            </Form.Item>
          </Form>

          </TabPane>
          <TabPane tab="Input Fields" key="2">
            <div
                className="ag-theme-balham"
                style={{
                height: '415px',
                width: '100%' }}
              >
                <AgGridReact
                  onCellValueChanged={this.dataTypechange}
                  columnDefs={columns}
                  rowData={input}
                  defaultColDef={{resizable: true, sortable: true}}
                  onGridReady={this.onQueriesTablesReady}
                  singleClickEdit={editingAllowed}>
                </AgGridReact>
              </div>
            </TabPane>
          <TabPane tab="Output Fields" key="3">
            <div
                className="ag-theme-balham"
                style={{
                height: '415px',
                width: '100%' }}
              >
                <AgGridReact
                  onCellValueChanged={this.dataTypechange}
                  columnDefs={columns}
                  rowData={output}
                  defaultColDef={{resizable: true, sortable: true}}
                  onGridReady={this.onQueriesTablesReady}
                  singleClickEdit={editingAllowed}>
                </AgGridReact>
              </div>
          </TabPane>

          {!this.props.isNew ? 
            <TabPane tab="Applications" key="7">
              <AssociatedDataflows assetName={name} assetType={'Query'}/>
            </TabPane> : null}
        </Tabs>
        </Modal>
      </div>
    );
  }
}
const QueryDetailsForm = Form.create()(QueryDetails);
export default QueryDetailsForm;

