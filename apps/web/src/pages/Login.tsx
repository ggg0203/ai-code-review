/**
 * 登录页面 — 邮箱密码 + GitHub OAuth 单点登录
 */
import { useState, useEffect } from "react";
import { Form, Input, Button, Card, message } from "antd";
import { UserOutlined, LockOutlined, GithubOutlined } from "@ant-design/icons";
import { useAuthStore } from "../stores/auth";
import { Divider } from 'antd'
import { Link, useSearchParams } from 'react-router-dom'

export default function Login() {
  const [loading, setLoading] = useState(false);
  const { fetchUser } = useAuthStore();
  const [searchParams] = useSearchParams();

  // 处理 GitHub OAuth 回调：从 URL 取 token 自动登录
  useEffect(() => {
    const accessToken = searchParams.get('access_token')
    const refreshToken = searchParams.get('refresh_token')
    if (accessToken && refreshToken) {
      localStorage.setItem('access_token', accessToken)
      localStorage.setItem('refresh_token', refreshToken)
      window.location.href = '/projects'
    }
  }, [searchParams])

  const handleGithubLogin = () => {
    window.location.href = 'http://localhost:8000/auth/github/login?source=web'
  }

  const onFinish = async (values: { email: string; password: string }) => {
    setLoading(true);
    try {
      const { login } = useAuthStore.getState();
      await login(values.email, values.password);
      await fetchUser();
      message.success("登录成功，即将跳转");
      setTimeout(() => { window.location.href = "/" }, 500);
    } catch (err: any) {
      console.error('登录错误:', err);
      const detail = err?.response?.data?.detail || err?.message || '登录失败';
      message.error(detail);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
        background: "#f0f2f5",
      }}
    >
      <Card title="AI Code Review Platform" style={{ width: 400 }}>
        <Form onFinish={onFinish} size="large">
          <Form.Item
            name="email"
            rules={[{ required: true, message: "请输入邮箱" }]}
          >
            <Input prefix={<UserOutlined />} placeholder="邮箱" />
          </Form.Item>
          <Form.Item
            name="password"
            rules={[{ required: true, message: "请输入密码" }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="密码" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>
              登录
            </Button>
          </Form.Item>
        </Form>

        <Divider plain style={{ fontSize: 13, color: "#999" }}>
          第三方登录
        </Divider>

        <Button
          block
          size="large"
          icon={<GithubOutlined />}
          onClick={handleGithubLogin}
          style={{
            background: '#24292e',
            color: '#fff',
            border: 'none',
            height: 44,
          }}
        >
          GitHub 登录
        </Button>

        <Divider plain style={{ fontSize: 13, color: "#999" }}>
          没有账号?
        </Divider>
        <Link to="/register">
          <Button block type="link">
            注册新账号
          </Button>
        </Link>
      </Card>
    </div>
  );
}
