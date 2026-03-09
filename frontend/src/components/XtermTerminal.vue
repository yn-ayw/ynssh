<template>
  <div class="xterm-terminal-container">
    <div 
      ref="terminalRef" 
      class="xterm-inner-container" 
      @click="focus"
      @contextmenu.prevent="showContextMenu"
    ></div>

    <!-- 右键菜单 -->
    <div 
      v-if="contextMenu.visible" 
      class="context-menu" 
      :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }"
      @mouseleave="hideContextMenu"
    >
      <div 
        class="menu-item" 
        @click="copyFromContextMenu"
        :class="{ disabled: !localHasSelection }"
      >
        <el-icon><DocumentCopy /></el-icon>
        <span>复制</span>
      </div>
      <div class="menu-divider"></div>
      <div 
        class="menu-item" 
        @click="pasteFromContextMenu"
        :class="{ disabled: !isConnected }"
      >
        <el-icon><DocumentAdd /></el-icon>
        <span>粘贴</span>
      </div>
      <div class="menu-divider"></div>
      <div class="menu-item" @click="selectAllFromContextMenu">
        <el-icon><Select /></el-icon>
        <span>全选</span>
      </div>
      <div class="menu-divider"></div>
      <div class="menu-item" @click="clearTerminal">
        <el-icon><Delete /></el-icon>
        <span>清屏</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { WebLinksAddon } from 'xterm-addon-web-links'
import 'xterm/css/xterm.css'
import { DocumentCopy, DocumentAdd, Select, Delete } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

const props = defineProps({
  isConnected: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['data', 'resize', 'selection-change'])

const terminalRef = ref(null)

let term = null
let fitAddon = null
let isComposing = false
let wheelHandler = null
let viewportWheelHandler = null
let initialScrollTop = 0

// Context Menu State
const contextMenu = ref({
  visible: false,
  x: 0,
  y: 0
})

const localHasSelection = ref(false)

// Initialize terminal logic
const initTerminal = () => {
  term = new Terminal({
    cursorBlink: true,
    fontSize: 14,
    fontFamily: "Consolas, 'Courier New', Monaco, Menlo, monospace",
    fontWeight: '400',
    fontWeightBold: '700',
    letterSpacing: 0,
    lineHeight: 1.2,
    theme: {
      background: '#000000',
      foreground: '#c0c0c0',
      cursor: '#00ff00',
      cursorAccent: '#000000',
      selectionBackground: 'rgba(51, 153, 255, 0.35)',
      black: '#000000',
      red: '#cc0000',
      green: '#00cc00',
      yellow: '#cccc00',
      blue: '#5555ff',
      magenta: '#cc00cc',
      cyan: '#00cccc',
      white: '#cccccc',
      brightBlack: '#555555',
      brightRed: '#ff5555',
      brightGreen: '#55ff55',
      brightYellow: '#ffff55',
      brightBlue: '#5555ff',
      brightMagenta: '#ff55ff',
      brightCyan: '#55ffff',
      brightWhite: '#ffffff',
    },
    disableStdin: false,
    scrollback: 10000,
    convertEol: true,
    allowTransparency: false,
    tabStopWidth: 8,
    cursorStyle: 'block',
    bellStyle: 'sound',
    allowProposedApi: true,
    windowsMode: true,
    screenReaderMode: false,
    scrollOnUserInput: true,
    scrollOnOutput: false,
    scrollSensitivity: 3,
    smoothScrollDuration: 0,
    fastScrollSensitivity: 5,
    fastScrollModifier: 'alt',
    macOptionIsMeta: false,
    macOptionClickForcesSelection: false,
    rightClickSelectsWord: false,
    rendererType: 'canvas',
  })

  fitAddon = new FitAddon()
  term.loadAddon(fitAddon)
  
  const webLinksAddon = new WebLinksAddon()
  term.loadAddon(webLinksAddon)
  
  if (terminalRef.value) {
    term.open(terminalRef.value)
    fitAddon.fit()
    term.focus()
    
    // IME Fix for composing
    setupHelperTextarea()
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          setupHelperTextarea()
        }
      })
    })
    observer.observe(terminalRef.value, { childList: true, subtree: true })
    
    // Terminal input handler
    term.onData((data) => {
      if (isComposing) return
      emit('data', data)
    })

    term.onSelectionChange(() => {
      localHasSelection.value = hasSelection()
      emit('selection-change', localHasSelection.value)
    })
    
    // Optimize wheel scroll
    enableWheelScroll()
    const wheelObserver = new MutationObserver(() => enableWheelScroll())
    wheelObserver.observe(terminalRef.value, { childList: true, subtree: true })
    
    wheelHandler = (e) => {
      const viewport = terminalRef.value?.querySelector('.xterm-viewport')
      if (viewport) {
        e.preventDefault()
        viewport.scrollTop += e.deltaY
      }
    }
    terminalRef.value.addEventListener('wheel', wheelHandler, { passive: false })
    
    // Custom key handlers
    term.attachCustomKeyEventHandler((event) => {
      // Prevent browser default on Ctrl+ keys except common text manipulation
      if ((event.ctrlKey || event.metaKey) && 
          !['c', 'v', 'a', 'z', 'x', 'y'].includes(event.key.toLowerCase())) {
        event.preventDefault()
      }
      return true
    })
    
    // Space bar behavior
    term.attachCustomKeyEventHandler((event) => {
      if (event.code === 'Space' || event.key === ' ') {
        event.preventDefault()
        if (props.isConnected) {
          emit('data', ' ')
          term.scrollToBottom()
        }
        return false
      }
      return true
    })
    
    // Paste support
    term.attachCustomKeyEventHandler((event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'v') {
        event.preventDefault()
        navigator.clipboard.readText().then(text => {
          if (props.isConnected) {
            emit('data', text)
          }
        }).catch(err => console.warn('Paste failed:', err))
        return false
      }
      return true
    })
    
    // Copy support
    term.attachCustomKeyEventHandler((event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c') {
        const selection = term.getSelection()
        if (selection) navigator.clipboard.writeText(selection)
      }
      return true
    })
  }
}

