/**
 * 管理员页面 — 用户管理（仅 ADMIN 可见）
 */
import { useEffect, useState } from "react";
import {
  Table, Button, Select, message, Popconfirm, Tag, Typography, Switch,
} from "antd";
import { CrownOutlined } from "@ant-design/icons";
import client from "../api/client";

const { Title, Text } = Typography;

const ROLE_OPTIONS = [
  { value: "ADMIN", label: "管理员" },
  { value: "REVIEWER", label: "审查者" },
  { value: "DEVELOPER", label: "开发者" },
];

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "gold",
  REVIEWER: "blue",
  DEVELOPER: "default",
};

export default function Admin() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await client.get("/auth/users");
      setUsers(res.data);
    } catch {
      message.error("加载用户列表失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleRoleChange = async (userId: number, newRole: string) => {
    try {
      await client.put(`/auth/users/${userId}/role`, { role: newRole });
      message.success("角色已更新");
      fetchUsers();
    } catch (err: any) {
      message.error(err?.response?.data?.detail || "更新失败");
    }
  };

  const handleToggleActive = async (userId: number) => {
    try {
      await client.put(`/auth/users/${userId}/toggle-active`);
      message.success("状态已切换");
      fetchUsers();
    } catch (err: any) {
      message.error(err?.response?.data?.detail || "操作失败");
    }
  };

  const columns = [
    { title: "ID", dataIndex: "id", width: 60 },
    { title: "用户名", dataIndex: "username" },
    { title: "邮箱", dataIndex: "email" },
    {
      title: "角色",
      dataIndex: "role",
      width: 160,
      render: (role: string, record: any) => (
        <Select
          value={role}
          size="small"
          style={{ width: 120 }}
          options={ROLE_OPTIONS}
          onChange={(val) => handleRoleChange(record.id, val)}
        />
      ),
    },
    {
      title: "状态",
      dataIndex: "is_active",
      width: 80,
      render: (active: boolean, record: any) => (
        <Popconfirm
          title={`确定${active ? "禁用" : "启用"}该用户？`}
          onConfirm={() => handleToggleActive(record.id)}
        >
          <Switch checked={active} checkedChildren="启" unCheckedChildren="禁" />
        </Popconfirm>
      ),
    },
    {
      title: "注册时间",
      dataIndex: "created_at",
      width: 110,
      render: (v: string) => new Date(v).toLocaleDateString("zh-CN"),
    },
  ];

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto" }}>
      <Title level={4}>
        <CrownOutlined style={{ marginRight: 8, color: "#faad14" }} />
        用户管理
        <Text type="secondary" style={{ fontSize: 14, marginLeft: 12, fontWeight: 400 }}>
          仅管理员可访问
        </Text>
      </Title>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={users}
        loading={loading}
        pagination={false}
        locale={{ emptyText: "暂无用户数据" }}
      />
    </div>
  );
}
