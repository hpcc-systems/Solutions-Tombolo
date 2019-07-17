import {Treant} from 'treant-js/Treant.js';
import { message, Row, Col, Icon,Popconfirm,Tooltip } from 'antd/lib';
import $ from 'jquery';
import { jsPlumb } from 'jsplumb';
import { _ } from 'underscore';
import React, { Component } from "react";
import FileDetailsForm from "./FileDetails";
import '../../../node_modules/bootstrap/dist/css/bootstrap.min.css';
import { authHeader, handleError } from "../common/AuthHeader.js"

class JSPlumbTree extends Component {
  constructor(props) {
    super(props);
    this.setWrapperRef = this.setWrapperRef.bind(this);
    this.handleClickOutside = this.handleClickOutside.bind(this);
  }

  state = {
    applications: [],
    openFileDetailsDialog: false,
    selectedFile: "",
    applicationId: this.props.applicationId,
    files: [],
    //nodes:{"connections":[{"id":"con_5","sourceId":"taxi_data_raw","targetId":"taxi_data_clean","anchors":[{"elementId":"taxi_data_raw","type":"RightMiddle"},{"elementId":"taxi_data_clean","type":"LeftMiddle"}]},{"id":"con_10","sourceId":"weather_new_york_city","targetId":"weather_newyork_clean","anchors":[{"elementId":"weather_new_york_city","type":"RightMiddle"},{"elementId":"weather_newyork_clean","type":"LeftMiddle"}]},{"id":"con_15","sourceId":"taxi_data_clean","targetId":"taxi_weather","anchors":[{"elementId":"taxi_data_clean","type":"RightMiddle"},{"elementId":"taxi_weather","type":"LeftMiddle"}]},{"id":"con_20","sourceId":"weather_newyork_clean","targetId":"taxi_weather","anchors":[{"elementId":"weather_newyork_clean","type":"RightMiddle"},{"elementId":"taxi_weather","type":"LeftMiddle"}]}],"styles":[{"id":"taxi_data_raw","style":"left: 360px; top: 112px;"},{"id":"taxi_data_clean","style":"left: 319px; top: 105px;"},{"id":"weather_new_york_city","style":"left: -227px; top: 319px;"},{"id":"weather_newyork_clean","style":"left: -260px; top: 330px;"},{"id":"taxi_weather","style":"left: 758px; top: 121px;"}]},
    nodes:{},
    chartContainer: this.props.chartContainer ? this.props.chartContainer : "canvas"
  }

  componentWillUnmount() {
    document.removeEventListener('mousedown', this.handleClickOutside);
  }

  componentWillReceiveProps(props) {
    var _self=this;
    this.setState({
        applicationId: props.applicationId
      });
    const { refresh } = this.props;
    if (props.refresh !== refresh) {
      setTimeout(() => {
        _self.fetchFiles();
      }, 200);

    }
  }

  componentDidMount() {
    document.addEventListener('mousedown', this.handleClickOutside);
    this.fetchFiles();
  }

  setWrapperRef(node) {
    this.wrapperRef = node;
  }

  handleClickOutside(event) {
    if (this.wrapperRef && !this.wrapperRef.contains(event.target)) {
        this.saveConnections();
    }
  }

  handleClose = () => {
    this.setState({
      openFileDetailsDialog: false
    });
  }

