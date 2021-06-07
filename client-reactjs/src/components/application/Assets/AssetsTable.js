import React, { useState, useEffect } from "react";
import { Table, message, Popconfirm, Tooltip, Divider } from "antd/lib";
import { authHeader, handleError } from "../../common/AuthHeader.js";
import FileDetailsForm from "../FileDetails";
import MoveAssetsDialog from "./MoveAssetsDialog";
import { hasEditPermission } from "../../common/AuthUtil.js";
import useFileDetailsForm from "../../../hooks/useFileDetailsForm";
import {
  handleFileDelete,
  handleJobDelete,
  handleIndexDelete,
  handleQueryDelete,
  updateGraph,
} from "../../common/WorkflowUtil";
import { useSelector, useDispatch } from "react-redux";
import { Constants } from "../../common/Constants";
import { assetsActions } from "../../../redux/actions/Assets";
import { useHistory } from "react-router";
import useModal from "../../../hooks/useModal";
import {
  DeleteOutlined,
  EditOutlined,
  QuestionCircleOutlined,
  FolderOpenOutlined,
} from "@ant-design/icons";
import { store } from "../../../redux/store/Store";
import { viewOnly } from "../../../redux/actions/ViewOnly";
import MarkdownView from "react-showdown";
import showdown from "showdown";

