/**
 * 个人设置页 — 用户信息 + 修改密码
 */
import { useState } from "react";
import { Card, Form, Input, Button, message, Descriptions, Divider, Typography } from "antd";
import { LockOutlined, UserOutlined, SaveOutlined } from "@ant-design/icons";
import { useAuthStore } from "../stores/auth";
import client from "../api/client";

const { Title } = Typography;

export default function Settings() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [pwdForm] = Form.useForm();

  const handleChangePassword = async (values: { old_password: string; new_password: string }) => {
    setLoading(true);
    try {
      await client.post("/auth/change-password", {
        old_password: values.old_password,
        new_password: values.new_password,
      });
      message.success("密码修改成功，下次登录请使用新密码");
      pwdForm.resetFields();
    } catch (err: any) {
      const detail = err?.response?.data?.detail || "修改失败，请重试";
      message.error(detail);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 700, margin: "0 auto" }}>
      <Title level={4}>
        <UserOutlined style={{ marginRight: 8 }} />
        个人设置
      </Title>

      {/* ---- 用户信息展示 ---- */}
      <Card title="基本信息" style={{ marginBottom: 24 }}>
        <Descriptions column={1} size="middle">
          <Descriptions.Item label="用户名">{user?.username || "—"}</Descriptions.Item>
          <Descriptions.Item label="邮箱">{user?.email || "—"}</Descriptions.Item>
          <Descriptions.Item label="角色">
            {user?.role === "ADMIN" ? "管理员" : user?.role === "REVIEWER" ? "审查者" : "开发者"}
          </Descriptions.Item>
          <Descriptions.Item label="注册时间">
            {user?.created_at ? new Date(user.created_at).toLocaleString("zh-CN") : "—"}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* ---- 修改密码 ---- */}
      <Card
        title={<span><LockOutlined style={{ marginRight: 8 }} />修改密码</span>}
      >
        <Form
          form={pwdForm}
          layout="vertical"
          onFinish={handleChangePassword}
          style={{ maxWidth: 400 }}
        >
          <Form.Item
            name="old_password"
            label="当前密码"
            rules={[{ required: true, message: "请输入当前密码" }]}
          >
            <Input.Password placeholder="输入当前密码" />
          </Form.Item>

          <Form.Item
            name="new_password"
            label="新密码"
            rules={[
              { required: true, message: "请输入新密码" },
              { min: 6, message: "密码至少 6 位" },
            ]}
          >
            <Input.Password placeholder="输入新密码（至少 6 位）" />
          </Form.Item>

          <Form.Item
            name="confirm_password"
            label="确认新密码"
            dependencies={["new_password"]}
            rules={[
              { required: true, message: "请再次输入新密码" },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue("new_password") === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error("两次输入的密码不一致"));
                },
              }),
            ]}
          >
            <Input.Password placeholder="再次输入新密码" />
          </Form.Item>

          <Button
            type="primary"
            htmlType="submit"
            icon={<SaveOutlined />}
            loading={loading}
            size="large"
          >
            保存新密码
          </Button>
        </Form>
      </Card>
    </div>
  );
}
