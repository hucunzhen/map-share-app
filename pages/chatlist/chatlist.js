// pages/chatlist/chatlist.js
// 消息列表页 - 显示会话列表 + 公共聊天室入口

const app = getApp()
const db = wx.cloud.database()

Page({
  data: {
    conversations: [],
    loading: true,
    unreadTotal: 0
  },

  onLoad() {
    this.loadConversations()
  },

  onShow() {
    this.loadConversations()
    // 设置消息监听
    this.startWatch()
  },

  onHide() {
    // 停止监听
    if (this.watcher) {
      this.watcher.close()
      this.watcher = null
    }
  },

  onUnload() {
    if (this.watcher) {
      this.watcher.close()
      this.watcher = null
    }
  },

  // 加载会话列表
  loadConversations() {
    const openid = app.globalData.openid
    if (!openid) {
      setTimeout(() => this.loadConversations(), 500)
      return
    }

    this.setData({ loading: true })

    // 查询包含当前用户的会话
    db.collection('conversations')
      .where({
        participants: openid
      })
      .orderBy('lastTime', 'desc')
      .get()
      .then(res => {
        const conversations = res.data || []
        conversations.forEach(c => {
          c.lastTimeStr = this.formatTime(c.lastTime)
          // 私聊：显示对方昵称
          if (c.type === 'private') {
            const otherIndex = c.participants.indexOf(openid)
            const otherInfo = c.participantInfos && c.participantInfos[otherIndex === 0 ? 1 : 0]
            c.displayName = otherInfo ? otherInfo.nickName : '未知用户'
            c.displayAvatar = otherInfo ? otherInfo.avatarUrl : ''
          }
        })
        this.setData({ conversations, loading: false })
      })
      .catch(err => {
        console.error('加载会话失败', err)
        this.setData({ loading: false })
      })
  },

  // 监听会话变化
  startWatch() {
    const openid = app.globalData.openid
    if (!openid) return

    if (this.watcher) {
      this.watcher.close()
    }

    this.watcher = db.collection('conversations')
      .where({
        participants: openid
      })
      .watch({
        onChange: snapshot => {
          if (snapshot.type === 'init') return
          // 有变化时重新加载列表
          this.loadConversations()
        },
        onError: err => {
          console.error('会话监听错误', err)
        }
      })
  },

  // 进入公共聊天室
  goPublicChat() {
    wx.navigateTo({
      url: '/pages/chat/chat?type=public'
    })
  },

  // 进入私聊
  goChat(e) {
    const { conversationkey, displayname } = e.currentTarget.dataset
    wx.navigateTo({
      url: `/pages/chat/chat?conversationKey=${conversationkey}&chatName=${encodeURIComponent(displayname)}`
    })
  },

  // 格式化时间
  formatTime(date) {
    if (!date) return ''
    const d = date instanceof Date ? date : new Date(date)
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const msgDate = new Date(d.getFullYear(), d.getMonth(), d.getDate())

    const hour = String(d.getHours()).padStart(2, '0')
    const min = String(d.getMinutes()).padStart(2, '0')
    const timeStr = `${hour}:${min}`

    if (msgDate.getTime() === today.getTime()) {
      return timeStr
    } else if (msgDate.getTime() === today.getTime() - 86400000) {
      return '昨天 ' + timeStr
    } else {
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${month}-${day} ${timeStr}`
    }
  }
})