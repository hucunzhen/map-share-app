// pages/mine/mine.js
// 我的页面 - 登录 + 查看发布记录 + 收藏

const app = getApp()

Page({
  data: {
    isLoggedIn: false,
    userInfo: null,
    myPosts: [],
    myFavorites: [],
    activeTab: 'posts',
    loading: false,
    // 登录表单数据
    tempAvatarUrl: '',
    tempNickName: ''
  },

  onLoad() {
    this.checkLoginStatus()
  },

  onShow() {
    this.checkLoginStatus()
    if (this.data.isLoggedIn) {
      if (this.data.activeTab === 'posts') {
        this.loadMyPosts()
      } else {
        this.loadMyFavorites()
      }
    }
  },

  // 检查登录状态
  checkLoginStatus() {
    const isLoggedIn = app.globalData.isLoggedIn
    const userInfo = app.globalData.userInfo
    this.setData({ isLoggedIn, userInfo })

    // 如果 openid 还没加载完，延迟再检查
    if (!isLoggedIn && !app.globalData.openid) {
      setTimeout(() => this.checkLoginStatus(), 500)
    }
  },

  // 选择头像（button open-type="chooseAvatar" 回调）
  onChooseAvatar(e) {
    const { avatarUrl } = e.detail
    this.setData({ tempAvatarUrl: avatarUrl })
  },

  // 输入昵称（input type="nickname" 回调）
  onNicknameInput(e) {
    this.setData({ tempNickName: e.detail.value })
  },

  // 点击登录
  onLogin() {
    const { tempAvatarUrl, tempNickName } = this.data
    if (!tempNickName || !tempNickName.trim()) {
      wx.showToast({ title: '请输入昵称', icon: 'none' })
      return
    }

    wx.showLoading({ title: '登录中...' })

    // 有新头像则上传到云存储
    if (tempAvatarUrl && (tempAvatarUrl.startsWith('http://tmp') || tempAvatarUrl.startsWith('wxfile://'))) {
      const cloudPath = `avatars/${app.globalData.openid}_${Date.now()}.png`
      wx.cloud.uploadFile({
        cloudPath,
        filePath: tempAvatarUrl,
        success: uploadRes => {
          this.saveUserInfo(tempNickName.trim(), uploadRes.fileID)
        },
        fail: () => {
          // 上传失败用临时路径
          this.saveUserInfo(tempNickName.trim(), tempAvatarUrl)
        }
      })
    } else {
      this.saveUserInfo(tempNickName.trim(), tempAvatarUrl || '')
    }
  },

  // 保存用户信息
  saveUserInfo(nickName, avatarUrl) {
    app.login({ nickName, avatarUrl }, success => {
      wx.hideLoading()
      if (success) {
        this.setData({
          isLoggedIn: true,
          userInfo: app.globalData.userInfo,
          tempAvatarUrl: '',
          tempNickName: ''
        })
        wx.showToast({ title: '登录成功', icon: 'success' })
        this.loadMyPosts()
      } else {
        wx.showToast({ title: '登录失败，请重试', icon: 'none' })
      }
    })
  },

  // 退出登录
  onLogout() {
    wx.showModal({
      title: '确认退出',
      content: '退出后需要重新登录才能发布和收藏',
      success: res => {
        if (res.confirm) {
          app.globalData.isLoggedIn = false
          app.globalData.userInfo = null
          this.setData({
            isLoggedIn: false,
            userInfo: null,
            myPosts: [],
            myFavorites: [],
            tempAvatarUrl: '',
            tempNickName: ''
          })
        }
      }
    })
  },

  // 切换标签
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({ activeTab: tab })
    if (tab === 'posts') {
      this.loadMyPosts()
    } else {
      this.loadMyFavorites()
    }
  },

  // 加载我的发布
  loadMyPosts() {
    const openid = app.globalData.openid
    if (!openid) {
      setTimeout(() => this.loadMyPosts(), 1000)
      return
    }

    this.setData({ loading: true })
    wx.cloud.database().collection('location_info')
      .where({ author: openid })
      .orderBy('createTime', 'desc')
      .get()
      .then(res => {
        const data = res.data || []
        data.forEach(item => {
          item.createTime = this.formatTime(item.createTime)
        })
        this.setData({ myPosts: data, loading: false })
      })
      .catch(err => {
        console.error('加载失败', err)
        this.setData({ loading: false })
      })
  },

  // 加载我的收藏
  loadMyFavorites() {
    const openid = app.globalData.openid
    if (!openid) return

    this.setData({ loading: true })

    const db = wx.cloud.database()
    const _ = db.command

    db.collection('favorites')
      .where({ userId: openid })
      .orderBy('createTime', 'desc')
      .get()
      .then(res => {
        const favoriteIds = res.data.map(f => f.infoId)
        if (favoriteIds.length === 0) {
          this.setData({ myFavorites: [], loading: false })
          return
        }

        // 批量查询收藏的信息详情
        const batch = Math.ceil(favoriteIds.length / 10)
        let allItems = []

        for (let i = 0; i < batch; i++) {
          const ids = favoriteIds.slice(i * 10, (i + 1) * 10)
          db.collection('location_info')
            .where({ _id: _.in(ids) })
            .get()
            .then(result => {
              allItems = [...allItems, ...(result.data || [])]
              if (i === batch - 1) {
                allItems.forEach(item => {
                  item.createTime = this.formatTime(item.createTime)
                })
                this.setData({ myFavorites: allItems, loading: false })
              }
            })
        }
      })
      .catch(err => {
        console.error('加载失败', err)
        this.setData({ loading: false })
      })
  },

  // 查看详情
  goDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/detail/detail?id=${id}`
    })
  },

  // 打开高德导航
  goNavigate(e) {
    const { lat, lon, name } = e.currentTarget.dataset
    wx.openLocation({ latitude: lat, longitude: lon, name: name || '', scale: 15 })
  },

  // 取消收藏
  removeFavorite(e) {
    const id = e.currentTarget.dataset.id
    const openid = app.globalData.openid

    wx.cloud.database().collection('favorites')
      .where({ infoId: id, userId: openid })
      .remove()
      .then(() => {
        wx.showToast({ title: '已取消收藏', icon: 'success' })
        this.loadMyFavorites()
      })
  },

  // 删除我的发布
  deletePost(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '确认删除',
      content: '删除后无法恢复，确定要删除吗？',
      success: res => {
        if (res.confirm) {
          wx.cloud.database().collection('location_info')
            .doc(id)
            .remove()
            .then(() => {
              wx.showToast({ title: '已删除', icon: 'success' })
              this.loadMyPosts()
            })
        }
      }
    })
  },

  // 进入我的消息
  goMessages() {
    wx.navigateTo({
      url: '/pages/chatlist/chatlist'
    })
  },

  // 格式化时间
  formatTime(date) {
    const d = date instanceof Date ? date : new Date(date)
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const hour = String(d.getHours()).padStart(2, '0')
    const min = String(d.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day} ${hour}:${min}`
  }
})