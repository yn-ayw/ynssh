<template>
  <div class="xshell-app" @click="closeAllMenus">
    <!-- Menu Bar -->
    <div class="xsh-menubar">
      <div
        v-for="menu in menuConfig"
        :key="menu.key"
        class="xsh-menu"
        @click.stop
      >
        <div
          class="xsh-menu-trigger"
          :class="{ active: openMenu === menu.key }"
          @click="toggleMenu(menu.key)"
          @mouseenter="onMenuHover(menu.key)"
        >{{ menu.label }}</div>
        <div v-if="openMenu === menu.key" class="xsh-menu-dropdown">
          <template v-for="(item, idx) in menu.children" :key="idx">
            <div v-if="item.type === 'divider'" class="xsh-menu-divider"></div>
            <div
              v-else
              class="xsh-menu-item"
              :class="{ disabled: item.disabled }"
              @click="executeMenuAction(item)"
            >
              <span class="xsh-menu-item-text">{{ item.label }}</span>
              <span v-if="item.shortcut" class="xsh-menu-item-key">{{ item.shortcut }}</span>
            </div>
          </template>
        </div>
      </div>
      <div class="xsh-menubar-right">
        <span class="xsh-user-info" @click.stop="handleLogout" title="退出登录">
          <el-icon><SwitchButton /></el-icon>
          {{ authStore.user?.email || '用户' }}
        </span>
      </div>
    </div>

    <!-- Toolbar -->
    <div class="xsh-toolbar">
      <div class="xsh-toolbar-btn" @click="createEmptyTab" title="新建会话">
        <el-icon><Plus /></el-icon>
      </div>
      <div class="xsh-toolbar-sep"></div>
      <div class="xsh-toolbar-btn" :class="{ disabled: !canReconnect }" @click="reconnectActive" title="重新连接">
        <el-icon><RefreshRight /></el-icon>
      </div>
      <div class="xsh-toolbar-btn" :class="{ disabled: !activeTab?.connected }" @click="disconnectActive" title="断开连接">
        <el-icon><SwitchButton /></el-icon>
      </div>
      <div class="xsh-toolbar-sep"></div>
      <div class="xsh-toolbar-btn" @click="copyActive" title="复制 (Ctrl+Ins)">
        <el-icon><DocumentCopy /></el-icon>
      </div>
      <div class="xsh-toolbar-btn" :class="{ disabled: !activeTab?.connected }" @click="pasteActive" title="粘贴 (Shift+Ins)">
        <el-icon><Document /></el-icon>
      </div>
      <div class="xsh-toolbar-sep"></div>
      <div class="xsh-toolbar-btn" @click="clearActive" title="清除屏幕">
        <el-icon><Delete /></el-icon>
      </div>
      <div class="xsh-toolbar-btn" @click="toggleFullscreen" title="全屏 (F11)">
        <el-icon><FullScreen /></el-icon>
      </div>
      <div class="xsh-toolbar-sep"></div>
      <div
        class="xsh-toolbar-btn"
        :class="{ active: fileManagerEnabled }"
        @click="toggleFileManager"
        title="文件管理 (SFTP)"
      >
        <el-icon><Folder /></el-icon>
      </div>
      <div class="xsh-toolbar-btn" @click="showCommands = true" title="常用命令库">
        <el-icon><Tickets /></el-icon>
      </div>
      <div class="xsh-toolbar-btn" :class="{ active: showSidebar }" @click="showSidebar = !showSidebar" title="会话管理器">
        <el-icon><Folder /></el-icon>
      </div>
    </div>

    <!-- Address Bar -->
    <div class="xsh-addressbar">
      <el-icon class="xsh-addr-icon"><Connection /></el-icon>
      <input
        v-model="addressInput"
        class="xsh-addr-input"
        placeholder="ssh:// 或直接输入 IP，例如 192.168.1.1:22，回车临时连接"
        @keyup.enter="handleAddressEnter"
      />
    </div>

    <!-- Tab Bar -->
    <div class="xsh-tabbar" @dblclick="createEmptyTab">
      <div class="xsh-tabbar-scroll">
        <div
          v-for="tab in tabs"
          :key="tab.id"
          class="xsh-tab"
          :class="{ active: activeTabId === tab.id }"
          @click="switchTab(tab.id)"
          @mousedown.middle.prevent="closeTab(tab.id)"
          @contextmenu.prevent="showTabContextMenu($event, tab)"
        >
          <span class="xsh-tab-dot" :class="{ green: tab.connected, yellow: tab.connecting }"></span>
          <span class="xsh-tab-title">{{ tab.title }}</span>
          <span class="xsh-tab-close" @click.stop="closeTab(tab.id)">&times;</span>
        </div>
      </div>
    </div>

    <!-- Main Body -->
    <div class="xsh-body">
      <!-- Sidebar: Session Manager -->
      <div class="xsh-sidebar" v-show="showSidebar">
        <div class="xsh-sidebar-header">
          <span class="xsh-sidebar-title">会话管理器</span>
          <span class="xsh-sidebar-close" @click="showSidebar = false">&times;</span>
        </div>
        <div class="xsh-sidebar-search">
          <input
            v-model="searchQuery"
            class="xsh-search-input"
            placeholder="搜索服务器..."
          />
        </div>
        <div class="xsh-sidebar-tree" @contextmenu.prevent="handleSidebarTreeContextMenu">
          <el-tree
            :data="serverTreeData"
            :props="treeProps"
            node-key="id"
            :default-expanded-keys="expandedKeys"
            :expand-on-click-node="false"
            :highlight-current="true"
            @node-click="handleTreeNodeClick"
            @node-dblclick="handleTreeNodeDblClick"
            @node-expand="handleNodeExpand"
            @node-collapse="handleNodeCollapse"
            @node-contextmenu="handleTreeContextMenu"
          >
            <template #default="{ data }">
              <div class="xsh-tree-node">
                <template v-if="data.type === 'group'">
                  <el-icon class="xsh-tree-icon folder"><Folder /></el-icon>
                  <span class="xsh-tree-label">{{ data.label }}</span>
                  <span class="xsh-tree-badge">{{ data.children?.length || 0 }}</span>
                </template>
                <template v-else>
                  <el-icon class="xsh-tree-icon server" :class="{ connected: getServerStatus(data.serverId) === 'connected' }">
                    <Monitor />
                  </el-icon>
                  <div class="xsh-tree-server">
                    <span class="xsh-tree-name">{{ data.label }}</span>
                    <span class="xsh-tree-addr">{{ data.host }}:{{ data.port }}</span>
                  </div>
                </template>
              </div>
            </template>
          </el-tree>
        </div>
      </div>

      <!-- Terminal Area + 右侧固定 SFTP -->
      <div class="xsh-main">
      <div class="xsh-main-center">
          <div v-if="tabs.length === 0" class="xsh-empty">
            <el-icon :size="64" color="#444"><Monitor /></el-icon>
            <h3>WebSSH Terminal</h3>
            <p>从左侧会话管理器选择服务器，或点击工具栏/标签栏空白处新建会话</p>
          </div>
          <div
            v-for="tab in tabs"
            :key="tab.id"
            class="xsh-tab-pane"
            :class="{ active: activeTabId === tab.id }"
          >
            <div class="xsh-terminal-wrap">
              <XtermTerminal
                :ref="(el) => { if (el) terminalComponentRefs[tab.id] = el }"
                :is-connected="tab.connected"
                :tab-id="tab.id"
                @data="(data) => handleTerminalData(data, tab.id)"
                @resize="(dim) => handleTerminalResize(dim, tab.id)"
                @click="focusTerminal(tab.id)"
              />
              <div v-if="tab.connecting && !tab.connected" class="xsh-conn-overlay">
                <el-icon class="is-loading" :size="20"><Loading /></el-icon>
                <span>正在连接服务器...</span>
              </div>
              <div v-if="tab.error && !tab.connected && !tab.connecting" class="xsh-conn-overlay error">
                <el-icon :size="20" color="#f56c6c"><CircleClose /></el-icon>
                <span>{{ tab.error }}</span>
              </div>
            </div>
          </div>
        </div>
        <template v-if="fileManagerEnabled">
          <div class="xsh-splitter" @mousedown="startResize"></div>
          <div class="xsh-sftp-panel" :style="{ width: sftpWidth + 'px' }">
            <div class="xsh-sftp-panel-title">文件管理 (SFTP)</div>
            <QuickSftpFileManager
              v-if="activeTab?.quickConnect && activeTab?.quickSftp?.isConnected?.value"
              :sftp="activeTab.quickSftp"
            />
            <SftpFileManager v-else-if="!activeTab?.quickConnect && sftpStore.isConnected" />
            <div v-else class="xsh-sftp-empty">
              <el-icon class="is-loading" :size="18"><Loading /></el-icon>
              <span>{{ sftpPanelMessage }}</span>
            </div>
          </div>
        </template>
      </div>
    </div>

    <!-- Status Bar -->
    <div class="xsh-statusbar">
      <div class="xsh-remark">
        <span class="xsh-remark-label">备注</span>
        <span class="xsh-remark-text">{{ activeRemark || '-' }}</span>
      </div>
      <div class="xsh-status-indicator" :class="{ connected: activeTab?.connected }">
        <span class="xsh-status-dot"></span>
        {{ activeTab?.connected ? '已连接' : (activeTab?.connecting ? '连接中' : '未连接') }}
      </div>
      <div class="xsh-status-fields">
        <div class="xsh-status-field">
          <span class="xsh-sf-label">主机</span>
          <span class="xsh-sf-value">{{ activeHost || '-' }}</span>
        </div>
        <div class="xsh-status-sep"></div>
        <div class="xsh-status-field">
          <span class="xsh-sf-label">用户名</span>
          <span class="xsh-sf-value">{{ activeUsername || '-' }}</span>
        </div>
        <div class="xsh-status-sep"></div>
        <div class="xsh-status-field">
          <span class="xsh-sf-label">协议</span>
          <span class="xsh-sf-value">SSH</span>
        </div>
        <div class="xsh-status-sep"></div>
        <div class="xsh-status-field">
          <span class="xsh-sf-label">端口</span>
          <span class="xsh-sf-value">{{ activePort || '-' }}</span>
        </div>
        <div class="xsh-status-sep"></div>
        <div class="xsh-status-field">
          <span class="xsh-sf-label">编码</span>
          <span class="xsh-sf-value">UTF-8</span>
        </div>
      </div>
    </div>

    <!-- 会话树右键菜单 -->
    <div
      v-if="treeContextMenu.visible"
      class="xsh-context-menu"
      :style="{ left: treeContextMenu.x + 'px', top: treeContextMenu.y + 'px' }"
      @mouseleave="treeContextMenu.visible = false"
    >
      <template v-if="treeContextMenu.data?.type === 'blank'">
        <div class="xsh-cm-item" @click="onTreeContextAction('createGroup')">新建分组</div>
      </template>
      <template v-else-if="treeContextMenu.data?.type === 'group'">
        <div class="xsh-cm-item" @click="onTreeContextAction('renameGroup')">重命名分组</div>
        <div class="xsh-cm-item" @click="onTreeContextAction('deleteGroup')">删除分组</div>
      </template>
      <template v-else-if="treeContextMenu.data?.type === 'server'">
        <div class="xsh-cm-item" @click="onTreeContextAction('editServer')">编辑</div>
        <div class="xsh-cm-item" @click="onTreeContextAction('deleteServer')">删除</div>
        <div class="xsh-cm-item" @click="onTreeContextAction('moveServer')">移动到...</div>
      </template>
    </div>

    <!-- 标签右键菜单 -->
    <div
      v-if="tabContextMenu.visible"
      class="xsh-context-menu"
      :style="{ left: tabContextMenu.x + 'px', top: tabContextMenu.y + 'px' }"
      @mouseleave="hideTabContextMenu"
    >
      <div class="xsh-cm-item" @click="onTabContextAction('rename')">编辑备注</div>
      <div class="xsh-cm-divider"></div>
      <div class="xsh-cm-item" @click="onTabContextAction('close')">关闭</div>
      <div class="xsh-cm-item" @click="onTabContextAction('closeOther')">关闭其他</div>
      <div class="xsh-cm-item" @click="onTabContextAction('closeAll')">关闭所有</div>
      <template v-if="tabContextMenu.tab?.connectionInfo || tabContextMenu.tab?.server">
        <div class="xsh-cm-divider"></div>
        <div class="xsh-cm-item" @click="onTabContextAction('saveToGroup')">保存到我的分组</div>
      </template>
    </div>

    <!-- 保存到分组对话框 -->
    <el-dialog v-model="saveToGroupDialog" title="保存到分组" width="400px" @close="saveToGroupTab = null">
      <el-form label-width="80px">
        <el-form-item label="名称">
          <el-input v-model="saveToGroupForm.name" placeholder="服务器名称" />
        </el-form-item>
        <el-form-item label="分组">
          <el-select v-model="saveToGroupForm.groupName" filterable allow-create placeholder="分组" style="width:100%">
            <el-option v-for="g in serversStore.groups" :key="g.name" :label="g.name" :value="g.name" />
            <el-option label="Default" value="Default" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="saveToGroupDialog = false">取消</el-button>
        <el-button type="primary" @click="confirmSaveToGroup">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="quickConnectDialog.visible" title="临时连接" width="520px" @close="resetQuickConnectDialog">
      <el-form label-width="90px">
        <el-form-item label="主机">
          <el-input :model-value="quickConnectDialog.host" readonly />
        </el-form-item>
        <el-form-item label="端口">
          <el-input :model-value="String(quickConnectDialog.port || 22)" readonly />
        </el-form-item>
        <el-form-item label="用户名">
          <el-input v-model="quickConnectDialog.username" placeholder="请输入 SSH 用户名" />
        </el-form-item>
        <el-form-item label="认证方式">
          <el-radio-group v-model="quickConnectDialog.authType">
            <el-radio label="password">密码认证</el-radio>
            <el-radio label="key">私钥认证</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="quickConnectDialog.authType === 'password'" label="密码">
          <el-input
            v-model="quickConnectDialog.password"
            type="password"
            show-password
            placeholder="请输入 SSH 密码"
          />
        </el-form-item>
        <el-form-item v-else label="私钥">
          <el-input
            v-model="quickConnectDialog.privateKey"
            type="textarea"
            :rows="8"
            placeholder="请输入 SSH 私钥内容"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="quickConnectDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="quickConnectDialog.submitting" @click="confirmQuickConnect">连接</el-button>
      </template>
    </el-dialog>

    <!-- 编辑服务器对话框（从树右键） -->
    <el-dialog v-model="showEditServerDialog" :title="'编辑 - ' + editingServerName" width="500px">
      <ServerForm
        v-if="editingServerId"
        :server-id="editingServerId"
        @success="handleServerUpdated"
        @cancel="showEditServerDialog = false"
      />
    </el-dialog>

    <CommandLibrary v-model="showCommands" @command="injectCommand" />
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useRouter } from 'vue-router'
import XtermTerminal from '@/components/XtermTerminal.vue'
import CommandLibrary from '@/components/CommandLibrary.vue'
import SftpFileManager from '@/components/SftpFileManager.vue'
import QuickSftpFileManager from '@/components/QuickSftpFileManager.vue'
import ServerForm from '@/components/ServerForm.vue'
import { useTerminalStore } from '@/stores/terminal'
import { useServersStore } from '@/stores/servers'
import { useAuthStore } from '@/stores/auth'
import { useSftpStore } from '@/stores/sftp'
import { useQuickSftp } from '@/composables/useQuickSftp'
import { io } from 'socket.io-client'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Plus, Close, Monitor, Folder, Connection,
  SuccessFilled, Loading, CircleClose, Tickets, Delete,
  RefreshRight, FullScreen, SwitchButton,
  DocumentCopy, Document, Search
} from '@element-plus/icons-vue'