// Fixed IME for multi-character inputs (e.g. Chinese)
const setupHelperTextarea = () => {
  const textarea = terminalRef.value?.querySelector('.xterm-helper-textarea')
  if (textarea && !textarea._imeFixed) {
    textarea._imeFixed = true

    textarea.style.opacity = '0'
    textarea.style.color = 'transparent'
    textarea.style.position = 'absolute'
    textarea.style.bottom = '4px'
    textarea.style.left = '4px'
    textarea.style.width = '1px'
    textarea.style.height = '1px'
    textarea.style.zIndex = '1'
    textarea.style.caretColor = 'transparent'

    textarea.addEventListener('compositionstart', (e) => {
      isComposing = true
      e.stopImmediatePropagation()
    }, true)

    textarea.addEventListener('compositionupdate', (e) => {
      e.stopImmediatePropagation()
    }, true)

    textarea.addEventListener('compositionend', (e) => {
      e.stopImmediatePropagation()
      isComposing = false
      const text = e.data
      if (text && props.isConnected) {
        emit('data', text)
      }
      Promise.resolve().then(() => { textarea.value = '' })
    }, true)
  }
}

// Enhance viewport wheel scrolling
const enableWheelScroll = () => {
  const viewport = terminalRef.value?.querySelector('.xterm-viewport')
  if (viewport) {
    if (viewportWheelHandler) viewport.removeEventListener('wheel', viewportWheelHandler)
    
    viewportWheelHandler = (event) => {
      event.preventDefault()
      const deltaY = event.deltaY
      const deltaMode = event.deltaMode
      
      if (deltaMode === 0) {
        const scrollAmount = Math.sign(deltaY) * Math.ceil(Math.abs(deltaY) / 8)
        viewport.scrollTop += scrollAmount * 20
      } else if (deltaMode === 1) {
        viewport.scrollTop += deltaY * 20
      } else {
        viewport.scrollTop += deltaY * viewport.clientHeight
      }
    }
    
    viewport.addEventListener('wheel', viewportWheelHandler, { passive: false })
    viewport.style.overflowY = 'auto'
    viewport.style.overflowX = 'hidden'
  }
}