  showFileDetails = (fileId) => {
    this.setState({
        selectedFile: fileId,
        openFileDetailsDialog: true
      });
  }
  DeleteFilevalue=(fileId,applicationId)=>{
    var _self=this;
      var data = JSON.stringify({fileId: fileId, application_id:applicationId});
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
       _self.fetchFiles();
       message.success("File deleted sucessfully");       
     }).catch(error => {
       console.log(error);
       message.error("There was an error deleting the file");
     });
               

  }
  EditFile=(fileId)=>{
      this.showFileDetails(fileId);
  }

  handleRefreshTree = () => this.fetchFiles();

  fetchFiles() {
    fetch("/api/file/read/file_list?app_id="+this.state.applicationId, {
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
        files: data
      });
      this.setState({
        openFileDetailsDialog: false
      });
      //this.fetchFileRelations();
      this.fetchFileTreeDetails();
    }).catch(error => {
      console.log(error);
    });
  }

  async fetchFileTreeDetails() {
    var _self=this;
    try {
        const data = await fetch("/api/file/read/filetree?app_id="+this.state.applicationId, {
            headers: authHeader()
        })
        const responseJson = await data.json();
        var nodes = {"connections":responseJson.connections, "styles":responseJson.tree_styles};
        this.setState(
            () => ({ nodes: nodes })
        );

        setTimeout(() => {
            _self.renderTree();
        }, 200);
    } catch(error) {
      console.log(error);
    };
  }

  renderTree() {
    var _self=this;
    var chartContainer = document.getElementById(this.state.chartContainer);
    var nodes = this.state.nodes;

    jsPlumb.ready(function () {
        var instance = null;
        if(_self.instance != undefined) {
            //_self.instance.reset();
            _self.instance.deleteEveryEndpoint();
            _self.instance.deleteEveryConnection();
            instance = _self.instance;
        } else {
            instance = jsPlumb.getInstance({
                dragOptions: { cursor: 'pointer', zIndex: 2000 },
                PaintStyle: { stroke: '#666' },
                EndpointHoverStyle: { fill: "orange" },
                HoverPaintStyle: { stroke: "orange" },
                EndpointStyle: { width: 20, height: 16, stroke: '#666' },
                Endpoint: "Rectangle",
                Anchors: ["TopCenter", "TopCenter"],
                ConnectionOverlays: [
                    ["Custom", {
                        create: function (component) {
                            return $('<img style="display:block;" src="/icons/delete-16.png"/>');
                        },
                        location: 0.5,
                        cssClass: 'delete-connection'
                    }]
                ],
                Container: chartContainer
            });
        }

        // suspend drawing and initialise.
        instance.batch(function () {

            instance.bind("click", function (component, originalEvent) {
                var deleteClicked=false;
                for(var i=0; i<originalEvent.path.length; i++) {
                    if(originalEvent.path[i].nodeName == 'IMG') {
                        deleteClicked=true;
                        instance.deleteConnection(component);
                        _self.saveConnections();
                    }
                }
                if(deleteClicked) {
                } else {
                    _self.showFileDetails(component.target.getAttribute("id"));
                }
            });
            _self.instance = instance;
            //_self.instace.deleteEveryConnection();

            if(Object.keys(nodes).length <= 0) {
                console.log('nodes empty');
                _self.state.files.forEach(function (item) {
                    _self.addAllEndpointsTonodes(item.id);
                })
            } else {
                _self.loadConnections();
            }

            /*$('.window').dblclick(function() {
              _self.showFileDetails($( this ).attr("id"));             
            });*/
            // make .window divs draggable

            instance.draggable($('.window').not('.jtk-draggable'));

             $(window).resize(function(){
                console.log('resizing...');
                  instance.repaintEverything();
              });
             $(window).scroll(function(){
                console.log('scrolling...');
                  instance.repaintEverything();
              });
        });
    });
}

  addEndPointsToNodes(endpointId, anchor) {
    var _self=this;
    if(anchor) {
        // configure some drop options for use by all endpoints.
        var exampleDropOptions = {
            tolerance: "touch",
            hoverClass: "dropHover",
            activeClass: "dragActive"
        };
        var color2 = "#316b31";
        var exampleEndpoint2 = {
            endpoint: ["Dot", { radius: 8 }],
            paintStyle: { fill: color2 },
            isSource: true,
            scope: "green",
            connectorStyle: { stroke: color2, strokeWidth: 6 },
            connector: ["Bezier", { curviness: 63 } ],
            maxConnections: 5,
            isTarget: true,
            dropOptions: exampleDropOptions
        };
        return _self.instance.addEndpoint(endpointId, { anchor: anchor }, exampleEndpoint2);
    }

  }

  loadConnections = () => {
    var _self=this;
    //_self.instance.removeAllEndpoints();
    var nodes = this.state.nodes;
    nodes.connections.forEach(function(connection) {
        //instance.addEndpoint("flowchart" + toId, targetEndpoint, { anchor: targetAnchors[j], uuid: targetUUID });
        var sourceEndPoint = _self.addEndPointsToNodes(connection.sourceid, connection.sourceEndPointType);
        var targetEndPoint = _self.addEndPointsToNodes(connection.targetid, connection.targetEndPointType);
        var connectionObj = _self.instance.connect({
            source: sourceEndPoint,
            target: targetEndPoint,
            paintStyle: { stroke: "#316b31", strokeWidth: 6 },
            deleteEndpointsOnDetach:false
        });
    })
    var styles = this.state.nodes.styles;
    var windows = document.querySelectorAll('.window');
    windows.forEach(function (window) {
        var styleObj = styles.filter(obj => { return obj.node_id==window.getAttribute("id")})
        if(styleObj && styleObj[0]) {
            window.setAttribute("style", styleObj[0].style);
        }
        _self.addAllEndpointsTonodes(window.getAttribute("id"));
    });

}