const router = useRouter()
const authStore = useAuthStore()
const terminalStore = useTerminalStore()
const serversStore = useServersStore()
const sftpStore = useSftpStore()

const terminalComponentRefs = ref({})
const tabs = ref([])
const activeTabId = ref(null)
const searchQuery = ref('')
const showCommands = ref(false)
const showSidebar = ref(true)
const openMenu = ref(null)
const addressInput = ref('')
const quickConnectDialog = reactive({
  visible: false,
  submitting: false,
  host: '',
  port: 22,
  username: 'root',
  authType: 'password',
  password: '',
  privateKey: ''
})
const fileManagerEnabled = ref(false)
const sftpWidth = ref(320)
let isResizing = false
let resizeStartX = 0
let resizeStartWidth = 320

const EXPANDED_KEYS_KEY = 'xshell_expanded_keys'
const expandedKeys = ref(JSON.parse(sessionStorage.getItem(EXPANDED_KEYS_KEY) || '[]'))

const menuConfig = [
  {
    key: 'file', label: '文件(F)',
    children: [
      { label: '新建会话', action: 'newTab' },
      { type: 'divider' },
      { label: '重新连接', action: 'reconnect' },
      { label: '断开', action: 'disconnect' },
      { type: 'divider' },
      { label: '关闭标签页', action: 'closeTab', shortcut: 'Ctrl+W' },
      { label: '关闭所有标签', action: 'closeAllTabs' },
      { type: 'divider' },
      { label: '退出登录', action: 'logout' }
    ]
  },
  {
    key: 'edit', label: '编辑(E)',
    children: [
      { label: '复制', action: 'copy', shortcut: 'Ctrl+Ins' },
      { label: '粘贴', action: 'paste', shortcut: 'Shift+Ins' },
      { type: 'divider' },
      { label: '全选', action: 'selectAll', shortcut: 'Ctrl+A' },
      { type: 'divider' },
      { label: '清除屏幕', action: 'clearScreen' },
      { label: '重置终端', action: 'resetTerminal' }
    ]
  },
  {
    key: 'view', label: '查看(V)',
    children: [
      { label: '会话管理器', action: 'toggleSidebar' },
      { type: 'divider' },
      { label: '全屏', action: 'fullscreen', shortcut: 'F11' }
    ]
  },
  {
    key: 'tools', label: '工具(T)',
    children: [
      { label: '常用命令库', action: 'commandLibrary' }
    ]
  },
  {
    key: 'tabs_menu', label: '选项卡(B)',
    children: [
      { label: '关闭当前标签', action: 'closeTab' },
      { label: '关闭其他标签', action: 'closeOtherTabs' },
      { label: '关闭所有标签', action: 'closeAllTabs' }
    ]
  },
  {
    key: 'help', label: '帮助(H)',
    children: [
      { label: '关于 WebSSH', action: 'about' }
    ]
  }
]

