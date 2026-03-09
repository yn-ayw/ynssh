<template>
  <div class="sftp-file-manager">
    <!-- 顶部工具栏 -->
    <div class="toolbar">
      <div class="toolbar-buttons">
        <el-button size="small" @click="goToParentDirectory" :disabled="currentPath === '/'">
          <el-icon><ArrowUp /></el-icon>
          返回上级
        </el-button>
        <el-button size="small" @click="refreshDirectory">
          <el-icon><Refresh /></el-icon>
          刷新
        </el-button>
        <el-button size="small" @click="showCreateDirDialog = true">
          <el-icon><FolderAdd /></el-icon>
          新建文件夹
        </el-button>
        <el-button size="small" @click="handleUploadClick">
          <el-icon><Upload /></el-icon>
          上传文件
        </el-button>
        <el-button 
          size="small"
          @click="handleDeleteSelected" 
          :disabled="selectedFiles.size === 0"
          type="danger"
        >
          <el-icon><Delete /></el-icon>
          删除选中
        </el-button>
      </div>
      
      <div class="path-display">
        <span>当前路径: {{ currentPath }}</span>
      </div>
    </div>

    <!-- 文件列表 -->
    <div class="file-list-container">
      <div v-if="loading" class="loading">
        <el-icon class="is-loading"><Loading /></el-icon>
        加载中...
      </div>
      
      <div v-else-if="error" class="error">
        <el-alert :title="error" type="error" show-icon />
      </div>
      
      <div v-else class="file-list">
        <div class="file-header">
          <span class="fh-name">名称</span>
          <span class="fh-attr">属性</span>
          <span class="fh-size">大小</span>
          <span class="fh-time">修改时间</span>
        </div>
        <div 
          v-for="file in files" 
          :key="file.path"
          class="file-item"
          :class="{ 
            'selected': selectedFiles.has(file.path), 
            'directory': file.type === 'directory' 
          }"
          @click="handleFileClick(file)"
          @dblclick="handleFileDoubleClick(file)"
          @contextmenu.prevent="handleFileContextMenu($event, file)"
        >
          <div class="file-icon">
            <el-icon v-if="file.type === 'directory'"><Folder /></el-icon>
            <el-icon v-else-if="file.name.endsWith('.txt')"><Document /></el-icon>
            <el-icon v-else-if="file.name.endsWith('.js')"><Document /></el-icon>
            <el-icon v-else-if="file.name.endsWith('.py')"><Document /></el-icon>
            <el-icon v-else><Document /></el-icon>
          </div>
          
          <div class="file-info">
            <div class="file-name">{{ file.name }}</div>
            <div class="file-details">
              <span class="fd-attr">{{ file.type === 'file' ? '文件' : '目录' }}</span>
              <span class="fd-size">{{ file.type === 'file' ? formatFileSize(file.size) : '-' }}</span>
              <span class="fd-time">{{ formatDate(file.modified) }}</span>
            </div>
          </div>
          
          <div class="file-actions">
            <el-button 
              v-if="file.type === 'file'" 
              size="small" 
              type="primary" 
              @click.stop="handleEditFile(file)"
            >
              编辑
            </el-button>
            <el-button 
              v-if="file.type === 'file'" 
              size="small" 
              @click.stop="handleDownload(file)"
            >
              下载
            </el-button>
            <el-button 
              size="small" 
              type="danger" 
              @click.stop="handleDelete(file)"
            >
              删除
            </el-button>
          </div>
        </div>
        
        <div v-if="files.length === 0" class="empty-directory">
          <el-empty description="目录为空" />
        </div>
      </div>
    </div>

    <!-- 文件上传输入 -->
    <input 
      ref="fileInput" 
      type="file" 
      multiple 
      style="display: none" 
      @change="handleFileUpload"
    />

    <!-- 对话框 -->
    <el-dialog v-model="showCreateDirDialog" title="新建文件夹" width="400px">
      <el-form :model="createDirForm" label-width="80px">
        <el-form-item label="文件夹名">
          <el-input v-model="createDirForm.name" placeholder="请输入文件夹名称" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDirDialog = false">取消</el-button>
        <el-button type="primary" @click="handleCreateDirectory">创建</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showRenameDialog" title="重命名" width="400px">
      <el-form :model="renameForm" label-width="80px">
        <el-form-item label="新名称">
          <el-input v-model="renameForm.newName" :placeholder="renameForm.oldName" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showRenameDialog = false">取消</el-button>
        <el-button type="primary" @click="handleRename">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showEditDialog" title="编辑文件" width="80%" fullscreen>
      <div class="editor-container">
        <div class="editor-header">
          <span>正在编辑: {{ editFile.path }}</span>
          <el-button type="primary" @click="handleSaveEdit">保存</el-button>
        </div>
        <vue-monaco-editor
          v-model:value="editFile.content"
          theme="vs-dark"
          :language="getLanguage(editFile.path)"
          :options="{
            automaticLayout: true,
            fontSize: 14,
            minimap: { enabled: false }
          }"
          class="file-editor-monaco"
        />
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick, computed } from 'vue';
import { useSftpStore } from '../stores/sftp';
import { ElMessage, ElMessageBox } from 'element-plus';
import { VueMonacoEditor } from '@guolao/vue-monaco-editor';