const handleResize = () => {
  if (fitAddon && term) {
    fitAddon.fit()
    const dimensions = fitAddon.proposeDimensions()
    if (dimensions) {
      const adjustedRows = Math.max(1, dimensions.rows - 1)
      term.resize(dimensions.cols, adjustedRows)
      emit('resize', {
        rows: adjustedRows,
        cols: dimensions.cols,
        height: dimensions.height,
        width: dimensions.width
      })
    }
  }
}

// Component methods to expose via defineExpose
const write = (data) => {
  if (term) term.write(data)
}

const writeError = (msg) => {
  if (term) term.write(`\r\n\x1b[31m${msg}\x1b[0m\r\n`)
}

const writeWarning = (msg) => {
  if (term) term.write(`\r\n\x1b[33m${msg}\x1b[0m\r\n`)
}

const focus = () => {
  if (term) term.focus()
}

const clear = () => {
  if (term) term.clear()
}

const getSelection = () => {
  return term ? term.getSelection() : ''
}

const selectAll = () => {
  if (term) term.selectAll()
}

const hasSelection = () => {
  return term && term.getSelection() && term.getSelection().length > 0
}

const scrollToTop = () => {
  if (term && typeof term.scrollToTop === 'function') term.scrollToTop()
}

const scrollToBottom = () => {
  if (term && typeof term.scrollToBottom === 'function') term.scrollToBottom()
}

// ------ Context Menu Methods ------
const showContextMenu = (event) => {
  event.preventDefault()
  contextMenu.value = {
    visible: true,
    x: event.clientX,
    y: event.clientY
  }
}

const hideContextMenu = () => {
  contextMenu.value.visible = false
}

const copyFromContextMenu = async () => {
  if (hasSelection()) {
    const selection = getSelection()
    try {
      await navigator.clipboard.writeText(selection)
      ElMessage.success(`已复制 ${selection.length} 个字符`)
      hideContextMenu()
    } catch (error) {
      console.warn('复制失败:', error)
      ElMessage.error('复制失败，请重试')
    }
  }
}

const pasteFromContextMenu = async () => {
  if (props.isConnected) {
    try {
      const text = await navigator.clipboard.readText()
      emit('data', text) // Send data back up to the parent to handle input
      hideContextMenu()
    } catch (error) {
      console.warn('粘贴失败:', error)
      ElMessage.error('粘贴失败，请重试')
    }
  }
}

const selectAllFromContextMenu = () => {
  selectAll()
  hideContextMenu()
}

const clearTerminal = () => {
  reset()
  hideContextMenu()
}

const onDocumentClick = () => {
  if (contextMenu.value.visible) {
    hideContextMenu()
  }
}
// ------ End Context Menu Methods ------

const reset = () => {
  if (term) {
    term.reset()
    term.focus()
    term.write('\x1b[?25h')
    scrollToTop()
    const viewport = terminalRef.value?.querySelector('.xterm-viewport')
    if (viewport) viewport.scrollTop = initialScrollTop || 0
  }
}

const fit = () => {
  handleResize()
}

defineExpose({
  write,
  writeError,
  writeWarning,
  focus,
  clear,
  getSelection,
  selectAll,
  hasSelection,
  scrollToTop,
  scrollToBottom,
  reset,
  fit
})

onMounted(async () => {
  await nextTick()
  initTerminal()
  window.addEventListener('resize', handleResize)
  document.addEventListener('click', onDocumentClick)
})

onUnmounted(() => {
  if (term) {
    term.dispose()
    term = null
  }
  if (terminalRef.value && wheelHandler) {
    terminalRef.value.removeEventListener('wheel', wheelHandler)
    wheelHandler = null
  }
  const viewportEl = terminalRef.value?.querySelector('.xterm-viewport')
  if (viewportEl && viewportWheelHandler) {
    viewportEl.removeEventListener('wheel', viewportWheelHandler)
    viewportWheelHandler = null
  }
  window.removeEventListener('resize', handleResize)
  document.removeEventListener('click', onDocumentClick)
})