const activeTab = computed(() => tabs.value.find(t => t.id === activeTabId.value))
const sftpPanelMessage = computed(() => {
  const tab = activeTab.value
  if (tab?.quickConnect) {
    return tab.quickSftp?.loading?.value ? '正在连接临时会话文件管理...' : '点击文件管理按钮后，可为当前临时连接打开 SFTP'
  }
  return sftpStore.loading ? '正在连接...' : '请先连接会话，再打开文件管理'
})

const canReconnect = computed(() => {
  const tab = activeTab.value
  return tab && tab.serverId && !tab.connecting
})

const activeHost = computed(() => {
  const tab = activeTab.value
  if (!tab) return ''
  return tab.server?.host || tab.connectionInfo?.host || ''
})

const activeUsername = computed(() => {
  const tab = activeTab.value
  if (!tab) return ''
  return tab.server?.username || tab.connectionInfo?.username || ''
})

const activePort = computed(() => {
  const tab = activeTab.value
  if (!tab) return ''
  return tab.server?.port || tab.connectionInfo?.port || '22'
})

const activeRemark = computed(() => {
  const tab = activeTab.value
  if (!tab) return ''
  return tab.remark || tab.server?.name || tab.connectionInfo?.name || ''
})

const currentAddress = computed(() => {
  if (!activeHost.value) return ''
  return `ssh://${activeUsername.value || 'root'}@${activeHost.value}:${activePort.value}`
})

const serverTreeData = computed(() => {
  const groupedServers = {}
  const explicitGroupNames = serversStore.groups.map(group => group.name)
  let filteredServers = serversStore.servers
  const q = searchQuery.value.trim().toLowerCase()

  if (q) {
    filteredServers = filteredServers.filter(s =>
      s.name?.toLowerCase().includes(q) ||
      s.host?.toLowerCase().includes(q) ||
      s.group_name?.toLowerCase().includes(q)
    )
  }

  filteredServers.forEach(server => {
    const groupName = server.group_name || 'Default'
    if (!groupedServers[groupName]) groupedServers[groupName] = []
    groupedServers[groupName].push({
      id: `server-${server.id}`,
      label: server.name,
      host: server.host,
      port: server.port,
      type: 'server',
      serverId: server.id
    })
  })

  const groupNames = new Set([...explicitGroupNames, ...Object.keys(groupedServers)])
  const visibleGroupNames = Array.from(groupNames).filter(name => !q || name.toLowerCase().includes(q) || groupedServers[name]?.length)

  return visibleGroupNames.map(name => ({
    id: `group-${name}`,
    label: name,
    type: 'group',
    children: groupedServers[name] || []
  }))
})

const treeProps = { children: 'children', label: 'label' }

// --- Menu ---
const toggleMenu = (key) => { openMenu.value = openMenu.value === key ? null : key }
const onMenuHover = (key) => { if (openMenu.value !== null) openMenu.value = key }
const closeAllMenus = () => {
  openMenu.value = null
  hideTabContextMenu()
  treeContextMenu.value.visible = false
}

const executeMenuAction = (item) => {
  if (item.disabled) return
  openMenu.value = null
  const actions = {
    newTab: createEmptyTab,
    reconnect: reconnectActive,
    disconnect: disconnectActive,
    closeTab: () => activeTabId.value && closeTab(activeTabId.value),
    closeAllTabs,
    closeOtherTabs,
    logout: handleLogout,
    copy: copyActive,
    paste: pasteActive,
    selectAll: selectAllActive,
    clearScreen: clearActive,
    resetTerminal: resetActive,
    toggleSidebar: () => { showSidebar.value = !showSidebar.value },
    fullscreen: toggleFullscreen,
    commandLibrary: () => { showCommands.value = true },
    about: showAbout
  }
  const fn = actions[item.action]
  if (fn) fn()
}

// --- Tree ---
const handleNodeExpand = (data) => {
  if (data.type === 'group' && !expandedKeys.value.includes(data.id)) {
    expandedKeys.value.push(data.id)
    sessionStorage.setItem(EXPANDED_KEYS_KEY, JSON.stringify(expandedKeys.value))
  }
}
const handleNodeCollapse = (data) => {
  if (data.type === 'group') {
    expandedKeys.value = expandedKeys.value.filter(id => id !== data.id)
    sessionStorage.setItem(EXPANDED_KEYS_KEY, JSON.stringify(expandedKeys.value))
  }
}

const getServerStatus = (serverId) => {
  const tab = tabs.value.find(t => t.serverId === serverId)
  if (!tab) return 'disconnected'
  if (tab.connecting) return 'connecting'
  if (tab.connected) return 'connected'
  return 'disconnected'
}

const handleTreeNodeClick = (data, node) => {
  if (data.type === 'server') {
    const server = serversStore.servers.find(s => s.id === data.serverId)
    if (server) createNewTabForServer(server)
  } else if (data.type === 'group' && node) {
    node.expanded = !node.expanded
  }
}

const handleTreeNodeDblClick = (data, node) => {
  if (data.type === 'group' && node) {
    node.expanded = !node.expanded
  }
}