function AssetsTable({ selectedGroup, handleEditGroup, refreshGroups }) {
  const [assets, setAssets] = useState([]);
  const { isShowing, toggle, OpenDetailsForm } = useFileDetailsForm();
  const authReducer = useSelector((state) => state.authenticationReducer);
  const applicationReducer = useSelector((state) => state.applicationReducer);
  const assetReducer = useSelector((state) => state.assetReducer);
  const history = useHistory();
  const applicationId = applicationReducer.application
    ? applicationReducer.application.applicationId
    : "";
  const { showMoveDialog = isShowing, toggleMoveDialog = toggle } = useModal();
  const { assetTypeFilter, keywords } = assetReducer.searchParams;
  let assetId = "",
    assetType = "";
  const [assetToMove, setAssetToMove] = useState({
    id: "",
    type: "",
    title: "",
    selectedGroup: {},
  });
  const groupsMoveReducer = useSelector((state) => state.groupsMoveReducer);

  useEffect(() => {
    if (
      (applicationId && selectedGroup && selectedGroup.groupId != "") || //a group has been selected
      assetTypeFilter != "" ||
      keywords != "" //a search triggered
    ) {
      fetchDataAndRenderTable();
    }
  }, [applicationId, selectedGroup, assetTypeFilter, keywords]);

  const dispatch = useDispatch();

  // Rerender table when Directory tree structure is changed
  useEffect(() => {
    fetchDataAndRenderTable();
  }, [groupsMoveReducer]);

  const fetchDataAndRenderTable = () => {
    let url =
      keywords != ""
        ? "/api/groups/assetsSearch?app_id=" + applicationId + ""
        : "/api/groups/assets?app_id=" + applicationId;
    if (selectedGroup && selectedGroup.id) {
      url += "&group_id=" + selectedGroup.id;
    }
    if (assetTypeFilter != "") {
      url += "&assetTypeFilter=" + assetTypeFilter;
    }
    if (keywords != "") {
      url += "&keywords=" + keywords;
    }
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
        //Converting Markdown to plain text
        const converter = new showdown.Converter();
        data.map((item) =>
          item.description
            ? (item.description = converter
                .makeHtml(item.description)
                .replace(/<[^>]*>/g, ""))
            : ""
        );
        setAssets(data);
      })
      .catch((error) => {
        console.log(error);
      });
  };

  //When edit icon is clicked
  const handleEdit = (id, type, action) => {
    if (action === "edit") {
      store.dispatch({
        type: Constants.ENABLE_EDIT,
        payload: true,
      });
    }

    dispatch(assetsActions.assetSelected(id, applicationId, ""));

    switch (type) {
      case "File":
        history.push("/" + applicationId + "/assets/file/" + id);
        break;
      case "Job":
        history.push("/" + applicationId + "/assets/job/" + id);
        break;
      case "Index":
        history.push("/" + applicationId + "/assets/index/" + id);
        break;
      case "Query":
        history.push("/" + applicationId + "/assets/query/" + id);
        break;
      case "Group":
        handleEditGroup(id);
        break;
      default:
        break;
    }
  };

  const handleClose = () => {
    //toggle();
  };

  const handleMoveAsset = (assetId, assetType, assetTitle) => {
    setAssetToMove({
      id: assetId,
      type: assetType,
      title: assetTitle,
      selectedGroup: selectedGroup,
    });
    toggleMoveDialog();
  };

  const handleDelete = (id, type) => {
    let deleteUrl = "",
      data = {},
      method = "post";
    message.config({ top: 130 });
    switch (type) {
      case "File":
        data = JSON.stringify({ fileId: id, application_id: applicationId });
        deleteUrl = "/api/file/read/delete";
        break;
      case "Index":
        data = JSON.stringify({ indexId: id, application_id: applicationId });
        deleteUrl = "/api/index/read/delete";
        break;
      case "Job":
        data = JSON.stringify({ jobId: id, application_id: applicationId });
        deleteUrl = "/api/job/delete";
        break;
      case "Query":
        data = JSON.stringify({ queryId: id, application_id: applicationId });
        deleteUrl = "/api/query/delete";
        break;
      case "Group":
        data = JSON.stringify({ group_id: id, app_id: applicationId });
        deleteUrl = "/api/groups";
        method = "delete";
        break;
    }
    fetch(deleteUrl, {
      method: method,
      headers: authHeader(),
      body: data,
    })
      .then((response) => {
        if (response.ok) {
          return response.json();
        }
        handleError(response);
      })
      .then((result) => {
        fetchDataAndRenderTable();
        if (type == "Group") {
          refreshGroups();
        }
        message.success(type + " deleted sucessfully");
      })
      .catch((error) => {
        console.log(error);
        message.error("There was an error deleting the " + type);
      });
  };

  const handleGroupClick = (groupId) => {
    dispatch(assetsActions.assetInGroupSelected(groupId));
  };

  const editingAllowed = hasEditPermission(authReducer.user);

  const generateAssetIcon = (type) => {
    let icon = "";
    switch (type) {
      case "File":
        icon = <i className="fa fa-file"></i>;
        break;
      case "Index":
        icon = <i className="fa fa-indent"></i>;
        break;
      case "Query":
        icon = <i className="fa fa-search"></i>;
        break;
      case "Job":
        icon = <i className="fa fa-clock-o"></i>;
        break;
      case "Group":
        icon = <i className="fa fa-folder-o"></i>;
        break;
    }
    return <React.Fragment>{icon}</React.Fragment>;
  };

  const columns = [
    {
      title: "Name",
      dataIndex: "name",
      width: "30%",
      ellipsis: {
        showTitle: false,
      },
      render: (text, record) => (
        <React.Fragment>
          <Tooltip placement="topLeft" title={record.name}>
            <span className="asset-name">
              {generateAssetIcon(record.type)}
              <a
                href="#"
                onClick={(row) => handleEdit(record.id, record.type, "view")}
              >
                {text}
              </a>
            </span>
            {keywords && keywords.length > 0 ? (
              <span className={"group-name"}>
                In Group:{" "}
                <a href="#" onClick={(row) => handleGroupClick(record.groupId)}>
                  {record.group_name ? record.group_name : "Groups"}
                </a>
              </span>
            ) : null}
          </Tooltip>
        </React.Fragment>
      ),
    },
    {
      title: "Description",
      dataIndex: "description",
      width: "25%",
      ellipsis: true,
      render: (text, record) => {
        return text ? text.split("\n")[0] : "";
      },
    },
    {
      title: "Type",
      dataIndex: "type",
      width: "10%",
    },
    {
      title: "Created",
      dataIndex: "createdAt",
      width: "20%",
      render: (text, record) => {
        let createdAt = new Date(text);
        return (
          createdAt.toLocaleDateString("en-US", Constants.DATE_FORMAT_OPTIONS) +
          " @ " +
          createdAt.toLocaleTimeString("en-US")
        );
      },
    },
    {
      width: "10%",
      title: "Action",
      dataJob: "",
      className: editingAllowed ? "show-column" : "hide-column",
      render: (text, record) => (
        <span>
          <a
            href="#"
            onClick={(row) => handleEdit(record.id, record.type, "edit")}
          >
            <Tooltip placement="right" title={"Edit"}>
              <EditOutlined />
            </Tooltip>
          </a>
          <Divider type="vertical" />
          <Popconfirm
            title="Deleting an asset will delete their metadata and make them unusable in workflows. Are you sure you want to delete this?"
            onConfirm={() => handleDelete(record.id, record.type)}
            icon={<QuestionCircleOutlined />}
          >
            <a href="#">
              <Tooltip placement="right" title={"Delete"}>
                <DeleteOutlined />
              </Tooltip>
            </a>
          </Popconfirm>
          <Divider type="vertical" />
          <a
            href="#"
            onClick={(row) =>
              handleMoveAsset(
                record.id,
                record.type,
                record.name,
                selectedGroup
              )
            }
          >
            <Tooltip placement="right" title={"Move"}>
              <FolderOpenOutlined />
            </Tooltip>
          </a>
        </span>
      ),
    },
  ];

  return (
    <React.Fragment>
      <Table
        columns={columns}
        rowKey={(record) => record.id}
        dataSource={assets}
        pagination={{ pageSize: 20 }}
        scroll={{ y: "70vh" }}
      />
      {showMoveDialog ? (
        <MoveAssetsDialog
          isShowing={showMoveDialog}
          toggle={toggleMoveDialog}
          application={applicationReducer.application}
          assetToMove={assetToMove}
          reloadTable={fetchDataAndRenderTable}
          refreshGroups={refreshGroups}
        />
      ) : null}
    </React.Fragment>
  );
}

function areEqual(prevProps, nextProps) {
  if (prevProps.selectedGroup != nextProps.selectedGroup) {
    return false;
  } else {
    return true;
  }
}
export default React.memo(AssetsTable, areEqual);
