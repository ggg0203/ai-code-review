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

      <!-- GitHub OAuth 登录 -->
      <view class="divider">
        <view class="divider-line" />
        <text class="divider-text">第三方登录</text>
        <view class="divider-line" />
      </view>
      <button class="btn btn-github" @click="handleGithubLogin">
        GitHub 登录
      </button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { API_BASE } from '../../api/config'

const email = ref('')
const password = ref('')

// 检测 GitHub OAuth 回调（URL 中带有 access_token 参数）
onMounted(() => {
  // #ifdef H5
  const hash = window.location.hash  // 格式: #/?access_token=xxx&refresh_token=yyy
  const qi = hash.indexOf('?')
  if (qi !== -1) {
    const params = new URLSearchParams(hash.slice(qi + 1))
    const at = params.get('access_token')
    const rt = params.get('refresh_token')
    if (at && rt) {
      uni.setStorageSync('access_token', at)
      uni.setStorageSync('refresh_token', rt)
      uni.showToast({ title: 'GitHub 登录成功', icon: 'success' })
      setTimeout(() => {
        uni.reLaunch({ url: '/pages/tabs/dashboard/index' })
      }, 500)
      return
    }
  }
  // #endif
})

const handleGithubLogin = () => {
  // #ifdef H5
  const myUrl = window.location.origin
  window.location.href = `${API_BASE}/auth/github/login?source=mobile&mobile_redirect=${encodeURIComponent(myUrl)}`
  // #endif
}

const handleLogin = async () => {
  try {
    const res: any = await uni.request({
      url: `${API_BASE}/auth/login`,
      method: 'POST',
      data: { email: email.value, password: password.value },
    })
    uni.setStorageSync('access_token', (res.data as any).access_token)
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
  box-sizing: border-box;
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
  line-height: 44px;
}
.btn-secondary {
  background: #fff;
  color: #1677ff;
  border: 1px solid #1677ff;
}
.btn-github {
  background: #24292e;
  color: #fff;
  border: none;
}
.divider {
  display: flex;
  align-items: center;
  margin: 20px 0 10px;
}
.divider-line {
  flex: 1;
  height: 1px;
  background: #e8e8e8;
}
.divider-text {
  padding: 0 12px;
  font-size: 13px;
  color: #999;
}
</style>