// --- Tabs ---
const createEmptyTab = () => {
  const tabId = 'empty-' + Date.now()
  const newTab = {
    id: tabId,
    title: '新建会话',
    type: 'terminal',
    connected: false,
    connecting: false,
    error: null,
    socket: null
  }
  tabs.value.push(newTab)
  activeTabId.value = tabId
}

const cleanupTabResources = async (tab) => {
  if (!tab) return
  if (tab.socket) {
    tab.socket.emit('disconnect-ssh')
    tab.socket.disconnect()
    tab.socket = null
  }
  if (tab.quickSftp?.isConnected?.value) {
    await tab.quickSftp.disconnectSftp()
  }
}

const switchTab = (tabId) => {
  activeTabId.value = tabId
  nextTick(() => {
    const tc = terminalComponentRefs.value[tabId]
    if (tc) { tc.fit(); tc.focus() }
  })
}

const closeTab = async (tabId) => {
  const tab = tabs.value.find(t => t.id === tabId)
  if (!tab) return
  if (tab.connected) {
    try {
      await ElMessageBox.confirm('当前标签有活动连接，确定关闭？', '确认关闭', {
        confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning'
      })
    } catch { return }
  }
  await cleanupTabResources(tab)
  delete terminalComponentRefs.value[tabId]
  const idx = tabs.value.findIndex(t => t.id === tabId)
  tabs.value = tabs.value.filter(t => t.id !== tabId)
  if (activeTabId.value === tabId) {
    if (tabs.value.length > 0) {
      activeTabId.value = tabs.value[Math.min(idx, tabs.value.length - 1)].id
    } else {
      activeTabId.value = null
    }
  }
}

const closeAllTabs = async () => {
  if (tabs.value.length === 0) return
  const hasConnected = tabs.value.some(t => t.connected)
  if (hasConnected) {
    try {
      await ElMessageBox.confirm('确定关闭所有标签？活动连接将被断开。', '确认', {
        confirmButtonText: '确定', cancelButtonText: '取消', type: 'error'
      })
    } catch { return }
  }
  for (const tab of tabs.value) {
    await cleanupTabResources(tab)
    delete terminalComponentRefs.value[tab.id]
  }
  tabs.value = []
  activeTabId.value = null
}

const closeOtherTabs = async () => {
  if (tabs.value.length <= 1) return
  const currentId = activeTabId.value
  const hasConnected = tabs.value.some(t => t.id !== currentId && t.connected)
  if (hasConnected) {
    try {
      await ElMessageBox.confirm('关闭其他标签？活动连接将被断开。', '确认', {
        confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning'
      })
    } catch { return }
  }
  for (const tab of tabs.value) {
    if (tab.id !== currentId) {
      await cleanupTabResources(tab)
      delete terminalComponentRefs.value[tab.id]
    }
  }
  tabs.value = tabs.value.filter(t => t.id === currentId)
}

// --- Connection ---
const createNewTabForServer = async (server) => {
  const tabId = 'server-' + server.id + '-' + Date.now()
  const existingCount = tabs.value.filter(t => t.serverId === server.id).length
  let tabTitle = server.name
  if (existingCount > 0) tabTitle = `${server.name} (${existingCount + 1})`

  const newTab = {
    id: tabId, title: tabTitle, type: 'terminal',
    serverId: server.id, server,
    connected: false, connecting: false, error: null, socket: null
  }
  tabs.value.push(newTab)
  activeTabId.value = tabId

  nextTick(async () => {
    const reactiveTab = tabs.value.find(t => t.id === tabId)
    if (reactiveTab) await performConnection(reactiveTab, server.id)
  })
}

const performConnection = async (tab, serverId) => {
  if (!authStore.token) { ElMessage.error('未认证，请重新登录'); return }
  tab.connecting = true
  tab.error = null
  try {
    tab.socket = io({ auth: { token: authStore.token } })
    tab.socket.on('connect', () => { tab.socket.emit('authenticate', authStore.token) })
    tab.socket.on('authenticated', (data) => {
      if (data.success) {
        const tc = terminalComponentRefs.value[tab.id]
        if (tc) { tc.clear(); tc.write('\x1b[33m正在连接服务器...\x1b[0m\r\n') }
        tab.socket.emit('connect-ssh', serverId)
      } else {
        tab.connecting = false; tab.error = '认证失败'
        const tc = terminalComponentRefs.value[tab.id]
        if (tc) tc.write('\r\n\x1b[31m认证失败\x1b[0m\r\n')
      }
    })
    tab.socket.on('ssh-connected', () => {
      tab.connected = true; tab.connecting = false; tab.error = null
      const tc = terminalComponentRefs.value[tab.id]
      if (tc) { tc.clear(); tc.focus() }
    })
    tab.socket.on('ssh-data', (data) => {
      const output = typeof data === 'string' ? data : String(data)
      const tc = terminalComponentRefs.value[tab.id]
      if (tc) tc.write(output)
    })
    tab.socket.on('ssh-error', (data) => {
      tab.connecting = false; tab.connected = false
      tab.error = data.error || '连接错误'
      const tc = terminalComponentRefs.value[tab.id]
      if (tc) tc.write(`\r\n\x1b[31m连接错误: ${tab.error}\x1b[0m\r\n`)
    })
    tab.socket.on('ssh-closed', () => {
      tab.connected = false; tab.connecting = false
      const tc = terminalComponentRefs.value[tab.id]
      if (tc) tc.write('\r\n\x1b[33m连接已关闭\x1b[0m\r\n')
    })
    tab.socket.on('disconnect', () => { tab.connected = false; tab.connecting = false })
    setTimeout(() => {
      if (!tab.connected && !tab.error) {
        tab.connecting = false; tab.error = '连接超时'
        const tc = terminalComponentRefs.value[tab.id]
        if (tc) tc.write('\r\n\x1b[31m连接超时\x1b[0m\r\n')
      }
    }, 30000)
  } catch (error) {
    tab.connecting = false; tab.error = error.message
    const tc = terminalComponentRefs.value[tab.id]
    if (tc) tc.write(`\r\n\x1b[31m连接失败: ${error.message}\x1b[0m\r\n`)
  }
}

const handleTerminalData = (data, tabId) => {
  const tab = tabs.value.find(t => t.id === tabId)
  if (tab?.connected && tab.socket) tab.socket.emit('ssh-input', data)
}

const handleTerminalResize = (dimensions, tabId) => {
  const tab = tabs.value.find(t => t.id === tabId)
  if (tab?.connected && tab.socket) {
    tab.socket.emit('resize', {
      rows: dimensions.rows, cols: dimensions.cols,
      height: dimensions.height, width: dimensions.width
    })
  }
}

const focusTerminal = (tabId) => {
  const tc = terminalComponentRefs.value[tabId]
  if (tc) tc.focus()
}

const injectCommand = (cmd) => {
  const tab = activeTab.value
  if (tab?.connected && tab.socket) {
    tab.socket.emit('ssh-input', cmd + '\n')
    focusTerminal(tab.id)
  } else {
    ElMessage.warning('当前没有连通的终端')
  }
}

const resetQuickConnectDialog = () => {
  quickConnectDialog.visible = false
  quickConnectDialog.submitting = false
  quickConnectDialog.host = ''
  quickConnectDialog.port = 22
  quickConnectDialog.username = 'root'
  quickConnectDialog.authType = 'password'
  quickConnectDialog.password = ''
  quickConnectDialog.privateKey = ''
}

const createQuickConnectTab = async (connectionInfo) => {
  const tabId = 'quick-' + Date.now()
  const title = connectionInfo.host + (connectionInfo.port !== 22 ? ':' + connectionInfo.port : '')
  const newTab = {
    id: tabId,
    title,
    type: 'terminal',
    quickConnect: true,
    quickSftp: useQuickSftp(),
    connectionInfo,
    connected: false,
    connecting: false,
    error: null,
    socket: null
  }
  tabs.value.push(newTab)
  activeTabId.value = tabId
  addressInput.value = ''
  await nextTick()
  const reactiveTab = tabs.value.find(t => t.id === tabId)
  if (reactiveTab) await performQuickConnectionWithSocket(reactiveTab, connectionInfo)
}

