import React, { useEffect, useState } from "react";
import { Layout, Typography, Input, Space, Button, Modal, message } from "antd";
import {
  StockOutlined,
  SearchOutlined,
  FileExcelOutlined,
  FilePdfOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import LayoutNew from "../Layout";
import { DataGrid } from "@mui/x-data-grid";
import axios from "axios";
import { formatDate } from "../Common/date";
import jsPDF from "jspdf";
import "jspdf-autotable";
import { exportToPDF } from "../Common/report";
const { Title } = Typography;
const { Content } = Layout;

const OrdersPage = () => {
  const token = localStorage.getItem("authToken");
  const [data, setData] = useState([]);
  const [filteredData, setFilteredData] = useState([]); // State to hold filtered data
  const [searchQuery, setSearchQuery] = useState("");

  const columns = [
    { field: "orderId", headerName: "Order ID", width: 150 },
    {
      field: "user",
      headerName: "Customer",
      width: 150,
      renderCell: (params) => (
        params.value ? params.value.firstName : "N/A"
      ),
    },
    
    {
      field: "items",
      headerName: "Items",
      width: 300,
      renderCell: (params) => (
        <div>
          {params.value.map((item, index) => (
            <div key={index}>
              <span>
                {item.name} ({item.quantity})
              </span>
            </div>
          ))}
        </div>
      ),
    },
    { field: "totalPrice", headerName: "Total Price", width: 150 },
    { field: "deliveryAddress", headerName: "Delivery Address", width: 150 },
    {
      field: "status",
      headerName: "Order Status",
      width: 200,
      renderCell: (params) => {
        let statusColor = "";
        switch (params.value) {
          case "Pending":
            statusColor = "orange";
            break;
          case "Confirmed":
            statusColor = "green";
            break;
          case "Delivered":
            statusColor = "brown";
            break;
          case "Cancelled":
            statusColor = "red";
            break;
          default:
            statusColor = "black";
        }
        return <span style={{ color: statusColor }}>{params.value}</span>;
      },
    },
    {
      field: "createdAt",
      headerName: "Created At",
      width: 200,
      renderCell: (params) => {
        return formatDate(params.value);
      },
    },
    {
      field: "action",
      headerName: "Action",
      width: 150,
      renderCell: (params) => (
        <div>
         
            <>
              <Button
                onClick={() => confirmOrder(params.row.id)}
                icon={<CheckCircleOutlined style={{ color: "green" }} />}
              />
              <Button
                onClick={() => cancelOrder(params.row.id)}
                icon={<CloseCircleOutlined style={{ color: "brown" }} />}
              />
              <Button
                onClick={() => confirmDelete(params.row.id)}
                icon={<DeleteOutlined style={{ color: "red" }} />}
              />
            </>
          
        </div>
      ),
    },
  ];

  const fetchOrders = async () => {
    try {
      const response = await axios.get(
        `${process.env.REACT_APP_BACKEND_BASE_URL}/orders`
      );
      setData(response.data.data);
    } catch (error) {
      console.error("Error fetching orders:", error);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const transformedRows = filteredData.map((row, index) => ({
    id: row._id, // or any other property that can uniquely identify the row
    ...row,
  }));

  const generatePDF = () => {
    const columnsToExport = columns.filter(
      (col) => col.field !== "action" && col.field !== "imageUrls"
    );
    const prepareDataForReport = (data) => {
      return data.map((order) => {
        const rowData = {};
        const customerName = `${ order.user ? order.user.firstName : "N/A"} ${order.user ? order.user.lastName : "N/A"}`;

        const items = order.items?.map(
          (item, index) => `${item.name} (${item.quantity})`
        );

        columnsToExport.forEach((col) => {
          if (col.field === "createdAt") {
            rowData[col.field] = formatDate(order[col.field]);
          } else if (col.field === "user") {
            rowData[col.field] = customerName;
          } else if (col.field === "items") {
            rowData[col.field] = items;
          } else {
            rowData[col.field] = order[col.field];
          }
        });
        return rowData;
      });
    };

    const reportData = prepareDataForReport(filteredData);
    exportToPDF(columnsToExport, reportData, {
      title: "Orders Report",
    });
  };

  const filterData = () => {
    const filtered = data.filter((row) => {
      const orderAttributesMatch = Object.values(row).some((value) => {
        if (value === null) {
          return false; // Skip null values
        }
        return value.toString().toLowerCase().includes(searchQuery.toLowerCase());
      });
  
      const itemMatch = row.items.some((item) => {
        if (item.name === null || item.quantity === null) {
          return false; // Skip null values
        }
        return (
          item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.quantity.toString().toLowerCase().includes(searchQuery.toLowerCase())
        );
      });
  
      return orderAttributesMatch || itemMatch;
    });
    setFilteredData(filtered);
  };
  

  const handleSearchInputChange = (e) => {
    setSearchQuery(e.target.value);
  };
  useEffect(() => {
    filterData();
  }, [searchQuery, data]);

  const confirmOrder = (id) => {
    Modal.confirm({
      title: "Confirm Order",
      content: "Are you sure you want to confirm this Order?",
      okText: "Yes",
      cancelText: "No",
      onOk: () => handleConfirm(id),
    });
  };

  const cancelOrder = (id) => {
    Modal.confirm({
      title: "Cancel Order",
      content: "Are you sure you want to cancel this Order?",
      okText: "Yes",
      cancelText: "No",
      onOk: () => handleCancel(id),
    });
  };

  const confirmDelete = (id) => {
    Modal.confirm({
      title: "Confirm Delete",
      content: "Are you sure you want to delete this Order?",
      okText: "Yes",
      cancelText: "No",
      onOk: () => deleteItem(id),
    });
  };

  const handleConfirm = async (id) => {
    const orderData = {
      status: "Confirmed",
    };
    const response = await axios.put(
      `${process.env.REACT_APP_BACKEND_BASE_URL}/orders/${id}`,
      orderData,
      {
        headers: {
          Authorization: token,
        },
      }
    );
    if (response.data.success) {
      message.success("Order confirmed successfully");
      fetchOrders();
    }
  };

  const handleCancel = async (id) => {
    const orderData = {
      status: "Cancelled",
    };
    const response = await axios.put(
      `${process.env.REACT_APP_BACKEND_BASE_URL}/orders/${id}`,
      orderData,
      {
        headers: {
          Authorization: token,
        },
      }
    );
    if (response.data.success) {
      message.success("Order cancelled successfully");
      fetchOrders();
    }
  };
  const deleteItem = async (id) => {
    const response = await axios.delete(
      `${process.env.REACT_APP_BACKEND_BASE_URL}/orders/${id}`,
      {
        headers: {
          Authorization: token,
        },
      }
    );
    if (response.data.success) {
      message.success("Order deleted successfully");
      fetchOrders();
    }
  };

  const [loggedInUserType, setLoggedInUserType] = useState("");

  useEffect(() => {
    const userType = localStorage.getItem("loggedInUserType");
    if (userType) {
      setLoggedInUserType(userType);
    }
  }, []);
  return (
    <LayoutNew userType={loggedInUserType}>
      <Layout>
        <Content style={{ padding: "24px" }}>
          <Space
            style={{
              background: "#001529",
              color: "white",
              padding: "12px",
              borderRadius: "8px",
              justifyContent: "space-between",
              display: "flex",
            }}
          >
            <Space>
              <StockOutlined style={{ fontSize: "24px", marginRight: "8px" }} />
              <Title
                level={2}
                style={{ fontSize: "24px", marginTop: "8px", color: "white" }}
              >
                Orders
              </Title>
            </Space>
            <Space>
              <Button
                type="primary"
                icon={<FilePdfOutlined />}
                onClick={generatePDF}
              >
                Export to PDF
              </Button>
            </Space>
          </Space>
          <br />
          <br />
          <div
            style={{
              marginBottom: "16px",
              display: "flex",
              alignItems: "center",
            }}
          >
            {/* Search input */}
            <Input
              placeholder="Search..."
              prefix={<SearchOutlined />}
              onChange={handleSearchInputChange}
              style={{ marginRight: "8px" }}
            />

            {/* Empty space to push buttons to the right */}
            <div style={{ flex: 1 }}></div>
          </div>
          <DataGrid
            rows={transformedRows}
            columns={columns}
            pageSize={10}
            checkboxSelection
            disableSelectionOnClick
            autoHeight
            sortModel={[
              {
                field: "number",
                sort: "asc",
              },
            ]}
          />
        </Content>
      </Layout>
    </LayoutNew>
  );
};

export default OrdersPage;
