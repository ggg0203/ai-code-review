/**
 * 项目管理页 — 支持创建、编辑、删除
 */
import { useEffect, useState } from "react";
import {
  Table, Button, Modal, Form, Input, message, Space, Popconfirm, Tag,
} from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import client from "../api/client";

export default function Projects() {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);       // 新建弹窗
  const [editOpen, setEditOpen] = useState(false); // 编辑弹窗
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();

  /** 拉取项目列表 */
  const fetchProjects = async () => {
    setLoading(true);
    try {
      const res = await client.get("/projects/");
      setProjects(res.data);
    } catch {
      message.error("加载项目列表失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProjects(); }, []);

  /** 创建项目 */
  const handleCreate = async (values: any) => {
    await client.post("/projects/", values);
    message.success("项目创建成功");
    setOpen(false);
    form.resetFields();
    fetchProjects();
  };

  /** 打开编辑弹窗并回填数据 */
  const handleEditOpen = (record: any) => {
    setEditingId(record.id);
    editForm.setFieldsValue({
      name: record.name,
      description: record.description,
      repo_url: record.repo_url,
      language: record.language,
    });
    setEditOpen(true);
  };

  /** 提交编辑 */
  const handleEdit = async (values: any) => {
    if (editingId === null) return;
    await client.put(`/projects/${editingId}`, values);
    message.success("项目更新成功");
    setEditOpen(false);
    editForm.resetFields();
    setEditingId(null);
    fetchProjects();
  };

  /** 删除项目 */
  const handleDelete = async (id: number) => {
    await client.delete(`/projects/${id}`);
    message.success("项目已删除");
    fetchProjects();
  };

  // ---- 表格列定义 ----
  const columns = [
    { title: "ID", dataIndex: "id", width: 60 },
    { title: "项目名", dataIndex: "name", ellipsis: true },
    { title: "描述", dataIndex: "description", ellipsis: true,
      render: (v: string | null) => v || "-" },
    {
      title: "语言",
      dataIndex: "language",
      width: 90,
      render: (v: string | null) => v ? <Tag>{v}</Tag> : "-",
    },
    {
      title: "状态",
      dataIndex: "status",
      width: 80,
      render: (v: string) => {
        const colors: Record<string, string> = {
          active: "green", archived: "orange", deleted: "red",
        };
        return <Tag color={colors[v] || "default"}>{v}</Tag>;
      },
    },
    {
      title: "创建时间",
      dataIndex: "created_at",
      width: 110,
      render: (v: string) => new Date(v).toLocaleDateString("zh-CN"),
    },
    {
      title: "操作",
      width: 140,
      render: (_: any, record: any) => (
        <Space>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEditOpen(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定删除这个项目？"
            description="删除后项目及其关联的审查记录将被标记为删除状态"
            onConfirm={() => handleDelete(record.id)}
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      {/* ---- 顶部操作栏 ---- */}
      <div style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>
          新建项目
        </Button>
      </div>

      {/* ---- 项目列表 ---- */}
      <Table
        rowKey="id"
        columns={columns}
        dataSource={projects}
        loading={loading}
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          showTotal: (t) => `共 ${t} 个项目`,
        }}
        locale={{ emptyText: "暂无项目，点击「新建项目」开始" }}
      />

      {/* ---- 新建项目弹窗 ---- */}
      <Modal
        title="新建项目"
        open={open}
        onOk={() => form.submit()}
        onCancel={() => { setOpen(false); form.resetFields(); }}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="name" label="项目名" rules={[{ required: true, message: "请输入项目名" }]}>
            <Input placeholder="例如：AI Code Review Platform" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} placeholder="简要描述项目用途..." />
          </Form.Item>
          <Form.Item name="repo_url" label="仓库地址">
            <Input placeholder="https://github.com/user/repo" />
          </Form.Item>
          <Form.Item name="language" label="主要语言">
            <Input placeholder="例如：Python" />
          </Form.Item>
        </Form>
      </Modal>

      {/* ---- 编辑项目弹窗 ---- */}
      <Modal
        title="编辑项目"
        open={editOpen}
        onOk={() => editForm.submit()}
        onCancel={() => { setEditOpen(false); editForm.resetFields(); setEditingId(null); }}
      >
        <Form form={editForm} layout="vertical" onFinish={handleEdit}>
          <Form.Item name="name" label="项目名" rules={[{ required: true, message: "请输入项目名" }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="repo_url" label="仓库地址">
            <Input />
          </Form.Item>
          <Form.Item name="language" label="主要语言">
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
