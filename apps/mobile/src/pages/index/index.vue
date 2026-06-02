<template>
  <view class="container">
    <!-- Logo 区 -->
    <view class="logo-area">
      <text class="logo-icon">🔍</text>
      <text class="logo-title">AI Code Review</text>
      <text class="logo-desc">智能代码审查与项目管理</text>
    </view>

    <!-- 登录表单 -->
    <view class="form-area">
      <input
        v-model="email"
        class="input"
        placeholder="邮箱"
        type="text"
      />
      <input
        v-model="password"
        class="input"
        placeholder="密码"
        type="password"
      />
      <button class="btn" @click="handleLogin">登录</button>
      <button class="btn btn-secondary" @click="handleRegister">注册</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { API_BASE } from '../../api/config'

const email = ref('')
const password = ref('')

const handleLogin = async () => {
  try {
    const res = await uni.request({
      url: `${API_BASE}/auth/login`,
      method: 'POST',
      data: { email: email.value, password: password.value },
    })
    uni.setStorageSync('access_token', res.data.access_token)
    uni.setStorageSync('email', email.value)
    uni.showToast({ title: '登录成功', icon: 'success' })
    setTimeout(() => {
      uni.reLaunch({ url: '/pages/tabs/dashboard/index' })
    }, 500)
  } catch (err: any) {
    uni.showToast({ title: err?.data?.detail || '登录失败', icon: 'error' })
  }
}

const handleRegister = () => {
  uni.navigateTo({ url: '/pages/register/index' })
}
</script>

<style>
.container {
  padding: 40px 30px;
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.logo-area {
  text-align: center;
  margin-bottom: 40px;
}
.logo-icon {
  font-size: 60px;
}
.logo-title {
  display: block;
  font-size: 24px;
  color: #fff;
  font-weight: bold;
  margin-top: 10px;
}
.logo-desc {
  display: block;
  font-size: 14px;
  color: rgba(255,255,255,0.7);
  margin-top: 5px;
}
.form-area {
  width: 100%;
  background: #fff;
  border-radius: 12px;
  padding: 30px 20px;
}
.input {
  width: 100%;
  height: 44px;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  padding: 0 15px;
  margin-bottom: 15px;
  font-size: 15px;
}
.btn {
  width: 100%;
  height: 44px;
  background: #1677ff;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  margin-top: 10px;
}
.btn-secondary {
  background: #fff;
  color: #1677ff;
  border: 1px solid #1677ff;
}
</style>
