/**
 * RAG 知识库管理页
 *
 * 两大功能：
 * 1. 添加知识 — 粘贴代码/文档到向量知识库，支持语义搜索
 * 2. 智能问答 — 基于知识库的 AI 问答（向量检索 + LLM 生成）
 */
import { useState, useRef, useEffect } from "react";
import {
  Card, Tabs, Form, Input, Button, message, Typography, Spin, Space, Tag, Empty, Segmented,
} from "antd";
import {
  PlusOutlined, SearchOutlined, DatabaseOutlined, QuestionCircleOutlined,
} from "@ant-design/icons";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import client from "../api/client";
import { MARKDOWN_COMPONENTS } from "@ui/Markdown";

const { TextArea } = Input;
const { Text, Title } = Typography;

// ---- 主组件 ----

export default function RAGPage() {
  const [adding, setAdding] = useState(false);
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState("");
  const [ragMode, setRagMode] = useState<"normal" | "agent">("normal");
  const [addForm] = Form.useForm();
  const [askForm] = Form.useForm();

  /** 添加知识到向量库 */
  const handleAdd = async (values: { code: string; project_name: string }) => {
    setAdding(true);
    try {
      await client.post("/rag/add", {
        text: values.code,
        project_name: values.project_name || "",
      });
      message.success("已添加到知识库，可通过智能问答搜索");
      addForm.resetFields();
    } catch {
      message.error("添加失败，请检查 Qdrant 服务是否运行");
    } finally {
      setAdding(false);
    }
  };

  /** RAG 智能问答（普通/Agent 模式） */
  const handleAsk = async (values: { question: string }) => {
    setAsking(true);
    setAnswer("");
    try {
      const endpoint = ragMode === "agent" ? "/rag/agent" : "/rag/ask";
      const timeout = ragMode === "agent" ? 60000 : 15000;
      const res = await client.post(endpoint, { question: values.question, top_k: 3 }, { timeout });
      setAnswer(res.data.answer);
    } catch (err: any) {
      message.error(err?.message === "canceled" ? "请求超时，Agent 分析时间较长请重试" : "问答失败，请检查 AI 服务");
    } finally {
      setAsking(false);
    }
  };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <Title level={4}>
        <DatabaseOutlined style={{ marginRight: 8 }} />
        RAG 知识库管理
      </Title>
      <Text type="secondary" style={{ display: "block", marginBottom: 24 }}>
        利用向量嵌入（text-embedding-v2, 1536 维）+ Qdrant 向量数据库实现语义搜索，
        结合 deepseek-v4-pro 大模型提供基于知识库的智能问答。
      </Text>

      <Tabs
        defaultActiveKey="ask"
        items={[
          // ---- Tab 1: 智能问答 ----
          {
            key: "ask",
            label: (
              <span><QuestionCircleOutlined /> 智能问答</span>
            ),
            children: (
              <Card>
                <Segmented
                  value={ragMode}
                  onChange={(v) => setRagMode(v as "normal" | "agent")}
                  options={[
                    { value: "normal", label: "普通问答" },
                    { value: "agent", label: "🔍 ReAct Agent" },
                  ]}
                  style={{ marginBottom: 16 }}
                  block
                />
                <Form form={askForm} layout="vertical" onFinish={handleAsk}>
                  <Form.Item
                    name="question"
                    label="输入问题"
                    rules={[{ required: true, message: "请输入问题" }]}
                  >
                    <TextArea
                      rows={3}
                      placeholder="例如：SQL 注入的最佳防御方式是什么？项目中哪些地方存在安全隐患？"
                    />
                  </Form.Item>
                  <Button
                    type="primary"
                    htmlType="submit"
                    icon={<SearchOutlined />}
                    loading={asking}
                    size="large"
                  >
                    {asking ? "搜索知识库中..." : "搜索知识库"}
                  </Button>
                </Form>

                {/* 回答区域 */}
                <div style={{ marginTop: 24 }}>
                  {asking && (
                    <div style={{ textAlign: "center", padding: 40 }}>
                      <Spin tip="正在搜索知识库并生成回答..." />
                    </div>
                  )}
                  {!asking && answer && (
                    <div className="stream-markdown-body" style={{
                      background: "#fefefe", padding: "16px 20px",
                      borderRadius: 8, border: "1px solid #e8e8e8",
                    }}>
                      <div style={{ marginBottom: 12 }}>
                        <Tag color="blue">AI 回答</Tag>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          基于知识库中相似代码片段的语义检索结果生成
                        </Text>
                      </div>
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={MARKDOWN_COMPONENTS}
                      >
                        {answer}
                      </ReactMarkdown>
                    </div>
                  )}
                  {!asking && !answer && (
                    <Empty description="输入问题后搜索知识库，AI 将基于相关代码片段给出回答" />
                  )}
                </div>
              </Card>
            ),
          },

          // ---- Tab 2: 添加知识 ----
          {
            key: "add",
            label: (
              <span><PlusOutlined /> 添加知识</span>
            ),
            children: (
              <Card>
                <Form form={addForm} layout="vertical" onFinish={handleAdd}>
                  <Form.Item
                    name="code"
                    label="代码 / 文档内容"
                    rules={[{ required: true, message: "请输入要入库的代码或文档" }]}
                  >
                    <TextArea
                      rows={8}
                      placeholder="粘贴要存入知识库的代码、文档、最佳实践等内容..."
                      style={{ fontFamily: '"Fira Code", Consolas, monospace', fontSize: 13 }}
                    />
                  </Form.Item>
                  <Form.Item name="project_name" label="所属项目（可选）">
                    <Input placeholder="例如：AI Code Review Platform" />
                  </Form.Item>
                  <Button
                    type="primary"
                    htmlType="submit"
                    icon={<PlusOutlined />}
                    loading={adding}
                    size="large"
                  >
                    {adding ? "向量化并入库中..." : "添加到知识库"}
                  </Button>
                  <Text type="secondary" style={{ display: "block", marginTop: 8, fontSize: 12 }}>
                    文本将被转为 1536 维向量存入 Qdrant 数据库，支持语义相似度搜索
                  </Text>
                </Form>
              </Card>
            ),
          },
        ]}
      />
    </div>
  );
}
