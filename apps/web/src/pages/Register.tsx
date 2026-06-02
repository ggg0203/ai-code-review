/**
 * 注册页面
 */
import { useState } from 'react'
import { Form, Input, Button, Card, message, Divider } from 'antd'
import { UserOutlined, MailOutlined, LockOutlined } from '@ant-design/icons'
import { Link } from 'react-router-dom'
import client from '../api/client'

export default function Register() {
  const [loading, setLoading] = useState(false)

  const onFinish = async (values: any) => {
    setLoading(true)
    try {
      const res = await client.post('/auth/register', values)
      localStorage.setItem('access_token', res.data.access_token)
      localStorage.setItem('refresh_token', res.data.refresh_token)
      message.success('注册成功，即将跳转')
      setTimeout(() => { window.location.href = '/' }, 500)
    } catch (err: any) {
      message.error(err.response?.data?.detail || '注册失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    }}>
      <Card
        title={<span style={{ fontSize: 20, fontWeight: 600 }}>AI Code Review</span>}
        style={{ width: 420, borderRadius: 12, boxShadow: '0 8px 40px rgba(0,0,0,0.12)' }}
        headStyle={{ textAlign: 'center', borderBottom: 'none', paddingTop: 24 }}
      >
        <Form onFinish={onFinish} size="large" layout="vertical">
          <Form.Item name="username" rules={[
            { required: true, message: '请输入用户名' },
            { min: 2, message: '用户名至少2个字符' },
          ]}>
            <Input prefix={<UserOutlined />} placeholder="用户名" />
          </Form.Item>

          <Form.Item name="email" rules={[
            { required: true, message: '请输入邮箱' },
            { type: 'email', message: '邮箱格式不正确' },
          ]}>
            <Input prefix={<MailOutlined />} placeholder="邮箱" />
          </Form.Item>

          <Form.Item name="password" rules={[
            { required: true, message: '请输入密码' },
            { min: 6, message: '密码至少6位' },
          ]}>
            <Input.Password prefix={<LockOutlined />} placeholder="密码" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>
              注册
            </Button>
          </Form.Item>
        </Form>

        <Divider plain style={{ fontSize: 13, color: '#999' }}>已有账号?</Divider>
        <Link to="/login">
          <Button block type="link">返回登录</Button>
        </Link>
      </Card>
    </div>
  )
}