const sftpStore = useSftpStore();
const fileInput = ref(null);

// 响应式数据
const showCreateDirDialog = ref(false);
const showRenameDialog = ref(false);
const showEditDialog = ref(false);

const createDirForm = ref({
  name: ''
});

const renameForm = ref({
  oldPath: '',
  oldName: '',
  newName: ''
});

const editFile = ref({
  path: '',
  content: ''
});

// 计算属性
const currentPath = computed(() => sftpStore.currentPath);
const files = computed(() => sftpStore.files);
const loading = computed(() => sftpStore.loading);
const error = computed(() => sftpStore.error);
const selectedFiles = computed(() => sftpStore.selectedFiles);

// 方法
const refreshDirectory = async () => {
  await sftpStore.listDirectory(currentPath.value);
};

const goToParentDirectory = async () => {
  await sftpStore.goToParentDirectory();
};

const handleFileClick = (file) => {
  sftpStore.toggleFileSelection(file.path);
};

const handleFileDoubleClick = async (file) => {
  if (file.type === 'directory') {
    await sftpStore.enterDirectory(file.name);
  } else {
    handleEditFile(file);
  }
};

const handleEditFile = async (file) => {
  try {
    const content = await sftpStore.readFile(file.path);
    editFile.value = {
      path: file.path,
      content: content
    };
    showEditDialog.value = true;
  } catch (err) {
    ElMessage.error('读取文件失败: ' + err.message);
  }
};

const getLanguage = (path) => {
  if (!path) return 'plaintext';
  const ext = path.split('.').pop().toLowerCase();
  const map = {
    js: 'javascript', ts: 'typescript', vue: 'html', html: 'html', css: 'css',
    json: 'json', py: 'python', java: 'java', c: 'c', cpp: 'cpp', 
    md: 'markdown', txt: 'plaintext', sh: 'shell', yaml: 'yaml', yml: 'yaml',
    conf: 'ini', ini: 'ini', xml: 'xml', sql: 'sql', php: 'php', rb: 'ruby',
    go: 'go', rs: 'rust', pb: 'protobuf'
  };
  return map[ext] || 'plaintext';
};

const handleFileContextMenu = (event, file) => {
  // 这里可以实现右键菜单
  console.log('右键菜单:', file);
};

const handleDownload = async (file) => {
  try {
    await sftpStore.downloadFile(file.path, file.name);
    ElMessage.success('下载成功');
  } catch (err) {
    ElMessage.error('下载失败: ' + err.message);
  }
};

