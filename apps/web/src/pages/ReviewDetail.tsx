/**
 * 审查详情页 — 查看 AI 审查结果 + 重新分析
 *
 * 功能：
 * 1. 审查基本信息卡片（标题/项目/分支/状态/评分）
 * 2. 代码片段展示（只读，语法高亮）
 * 3. AI 审查结果（Markdown 实时渲染，同 StreamReview 的视觉增强效果）
 * 4. 重新分析按钮（SSE 流式更新，结果自动保存）
 */
import { useEffect, useState, useRef, useCallback } from "react";
import {
  Card, Button, Tag, Descriptions, Space, Typography, message, Spin,
  Divider, Result, Row, Col,
} from "antd";
import {
  ArrowLeftOutlined, ThunderboltOutlined, ReloadOutlined,
  CheckCircleOutlined, ClockCircleOutlined,
} from "@ant-design/icons";
import { useParams, useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import client from "../api/client";
import { useStreamStore } from "../stores/stream";

const { Text, Title, Paragraph } = Typography;

// 状态标签配置（同 Reviews.tsx）
const statusConfig: Record<string, { color: string; label: string }> = {
  pending:   { color: "default", label: "待审查" },
  reviewing: { color: "processing", label: "分析中" },
  completed: { color: "success", label: "已完成" },
  approved:  { color: "green", label: "已通过" },
  rejected:  { color: "error", label: "已拒绝" },
};

// ---- Markdown 自定义渲染组件（与 StreamReview.tsx 保持一致） ----

function CodeBlock({ className, children, ...props }: any) {
  const language = className ? className.replace("language-", "") : "";
  return (
    <div style={{ margin: "12px 0", borderRadius: 8, overflow: "hidden", border: "1px solid #e8e8e8" }}>
      {language && (
        <div style={{
          padding: "4px 16px", fontSize: 12, color: "#888",
          background: "#fafafa", borderBottom: "1px solid #e8e8e8",
          fontFamily: "monospace",
        }}>
          {language}
        </div>
      )}
      <pre style={{
        margin: 0, padding: "16px", overflow: "auto",
        background: "#1e1e1e", color: "#d4d4d4",
        fontFamily: '"Fira Code", "Cascadia Code", Consolas, monospace',
        fontSize: 13, lineHeight: 1.7,
        whiteSpace: "pre-wrap", wordBreak: "break-word",
      }}>
        <code className={className} {...props}>{children}</code>
      </pre>
    </div>
  );
}

function InlineCode({ children, ...props }: any) {
  return (
    <code {...props} style={{
      background: "#f5f2f0", color: "#c7254e",
      padding: "2px 6px", borderRadius: 4,
      fontFamily: '"Fira Code", Consolas, monospace', fontSize: "0.9em",
    }}>
      {children}
    </code>
  );
}

function HeadingRenderer({ level, children, ...props }: any) {
  const sizes: Record<number, { fontSize: number; color: string; border?: boolean }> = {
    1: { fontSize: 24, color: "#1a1a2e" },
    2: { fontSize: 20, color: "#16213e" },
    3: { fontSize: 17, color: "#0f3460" },
    4: { fontSize: 15, color: "#333" },
  };
  const style = sizes[level] || sizes[4];
  const Tag = `h${level}` as keyof JSX.IntrinsicElements;
  return (
    <Tag {...props} style={{
      fontSize: style.fontSize, fontWeight: 700, color: style.color,
      marginTop: level <= 2 ? 24 : 16, marginBottom: 8,
      paddingBottom: level <= 2 ? 8 : 0,
      borderBottom: level <= 2 ? "2px solid #e8e8e8" : "none",
      lineHeight: 1.4,
    }}>
      {children}
    </Tag>
  );
}

function BlockquoteRenderer({ children, ...props }: any) {
  return (
    <blockquote {...props} style={{
      margin: "12px 0", padding: "8px 16px",
      borderLeft: "4px solid #1890ff", background: "#e6f7ff",
      borderRadius: "0 6px 6px 0", color: "#333",
    }}>
      {children}
    </blockquote>
  );
}

function TableRenderer({ children, ...props }: any) {
  return (
    <div style={{ overflowX: "auto", margin: "12px 0" }}>
      <table {...props} style={{
        width: "100%", borderCollapse: "collapse", fontSize: 14,
        borderRadius: 8, overflow: "hidden", border: "1px solid #e8e8e8",
      }}>
        {children}
      </table>
    </div>
  );
}

function TheadRenderer({ children, ...props }: any) {
  return <thead {...props} style={{ background: "#fafafa" }}>{children}</thead>;
}

function ThRenderer({ children, ...props }: any) {
  return (
    <th {...props} style={{
      padding: "10px 16px", textAlign: "left", fontWeight: 600,
      borderBottom: "1px solid #e8e8e8", color: "#555", fontSize: 13,
    }}>
      {children}
    </th>
  );
}

function TdRenderer({ children, ...props }: any) {
  return (
    <td {...props} style={{
      padding: "10px 16px", borderBottom: "1px solid #f0f0f0",
      fontSize: 14, verticalAlign: "top",
    }}>
      {children}
    </td>
  );
}

// ---- 主组件 ----

export default function ReviewDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const resultRef = useRef<HTMLDivElement>(null);

  const [review, setReview] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { detailResult: streamResult, streaming: analyzing, setDetailResult, setStreaming } = useStreamStore();

  /** 加载审查详情 */
  const fetchReview = useCallback(async () => {
    if (!id) return;
    try {
      const res = await client.get(`/reviews/${id}`);
      setReview(res.data);
    } catch {
      message.error("加载审查详情失败");
      navigate("/reviews");
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => { fetchReview(); }, [fetchReview]);

  // 自动滚动
  useEffect(() => {
    if (resultRef.current) {
      resultRef.current.scrollTop = resultRef.current.scrollHeight;
    }
  }, [streamResult]);

  /** 触发 AI 重新分析（SSE 流式） */
  const handleReanalyze = async () => {
    if (!id || !review?.code_snippet) {
      message.warning("该审查记录未包含代码片段");
      return;
    }

    setStreaming(true);
    setDetailResult(() => "");

    try {
      const token = localStorage.getItem("access_token");
      const response = await fetch(`/api/reviews/${id}/analyze`, {
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
          message.error("无权限：仅审查者和管理员可触发 AI 分析。当前角色权限不足。");
        } else {
          message.error(errMsg);
        }
        setStreaming(false);
        return;
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) return;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        const lines = text.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") {
              message.success("AI 分析完成，结果已保存");
              await fetchReview(); // 重新加载完整数据
              setDetailResult(() => "");
              setStreaming(false);
              return;
            }
            if (data.startsWith("[ERROR]")) {
              message.error(`分析失败：${data.slice(8)}`);
              setStreaming(false);
              return;
            }
            try {
              setDetailResult(prev => prev + JSON.parse(data));
            } catch {
              setDetailResult(prev => prev + data);
            }
          }
        }
      }
      // 正常结束
      message.success("AI 分析完成，结果已保存");
      await fetchReview();
    } catch {
      message.error("网络错误，请重试");
    } finally {
      setDetailResult(() => "");
      setStreaming(false);
    }
  };

  // ---- 加载中 ----
  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: 80 }}>
        <Spin size="large" tip="加载审查详情..." />
      </div>
    );
  }

  // ---- 未找到 ----
  if (!review) {
    return (
      <Result
        status="404"
        title="审查记录未找到"
        extra={<Button type="primary" onClick={() => navigate("/reviews")}>返回列表</Button>}
      />
    );
  }

  const statusCfg = statusConfig[review.status] || { color: "default", label: review.status };
  const displayResult = analyzing ? streamResult : review.ai_result;

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      {/* ---- 顶部导航 ---- */}
      <Button
        type="text"
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate("/reviews")}
        style={{ marginBottom: 16, paddingLeft: 0 }}
      >
        返回审查列表
      </Button>

      {/* ---- 基本信息卡片 ---- */}
      <Card style={{ marginBottom: 24 }}>
        <Row justify="space-between" align="middle">
          <Col>
            <Title level={4} style={{ margin: 0 }}>{review.pr_title}</Title>
            <Space style={{ marginTop: 8 }}>
              <Tag color={statusCfg.color}>{statusCfg.label}</Tag>
              {review.ai_score !== null && (
                <Text strong style={{
                  fontSize: 16,
                  color: review.ai_score >= 80 ? "#52c41a" : review.ai_score >= 60 ? "#faad14" : "#ff4d4f",
                }}>
                  评分：{review.ai_score}/100
                </Text>
              )}
            </Space>
          </Col>
          <Col>
            <Button
              type="primary"
              icon={<ReloadOutlined />}
              onClick={handleReanalyze}
              loading={analyzing}
              disabled={!review.code_snippet}
            >
              {analyzing ? "AI 分析中..." : "重新分析"}
            </Button>
          </Col>
        </Row>

        <Divider style={{ margin: "16px 0" }} />

        <Descriptions size="small" column={3}>
          <Descriptions.Item label="PR 编号">{review.pr_number ?? "-"}</Descriptions.Item>
          <Descriptions.Item label="分支">{review.branch ?? "-"}</Descriptions.Item>
          <Descriptions.Item label="修改文件数">{review.files_changed ?? "-"}</Descriptions.Item>
          <Descriptions.Item label="项目 ID">{review.project_id}</Descriptions.Item>
          <Descriptions.Item label="创建时间">
            {new Date(review.created_at).toLocaleString("zh-CN")}
          </Descriptions.Item>
          <Descriptions.Item label="更新时间">
            {new Date(review.updated_at).toLocaleString("zh-CN")}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* ---- 代码片段 ---- */}
      {review.code_snippet && (
        <Card title="代码片段" style={{ marginBottom: 24 }} styles={{ body: { padding: 0 } }}>
          <pre style={{
            margin: 0, padding: "16px 24px", overflow: "auto", maxHeight: 300,
            background: "#1e1e1e", color: "#d4d4d4",
            fontFamily: '"Fira Code", Consolas, monospace',
            fontSize: 13, lineHeight: 1.7, whiteSpace: "pre-wrap",
          }}>
            {review.code_snippet}
          </pre>
        </Card>
      )}

      {/* ---- AI 审查结果 ---- */}
      <Card
        title={
          <Space>
            <span>AI 审查结果</span>
            {analyzing && <Tag color="processing">实时分析中...</Tag>}
            {!analyzing && review.status === "completed" && (
              <Tag icon={<CheckCircleOutlined />} color="success">分析完成</Tag>
            )}
          </Space>
        }
        styles={{ body: { padding: 0 } }}
      >
        <div
          ref={resultRef}
          style={{
            maxHeight: "70vh", overflow: "auto",
            padding: "16px 24px", background: "#fefefe",
          }}
        >
          {displayResult ? (
            <div className="stream-markdown-body">
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
                  h1: HeadingRenderer, h2: HeadingRenderer,
                  h3: HeadingRenderer, h4: HeadingRenderer,
                  blockquote: BlockquoteRenderer,
                  table: TableRenderer,
                  thead: TheadRenderer,
                  th: ThRenderer,
                  td: TdRenderer,
                  hr: () => <Divider style={{ margin: "20px 0" }} />,
                }}
              >
                {displayResult}
              </ReactMarkdown>
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: 60 }}>
              {review.code_snippet ? (
                <>
                  <ClockCircleOutlined style={{ fontSize: 48, color: "#d9d9d9" }} />
                  <p style={{ marginTop: 16, color: "#999" }}>
                    尚未进行 AI 分析，点击「重新分析」按钮开始
                  </p>
                </>
              ) : (
                <>
                  <ThunderboltOutlined style={{ fontSize: 48, color: "#d9d9d9" }} />
                  <p style={{ marginTop: 16, color: "#999" }}>
                    该审查记录未包含代码片段，请返回编辑
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
