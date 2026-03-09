<template>
  <el-footer class="terminal-footer" v-if="isConnected">
    <div class="status-bar">
      <!-- Connection Status with Pulse LED -->
      <div class="status-item status-pill connected">
        <span class="pulse-led"></span>
        <span class="status-text">已连接</span>
      </div>

      <!-- Server Host Info -->
      <div class="status-item host-info">
        <el-icon><Monitor /></el-icon>
        <span class="host-text">{{ connectionDisplay }}</span>
      </div>

      <!-- Actions (Now placed after host info) -->
      <div class="status-actions">
        <div 
          class="action-item" 
          :class="{ active: showSftp }"
          @click="$emit('toggle-sftp')"
          title="文件管理器"
        >
          <el-icon><Folder /></el-icon>
          <span>文件管理</span>
        </div>
        <div 
          class="action-item" 
          @click="$emit('show-commands')"
          title="常用命令库"
        >
          <el-icon><Tickets /></el-icon>
          <span>常用命令</span>
        </div>
      </div>

      <!-- Spacer -->
      <div class="flex-spacer"></div>
    </div>
  </el-footer>
</template>

<script setup>
import { Connection, Monitor, Folder, Tickets } from '@element-plus/icons-vue'

defineProps({
  isConnected: {
    type: Boolean,
    default: false
  },
  connectionDisplay: {
    type: String,
    default: ''
  },
  showSftp: {
    type: Boolean,
    default: false
  }
})

defineEmits(['toggle-sftp', 'show-commands'])
</script>

<style scoped>
.terminal-footer {
  flex-shrink: 0;
  height: 24px !important;
  padding: 0 10px;
  display: flex;
  align-items: center;
  background: #007acc;
  border-top: 1px solid #005a9e;
  color: #ffffff;
  font-family: "Microsoft YaHei", "Segoe UI", sans-serif;
  font-size: 11px;
  position: relative;
  z-index: 100;
}

.status-bar {
  display: flex;
  align-items: center;
  width: 100%;
  height: 100%;
  gap: 12px;
}

.status-pill {
  display: flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 2px;
  background: transparent;
}

.status-pill.connected {
  color: #ffffff;
  font-weight: 500;
}

.pulse-led {
  width: 7px;
  height: 7px;
  background-color: #7dff7d;
  border-radius: 50%;
  margin-right: 6px;
  box-shadow: 0 0 4px rgba(125, 255, 125, 0.5);
}

.host-info {
  display: flex;
  align-items: center;
  gap: 5px;
  font-family: Consolas, "Courier New", monospace;
  color: rgba(255, 255, 255, 0.85);
}

.flex-spacer {
  flex: 1;
}

.status-actions {
  display: flex;
  gap: 8px;
}

.action-item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 2px;
  cursor: pointer;
  transition: all 0.12s;
  color: rgba(255, 255, 255, 0.75);
}

.action-item:hover {
  background: rgba(255, 255, 255, 0.15);
  color: #ffffff;
}

.action-item.active {
  background: rgba(255, 255, 255, 0.2);
  color: #ffffff;
  font-weight: 500;
}

.status-divider {
  width: 1px;
  height: 14px;
  background: rgba(255, 255, 255, 0.25);
  margin: 0 4px;
}

.action-item .el-icon {
  font-size: 12px;
}
</style>