saveConnections = () => {
    var _self=this;
    var connectionsToSave=[];
    if(_self.instance != undefined) {
        var connections = _self.instance.getConnections('*');
        connections.forEach(function(connection) {
            if(connection.endpoints != null) {
                var sourceEndpoint = connection.endpoints.filter(endpoint => endpoint.anchor.elementId == connection.sourceId);
                var targetEndpoint = connection.endpoints.filter(endpoint => endpoint.anchor.elementId == connection.targetId);
                var connToPersist = {
                    "sourceid": connection.sourceId,
                    "targetid":connection.targetId,
                    "sourceEndPointType": sourceEndpoint[0].anchor.type,
                    "targetEndPointType": targetEndpoint[0].anchor.type
                }
                connectionsToSave.push(connToPersist);
            }
        });
        var nodes = document.querySelectorAll('.window');
        var nodeStyles=[];
        nodes.forEach(function(node) {
            nodeStyles.push({"node_id" : node.getAttribute("id"), "style" : node.getAttribute("style")})
        });
        var savedObject = {
            "application_id": this.state.applicationId,
            "connections": connectionsToSave,
            "styles": nodeStyles
        }
        if(!(_.isEqual(connectionsToSave, this.state.nodes.connections)) || !(_.isEqual(_.sortBy(nodeStyles, 'node_id'), _.sortBy(this.state.nodes.styles, 'node_id')))) {
            fetch('/api/file/read/saveFileTree', {
                method: 'post',
                headers: authHeader(),
                body: JSON.stringify(savedObject)
            }).then(function(response) {
                if(response.ok) {
                  return response.json();
                }
                handleError(response);
            }).then(function(data) {
                console.log('Saved file tree..');
                //_self.fetchFiles();
            });
        }
    }
}

addAllEndpointsTonodes = (nodeId) => {
    var _self=this;
    ["TopCenter", "BottomCenter", "LeftMiddle", "RightMiddle"].forEach(function(anchor) {
        _self.addEndPointsToNodes(nodeId, anchor);
    });
}

  render() {
    const { files, relations } = this.state;
    let top=120, left=120;
    return (
      <div ref={this.setWrapperRef}>

        <div className="jtk-demo-canvas canvas-wide drag-drop-demo jtk-surface jtk-surface-nopan" id="canvas">
            {files.map((item, index) => {
                left+=120;
                if(index != 0 && (index % 5) == 0) {
                    left=240;
                    top+=100;
                }               
              return <div className="window" style={{"top":top,"left":left}}key={item.id} id={item.id}>
                <Popconfirm title="Are you sure you want to delete this File?" onConfirm={() => this.DeleteFilevalue(item.id,this.props.applicationId)} icon={<Icon type="question-circle-o" style={{ color: 'red' }} />}>
                <a href="#"><Tooltip placement="right" title={"Delete File"}><Icon type="close-circle" style={{"top":'1px',"right":'1px','position': 'absolute'}}   />
                </Tooltip></a>
                </Popconfirm>
                <div style={{"padding-top":'4px'}} onDoubleClick={() =>this.EditFile(item.id)} >{(item.title)?item.title:item.name}</div>
                </div>
               // return <div className="window" style={{"top":top,"left":left}}key={item.id} id={item.id}>{item.title}</div>
            })}
            
        </div>


        {this.state.openFileDetailsDialog ?
          <FileDetailsForm
            onRef={ref => (this.child = ref)}
            isNewFile={false}
            selectedFile={this.state.selectedFile}
            applicationId={this.props.applicationId}
            onRefresh={this.handleRefreshTree}
            onClose={this.handleClose}/> : null}
      </div>
    )
  }
}

export default JSPlumbTree;