</script>

<style scoped>
.xterm-terminal-container {
  flex: 1;
  width: 100%;
  padding: 2px;
  cursor: text;
  overflow: hidden;
  position: relative;
  min-height: 0;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  background-color: #000000;
}

.xterm-inner-container {
  flex: 1;
  width: 100%;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.xterm-inner-container:hover {
  outline: none;
}

.context-menu {
  position: fixed;
  background: #2d2d30;
  border: 1px solid #454545;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.6);
  z-index: 1000;
  min-width: 150px;
  padding: 4px 0;
}

.menu-item {
  display: flex;
  align-items: center;
  padding: 5px 16px;
  cursor: pointer;
  color: #d4d4d4;
  font-size: 12px;
  font-family: "Microsoft YaHei", "Segoe UI", sans-serif;
  gap: 8px;
  transition: background 0.1s;
}

.menu-item:hover {
  background-color: #094771;
  color: #ffffff;
}

.menu-item.disabled {
  color: #666;
  cursor: not-allowed;
}

.menu-item.disabled:hover {
  background-color: transparent;
}

.menu-divider {
  height: 1px;
  background-color: #454545;
  margin: 4px 0;
}

.menu-item .el-icon {
  font-size: 13px;
  width: 16px;
}

/* XTerm.js CSS overrides */
:deep(.xterm) {
  padding: 0 !important;
  overflow: hidden !important;
  height: 100% !important;
  width: 100% !important;
  display: flex !important;
  flex-direction: column !important;
}

:deep(.xterm-viewport) {
  background-color: transparent !important;
  overflow-y: auto !important;
  overflow-x: hidden !important;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.3) rgba(255, 255, 255, 0.1);
  position: relative !important;
  direction: ltr !important;
  width: 100% !important;
  height: 100% !important;
  pointer-events: auto !important;
}

:deep(.xterm-viewport::-webkit-scrollbar) {
  width: 12px;
}
:deep(.xterm-viewport::-webkit-scrollbar-track) {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  margin: 2px;
}
:deep(.xterm-viewport::-webkit-scrollbar-thumb) {
  background: rgba(255, 255, 255, 0.3);
  border-radius: 6px;
  border: 2px solid transparent;
  background-clip: content-box;
  transition: background 0.2s ease;
}
:deep(.xterm-viewport::-webkit-scrollbar-thumb:hover) {
  background: rgba(255, 255, 255, 0.5);
}
:deep(.xterm-viewport::-webkit-scrollbar-thumb:active) {
  background: rgba(255, 255, 255, 0.7);
}

:deep(.xterm-screen) {
  background-color: transparent !important;
  width: 100% !important;
  height: 100% !important;
  display: flex !important;
  flex-direction: column !important;
  overflow: visible !important;
}

:deep(.xterm-screen::after) {
  content: "";
  display: block;
  height: 4px;
  width: 100%;
}

:deep(.xterm-helper-textarea) {
  opacity: 0 !important;
  color: transparent !important;
  caret-color: transparent !important;
  resize: none !important;
  outline: none !important;
  border: none !important;
  padding: 0 !important;
  margin: 0 !important;
}

:deep(.xterm .xterm-selection) {
  background-color: rgba(51, 153, 255, 0.35) !important;
  mix-blend-mode: normal;
}

:deep(.xterm-scroll-area) {
  overflow: visible !important;
}

:deep(.xterm-char-measure-element) {
  position: absolute !important;
  left: -9999px !important;
  top: -9999px !important;
  visibility: hidden !important;
  width: auto !important;
  height: auto !important;
  opacity: 0 !important;
  pointer-events: none !important;
}

:deep(.xterm-rows), :deep(.xterm-row) {
  color: #c0c0c0 !important;
  background-color: transparent !important;
}

:deep(.xterm-selection-layer) {
  background-color: rgba(51, 153, 255, 0.35) !important;
}
</style>
