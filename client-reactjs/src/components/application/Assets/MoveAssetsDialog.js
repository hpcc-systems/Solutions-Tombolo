import React, { useState, useEffect } from "react";
import { authHeader, handleError } from "../../common/AuthHeader.js";
import { Modal, Button, Tree, message } from "antd/lib";
import { useSelector, useDispatch } from "react-redux";
import { moveGroup } from "../../../redux/actions/GroupsMove";
import { store } from "../../../redux/store/Store";
import { Constants } from "../../common/Constants";

const { TreeNode, DirectoryTree } = Tree;
const { confirm } = Modal;

function MoveAssetsDialog({
  isShowing,
  toggle,
  application,
  assetToMove,
  reloadTable,
  refreshGroups,
}) {
  const [moveDestinationGroup, setMoveDestinationGroup] = useState({
    id: "",
    key: "",
  });
  const [expandedGroups, setExpandedGroups] = useState([]);
  const [treeData, setTreeData] = useState([]);
  const dispatch = useDispatch();

  useEffect(() => {
    if (application && application.applicationId) {
      fetchGroups();
    }
  }, [application]);

  const fetchGroups = () => {
    let url = "/api/groups?app_id=" + application.applicationId;
    fetch(url, {
      headers: authHeader(),
    })
      .then((response) => {
        if (response.ok) {
          return response.json();
        }
        handleError(response);
      })
      .then((data) => {
        setTreeData(data);
        setMoveDestinationGroup({ id: data[0].id, key: data[0].key });
        setExpandedGroups(["0-0"]);
      })
      .catch((error) => {
        console.log(error);
      });
  };

  const onSelect = (keys, event) => {
    setMoveDestinationGroup({
      id: event.node.props.id,
      key: event.node.props.eventKey,
      title: event.node.props.title,
    });
  };

  const onExpand = (expandedKeys) => {
    setExpandedGroups(expandedKeys);
  };

  const handleClose = () => {
    toggle();
  };

  const handleMove = () => {
    message.config({ top: 130 });
    if (assetToMove.id == moveDestinationGroup.id) {
      message.error(
        '"' +
          assetToMove.title +
          '" is already in "' +
          moveDestinationGroup.title +
          '" group. Please select a different group to move it.'
      );
      return;
    }
    console.log("<<<< Move function executed");
    confirm({
      title:
        'Are you sure you want to move "' +
        assetToMove.title +
        '" to "' +
        moveDestinationGroup.title +
        '" group?',
      okText: "Yes",
      okType: "danger",
      cancelText: "No",
      onOk() {
        console.log(
          " >>>> Asset to Move id ",
          assetToMove.id,
          "Destination Group",
          moveDestinationGroup.id
        );
        fetch("/api/groups/move/asset", {
          method: "put",
          headers: authHeader(),
          body: JSON.stringify({
            groupId: assetToMove.id,
            destGroupId: moveDestinationGroup.id,
            app_id: application.applicationId,
            assetType: assetToMove.type,
            assetId: assetToMove.id,
          }),
        })
          .then(function (response) {
            console.log("<<<< Response from back ", response);
            if (response.ok) {
              console.log("Response is okay <<<<");
              return response.json();
            }
            handleError(response);
          })
          .then(function (data) {
            message.success(
              '"' +
                assetToMove.title +
                '" has been moved to "' +
                moveDestinationGroup.title +
                '" group.'
            );
            reloadTable();
            store.dispatch({
              type: Constants.MOVE_GROUP,
              payload: assetToMove.id,
            });
            toggle();
            refreshGroups();
          })
          .catch((error) => {
            console.log("Error :-", error);
          });
      },
      onCancel() {},
    });
  };

  return (
    <React.Fragment>
      <div>
        <Modal
          title="Select Group to Move"
          visible={isShowing}
          width={520}
          footer={[
            <Button key="close" onClick={handleClose}>
              Close
            </Button>,
            <Button key="move" type="primary" onClick={handleMove}>
              Move
            </Button>,
          ]}
        >
          <DirectoryTree
            onSelect={onSelect}
            onExpand={onExpand}
            treeData={treeData}
            selectedKeys={[moveDestinationGroup.key]}
            expandedKeys={expandedGroups}
            defaultExpandAll={true}
          />
        </Modal>
      </div>
    </React.Fragment>
  );
}

export default MoveAssetsDialog;