const confirmQuickConnect = async () => {
  const username = String(quickConnectDialog.username || '').trim() || 'root'
  const authType = quickConnectDialog.authType === 'key' ? 'key' : 'password'
  const password = String(quickConnectDialog.password || '')
  const privateKey = String(quickConnectDialog.privateKey || '').trim()

  if (!quickConnectDialog.host) {
    ElMessage.warning('主机地址不能为空')
    return
  }
  if (!username) {
    ElMessage.warning('请输入用户名')
    return
  }
  if (authType === 'password' && !password) {
    ElMessage.warning('请输入 SSH 密码')
    return
  }
  if (authType === 'key' && !privateKey) {
    ElMessage.warning('请输入 SSH 私钥')
    return
  }

  quickConnectDialog.submitting = true
  const connectionInfo = {
    host: String(quickConnectDialog.host).trim(),
    port: parseInt(quickConnectDialog.port, 10) || 22,
    username,
    authType
  }
  if (authType === 'password') connectionInfo.password = password
  else connectionInfo.privateKey = privateKey

  resetQuickConnectDialog()
  await createQuickConnectTab(connectionInfo)
}

// 地址栏回车：解析 IP/端口，弹出临时连接表单
const handleAddressEnter = async () => {
  const raw = (addressInput.value || '').trim()
  if (!raw) return
  let host = ''
  let port = 22
  let username = 'root'
  const sshMatch = raw.match(/^ssh:\/\/(?:([^@]+)@)?([^:/]+)(?::(\d+))?/)
  if (sshMatch) {
    username = sshMatch[1] || 'root'
    host = sshMatch[2]
    port = sshMatch[3] ? parseInt(sshMatch[3], 10) : 22
  } else {
    const parts = raw.split(':')
    host = parts[0].trim()
    if (parts[1] !== undefined) port = parseInt(parts[1].trim(), 10) || 22
  }
  if (!host) return
  quickConnectDialog.host = String(host).trim()
  quickConnectDialog.port = parseInt(port, 10) || 22
  quickConnectDialog.username = String(username).trim() || 'root'
  quickConnectDialog.authType = 'password'
  quickConnectDialog.password = ''
  quickConnectDialog.privateKey = ''
  quickConnectDialog.visible = true
}

// 使用独立 socket 的快速连接（多标签时每标签一个连接）
const performQuickConnectionWithSocket = async (tab, connectionInfo) => {
  if (!authStore.token) { ElMessage.error('未认证，请重新登录'); return }
  tab.connecting = true
  tab.error = null
  try {
    tab.socket = io({ auth: { token: authStore.token } })
    tab.socket.on('connect', () => { tab.socket.emit('authenticate', authStore.token) })
    tab.socket.on('authenticated', (data) => {
      if (data.success) {
        const tc = terminalComponentRefs.value[tab.id]
        if (tc) { tc.clear(); tc.write('\x1b[33m正在连接服务器...\x1b[0m\r\n') }
        tab.socket.emit('quick-connect', connectionInfo)
      } else {
        tab.connecting = false
        tab.error = '认证失败'
        const tc = terminalComponentRefs.value[tab.id]
        if (tc) tc.write('\r\n\x1b[31m认证失败\x1b[0m\r\n')
      }
    })
    tab.socket.on('ssh-connected', () => {
      tab.connected = true
      tab.connecting = false
      tab.error = null
      const tc = terminalComponentRefs.value[tab.id]
      if (tc) { tc.clear(); tc.focus() }
    })
    tab.socket.on('ssh-data', (data) => {
      const output = typeof data === 'string' ? data : String(data)
      const tc = terminalComponentRefs.value[tab.id]
      if (tc) tc.write(output)
    })
    tab.socket.on('ssh-error', (data) => {
      tab.connecting = false
      tab.connected = false
      tab.error = data.error || '连接错误'
      const tc = terminalComponentRefs.value[tab.id]
      if (tc) tc.write(`\r\n\x1b[31m连接错误: ${tab.error}\x1b[0m\r\n`)
    })
    tab.socket.on('ssh-closed', () => {
      tab.connected = false
      tab.connecting = false
      const tc = terminalComponentRefs.value[tab.id]
      if (tc) tc.write('\r\n\x1b[33m连接已关闭\x1b[0m\r\n')
    })
    tab.socket.on('disconnect', () => { tab.connected = false; tab.connecting = false })
    setTimeout(() => {
      if (!tab.connected && !tab.error) {
        tab.connecting = false
        tab.error = '连接超时'
        const tc = terminalComponentRefs.value[tab.id]
        if (tc) tc.write('\r\n\x1b[31m连接超时\x1b[0m\r\n')
      }
    }, 30000)
  } catch (error) {
    tab.connecting = false
    tab.error = error.message
    const tc = terminalComponentRefs.value[tab.id]
    if (tc) tc.write(`\r\n\x1b[31m连接失败: ${error.message}\x1b[0m\r\n`)
  }
}

// 文件管理：切到当前会话并在右侧显示 SFTP，随会话切换
const toggleFileManager = async () => {
  fileManagerEnabled.value = !fileManagerEnabled.value
  if (fileManagerEnabled.value) {
    await connectSftpForActiveTab()
  } else {
    if (activeTab.value?.quickConnect) await activeTab.value.quickSftp?.disconnectSftp?.()
    else await sftpStore.disconnectSftp()
  }
  nextTick(() => {
    const tc = terminalComponentRefs.value[activeTabId.value]
    if (tc) tc.fit()
  })
}

const startResize = (e) => {
  if (!fileManagerEnabled.value) return
  isResizing = true
  resizeStartX = e.clientX
  resizeStartWidth = sftpWidth.value
  window.addEventListener('mousemove', onResizeMove)
  window.addEventListener('mouseup', stopResize)
}

const onResizeMove = (e) => {
  if (!isResizing) return
  const delta = resizeStartX - e.clientX
  let newWidth = resizeStartWidth + delta
  if (newWidth < 160) newWidth = 160
  sftpWidth.value = newWidth
}

const stopResize = () => {
  if (!isResizing) return
  isResizing = false
  window.removeEventListener('mousemove', onResizeMove)
  window.removeEventListener('mouseup', stopResize)
}

const connectSftpForActiveTab = async () => {
  const tab = activeTab.value
  if (!tab?.connected) return
  if (tab.quickConnect && tab.connectionInfo) {
    const ok = await tab.quickSftp.connectSftp({
      host: tab.connectionInfo.host,
      port: tab.connectionInfo.port,
      username: tab.connectionInfo.username,
      password: tab.connectionInfo.password,
      privateKey: tab.connectionInfo.privateKey
    })
    if (!ok) ElMessage.error(tab.quickSftp.error.value || 'SFTP 连接失败')
    return
  }
  const server = tab.server
  if (!server?.id) return
  const ok = await sftpStore.connectSftp(server)
  if (!ok) ElMessage.error('SFTP 连接失败')
}

// 标签右键菜单
const tabContextMenu = ref({ visible: false, x: 0, y: 0, tab: null })
const showTabContextMenu = (e, tab) => {
  treeContextMenu.value.visible = false
  tabContextMenu.value = { visible: true, x: e.clientX, y: e.clientY, tab }
}