const handleDelete = async (file) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除 ${file.type === 'directory' ? '目录' : '文件'} "${file.name}" 吗？`,
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    );
    
    await sftpStore.deleteItem(file.path, file.type);
    ElMessage.success('删除成功');
  } catch (err) {
    if (err !== 'cancel') {
      ElMessage.error('删除失败: ' + err.message);
    }
  }
};

const handleDeleteSelected = async () => {
  try {
    const count = selectedFiles.value.size;
    await ElMessageBox.confirm(
      `确定要删除选中的 ${count} 个项目吗？`,
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    );
    
    for (const filePath of selectedFiles.value) {
      const file = files.value.find(f => f.path === filePath);
      if (file) {
        await sftpStore.deleteItem(file.path, file.type);
      }
    }
    
    ElMessage.success(`成功删除 ${count} 个项目`);
    sftpStore.clearSelection();
  } catch (err) {
    if (err !== 'cancel') {
      ElMessage.error('删除失败: ' + err.message);
    }
  }
};

const handleUploadClick = () => {
  fileInput.value.click();
};

const handleFileUpload = async (event) => {
  const files = Array.from(event.target.files);
  
  for (const file of files) {
    try {
      await sftpStore.uploadFile(file);
      ElMessage.success(`文件 ${file.name} 上传成功`);
    } catch (err) {
      ElMessage.error(`文件 ${file.name} 上传失败: ` + err.message);
    }
  }
  
  // 清空文件输入
  event.target.value = '';
};

const handleCreateDirectory = async () => {
  if (!createDirForm.value.name.trim()) {
    ElMessage.warning('请输入文件夹名称');
    return;
  }
  
  try {
    await sftpStore.createDirectory(createDirForm.value.name.trim());
    ElMessage.success('文件夹创建成功');
    showCreateDirDialog.value = false;
    createDirForm.value.name = '';
  } catch (err) {
    ElMessage.error('创建文件夹失败: ' + err.message);
  }
};

const handleRename = async () => {
  if (!renameForm.value.newName.trim()) {
    ElMessage.warning('请输入新名称');
    return;
  }
  
  try {
    await sftpStore.renameItem(renameForm.value.oldPath, renameForm.value.newName.trim());
    ElMessage.success('重命名成功');
    showRenameDialog.value = false;
    renameForm.value = {
      oldPath: '',
      oldName: '',
      newName: ''
    };
  } catch (err) {
    ElMessage.error('重命名失败: ' + err.message);
  }
};

const handleSaveEdit = async () => {
  try {
    await sftpStore.saveFile(editFile.value.path, editFile.value.content);
    ElMessage.success('文件保存成功');
    showEditDialog.value = false;
  } catch (err) {
    ElMessage.error('保存文件失败: ' + err.message);
  }
};

// 工具函数
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const formatDate = (timestamp) => {
  return new Date(timestamp * 1000).toLocaleString();
};

// 生命周期
onMounted(() => {
  // 自动刷新当前目录
  if (sftpStore.isConnected) {
    sftpStore.listDirectory(sftpStore.currentPath);
  }
});
</script>

<style scoped>
.sftp-file-manager {
  height: 100%;
  display: flex;
  flex-direction: column;
  color: #d4d4d4;
  background-color: #252526;
  font-size: 12px;
}

.toolbar {
  padding: 8px 10px;
  border-bottom: 1px solid #1a1a1a;
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
  background: linear-gradient(180deg, #3a3a3c 0%, #2d2d30 100%);
}

.toolbar-buttons {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items: center;
}

.toolbar-buttons .el-button {
  width: 120px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 32px;
  line-height: 32px;
  padding: 0 12px;
}

.path-display {
  margin-left: auto;
  color: #9e9e9e;
  font-size: 11px;
  font-family: Consolas, monospace;
}

.file-list-container {
  flex: 1;
  overflow: auto;
  background-color: #252526;
}

.loading, .error {
  padding: 20px;
  text-align: center;
}

.file-list {
  padding: 8px;
}

.file-item {
  display: flex;
  align-items: center;
  padding: 6px 8px;
  border-radius: 3px;
  margin-bottom: 2px;
  cursor: pointer;
  transition: all 0.2s;
  color: #d4d4d4;
  background-color: #2d2d30;
}

.file-item:hover {
  background-color: #3a3a3c;
}

.file-item.selected {
  background-color: #094771;
}

.file-item.directory {
  font-weight: bold;
}

.file-icon {
  margin-right: 10px;
  font-size: 20px;
  color: #75beff;
}

.file-info {
  flex: 1;
}

.file-name {
  font-weight: 500;
  margin-bottom: 4px;
  color: #f0f0f0;
}

.file-details {
  display: flex;
  gap: 8px;
  font-size: 11px;
  color: #a0a0a0;
  justify-content: flex-end;
}

.file-actions {
  opacity: 0;
  transition: opacity 0.2s;
}

.file-header {
  display: flex;
  align-items: center;
  padding: 4px 8px;
  margin-bottom: 4px;
  font-size: 11px;
  color: #9e9e9e;
  border-bottom: 1px solid #1a1a1a;
}

.fh-name {
  flex: 1;
}

.fh-attr,
.fd-attr {
  width: 60px;
  text-align: right;
}

.fh-size,
.fd-size {
  width: 80px;
  text-align: right;
}

.fh-time,
.fd-time {
  width: 140px;
  text-align: right;
}

.file-item:hover .file-actions {
  opacity: 1;
}

.empty-directory {
  text-align: center;
  padding: 40px;
  color: #909399;
}

.editor-container {
  height: 600px;
  display: flex;
  flex-direction: column;
}

.editor-header {
  padding: 10px;
  border-bottom: 1px solid #e4e7ed;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.file-editor-monaco {
  flex: 1;
  min-height: 0;
}
</style>
