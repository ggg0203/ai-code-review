<template>
  <view class="container">
    <view class="logo-area" @click="goBack">
      <text class="back">← 返回</text>
    </view>
    <view class="form-area">
      <input v-model="username" class="input" placeholder="用户名" />
      <input v-model="email" class="input" placeholder="邮箱" type="text" />
      <input v-model="password" class="input" placeholder="密码" type="password" />
      <button class="btn" @click="handleRegister">注册</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { API_BASE } from '../../api/config'

const username = ref('')
const email = ref('')
const password = ref('')

const handleRegister = async () => {
  try {
    const res = await uni.request({
      url: `${API_BASE}/auth/register`,
      method: 'POST',
      data: { username: username.value, email: email.value, password: password.value },
    })
    uni.setStorageSync('access_token', res.data.access_token)
    uni.setStorageSync('username', username.value)
    uni.setStorageSync('email', email.value)
    uni.showToast({ title: '注册成功', icon: 'success' })
    setTimeout(() => { uni.reLaunch({ url: '/pages/tabs/dashboard/index' }) }, 500)
  } catch (err: any) {
    uni.showToast({ title: err?.data?.detail || '注册失败', icon: 'error' })
  }
}

const goBack = () => uni.navigateBack()
</script>

<style scoped>
.container { padding: 30px; min-height: 100vh; background: #f5f5f5; }
.logo-area { margin-bottom: 30px; }
.back { font-size: 14px; color: #1677ff; }
.form-area { background: #fff; border-radius: 12px; padding: 30px 20px; }
.input { width: 100%; height: 44px; border: 1px solid #e8e8e8; border-radius: 8px; padding: 0 15px; margin-bottom: 15px; font-size: 15px; }
.btn { width: 100%; height: 44px; background: #1677ff; color: #fff; border: none; border-radius: 8px; font-size: 16px; }
</style>
