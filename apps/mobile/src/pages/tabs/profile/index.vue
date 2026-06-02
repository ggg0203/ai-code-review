<template>
  <view class="container">
    <view class="header">
      <view class="avatar">👤</view>
      <text class="name">{{ username }}</text>
      <text class="email">{{ email }}</text>
    </view>
    <view class="menu">
      <view class="menu-item" @click="logout">
        <text>退出登录</text>
        <text class="arrow">→</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
const username = ref('用户')
const email = ref('')

onMounted(() => {
  username.value = uni.getStorageSync('username') || '用户'
  email.value = uni.getStorageSync('email') || ''
})

const logout = () => {
  uni.removeStorageSync('access_token')
  uni.removeStorageSync('username')
  uni.reLaunch({ url: '/pages/index/index' })
}
</script>

<style scoped>
.header { background: #1677ff; padding: 40px 20px 30px; text-align: center; }
.avatar { font-size: 50px; margin-bottom: 8px; }
.name { display: block; color: #fff; font-size: 20px; font-weight: bold; }
.email { display: block; color: rgba(255,255,255,0.7); font-size: 14px; margin-top: 4px; }
.menu { margin: 16px; background: #fff; border-radius: 10px; }
.menu-item { display: flex; justify-content: space-between; padding: 16px; border-bottom: 1px solid #f0f0f0; font-size: 15px; }
.arrow { color: #ccc; }
</style>
