import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom';
import { Modal, Button, Tabs, Select, Form, Typography, Divider, Input, Icon, Table } from 'antd/lib';
import {Graph} from "./Graph";
import { useSelector } from "react-redux";
import { authHeader, handleError } from "../../common/AuthHeader.js"
import { hasEditPermission } from "../../common/AuthUtil.js";
const TabPane = Tabs.TabPane;
const Option = Select.Option;
const { Paragraph } = Typography;

function SubProcessDialog({show, applicationId, selectedParentDataflow, onRefresh, selectedSubProcess, nodeId}) {
  const [visible, setVisible] = useState(false);
  const [subProcess, setSubProcess] = useState({"id":'-', "title": 'Select a Dataflow'});
  const [dataFlows, setDataFlows] = useState([]);
  const [activeTab, setActiveTab] = useState();
  const [subProcessInput, setSubProcessInput] = useState([]);
  const [subProcessOutput, setSubProcessOutput] = useState([]);

  const authReducer = useSelector(state => state.authenticationReducer);
  const editingAllowed = hasEditPermission(authReducer.user);

  useEffect(() => {
    setVisible(show);
    if(selectedSubProcess && selectedSubProcess.id != "") {
    	setSubProcess(selectedSubProcess);
    	setActiveTab(2);

    } else {
    	setSubProcess(selectedSubProcess);
      setActiveTab(1)
    }

    fetchSavedGraph();

  }, [show, selectedSubProcess])

  useEffect(() => {
	  if(applicationId) {
	  	getData();
	  }
	}, []);

  const onClose = () => {
  	setVisible(false);
  }

  const onSave = () => {
    setVisible(false);
    onRefresh(subProcess);
  }

  const getData = async () => {
    fetch('/api/dataflow?application_id='+applicationId, {
      headers: authHeader()
    }).then(function(response) {
      if(response.ok) {
        return response.json();
      }
      handleError(response);
    }).then(function(data) {
      setDataFlows(data);
    }).catch(error => {
      console.log(error);
    });
  };

  const fetchSavedGraph = async () => {
    if(selectedParentDataflow && selectedParentDataflow.id != '' && selectedParentDataflow.id != undefined) {
      fetch("/api/dataflowgraph?application_id="+applicationId+"&dataflowId="+selectedParentDataflow.id, {
         headers: authHeader()
      })
      .then((response) => {
          if(response.ok) {
            return response.json();
          }
          handleError(response);
      })
      .then(data => {
        if(data != undefined && data != null) {
          let nodes = JSON.parse(data.nodes);
          let edges = JSON.parse(data.edges);

          edges.forEach((edge) => {
          	if(edge.source == nodeId) {
          		let output = nodes.filter((node) => {
		            return node.id === edge.target;
		          })
		          setSubProcessOutput(output)
          	}
          	if(edge.target == nodeId) {
          		let input = nodes.filter((node) => {
		            return node.id === edge.source;
		          })
		          setSubProcessInput(input)
          	}

	        });
        }
      }).catch(error => {
        console.log(error);
      });
    }
  }


  const onChange = (value) => {
    if(value != '-') {
      let selectedDataflow = dataFlows.filter(dataflow => dataflow.id == value)[0];
    	setSubProcess({"id": selectedDataflow.id, "title": subProcess.title});
    	setActiveTab("2");
    } else {
      setSubProcess({"id": '', "title": ''});
    }
  }

  const handleChange = (e) => {
    setSubProcess({'id': subProcess.id, 'title': e.target.value});
  }

  const formItemLayout = {
    labelCol: {
      xs: { span: 2 },
      sm: { span: 2 },
    },
    wrapperCol: {
      xs: { span: 1 },
      sm: { span: 10 },
    },
  };

  const assetCols = [{
    title: 'Title',
    dataIndex: 'title',
    width: '30%',
    render: text => <a>{text}</a>
  }]

	return (
	  <React.Fragment>
		  <Modal
        title={"Sub-Process"}
        visible={visible}
        onOk={onClose}
        onCancel={onClose}
        destroyOnClose={true}
        width="1100px"
        bodyStyle={{height:"700px", left:"100px", padding:"5px"}}
        footer={[
          <Button key="back" onClick={onClose}>
            Close
          </Button>,
          <Button key="save" type="primary" onClick={onSave}>
            Save
          </Button>
        ]}
      >
      <Tabs defaultActiveKey={activeTab}>
        <TabPane tab="Dataflow" key="1">
        	{subProcess.id == "" || subProcess.id == undefined ?
            <span className="error">Please select a dataflow for this Sub-Process.</span>
          : null}

          <Form.Item {...formItemLayout} label="Dataflow">
	        	<Select
					    style={{ width: 300 }}
					    onChange={onChange}
					    value={(subProcess.id != '' && subProcess.id != undefined) ? subProcess.id : '-'}
					  >
            <Option key={'-'}>Select a Dataflow</Option>
					  	{dataFlows.map(dataflow => <Option key={dataflow.id}>{dataflow.title}</Option>)}
	        	</Select>
        	</Form.Item>
          <Form.Item {...formItemLayout} label="Title">
            <Input id="title" name="title" onChange={handleChange} defaultValue={subProcess.title} value={subProcess.title} placeholder="Title" disabled={!editingAllowed}/>
          </Form.Item>

        	<Tabs defaultActiveKey={"1"}>
        		<TabPane tab="Input" key="1">
        			<Table
				        columns={assetCols}
				        rowKey={record => record.id}
				        dataSource={subProcessInput}
				        pagination={{ pageSize: 5 }} scroll={{ y: 380 }}
				      />
        		</TabPane>
        		<TabPane tab="Output" key="2">
        			<Table
				        columns={assetCols}
				        rowKey={record => record.id}
				        dataSource={subProcessOutput}
				        pagination={{ pageSize: 5 }} scroll={{ y: 380 }}

				      />
        		</TabPane>
        	</Tabs>
        </TabPane>
        <TabPane tab="Designer" key="2"  disabled={subProcess.id == '' || subProcess.id == undefined}>
	        <Graph
	          applicationId={applicationId}
	          viewMode={false}
	          selectedParentDataflow={selectedParentDataflow}
	          selectedDataflow={{'id':subProcess.id}}
	          graphContainer="subgraph" sidebarContainer="subgraphsidebar"
	          dataflowType="sub-process"
	          updateProcessId={subProcess.id}
	        />
	      </TabPane>
			</Tabs>
	  </Modal>
	</React.Fragment>
  )
}

export default SubProcessDialog