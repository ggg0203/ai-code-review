<template>
  <view class="container">
    <!-- 头部 -->
    <view class="header">
      <view class="header-bg" />
      <view class="avatar-box">
        <text class="avatar-text">{{ avatar }}</text>
      </view>
      <text class="username">{{ username }}</text>
      <text class="email">{{ email || '未设置邮箱' }}</text>
    </view>

    <!-- 菜单 -->
    <view class="menu-section">
      <text class="section-label">帐号</text>
      <view class="menu-card">
        <view class="menu-item">
          <text class="menu-icon">👤</text>
          <text class="menu-text">个人信息</text>
          <text class="menu-arrow">›</text>
        </view>
        <view class="menu-item">
          <text class="menu-icon">🔐</text>
          <text class="menu-text">修改密码</text>
          <text class="menu-arrow">›</text>
        </view>
      </view>

      <text class="section-label" style="margin-top: 20px">通用</text>
      <view class="menu-card">
        <view class="menu-item">
          <text class="menu-icon">🌙</text>
          <text class="menu-text">深色模式</text>
          <text class="menu-hint">即将开放</text>
        </view>
        <view class="menu-item">
          <text class="menu-icon">🌐</text>
          <text class="menu-text">语言</text>
          <text class="menu-hint">简体中文</text>
        </view>
        <view class="menu-item">
          <text class="menu-icon">ℹ️</text>
          <text class="menu-text">关于</text>
          <text class="menu-hint">v1.0.0</text>
        </view>
      </view>

      <text class="section-label" style="margin-top: 20px">数据</text>
      <view class="menu-card">
        <view class="menu-item">
          <text class="menu-icon">🗑</text>
          <text class="menu-text">清除缓存</text>
          <text class="menu-arrow">›</text>
        </view>
      </view>
    </view>

    <!-- 退出按钮 -->
    <button class="logout-btn" @click="logout">退出登录</button>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

const username = ref('用户')
const email = ref('')
const avatar = ref('用')

onMounted(() => {
  username.value = uni.getStorageSync('username') || '用户'
  email.value = uni.getStorageSync('email') || ''
  avatar.value = username.value[0]
})

const logout = () => {
  uni.removeStorageSync('access_token')
  uni.removeStorageSync('username')
  uni.removeStorageSync('email')
  uni.reLaunch({ url: '/pages/index/index' })
}
</script>

<style scoped>
.container { background: #f5f6fa; min-height: 100vh; }
.header {
  background: linear-gradient(135deg, #1677ff 0%, #6941c6 100%);
  padding: 40px 20px 36px;
  text-align: center;
  position: relative;
  overflow: hidden;
}
.header-bg {
  position: absolute; top: -60%; left: -20%; width: 140%; height: 200%;
  background: radial-gradient(circle at 30% 50%, rgba(255,255,255,0.1), transparent 50%);
}
.avatar-box {
  width: 72px; height: 72px; border-radius: 50%; background: rgba(255,255,255,0.2);
  border: 3px solid rgba(255,255,255,0.4);
  margin: 0 auto 12px;
  display: flex; align-items: center; justify-content: center;
  position: relative; z-index: 1;
}
.avatar-text { font-size: 28px; color: #fff; font-weight: 700; }
.username { font-size: 20px; font-weight: 700; color: #fff; display: block; position: relative; z-index: 1; }
.email { font-size: 13px; color: rgba(255,255,255,0.7); display: block; margin-top: 6px; position: relative; z-index: 1; }

.menu-section { padding: 20px 16px; }
.section-label { font-size: 13px; color: #999; font-weight: 500; margin-bottom: 10px; display: block; padding-left: 4px; }
.menu-card { background: #fff; border-radius: 14px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.04); }
.menu-item {
  display: flex; align-items: center; padding: 16px;
  border-bottom: 1px solid #f5f5f5;
}
.menu-item:last-child { border-bottom: none; }
.menu-icon { font-size: 18px; margin-right: 12px; }
.menu-text { font-size: 15px; color: #333; flex: 1; }
.menu-arrow { font-size: 18px; color: #ccc; }
.menu-hint { font-size: 13px; color: #aaa; }

.logout-btn {
  margin: 30px 16px; padding: 14px; border-radius: 14px; border: none;
  background: #fff; color: #ff4d4f; font-size: 16px; font-weight: 500;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
}
</style>
