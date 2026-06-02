/**
 * RAG 知识库管理页
 *
 * 两大功能：
 * 1. 添加知识 — 粘贴代码/文档到向量知识库，支持语义搜索
 * 2. 智能问答 — 基于知识库的 AI 问答（向量检索 + LLM 生成）
 */
import { useState, useRef, useEffect } from "react";
import {
  Card, Tabs, Form, Input, Button, message, Typography, Spin, Space, Tag, Empty,
} from "antd";
import {
  PlusOutlined, SearchOutlined, DatabaseOutlined, QuestionCircleOutlined,
} from "@ant-design/icons";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import client from "../api/client";

const { TextArea } = Input;
const { Text, Title } = Typography;

// ---- Markdown 渲染组件（与其他页面保持一致） ----
function CodeBlock({ className, children, ...props }: any) {
  const language = className ? className.replace("language-", "") : "";
  return (
    <div style={{ margin: "12px 0", borderRadius: 8, overflow: "hidden", border: "1px solid #e8e8e8" }}>
      {language && (
        <div style={{
          padding: "4px 16px", fontSize: 12, color: "#888",
          background: "#fafafa", borderBottom: "1px solid #e8e8e8", fontFamily: "monospace",
        }}>
          {language}
        </div>
      )}
      <pre style={{
        margin: 0, padding: "16px", overflow: "auto",
        background: "#1e1e1e", color: "#d4d4d4",
        fontFamily: '"Fira Code", Consolas, monospace',
        fontSize: 13, lineHeight: 1.7, whiteSpace: "pre-wrap",
      }}>
        <code className={className} {...props}>{children}</code>
      </pre>
    </div>
  );
}

function InlineCode({ children, ...props }: any) {
  return (
    <code {...props} style={{
      background: "#f5f2f0", color: "#c7254e", padding: "2px 6px",
      borderRadius: 4, fontFamily: '"Fira Code", Consolas, monospace', fontSize: "0.9em",
    }}>
      {children}
    </code>
  );
}

// ---- 主组件 ----

export default function RAGPage() {
  const [adding, setAdding] = useState(false);
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState("");
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

  /** RAG 智能问答 */
  const handleAsk = async (values: { question: string }) => {
    setAsking(true);
    setAnswer("");
    try {
      const res = await client.post("/rag/ask", {
        question: values.question,
        top_k: 3,
      });
      setAnswer(res.data.answer);
    } catch {
      message.error("问答失败，请检查 AI 服务");
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
                        components={{
                          code({ className, children, ...props }: any) {
                            const isBlock = className?.startsWith("language-");
                            if (isBlock) {
                              return <CodeBlock className={className} {...props}>{children}</CodeBlock>;
                            }
                            return <InlineCode {...props}>{children}</InlineCode>;
                          },
                          blockquote: ({ children, ...props }: any) => (
                            <blockquote {...props} style={{
                              margin: "12px 0", padding: "8px 16px",
                              borderLeft: "4px solid #1890ff", background: "#e6f7ff",
                              borderRadius: "0 6px 6px 0",
                            }}>
                              {children}
                            </blockquote>
                          ),
                        }}
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
