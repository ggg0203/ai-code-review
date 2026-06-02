/**
 * 代码审查列表页
 * 
 * 功能：
 * 1. 审查记录列表展示（ID / PR标题 / 代码预览 / AI评分 / 状态 / 操作）
 * 2. 新建审查记录（含代码片段输入）
 * 3. 触发 AI 流式分析
 * 4. 跳转审查详情页
 */
import { useEffect, useState } from "react";
import {
  Table, Button, Modal, Form, Input, InputNumber, Select,
  message, Tag, Space, Tooltip, Typography, Popconfirm,
} from "antd";
import {
  PlusOutlined, ThunderboltOutlined, EyeOutlined,
  DeleteOutlined, CodeOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import client from "../api/client";

const { TextArea } = Input;
const { Text } = Typography;

// 状态标签配置
const statusConfig: Record<string, { color: string; label: string }> = {
  pending:   { color: "default", label: "待审查" },
  reviewing: { color: "processing", label: "分析中" },
  completed: { color: "success", label: "已完成" },
  approved:  { color: "green", label: "已通过" },
  rejected:  { color: "error", label: "已拒绝" },
};

export default function Reviews() {
  const [reviews, setReviews] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [analyzingId, setAnalyzingId] = useState<number | null>(null);
  const [form] = Form.useForm();
  const navigate = useNavigate();

  /** 拉取审查列表 + 项目列表 */
  const fetchData = async () => {
    setLoading(true);
    try {
      const [reviewRes, projRes] = await Promise.all([
        client.get("/reviews/"),
        client.get("/projects/"),
      ]);
      setReviews(reviewRes.data);
      setProjects(projRes.data);
    } catch {
      message.error("加载数据失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // 轮询：如果有正在分析的记录，每 2 秒刷新一次
  useEffect(() => {
    if (analyzingId === null) return;
    const timer = setInterval(fetchData, 2000);
    return () => clearInterval(timer);
  }, [analyzingId]);

  /** 创建审查记录 */
  const handleCreate = async (values: any) => {
    await client.post("/reviews/", values);
    message.success("审查记录创建成功");
    setOpen(false);
    form.resetFields();
    fetchData();
  };

  /** 触发 AI 分析 */
  const handleAnalyze = async (reviewId: number) => {
    setAnalyzingId(reviewId);
    try {
      const token = localStorage.getItem("access_token");
      const response = await fetch(`/api/reviews/${reviewId}/analyze`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      // ---- 先检测 HTTP 状态码（403/404 等） ----
      if (!response.ok) {
        let errMsg = `请求失败 (${response.status})`;
        try {
          const errBody = await response.text();
          if (errBody) {
            const errJson = JSON.parse(errBody);
            errMsg = errJson.detail || errMsg;
          }
        } catch {}
        if (response.status === 403) {
          message.error(`无权限：仅审查者和管理员可触发 AI 分析。当前角色权限不足。`);
        } else {
          message.error(errMsg);
        }
        fetchData();
        setAnalyzingId(null);
        return;
      }

      // ---- 读取 SSE 流直到完成 ----
      const reader = response.body?.getReader();
      if (!reader) return;
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value);
        const lines = text.split("\n");
        for (const line of lines) {
          if (line.startsWith("data: ") && line.includes("[DONE]")) {
            message.success("AI 分析完成");
            fetchData();
            setAnalyzingId(null);
            return;
          }
          if (line.startsWith("data: ") && line.includes("[ERROR]")) {
            message.error(`AI 分析失败：${line.slice(14)}`);
            fetchData();
            setAnalyzingId(null);
            return;
          }
        }
      }
      // 如果流正常结束
      message.success("AI 分析完成");
      fetchData();
    } catch {
      message.error("AI 分析失败，请检查网络");
    } finally {
      setAnalyzingId(null);
    }
  };

  /** 删除审查记录 */
  const handleDelete = async (id: number) => {
    // 软删除：更新状态为 rejected（后端只有软删除，这里用 PUT 更新状态）
    await client.put(`/reviews/${id}`, { status: "rejected" });
    message.success("已删除");
    fetchData();
  };

  // ---- 表格列定义 ----
  const columns = [
    { title: "ID", dataIndex: "id", width: 60 },
    {
      title: "PR 标题",
      dataIndex: "pr_title",
      ellipsis: true,
      render: (v: string, record: any) => (
        <Space>
          <Text strong>{v}</Text>
          {record.code_snippet && (
            <Tooltip title="已包含代码片段">
              <CodeOutlined style={{ color: "#52c41a" }} />
            </Tooltip>
          )}
        </Space>
      ),
    },
    {
      title: "项目",
      dataIndex: "project_id",
      width: 100,
      render: (v: number) => {
        const proj = projects.find((p: any) => p.id === v);
        return proj?.name || `#${v}`;
      },
    },
    {
      title: "AI 评分",
      dataIndex: "ai_score",
      width: 90,
      align: "center" as const,
      render: (v: number | null) =>
        v !== null ? (
          <Text strong style={{ color: v >= 80 ? "#52c41a" : v >= 60 ? "#faad14" : "#ff4d4f", fontSize: 15 }}>
            {v}
          </Text>
        ) : (
          <Text type="secondary">-</Text>
        ),
    },
    {
      title: "状态",
      dataIndex: "status",
      width: 90,
      render: (v: string) => {
        const cfg = statusConfig[v] || { color: "default", label: v };
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
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
      width: 200,
      render: (_: any, record: any) => (
        <Space>
          {/* AI 分析按钮 — 仅当有代码片段且非分析中 */}
          {record.code_snippet && record.status !== "reviewing" && (
            <Button
              type="primary"
              size="small"
              icon={<ThunderboltOutlined />}
              loading={analyzingId === record.id}
              onClick={() => handleAnalyze(record.id)}
            >
              AI 分析
            </Button>
          )}
          {record.status === "reviewing" && (
            <Button size="small" loading disabled>分析中</Button>
          )}
          {/* 查看详情 — 仅当有 AI 结果 */}
          {record.ai_result && (
            <Button
              size="small"
              icon={<EyeOutlined />}
              onClick={() => navigate(`/reviews/${record.id}`)}
            >
              详情
            </Button>
          )}
          {/* 删除 */}
          <Popconfirm
            title="确定删除这条审查记录？"
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
          新建审查
        </Button>
        <Text type="secondary" style={{ marginLeft: 12, fontSize: 13 }}>
          创建审查记录后可粘贴代码片段，一键触发 AI 流式分析
        </Text>
      </div>

      {/* ---- 审查列表 ---- */}
      <Table
        rowKey="id"
        columns={columns}
        dataSource={reviews}
        loading={loading}
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          showTotal: (t) => `共 ${t} 条审查记录`,
        }}
        locale={{ emptyText: "暂无审查记录，点击「新建审查」开始" }}
      />

      {/* ---- 新建审查弹窗 ---- */}
      <Modal
        title="新建审查记录"
        open={open}
        onOk={() => form.submit()}
        onCancel={() => { setOpen(false); form.resetFields(); }}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="project_id" label="所属项目" rules={[{ required: true, message: "请选择项目" }]}>
            <Select
              placeholder="选择项目"
              options={projects.map((p: any) => ({ label: p.name, value: p.id }))}
            />
          </Form.Item>
          <Form.Item name="pr_title" label="PR 标题" rules={[{ required: true, message: "请输入标题" }]}>
            <Input placeholder="例如：修复登录接口 SQL 注入漏洞" />
          </Form.Item>
          <Space style={{ width: "100%" }} size={16}>
            <Form.Item name="pr_number" label="PR 编号" style={{ flex: 1 }}>
              <InputNumber style={{ width: "100%" }} placeholder="例如：42" />
            </Form.Item>
            <Form.Item name="branch" label="分支" style={{ flex: 1 }}>
              <Input placeholder="例如：fix/sql-injection" />
            </Form.Item>
            <Form.Item name="files_changed" label="修改文件数" style={{ flex: 1 }}>
              <InputNumber style={{ width: "100%" }} placeholder="0" min={0} />
            </Form.Item>
          </Space>
          <Form.Item name="code_snippet" label="代码片段（用于 AI 分析）">
            <TextArea
              rows={5}
              placeholder="粘贴待审查的代码，后续可点击「AI 分析」触发自动审查"
              style={{ fontFamily: '"Fira Code", Consolas, monospace', fontSize: 13 }}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
