// pages/chat/chat.js
// 聊天页 - 支持私聊和公共聊天室

const app = getApp()
const db = wx.cloud.database()

Page({
  data: {
    // 聊天类型：private / public
    chatType: 'private',
    // 会话标识
    conversationKey: '',
    // 聊天对象名称
    chatName: '',
    // 对方 openid（私聊）
    targetUser: '',
    // 关联的位置信息 ID
    infoId: '',
    // 消息列表
    messages: [],
    // 输入内容
    inputContent: '',
    // 加载状态
    loading: true,
    sending: false,
    // 分页
    hasMore: true,
    page: 0,
    pageSize: 20
  },

  watcher: null,

  onLoad(options) {
    const chatType = options.type || 'private'
    const conversationKey = options.conversationKey || ''
    const chatName = decodeURIComponent(options.chatName || '聊天')
    const targetUser = options.targetUser || ''
    const infoId = options.infoId || ''

    this.setData({
      chatType,
      conversationKey,
      chatName,
      targetUser,
      infoId
    })

    // 设置导航栏标题
    wx.setNavigationBarTitle({
      title: chatType === 'public' ? '公共聊天室' : chatName
    })

    // 如果没有 conversationKey，生成一个
    if (!conversationKey) {
      if (chatType === 'public') {
        this.setData({ conversationKey: 'public_chat' })
      } else if (targetUser) {
        const key = this.buildConversationKey(app.globalData.openid, targetUser)
        this.setData({ conversationKey: key })
      }
    }

    this.loadMessages()
  },

  onShow() {
    this.startWatch()
  },

  onHide() {
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

  // 生成会话 key（两个 openid 排序后拼接）
  buildConversationKey(openid1, openid2) {
    return [openid1, openid2].sort().join('_')
  },

  // 加载消息
  loadMessages() {
    const { conversationKey, page, pageSize } = this.data
    if (!conversationKey) return

    this.setData({ loading: true })

    db.collection('messages')
      .where({ conversationKey })
      .orderBy('createTime', 'desc')
      .skip(page * pageSize)
      .limit(pageSize)
      .get()
      .then(res => {
        const messages = (res.data || []).reverse()
        messages.forEach(m => {
          m.timeStr = this.formatMsgTime(m.createTime)
          m.isMine = m.sender === app.globalData.openid
        })
        this.setData({
          messages,
          loading: false,
          hasMore: res.data.length >= pageSize
        })
        this.scrollToBottom()
      })
      .catch(err => {
        console.error('加载消息失败', err)
        this.setData({ loading: false })
      })
  },

  // 加载更多（上拉加载历史消息）
  loadMore() {
    if (!this.data.hasMore || this.data.loading) return

    const { conversationKey, page, pageSize, messages } = this.data
    const nextPage = page + 1

    this.setData({ loading: true })

    db.collection('messages')
      .where({ conversationKey })
      .orderBy('createTime', 'desc')
      .skip(nextPage * pageSize)
      .limit(pageSize)
      .get()
      .then(res => {
        const older = (res.data || []).reverse()
        older.forEach(m => {
          m.timeStr = this.formatMsgTime(m.createTime)
          m.isMine = m.sender === app.globalData.openid
        })
        this.setData({
          messages: [...older, ...messages],
          loading: false,
          hasMore: res.data.length >= pageSize,
          page: nextPage
        })
      })
  },

  // 监听新消息
  startWatch() {
    const { conversationKey } = this.data
    if (!conversationKey) return

    if (this.watcher) {
      this.watcher.close()
    }

    this.watcher = db.collection('messages')
      .where({ conversationKey })
      .watch({
        onChange: snapshot => {
          if (snapshot.type === 'init') return
          // 有新消息，重新加载
          const msgs = snapshot.docs || []
          if (snapshot.type === 'replace' || snapshot.type === 'update') {
            // 增量更新：只追加新消息
            const newMsgs = []
            for (const change of (snapshot.queue || [])) {
              if (change.dataType === 'add') {
                const msg = change.doc
                msg.timeStr = this.formatMsgTime(msg.createTime)
                msg.isMine = msg.sender === app.globalData.openid
                newMsgs.push(msg)
              }
            }
            if (newMsgs.length > 0) {
              this.setData({
                messages: [...this.data.messages, ...newMsgs]
              })
              this.scrollToBottom()
            }
          }
        },
        onError: err => {
          console.error('消息监听错误', err)
        }
      })
  },

  // 输入消息
  onInput(e) {
    this.setData({ inputContent: e.detail.value })
  },

  // 发送消息
  sendMessage() {
    const content = this.data.inputContent.trim()
    if (!content) return

    const openid = app.globalData.openid
    if (!openid) {
      wx.showToast({ title: '请先登录', icon: 'none' })
      return
    }

    const { chatType, conversationKey, targetUser, infoId } = this.data
    const userInfo = app.globalData.userInfo || {}

    this.setData({ sending: true })

    // 1. 写入消息
    const msgData = {
      conversationKey,
      sender: openid,
      senderInfo: {
        nickName: userInfo.nickName || '匿名用户',
        avatarUrl: userInfo.avatarUrl || ''
      },
      content,
      type: 'text',
      createTime: db.serverDate(),
      read: false
    }

    db.collection('messages').add({ data: msgData })
      .then(() => {
        this.setData({ inputContent: '', sending: false })
        this.scrollToBottom()

        // 2. 更新或创建会话
        this.upsertConversation(content)
      })
      .catch(err => {
        console.error('发送失败', err)
        this.setData({ sending: false })
        wx.showToast({ title: '发送失败', icon: 'none' })
      })
  },

  // 更新或创建会话记录
  upsertConversation(lastMessage) {
    const { chatType, conversationKey, targetUser, infoId } = this.data
    const openid = app.globalData.openid
    const userInfo = app.globalData.userInfo || {}

    // 查找是否已有会话
    db.collection('conversations')
      .where({ conversationKey })
      .get()
      .then(res => {
        if (res.data && res.data.length > 0) {
          // 已有会话，更新最后消息
          db.collection('conversations')
            .doc(res.data[0]._id)
            .update({
              data: {
                lastMessage,
                lastTime: db.serverDate()
              }
            })
        } else {
          // 新建会话
          const convData = {
            conversationKey,
            type: chatType,
            participants: chatType === 'public' ? [openid] : [openid, targetUser].sort(),
            participantInfos: chatType === 'public'
              ? [{ nickName: userInfo.nickName || '', avatarUrl: userInfo.avatarUrl || '' }]
              : [
                  { nickName: userInfo.nickName || '', avatarUrl: userInfo.avatarUrl || '' },
                  { nickName: '', avatarUrl: '' } // 对方信息首次发送时未知
                ],
            lastMessage,
            lastTime: db.serverDate()
          }

          if (infoId) {
            convData.infoId = infoId
          }

          db.collection('conversations').add({ data: convData })
        }
      })
  },

  // 滚动到底部
  scrollToBottom() {
    setTimeout(() => {
      wx.pageScrollTo({ bottom: 0, duration: 200 })
    }, 100)
  },

  // 格式化消息时间
  formatMsgTime(date) {
    if (!date) return ''
    const d = date instanceof Date ? date : new Date(date)
    const hour = String(d.getHours()).padStart(2, '0')
    const min = String(d.getMinutes()).padStart(2, '0')
    return `${hour}:${min}`
  }
})