const treeContextMenu = ref({ visible: false, x: 0, y: 0, data: null, node: null })
const handleSidebarTreeContextMenu = (event) => {
  if (event.target?.closest?.('.el-tree-node__content')) return
  tabContextMenu.value.visible = false
  treeContextMenu.value = {
    visible: true,
    x: event.clientX,
    y: event.clientY,
    data: { type: 'blank' },
    node: null
  }
}
const handleTreeContextMenu = (event, data, node) => {
  tabContextMenu.value.visible = false
  treeContextMenu.value = { visible: true, x: event.clientX, y: event.clientY, data, node }
}
const onTreeContextAction = async (action) => {
  const { data } = treeContextMenu.value
  treeContextMenu.value.visible = false
  if (!data) return
  if (action === 'createGroup') {
    try {
      const { value } = await ElMessageBox.prompt('请输入分组名称', '新建分组', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        inputPlaceholder: '分组名称'
      })
      const groupName = value?.trim()
      if (!groupName) return
      const result = await serversStore.addGroup({ name: groupName })
      if (!result.success) {
        ElMessage.error(result.error || '新建分组失败')
        return
      }
      ElMessage.success('分组已创建')
    } catch {}
  } else if (action === 'renameGroup') {
    const group = serversStore.groups.find(g => g.name === data.label)
    if (!group) return
    try {
      const { value } = await ElMessageBox.prompt('新分组名称', '重命名分组', {
        confirmButtonText: '确定', cancelButtonText: '取消', inputValue: data.label
      })
      if (value) await serversStore.updateGroup(group.id, { name: value })
      await serversStore.fetchServers()
      ElMessage.success('已重命名')
    } catch {}
  } else if (action === 'deleteGroup') {
    const group = serversStore.groups.find(g => g.name === data.label)
    if (!group) return
    try {
      await ElMessageBox.confirm('确定删除该分组？', '删除分组', { type: 'warning' })
      await serversStore.deleteGroup(group.id, false)
      await serversStore.fetchServers()
      ElMessage.success('已删除')
    } catch {}
  } else if (action === 'editServer') {
    if (data.type !== 'server' || !data.serverId) return
    editingServerId.value = data.serverId
    editingServerName.value = serversStore.servers.find(s => s.id === data.serverId)?.name || ''
    showEditServerDialog.value = true
  } else if (action === 'deleteServer') {
    if (data.type !== 'server' || !data.serverId) return
    const server = serversStore.servers.find(s => s.id === data.serverId)
    if (!server) return
    try {
      await ElMessageBox.confirm('确定删除该服务器？', '删除', { type: 'warning' })
      await serversStore.deleteServer(data.serverId)
      await serversStore.fetchServers()
      ElMessage.success('已删除')
    } catch {}
  } else if (action === 'moveServer') {
    if (data.type !== 'server' || !data.serverId) return
    const server = serversStore.servers.find(s => s.id === data.serverId)
    if (!server) return
    try {
      const { value } = await ElMessageBox.prompt('目标分组名称', '移动到', {
        confirmButtonText: '确定', cancelButtonText: '取消',
        inputPlaceholder: '分组名称',
        inputValue: server.group_name || 'Default'
      })
      if (value != null) {
        await serversStore.updateServer(data.serverId, {
          name: server.name,
          host: server.host,
          port: server.port,
          username: server.username,
          authType: server.auth_type || 'password',
          groupName: value
        })
        await serversStore.fetchServers()
        ElMessage.success('已移动')
      }
    } catch {}
  }
}
const showEditServerDialog = ref(false)
const editingServerId = ref(null)
const editingServerName = ref('')
const handleServerUpdated = () => {
  showEditServerDialog.value = false
  editingServerId.value = null
  editingServerName.value = ''
  ElMessage.success('已更新')
  serversStore.fetchServers()
}
const hideTabContextMenu = () => {
  tabContextMenu.value = { visible: false, x: 0, y: 0, tab: null }
}
const onTabContextAction = (action) => {
  const { tab } = tabContextMenu.value
  hideTabContextMenu()
  if (!tab) return
  if (action === 'close') closeTab(tab.id)
  else if (action === 'closeOther') closeOtherTabs()
  else if (action === 'closeAll') closeAllTabs()
  else if (action === 'rename') promptRenameTab(tab)
  else if (action === 'saveToGroup') openSaveToGroupDialog(tab)
}
const promptRenameTab = async (tab) => {
  try {
    const { value } = await ElMessageBox.prompt('备注名称', '编辑备注', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      inputValue: tab.remark ?? tab.title ?? ''
    })
    if (value != null) {
      tab.remark = value
      tab.title = value || (tab.server?.name || tab.connectionInfo?.host || '未命名')
    }
  } catch {}
}
const saveToGroupDialog = ref(false)
const saveToGroupTab = ref(null)
const saveToGroupForm = ref({ name: '', groupName: 'Default' })
const openSaveToGroupDialog = (tab) => {
  if (!tab.connectionInfo && !tab.server) return
  saveToGroupTab.value = tab
  saveToGroupForm.value = {
    name: tab.title || tab.connectionInfo?.host || tab.server?.name || '',
    groupName: 'Default'
  }
  saveToGroupDialog.value = true
}
const confirmSaveToGroup = async () => {
  const tab = saveToGroupTab.value
  if (!tab) return
  const info = tab.connectionInfo || (tab.server ? { host: tab.server.host, port: tab.server.port, username: tab.server.username, password: '' } : null)
  if (!info?.host) {
    ElMessage.warning('无法获取连接信息')
    return
  }
  const name = (saveToGroupForm.value.name || '').trim() || info.host
  const groupName = (saveToGroupForm.value.groupName || '').trim() || 'Default'
  const serverData = {
    name,
    host: info.host,
    port: info.port || 22,
    username: info.username || 'root',
    authType: info.authType || (info.privateKey ? 'key' : 'password'),
    groupName
  }
  if (serverData.authType === 'key') serverData.privateKey = info.privateKey || ''
  else serverData.password = info.password || ''
  const result = await serversStore.addServer(serverData)
  saveToGroupDialog.value = false
  saveToGroupTab.value = null
  if (result.success) {
    ElMessage.success('已保存到分组')
    await serversStore.fetchServers()
  } else {
    ElMessage.error(result.error || '保存失败')
  }
}

// --- Actions ---
const reconnectActive = async () => {
  const tab = activeTab.value
  if (!tab?.serverId || tab.connecting) return
  if (tab.quickSftp?.isConnected?.value) await tab.quickSftp.disconnectSftp()
  if (tab.socket) { tab.socket.emit('disconnect-ssh'); tab.socket.disconnect(); tab.socket = null }
  tab.connected = false; tab.connecting = false; tab.error = null
  const tc = terminalComponentRefs.value[tab.id]
  if (tc) { tc.clear(); tc.write('\x1b[33m正在重新连接...\x1b[0m\r\n') }
  await performConnection(tab, tab.serverId)
}

const disconnectActive = () => {
  const tab = activeTab.value
  if (!tab?.connected) return
  if (tab.socket) { tab.socket.emit('disconnect-ssh'); tab.socket.disconnect(); tab.socket = null }
  tab.connected = false
  if (tab.quickConnect) tab.quickSftp?.disconnectSftp?.()
  else if (sftpStore.currentServer?.id === tab.serverId) sftpStore.disconnectSftp()
  const tc = terminalComponentRefs.value[tab.id]
  if (tc) tc.write('\r\n\x1b[33m已断开连接\x1b[0m\r\n')
}

const copyActive = async () => {
  const tab = activeTab.value
  if (!tab) return
  const tc = terminalComponentRefs.value[tab.id]
  if (tc) {
    const sel = tc.getSelection()
    if (sel) {
      await navigator.clipboard.writeText(sel)
      ElMessage.success(`已复制 ${sel.length} 个字符`)
    } else {
      ElMessage.warning('请先选中文本')
    }
  }
}

const pasteActive = async () => {
  const tab = activeTab.value
  if (!tab?.connected || !tab.socket) return
  try {
    const text = await navigator.clipboard.readText()
    if (text) tab.socket.emit('ssh-input', text)
  } catch { ElMessage.error('粘贴失败') }
}

const selectAllActive = () => {
  const tab = activeTab.value
  if (!tab) return
  const tc = terminalComponentRefs.value[tab.id]
  if (tc) tc.selectAll()
}

const clearActive = () => {
  const tab = activeTab.value
  if (!tab) return
  const tc = terminalComponentRefs.value[tab.id]
  if (tc) tc.clear()
}

const resetActive = () => {
  const tab = activeTab.value
  if (!tab) return
  const tc = terminalComponentRefs.value[tab.id]
  if (tc) tc.reset()
}

const toggleFullscreen = () => {
  if (document.fullscreenElement) document.exitFullscreen()
  else document.documentElement.requestFullscreen()
}

