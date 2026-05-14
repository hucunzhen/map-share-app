// pages/detail/detail.js
// 详情页 - 查看位置信息 + 跳转高德导航

const app = getApp()

Page({
  data: {
    id: '',
    info: null,
    loading: true,
    isLiked: false,
    likeCount: 0,
    comments: [],
    newComment: '',
    userInfo: null,
    currentUser: ''
  },

  onLoad(options) {
    if (options.id) {
      this.setData({ id: options.id })
      this.loadDetail()
    }
  },

  onShow() {
    // 每次进入刷新评论
    if (this.data.id) {
      this.loadComments()
    }
  },

  // 加载详情
  loadDetail() {
    this.setData({ loading: true })
    
    wx.cloud.database().collection('location_info')
      .doc(this.data.id)
      .get()
      .then(res => {
        const info = res.data
        if (!info) {
          wx.showToast({ title: '信息不存在', icon: 'none' })
          return
        }

        // 格式化时间
        info.createTime = this.formatTime(info.createTime)

        // 更新浏览量
        wx.cloud.database().collection('location_info').doc(this.data.id).update({
          data: { viewCount: wx.cloud.database().command.inc(1) }
        })

        this.setData({
          info: info,
          likeCount: info.likeCount || 0,
          loading: false,
          currentUser: app.globalData.openid || ''
        })

        // 检查是否已收藏
        this.checkLike()
        // 加载评论
        this.loadComments()
      })
      .catch(err => {
        console.error('加载详情失败', err)
        this.setData({ loading: false })
        wx.showToast({ title: '加载失败', icon: 'none' })
      })
  },

  // 检查是否已点赞
  checkLike() {
    const openid = app.globalData.openid
    if (!openid) return

    wx.cloud.database().collection('likes')
      .where({
        infoId: this.data.id,
        userId: openid
      })
      .get()
      .then(res => {
        this.setData({ isLiked: res.data.length > 0 })
      })
  },

  // 加载评论
  loadComments() {
    wx.cloud.database().collection('comments')
      .where({ infoId: this.data.id })
      .orderBy('createTime', 'asc')
      .get()
      .then(res => {
        const comments = res.data || []
        comments.forEach(c => {
          c.createTime = this.formatTime(c.createTime)
        })
        this.setData({ comments })
      })
  },

  // 点赞/取消点赞
  toggleLike() {
    const openid = app.globalData.openid
    if (!openid) {
      wx.showToast({ title: '请稍候...', icon: 'none' })
      return
    }

    const isLiked = this.data.isLiked
    const db = wx.cloud.database()

    if (isLiked) {
      // 取消点赞
      db.collection('likes')
        .where({ infoId: this.data.id, userId: openid })
        .remove()
        .then(() => {
          db.collection('location_info').doc(this.data.id).update({
            data: { likeCount: db.command.inc(-1) }
          })
          this.setData({ isLiked: false, likeCount: this.data.likeCount - 1 })
        })
    } else {
      // 添加点赞
      db.collection('likes').add({
        data: {
          infoId: this.data.id,
          userId: openid,
          createTime: new Date()
        }
      }).then(() => {
        db.collection('location_info').doc(this.data.id).update({
          data: { likeCount: db.command.inc(1) }
        })
        this.setData({ isLiked: true, likeCount: this.data.likeCount + 1 })
      })
    }
  },

  // 联系发布者
  contactAuthor() {
    const openid = app.globalData.openid
    if (!openid) {
      wx.showToast({ title: '请先登录', icon: 'none' })
      return
    }

    const author = this.data.info.author
    if (author === openid) {
      wx.showToast({ title: '这是你自己发布的', icon: 'none' })
      return
    }

    const authorName = this.data.info.authorInfo ? this.data.info.authorInfo.nickName : '发布者'
    wx.navigateTo({
      url: `/pages/chat/chat?type=private&targetUser=${author}&chatName=${encodeURIComponent(authorName)}&infoId=${this.data.id}`
    })
  },

  // 跳转路线规划（当前位置为起点，本页地点为终点）
  goPlanRoute() {
    const info = this.data.info
    if (!info || info.latitude == null || info.longitude == null) {
      wx.showToast({ title: '无有效坐标', icon: 'none' })
      return
    }
    wx.navigateTo({
      url: `/pages/route/route?toLat=${info.latitude}&toLng=${info.longitude}`
    })
  },

  // 跳转高德地图导航
  openAmap() {
    const { latitude, longitude, title, address } = this.data.info
    const name = title || address || '目的地'

    // 判断平台
    const systemInfo = wx.getSystemInfoSync()
    const isIOS = systemInfo.platform === 'ios'

    // 高德 URL Scheme
    let url = ''
    if (isIOS) {
      url = `iosamap://navi?sourceApplication=miniprogram&poiname=${encodeURIComponent(name)}&lat=${latitude}&lon=${longitude}&dev=1`
    } else {
      url = `androidamap://navi?sourceApplication=miniprogram&poiname=${encodeURIComponent(name)}&lat=${latitude}&lon=${longitude}&dev=1`
    }

    wx.navigateToMiniProgram({
      appId: 'wx80fba4xxxx', // 替换为高德小程序 AppId（可选）
      path: `pages/navi/index?lat=${latitude}&lon=${longitude}&name=${encodeURIComponent(name)}`,
      fail: () => {
        // 如果跳转小程序失败，尝试直接打开 APP
        wx.openLocation({
          latitude,
          longitude,
          name: name,
          address: address,
          scale: 15
        })
      }
    })
  },

  // 在地图上查看
  viewOnMap() {
    const { latitude, longitude, title } = this.data.info
    wx.openLocation({
      latitude,
      longitude,
      name: title,
      scale: 15
    })
  },

  // 收藏/取消收藏
  toggleFavorite() {
    const openid = app.globalData.openid
    if (!openid) {
      wx.showToast({ title: '请稍候...', icon: 'none' })
      return
    }

    const db = wx.cloud.database()

    db.collection('favorites')
      .where({
        infoId: this.data.id,
        userId: openid
      })
      .get()
      .then(res => {
        if (res.data.length > 0) {
          // 已收藏，取消
          db.collection('favorites').doc(res.data[0]._id).remove()
          wx.showToast({ title: '已取消收藏', icon: 'none' })
        } else {
          // 未收藏，添加
          db.collection('favorites').add({
            data: {
              infoId: this.data.id,
              userId: openid,
              createTime: new Date()
            }
          })
          wx.showToast({ title: '收藏成功', icon: 'success' })
        }
      })
  },

  // 输入评论
  onCommentInput(e) {
    this.setData({ newComment: e.detail.value })
  },

  // 提交评论
  submitComment() {
    const content = this.data.newComment.trim()
    if (!content) {
      wx.showToast({ title: '请输入评论内容', icon: 'none' })
      return
    }

    const openid = app.globalData.openid

    wx.cloud.database().collection('comments').add({
      data: {
        infoId: this.data.id,
        author: openid || 'anonymous',
        authorInfo: app.globalData.userInfo || null,
        content: content,
        createTime: new Date()
      }
    }).then(res => {
      this.setData({ newComment: '' })
      this.loadComments()
      wx.showToast({ title: '评论成功', icon: 'success' })
    }).catch(err => {
      wx.showToast({ title: '评论失败', icon: 'none' })
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
  },

  // 分享
  onShareAppMessage() {
    const { title, description } = this.data.info
    return {
      title: title || '发现一个好地方',
      desc: description || '点击查看位置信息',
      path: `/pages/detail/detail?id=${this.data.id}`
    }
  }
})