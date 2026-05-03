// pages/mine/mine.js
// 我的页面 - 查看发布记录 + 收藏

const app = getApp()

Page({
  data: {
    userInfo: null,
    myPosts: [],
    myFavorites: [],
    activeTab: 'posts',
    loading: false
  },

  onLoad() {
    // 获取用户信息
    app.getUserInfo(info => {
      this.setData({ userInfo: info })
    })

    // 加载我的发布
    this.loadMyPosts()
  },

  onShow() {
    // 刷新数据
    if (this.data.activeTab === 'posts') {
      this.loadMyPosts()
    } else {
      this.loadMyFavorites()
    }
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

    wx.cloud.database().collection('favorites')
      .where({ userId: openid })
      .orderBy('createTime', 'desc')
      .get()
      .then(res => {
        const favoriteIds = res.data.map(f => f.infoId)

        if (favoriteIds.length === 0) {
          this.setData({ myFavorites: [], loading: false })
          return
        }

        // 查询收藏的信息详情
        const batch = Math.ceil(favoriteIds.length / 10)
        let allItems = []

        for (let i = 0; i < batch; i++) {
          const ids = favoriteIds.slice(i * 10, (i + 1) * 10)
          wx.cloud.database().collection('location_info')
            .where(wx.cloud.database().command.in(ids))
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
    const isIOS = wx.getSystemInfoSync().platform === 'ios'
    const url = isIOS
      ? `iosamap://navi?sourceApplication=miniprogram&poiname=${encodeURIComponent(name)}&lat=${lat}&lon=${lon}&dev=1`
      : `androidamap://navi?sourceApplication=miniprogram&poiname=${encodeURIComponent(name)}&lat=${lat}&lon=${lon}&dev=1`

    wx.navigateToMiniProgram({
      appId: 'wx80fba4xxxx',
      path: `pages/navi/index?lat=${lat}&lon=${lon}&name=${encodeURIComponent(name)}`,
      fail: () => {
        wx.openLocation({ latitude: lat, longitude: lon, name, scale: 15 })
      }
    })
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