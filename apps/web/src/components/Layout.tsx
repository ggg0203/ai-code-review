/**
 * 主布局 — 侧边栏 + 内容区
 */
import { useState, useEffect } from "react";
import { Layout, Menu, Button, theme as antTheme } from "antd";
import {
  ProjectOutlined,
  AuditOutlined,
  DashboardOutlined,
  LogoutOutlined,
  SunOutlined,
  MoonOutlined,
  MenuFoldOutlined,
  ThunderboltOutlined,
  DatabaseOutlined,
  SettingOutlined,
  CrownOutlined,
  SyncOutlined,
} from "@ant-design/icons";
import { useNavigate, useLocation, Outlet } from "react-router-dom";
import { useAuthStore } from "../stores/auth";
import { useThemeStore } from "../stores/theme";

const { Header, Sider, Content } = Layout;

export default function MainLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout, fetchUser } = useAuthStore();
  const { dark, toggle } = useThemeStore();
  const navigate = useNavigate();
  const location = useLocation();

  // 用 Ant Design 的 token 获取主题颜色
  const { token } = antTheme.useToken();

  // 页面加载时自动获取用户信息（解决刷新后 user 为 null 的问题）
  useEffect(() => {
    if (!user) fetchUser();
  }, []);

  const menuItems = [
    { key: "/", icon: <DashboardOutlined />, label: "首页" },
    { key: "/projects", icon: <ProjectOutlined />, label: "项目管理" },
    { key: "/reviews", icon: <AuditOutlined />, label: "代码审查" },
    { key: "/stream-review", icon: <ThunderboltOutlined />, label: "流式审查" },
    { key: "/rag", icon: <DatabaseOutlined />, label: "知识库" },
    { key: "/settings", icon: <SettingOutlined />, label: "个人设置" },
    { key: "/cicd", icon: <SyncOutlined />, label: "CI/CD 监控" },
    ...(user?.role === "ADMIN"
      ? [{ key: "/admin", icon: <CrownOutlined />, label: "用户管理" }]
      : []),
  ];

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <Layout style={{ minHeight: "100vh" }}>
      {/* ===== 侧边栏 ===== */}
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        trigger={null}
        style={{ background: token.colorBgContainer, borderRight: `1px solid ${token.colorBorderSecondary}` }}
      >
        <div style={{
          height: 64,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: collapsed ? 16 : 20,
          fontWeight: "bold",
          color: token.colorPrimary,
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
        }}>
          {collapsed ? "CR" : "Code Review"}
        </div>
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ borderRight: 0 }}
        />
      </Sider>

      {/* ===== 右侧区域 ===== */}
      <Layout>
        {/* 顶栏 */}
        <Header style={{
          padding: "0 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: token.colorBgContainer,
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
        }}>
          {/* 左侧：收起按钮 */}
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
          />

          {/* 右侧：主题 + 用户 + 退出 */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Button
              type="text"
              icon={dark ? <SunOutlined /> : <MoonOutlined />}
              onClick={toggle}
            />
            <span>{user?.username}</span>
            <Button type="text" icon={<LogoutOutlined />} onClick={handleLogout}>
              退出
            </Button>
          </div>
        </Header>

        {/* 内容区 */}
        <Content style={{ margin: 24, padding: 24, borderRadius: token.borderRadius }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
