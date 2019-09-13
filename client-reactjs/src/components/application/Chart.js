import React, { Component } from 'react';
import { Table,Modal } from 'antd/lib';
import Plotly from 'plotly.js-basic-dist';
import createPlotlyComponent from 'react-plotly.js/factory';
import { authHeader, handleError } from "../common/AuthHeader.js";
import { connect } from 'react-redux';
const Plot = createPlotlyComponent(Plotly);

class Chart extends Component {
  constructor(props) {
    super(props);
  }

  state = {
    applicationId: this.props.application ? this.props.application.applicationId : '',
    applicationTitle: this.props.application ? this.props.application.applicationTitle : '',    
    fileLicense: [],
    licenseName:[],
    fileCount:[],
    barWidth:[],
    maxCount:0,
    Dependencies:[],
    depMaxCount:0,
    showFileList:false,
    files:[],
    selectedLicense:""
  }
  componentDidMount() {
    this.fetchFileLicenseCount();  
    this.fetchDependenciesCount();    
  }

  fetchFileLicenseCount() {
    var self=this;   
    fetch("/api/file/read/fileLicenseCount?app_id="+this.state.applicationId, {
        headers: authHeader()
    })
    .then((response) => {
      if(response.ok) {
        return response.json();
      }
      handleError(response);
    })
    .then(data => {  
      var licenseName = [];
      var fileCount = [];
      var width=[];
      var maxCount=0;
      for (var obj in data) {
        licenseName.push(data[obj].name);
        fileCount.push(data[obj].fileCount);
        width.push(0.4);
        maxCount=(data[obj].fileCount>maxCount)?data[obj].fileCount:maxCount;
      }        
      self.setState({
        fileLicense: data,
        licenseName:licenseName,
        fileCount:fileCount,
        barWidth:width,
        maxCount:maxCount
      });         
    }).catch(error => {
      console.log(error);
    });
  }
  fetchDependenciesCount() {
    var self=this;  
    var maxCount=0; 
    fetch("/api/file/read/DependenciesCount?app_id="+this.state.applicationId, {
        headers: authHeader()
    })
    .then((response) => {
      if(response.ok) {
        return response.json();
      }
      handleError(response);
    })
    .then(data => {
      maxCount=data.fileCount>data.indexCount?data.fileCount:data.indexCount;
      maxCount=maxCount>data.queryCount?maxCount:data.queryCount;
      maxCount=maxCount>data.jobCount?maxCount:data.jobCount;    
      self.setState({
        Dependencies: data,
        depMaxCount:maxCount
      }); 
          
    }).catch(error => {
      console.log(error);
    });
  }
 
  onDependenciesClick = (data) => {
    var xaxisVal=data.points[0].x;
    if(xaxisVal=="File")
      this.props.history.push('/'+this.props.application.applicationId+'/files');    
    else if(xaxisVal=="Index")
    this.props.history.push('/'+this.props.application.applicationId+'/index');
    else if(xaxisVal=="Job")
    this.props.history.push('/'+this.props.application.applicationId+'/jobs');
    else if(xaxisVal=="Query")
    this.props.history.push('/'+this.props.application.applicationId+'/queries');
  }
  onComplianceClick = (data) => {  
    var xaxisVal=data.points[0].x; 
    fetch("/api/file/read/LicenseFileList?app_id="+this.state.applicationId+"&name="+data.points[0].x, {
        headers: authHeader()
    })
    .then((response) => {
      if(response.ok) {
        return response.json();
      }
      handleError(response);
    })
    .then(data => {
      var results = [];
      data.forEach(function(doc, idx) {
        var fileObj = {};
        fileObj=doc;
        fileObj.fileTitle=(doc.title)?doc.title:doc.name;        
        results.push(fileObj);
      });
      this.setState({
        files: results,
        selectedLicense:"License - "+xaxisVal
      });
      this.setState({
        showFileList: true
      });
          
    }).catch(error => {
      console.log(error);
    });
  }
  handleFileCancel=()=>{
    this.setState({
      showFileList: false
    });
  }
  render() {
    const fileColumns = [{
      title: 'Title',
      dataIndex: 'fileTitle',
      width: '30%',
    },
    {
        width: '30%',
        title: 'File Type',
        dataIndex: 'fileType'
    },
    {
        width: '40%',
        title: 'Qualified Path',
        dataIndex: 'qualifiedPath'
    }];
   const table = <Table
      columns={fileColumns}
      rowKey={record => record.id}
      dataSource={this.state.files}
      pagination={{ pageSize: 20 }}
      width="1000px"
    />
    const config = { displayModeBar: false }
    if(!this.props.application || !this.props.application.applicationId)
    return null;
    return (
      <div style={{paddingTop:"50px"}}>
      <Plot onClick={this.onComplianceClick} config={config}  data={[{
            x: this.state.licenseName,
            y: this.state.fileCount,
            width:this.state.barWidth,
            type: 'bar',
            marker: {color: 'blue'},
            name:"PCI"
          }
        ]}
        layout={ {width: 400, height: 500, title: 'Compliance Data Point',
        xaxis1: {
          side: 'bottom',
          "showline": true,
          title:"Licenses"  
        },
        yaxis1: {
          side: 'left',
          autorange:false,
          range: [0,this.state.maxCount],
          tickformat: ',d',
          "showline": true,
          title:"File count"  
        },
        plot_bgcolor: 'rgb(182, 215, 168)'
      } }
      />
      <Plot  onClick={this.onDependenciesClick} config={config}       
        data={[
          {
            x: ['File','Index','Query','Job'],
            y: [this.state.Dependencies.fileCount,
            this.state.Dependencies.indexCount,
            this.state.Dependencies.queryCount,
            this.state.Dependencies.jobCount],
            width:[0.5,0.5,0.5,0.5],
            type: 'bar',
            marker: {color: 'rgb(128,0,0)'},
          }
        ]}
        layout={ {width: 400, height: 500, title: 'Dependencies',
        xaxis1: {
          side: 'bottom',
          "showline": true,
          title:"Dependencies"  
        },
        yaxis1: {
          side: 'left',
          autorange:false,
          range: [0,this.state.depMaxCount],
          tickformat: ',d',
          "showline": true,
          title:"Count"  
        },
        plot_bgcolor: 'rgb(182, 215, 168)'
      } }
      />
      <Modal
	          title={this.state.selectedLicense}
	          visible={this.state.showFileList}
            onCancel={this.handleFileCancel}
            width="700px"
            footer={null}
	        >
          {table}
      </Modal>
      </div>
    );
  }
}
function mapStateToProps(state) {
  const { user } = state.authenticationReducer;
  const { application, selectedTopNav } = state.applicationReducer;
  return {
      user,
      application,
      selectedTopNav
  };
}

const connectedChart = connect(mapStateToProps)(Chart);
export { connectedChart as Chart };