const handleLogout = async () => {
  try {
    await ElMessageBox.confirm('确定退出登录？所有连接将断开。', '确认', {
      confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning'
    })
    for (const tab of tabs.value) await cleanupTabResources(tab)
    await sftpStore.disconnectSftp()
    authStore.logout()
    router.push('/login')
  } catch {}
}

const showAbout = () => {
  ElMessageBox.alert(
    '<div style="text-align:center;padding:20px 0;"><h2 style="margin-bottom:8px;">WebSSH Terminal</h2><p style="color:#999;">Xshell 风格 Web SSH 终端管理工具</p></div>',
    '关于 WebSSH',
    { confirmButtonText: '确定', dangerouslyUseHTMLString: true }
  )
}

// --- Keyboard Shortcuts ---
const handleKeyDown = (e) => {
  if (e.ctrlKey && e.key === 'w') {
    e.preventDefault()
    if (activeTabId.value) closeTab(activeTabId.value)
  }
  if (e.key === 'F11') {
    e.preventDefault()
    toggleFullscreen()
  }
}

// --- Watchers ---
watch(showSidebar, () => {
  nextTick(() => {
    if (activeTabId.value) {
      const tc = terminalComponentRefs.value[activeTabId.value]
      if (tc) tc.fit()
    }
  })
})

watch(activeTabId, (newId) => {
  if (newId) {
    const tab = tabs.value.find(t => t.id === newId)
    addressInput.value = tab
      ? (tab.server ? `ssh://${tab.server.username || 'root'}@${tab.server.host}:${tab.server.port}` : (tab.connectionInfo ? `ssh://${tab.connectionInfo.username || 'root'}@${tab.connectionInfo.host}:${tab.connectionInfo.port || 22}` : ''))
      : ''
    if (fileManagerEnabled.value) nextTick(() => connectSftpForActiveTab())
    nextTick(() => {
      const tc = terminalComponentRefs.value[newId]
      if (tc) { tc.fit(); tc.focus() }
    })
  }
})

onMounted(async () => {
  await serversStore.fetchServers()
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
  stopResize()
  tabs.value.forEach(tab => { cleanupTabResources(tab) })
  sftpStore.disconnectSftp()
})
</script>

<style scoped>
.xshell-app {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #1e1e1e;
  font-family: "Microsoft YaHei", "Segoe UI", Tahoma, sans-serif;
  font-size: 12px;
  color: #cccccc;
  overflow: hidden;
  user-select: none;
}

/* ===== Menu Bar ===== */
.xsh-menubar {
  display: flex;
  align-items: center;
  height: 28px;
  min-height: 28px;
  background: #3c3c3c;
  border-bottom: 1px solid #252525;
  padding: 0 2px;
}

.xsh-menu {
  position: relative;
}

.xsh-menu-trigger {
  padding: 4px 10px;
  cursor: pointer;
  color: #d4d4d4;
  font-size: 12px;
  line-height: 1;
  white-space: nowrap;
}

.xsh-menu-trigger:hover,
.xsh-menu-trigger.active {
  background: #505050;
  color: #ffffff;
}

.xsh-menu-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  background: #2d2d30;
  border: 1px solid #454545;
  box-shadow: 0 4px 16px rgba(0,0,0,0.6);
  min-width: 220px;
  padding: 4px 0;
  z-index: 9999;
}

.xsh-menu-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 5px 28px 5px 24px;
  cursor: pointer;
  color: #d4d4d4;
  font-size: 12px;
  white-space: nowrap;
}

.xsh-menu-item:hover {
  background: #094771;
  color: #ffffff;
}

.xsh-menu-item.disabled {
  color: #666;
  cursor: not-allowed;
}

.xsh-menu-item.disabled:hover {
  background: transparent;
  color: #666;
}

.xsh-menu-item-key {
  color: #777;
  font-size: 11px;
  margin-left: 32px;
}

.xsh-menu-divider {
  height: 1px;
  background: #454545;
  margin: 4px 0;
}

.xsh-menubar-right {
  margin-left: auto;
  display: flex;
  align-items: center;
}

.xsh-user-info {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  color: #999;
  cursor: pointer;
  font-size: 11px;
  transition: color 0.15s;
}

.xsh-user-info:hover {
  color: #fff;
}

/* ===== Toolbar ===== */
.xsh-toolbar {
  display: flex;
  align-items: center;
  height: 34px;
  min-height: 34px;
  background: linear-gradient(180deg, #404040 0%, #383838 100%);
  border-bottom: 1px solid #252525;
  padding: 0 6px;
  gap: 1px;
}

.xsh-toolbar-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 3px;
  cursor: pointer;
  color: #c8c8c8;
  transition: all 0.12s;
  border: 1px solid transparent;
}

.xsh-toolbar-btn:hover {
  background: #555;
  border-color: #666;
  color: #ffffff;
}

.xsh-toolbar-btn:active {
  background: #4a4a4a;
}

.xsh-toolbar-btn.active {
  background: #094771;
  border-color: #0a6ebd;
  color: #ffffff;
}

.xsh-toolbar-btn.disabled {
  color: #555;
  cursor: not-allowed;
}

.xsh-toolbar-btn.disabled:hover {
  background: transparent;
  border-color: transparent;
  color: #555;
}

.xsh-toolbar-sep {
  width: 1px;
  height: 20px;
  background: #555;
  margin: 0 4px;
}

/* ===== Address Bar ===== */
.xsh-addressbar {
  display: flex;
  align-items: center;
  height: 26px;
  min-height: 26px;
  background: #333;
  border-bottom: 1px solid #252525;
  padding: 0 10px;
  gap: 6px;
}

.xsh-addr-icon {
  color: #888;
  font-size: 12px;
}

.xsh-addr-input {
  flex: 1;
  border: none;
  outline: none;
  background: #1e1e1e;
  color: #d0d0d0;
  font-family: Consolas, "Courier New", monospace;
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 2px;
}

.xsh-addr-input::placeholder {
  color: #666;
}

/* ===== Tab Bar ===== */
.xsh-tabbar {
  background: #2d2d30;
  border-bottom: 1px solid #1a1a1a;
  min-height: 30px;
  display: flex;
  align-items: flex-end;
  padding: 0 4px;
}

.xsh-tabbar-scroll {
  display: flex;
  flex-wrap: wrap;
  max-height: 64px;
  overflow-y: auto;
  overflow-x: hidden;
  flex: 1;
}

.xsh-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 14px;
  height: 28px;
  cursor: pointer;
  color: #999;
  background: #2d2d30;
  border: 1px solid transparent;
  border-bottom: none;
  margin-right: 1px;
  font-size: 12px;
  transition: all 0.12s;
  white-space: nowrap;
  max-width: 200px;
  position: relative;
  top: 1px;
  box-sizing: border-box;
}

.xsh-tab:hover {
  color: #ddd;
  background: #383838;
}

.xsh-tab.active {
  color: #ffffff;
  background: #000000;
  border-color: #1a1a1a;
  border-bottom-color: #000000;
}

.xsh-tab-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #555;
  flex-shrink: 0;
}

.xsh-tab-dot.green {
  background: #4ec94e;
  box-shadow: 0 0 6px rgba(78, 201, 78, 0.5);
}

.xsh-tab-dot.yellow {
  background: #e6a23c;
  animation: xsh-blink 1.2s infinite;
}

@keyframes xsh-blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0.3; }
}

.xsh-tab-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 140px;
}

.xsh-tab-close {
  font-size: 16px;
  line-height: 1;
  opacity: 0;
  cursor: pointer;
  padding: 0 2px;
  flex-shrink: 0;
  transition: opacity 0.12s;
}

.xsh-tab:hover .xsh-tab-close {
  opacity: 0.5;
}

.xsh-tab-close:hover {
  opacity: 1 !important;
  color: #ff5f57;
}

/* ===== Body ===== */
.xsh-body {
  flex: 1;
  display: flex;
  min-height: 0;
  overflow: hidden;
}

