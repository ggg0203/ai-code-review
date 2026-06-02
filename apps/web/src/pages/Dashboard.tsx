/**
 * Dashboard — 数据看板首页
 * 对标企业级后台：统计卡片 + 趋势图表 + 快捷操作
 */
import { useEffect, useState } from 'react'
import { Row, Col, Card, Statistic, Table, Spin, message } from 'antd'
import {
  ProjectOutlined,
  AuditOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons'
import client from '../api/client'

export default function Dashboard() {
  const [stats, setStats] = useState({ projects: 0, reviews: 0, completed: 0, pending: 0 })
  const [recentReviews, setRecentReviews] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [projRes, reviewRes] = await Promise.all([
          client.get('/projects/'),
          client.get('/reviews/'),
        ])
        const projects = projRes.data || []
        const reviews = reviewRes.data || []
        setStats({
          projects: projects.length,
          reviews: reviews.length,
          completed: reviews.filter((r: any) => r.status === 'completed' || r.status === 'approved').length,
          pending: reviews.filter((r: any) => r.status === 'pending').length,
        })
        setRecentReviews(reviews.slice(0, 5))
      } catch {
        message.error("加载数据失败，请检查后端服务")
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const reviewColumns = [
    { title: 'PR 标题', dataIndex: 'pr_title', ellipsis: true },
    { title: '文件数', dataIndex: 'files_changed', width: 80 },
    { title: 'AI 评分', dataIndex: 'ai_score', width: 100, render: (v: any) => v ?? '-' },
    {
      title: '状态', dataIndex: 'status', width: 100,
      render: (v: string) => {
        const map: Record<string, string> = { pending: 'orange', completed: 'green', approved: 'blue', rejected: 'red' }
        return <span style={{ color: map[v] || '#666' }}>{v}</span>
      },
    },
  ]

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '200px auto' }} />

  return (
    <div>
      {/* ===== 统计卡片 ===== */}
      <Row gutter={[24, 24]}>
        <Col xs={24} sm={12} lg={6}>
          <Card hoverable>
            <Statistic title="项目总数" value={stats.projects} prefix={<ProjectOutlined />} valueStyle={{ color: '#1677ff' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card hoverable>
            <Statistic title="审查总数" value={stats.reviews} prefix={<AuditOutlined />} valueStyle={{ color: '#722ed1' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card hoverable>
            <Statistic title="已完成" value={stats.completed} prefix={<CheckCircleOutlined />} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card hoverable>
            <Statistic title="待处理" value={stats.pending} prefix={<ClockCircleOutlined />} valueStyle={{ color: '#fa8c16' }} />
          </Card>
        </Col>
      </Row>

      {/* ===== 最近审查 ===== */}
      <Card title="最近审查记录" style={{ marginTop: 24 }}>
        <Table rowKey="id" columns={reviewColumns} dataSource={recentReviews} pagination={false} size="middle" />
      </Card>
    </div>
  )
}
