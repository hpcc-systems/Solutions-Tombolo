import React, { useState, useEffect } from 'react'
import { Tree, Row, Col, Menu, Icon, Button, Modal, Form, Input } from 'antd/lib';
import BreadCrumbs from "../../common/BreadCrumbs";
import { authHeader, handleError } from "../../common/AuthHeader.js"
import { hasEditPermission } from "../../common/AuthUtil.js";
import { Constants } from '../../common/Constants';
import { useSelector, useDispatch } from "react-redux";
import { withRouter, NavLink } from 'react-router-dom';
import { assetsActions } from '../../../redux/actions/Assets';
import AssetsTable from "./AssetsTable";
import { MarkdownEditor } from "../../common/MarkdownEditor.js"

const { TreeNode, DirectoryTree } = Tree;
const { SubMenu } = Menu;
const { confirm } = Modal;

function Assets(props) {
  const [application, setApplication] = useState({...props});
  const [selectedGroup, setSelectedGroup] = useState({id:'', key:''});
  const [newGroup, setNewGroup] = useState({name:'', description:'', id: ''});
  const [newGroupForm, setNewGroupForm] = useState({submitted:false});
  const [treeData, setTreeData] = useState([]);
  const [openCreateGroupDialog, setOpenCreateGroupDialog] = useState(false);
  const [rightClickNodeTreeItem, setRightClickNodeTreeItem] = useState({
    visible: false,
    pageX: 0,
    pageY: 0,
    id: '',
    categoryName: ''
  });
  const formItemLayout = {
    labelCol: {
      xs: { span: 2 },
      sm: { span: 10 },
    },
    wrapperCol: {
      xs: { span: 4 },
      sm: { span: 24 },
    },
  };
  const splCharacters = /[ `!@#$%^&*()+\=\[\]{};':"\\|,.<>\/?~]/;
  const form = props.form;



  useEffect(() => {
    if(application.applicationId) {
      fetchGroups();
    }
    document.querySelector('.groups-div').addEventListener('contextmenu', onRightClickGroupsDiv)
  }, [application]);

  const fetchGroups = () => {
    let url = "/api/groups?app_id="+application.applicationId;
    fetch(url, {
      headers: authHeader()
    })
    .then((response) => {
      if(response.ok) {
        return response.json();
      }
      handleError(response);
    })
    .then(data => {
      setTreeData(data)
      setSelectedGroup({'id':data[0].id, 'key':data[0].key})
    }).catch(error => {
      console.log(error);
    });
  }

  const dispatch = useDispatch();

  const onSelect = (keys, event) => {
    setSelectedGroup({id:event.node.props.id, key:event.node.props.eventKey})
  };

  const onExpand = () => {
    console.log('Trigger Expand');
  };

  const onRightClick = e => {
    if(e.node) {
      setSelectedGroup({id: e.node.props.id, key:e.node.props.eventKey})
      setRightClickNodeTreeItem({
        visible: true,
        pageX: e.event.pageX,
        pageY: e.event.pageY,
        id: e.node.props["data-key"],
        categoryName: e.node.props["data-title"]
      });
    }
    document.addEventListener('click', function onClickOutside() {
      setRightClickNodeTreeItem({visible: false});
      document.removeEventListener('click', onClickOutside)
    })
  }

  const onRightClickGroupsDiv = e => {
    e.preventDefault();
    setSelectedGroup({id: '', key:''});
    setRightClickNodeTreeItem({
      visible: true,
      pageX: e.clientX,
      pageY: e.clientY,
    });
    document.addEventListener('click', function onClickOutside() {
      setRightClickNodeTreeItem({visible: false});
      document.removeEventListener('click', onClickOutside)
    })
  }

  const openNewGroupDialog = () => {
    setOpenCreateGroupDialog(true);
  }

  const closeCreateGroupDialog = () => {
   setOpenCreateGroupDialog(false);
   setNewGroup({name:'', description:''})

  }

  const handleMenuClick = (e) => {
    setRightClickNodeTreeItem({visible: false});
    dispatch(assetsActions.assetSelected(
      '',
      application.applicationId,
      ''
    ));
    switch (e.key) {
      case 'File':
        dispatch(assetsActions.newAsset(
          application.applicationId,
          selectedGroup.id
        ));
        props.history.push('/' + application.applicationId + '/file');
        break;

      case 'Index':
        break;

      case 'Query':
        break;

      case 'Job':
        break;

      case 'Group':
        openNewGroupDialog();
        break;

      case 'Edit-Group':
        handleEditGroup();
        break;

      case 'Delete-Group':
        handleDeleteGroup();
        break;
    }
  }

  const RightClickMenu = props => {
    return (rightClickNodeTreeItem.visible ?
      <React.Fragment>
      <div style={{left: `${rightClickNodeTreeItem.pageX + 40}px`, top: `${rightClickNodeTreeItem.pageY}px`}} className="self-right-menu">
        <Menu style={{ width: 150 }} mode="vertical" theme="dark" onClick={handleMenuClick}>
          <SubMenu
            key="create-new"
            title={
              <span>
                <Icon type="mail" />
                <span style={{"padding-right": "5px"}}>New</span>
              </span>
            }
          >
          {selectedGroup && selectedGroup.id != '' ?
            <Menu.ItemGroup title="Assets">
              <Menu.Item key="File"><i className="fa fa-lg fa-file"></i> File</Menu.Item>
              <Menu.Item key="Index"><i className="fa fa-lg fa-indent"></i> Index</Menu.Item>
              <Menu.Item key="Query"><i className="fa fa-lg fa-search"></i> Query</Menu.Item>
              <Menu.Item key="Job"><i className="fa fa-lg fa-clock-o"></i> Job</Menu.Item>
            </Menu.ItemGroup>
           : null}
          <Menu.ItemGroup title="Groups">
            <Menu.Item key="Group">Group</Menu.Item>
          </Menu.ItemGroup>
         </SubMenu>
         {selectedGroup && selectedGroup.id != '' ?
           <Menu.Item key="Edit-Group"><Icon type="edit" />Edit</Menu.Item> : null}
         {selectedGroup && selectedGroup.id != '' ?
           <Menu.Item key="Delete-Group"><Icon type="delete" />Delete</Menu.Item> : null}
       </Menu>
      </div>
      </React.Fragment>
     : null)
  }

  const handleCreateGroup = () => {
    setNewGroupForm({'submitted': true});

    fetch('/api/groups', {
      method: 'post',
      headers: authHeader(),
      body: JSON.stringify({
        "isNew": (newGroup.id && newGroup.id != '') ? false : true,
        "parentGroupId": selectedGroup.id,
        "name": newGroup.name,
        "applicationId": application.applicationId,
        "description": newGroup.description,
        "id": newGroup.id
      })
    }).then(function(response) {
      if(response.ok) {
        return response.json();
      }
      handleError(response);
    }).then(function(data) {
      closeCreateGroupDialog();
      fetchGroups();
    }).catch(error => {
      console.log(error);
    });
  }

  const handleDeleteGroup = () => {
    confirm({
      title: 'Are you sure you want to delete this Group?',
      okText: 'Yes',
      okType: 'danger',
      cancelText: 'No',
      onOk() {
        console.log('OK');
        fetch('/api/groups', {
          method: 'delete',
          headers: authHeader(),
          body: JSON.stringify({
            "group_id": selectedGroup.id,
            "app_id": application.applicationId
          })
        }).then(function(response) {
          if(response.ok) {
            return response.json();
          }

          handleError(response);
        }).then(function(data) {
          console.log(data);
          fetchGroups();
        }).catch(error => {
          console.log(error);
        });
      },
      onCancel() {
      },
    });
  }

  const handleEditGroup = () => {
    fetch('/api/groups/details?app_id='+application.applicationId+'&group_id='+selectedGroup.id, {
      headers: authHeader(),
    }).then(function(response) {
      if(response.ok) {
        return response.json();
      }
      handleError(response);
    }).then(function(data) {
      console.log(data)
      setNewGroup({
        'name': data.name,
        'description': data.description,
        'id': data.id
      })
    }).catch(error => {
      console.log(error);
    });
    setOpenCreateGroupDialog(true);
  }

  const handleDragEnter = (info) => {
    console.log("handleDragEnter")
  }

  const handleDragDrop = (info) => {
    console.log("handleDragDrop: "+info)
    if(info.node != undefined && info.dragNode != undefined) {
      const dropKey = info.node.props.eventKey;
      const dragKey = info.dragNode.props.eventKey;
      const dropPos = info.node.props.pos.split('-');
      console.log(info.dragNode.props.id, info.dragNode.props.title, info.node.props.id, info.node.props.title);
      fetch('/api/groups/move', {
        method: 'put',
        headers: authHeader(),
        body: JSON.stringify({
          "groupId": info.dragNode.props.id,
          "destGroupId": info.node.props.id,
          "app_id": application.applicationId
        })
      }).then(function(response) {
        if(response.ok) {
          return response.json();
        }

        handleError(response);
      }).then(function(data) {
        fetchGroups();
      }).catch(error => {
        console.log(error);
      });
    }
  }

  const authReducer = useSelector(state => state.authenticationReducer);
  const editingAllowed = hasEditPermission(authReducer.user);
  return (
      <React.Fragment>
        <div style={{paddingTop:"55px", margin: "5px"}}>
          <BreadCrumbs applicationId={application.applicationId} applicationTitle={application.applicationTitle}/>
          <Row gutter={24}>
            <Col className="gutter-row groups-div" span={3}>
              <div className="gutter-box">
                  <DirectoryTree
                    onSelect={onSelect}
                    onExpand={onExpand}
                    treeData={treeData}
                    onRightClick={onRightClick}
                    selectedKeys={[selectedGroup.key]}
                    draggable
                    onDragEnter={handleDragEnter}
                    onDrop={handleDragDrop}
                  />
              </div>
            </Col>
            <Col className="gutter-row" span={21}>
              <div className="gutter-box">
                <AssetsTable selectedGroup={selectedGroup}/>
              </div>
            </Col>
          </Row>
          <RightClickMenu/>
        </div>

        <div>
          <Modal
              title="Create Group"
              onOk={handleCreateGroup}
              onCancel={closeCreateGroupDialog}
              visible={openCreateGroupDialog}
              width={520}
            >
              <Form layout="vertical" form={form}>
                <div className={'form-group' + (newGroupForm.submitted && !newGroup.name ? ' has-error' : '')}>
                  <Form.Item {...formItemLayout} label="Name" name="name">
                    <Input id="name" name="name" onChange={e => setNewGroup({...newGroup, [e.target.name]: e.target.value})} placeholder="Name" value={newGroup.name}/>
                    {(newGroupForm.submitted && (!newGroup.name || splCharacters.test(newGroup.name))) &&
                      <div className="error">Please enter a valid Name</div>
                    }
                  </Form.Item>
                </div>
                <Form.Item {...formItemLayout} label="Description" name="description">
                  <MarkdownEditor id="desc" name="description" onChange={e => setNewGroup({...newGroup, [e.target.name]: e.target.value})} targetDomId="fileDescr" value={newGroup.description} disabled={!editingAllowed}/>
                </Form.Item>
                </Form>
            </Modal>
       </div>
     </React.Fragment>

    )
};

export default withRouter(Assets)