/* ===== Sidebar ===== */
.xsh-sidebar {
  width: 250px;
  min-width: 200px;
  background: #252526;
  border-right: 1px solid #1a1a1a;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.xsh-sidebar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 26px;
  padding: 0 10px;
  background: #333;
  border-bottom: 1px solid #1a1a1a;
}

.xsh-sidebar-title {
  font-size: 12px;
  font-weight: 600;
  color: #ccc;
}

.xsh-sidebar-close {
  cursor: pointer;
  font-size: 18px;
  color: #888;
  line-height: 1;
}

.xsh-sidebar-close:hover {
  color: #fff;
}

.xsh-sidebar-search {
  padding: 6px 8px;
  border-bottom: 1px solid #1a1a1a;
}

.xsh-search-input {
  width: 100%;
  background: #3c3c3c;
  border: 1px solid #555;
  color: #ccc;
  padding: 4px 8px;
  font-size: 12px;
  border-radius: 2px;
  outline: none;
  box-sizing: border-box;
  font-family: inherit;
}

.xsh-search-input:focus {
  border-color: #0078d4;
}

.xsh-search-input::placeholder {
  color: #666;
}

.xsh-sidebar-tree {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 2px 0;
}

/* Tree overrides for Xshell look */
.xsh-sidebar-tree :deep(.el-tree) {
  background: transparent !important;
  color: #ccc !important;
  font-size: 12px;
  --el-tree-node-hover-bg-color: rgba(255,255,255,0.04);
}

.xsh-sidebar-tree :deep(.el-tree-node__content) {
  height: 26px !important;
  padding: 0 6px !important;
  border-radius: 0 !important;
  transition: background 0.1s !important;
}

.xsh-sidebar-tree :deep(.el-tree-node__content:hover) {
  background: rgba(255,255,255,0.06) !important;
}

.xsh-sidebar-tree :deep(.el-tree-node.is-current > .el-tree-node__content) {
  background: #094771 !important;
  color: #ffffff !important;
}

.xsh-sidebar-tree :deep(.el-tree-node__expand-icon) {
  color: #888 !important;
  font-size: 12px !important;
}

.xsh-tree-node {
  display: flex;
  align-items: center;
  gap: 5px;
  width: 100%;
  font-size: 12px;
  line-height: 1.4;
}

.xsh-tree-icon {
  font-size: 14px;
  flex-shrink: 0;
}

.xsh-tree-icon.folder {
  color: #dcb67a;
}

.xsh-tree-icon.server {
  color: #75beff;
}

.xsh-tree-icon.server.connected {
  color: #4ec94e;
}

.xsh-tree-label {
  color: #ccc;
}

.xsh-tree-badge {
  color: #888;
  font-size: 10px;
  margin-left: 2px;
}

.xsh-tree-server {
  display: flex;
  flex-direction: column;
  min-width: 0;
  line-height: 1.2;
}

.xsh-tree-name {
  color: #ccc;
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.xsh-tree-addr {
  color: #777;
  font-size: 10px;
  font-family: Consolas, monospace;
}

.xsh-sidebar-footer {
  padding: 6px 8px;
  border-top: 1px solid #1a1a1a;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.xsh-sidebar-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  width: 100%;
  padding: 5px 8px;
  border: 1px solid #555;
  border-radius: 3px;
  background: #3c3c3c;
  color: #ccc;
  cursor: pointer;
  font-size: 12px;
  font-family: inherit;
  transition: all 0.12s;
}

.xsh-sidebar-btn:hover {
  background: #505050;
  color: #fff;
}

.xsh-sidebar-btn.primary:hover {
  background: #0078d4;
  border-color: #0078d4;
  color: #fff;
}

/* ===== Main Terminal Area ===== */
.xsh-main {
  flex: 1;
  display: flex;
  flex-direction: row;
  min-height: 0;
  overflow: hidden;
  background: #000000;
}

.xsh-main-center {
  flex: 1;
  position: relative;
  min-width: 0;
  overflow: hidden;
}

.xsh-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #555;
}

.xsh-empty h3 {
  margin-top: 16px;
  font-size: 20px;
  font-weight: 500;
  color: #666;
}

.xsh-empty p {
  margin-top: 8px;
  font-size: 13px;
  color: #444;
}

.xsh-tab-pane {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: none;
}

.xsh-tab-pane.active {
  display: flex;
}

.xsh-terminal-wrap {
  position: relative;
  width: 100%;
  height: 100%;
}

.xsh-conn-overlay {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(0, 0, 0, 0.85);
  padding: 14px 24px;
  border-radius: 6px;
  border: 1px solid #333;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 10px;
  color: #ccc;
  font-size: 13px;
  white-space: nowrap;
}

.xsh-conn-overlay.error {
  color: #f56c6c;
  border-color: #5a2020;
}

.xsh-quick-panel {
  width: 100%;
  height: 100%;
  overflow-y: auto;
  padding: 20px;
  background: #1e1e1e;
}

.xsh-sftp-panel {
  width: 320px;
  min-width: 280px;
  border-left: 1px solid #1a1a1a;
  background: #252526;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.xsh-sftp-panel-title {
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 600;
  color: #ccc;
  border-bottom: 1px solid #1a1a1a;
  flex-shrink: 0;
}

.xsh-sftp-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #888;
  font-size: 12px;
  padding: 16px;
  text-align: center;
}

.xsh-splitter {
  width: 4px;
  cursor: col-resize;
  background: #1a1a1a;
  flex-shrink: 0;
}

.xsh-splitter:hover {
  background: #007acc;
}

/* ===== Status Bar ===== */
.xsh-statusbar {
  display: flex;
  align-items: center;
  height: 24px;
  min-height: 24px;
  background: #007acc;
  border-top: 1px solid #005a9e;
  padding: 0 10px;
  flex-shrink: 0;
  gap: 12px;
}

.xsh-remark {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.75);
  max-width: 220px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.xsh-remark-label {
  opacity: 0.8;
}

.xsh-remark-text {
  font-family: Consolas, "Courier New", monospace;
}

.xsh-status-indicator {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.7);
  white-space: nowrap;
}

.xsh-status-indicator.connected {
  color: #ffffff;
}

.xsh-status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.4);
}

.xsh-status-indicator.connected .xsh-status-dot {
  background: #7dff7d;
  box-shadow: 0 0 4px rgba(125, 255, 125, 0.5);
}

.xsh-status-fields {
  display: flex;
  align-items: center;
}

.xsh-status-field {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 10px;
}

.xsh-sf-label {
  color: rgba(255, 255, 255, 0.6);
  font-size: 11px;
}

.xsh-sf-value {
  color: #ffffff;
  font-size: 11px;
  font-family: Consolas, "Courier New", monospace;
}

.xsh-status-sep {
  width: 1px;
  height: 14px;
  background: rgba(255, 255, 255, 0.25);
}

/* 标签右键菜单 */
.xsh-context-menu {
  position: fixed;
  background: #2d2d30;
  border: 1px solid #454545;
  box-shadow: 0 4px 16px rgba(0,0,0,0.6);
  min-width: 140px;
  padding: 4px 0;
  z-index: 10000;
}
.xsh-cm-item {
  padding: 5px 16px;
  cursor: pointer;
  color: #d4d4d4;
  font-size: 12px;
}
.xsh-cm-item:hover {
  background: #094771;
  color: #fff;
}
.xsh-cm-divider {
  height: 1px;
  background: #454545;
  margin: 4px 0;
}

/* Scrollbar styling */
.xsh-sidebar-tree::-webkit-scrollbar,
.xsh-tabbar-scroll::-webkit-scrollbar {
  width: 6px;
}

.xsh-sidebar-tree::-webkit-scrollbar-track,
.xsh-tabbar-scroll::-webkit-scrollbar-track {
  background: transparent;
}

.xsh-sidebar-tree::-webkit-scrollbar-thumb,
.xsh-tabbar-scroll::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.15);
  border-radius: 3px;
}

.xsh-sidebar-tree::-webkit-scrollbar-thumb:hover,
.xsh-tabbar-scroll::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}
</style>
