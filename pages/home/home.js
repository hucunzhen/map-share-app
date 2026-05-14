// pages/home/home.js
// 首页 - 信息列表 + 地图视图

const app = getApp()

Page({
  data: {
    listData: [],          // 列表模式数据
    markers: [],            // 地图模式标记点
    latitude: 28.0,         // 默认温州坐标
    longitude: 120.6,
    scale: 12,              // 地图缩放级别
    viewMode: 'list',       // list | map
    page: 1,
    pageSize: 10,
    hasMore: true,
    loading: false,
    cityName: '温州市'
  },

  onLoad() {
    // 默认显示温州区域
    this.loadData()
  },

  onShow() {
    // 每次进入刷新数据
    this.refreshData()
  },

  onPullDownRefresh() {
    this.refreshData()
    wx.stopPullDownRefresh()
  },

  // 刷新数据
  refreshData() {
    this.setData({ page: 1, listData: [], hasMore: true })
    this.loadData()
  },

  // 加载数据
  loadData() {
    if (this.data.loading || !this.data.hasMore) return
    this.setData({ loading: true })

    wx.cloud.database().collection('location_info')
      .orderBy('createTime', 'desc')
      .skip((this.data.page - 1) * this.data.pageSize)
      .limit(this.data.pageSize)
      .get()
      .then(res => {
        let newData = res.data || []
        // 处理数据
        newData.forEach(item => {
          item.createTime = this.formatTime(item.createTime)
        })

        this.setData({
          listData: this.data.page === 1 ? newData : [...this.data.listData, ...newData],
          markers: newData.map(item => this.createMarker(item)),
          hasMore: newData.length >= this.data.pageSize,
          page: this.data.page + 1,
          loading: false
        })
      })
      .catch(err => {
        console.error('加载数据失败', err)
        this.setData({ loading: false })
        wx.showToast({ title: '加载失败', icon: 'none' })
      })
  },

  // 生成分享卡片
  onShareAppMessage() {
    return {
      title: '发现一个好地方，分享给你',
      path: '/pages/detail/detail?id=xxx'
    }
  },

  // 创建地图标记点
  createMarker(item) {
    return {
      id: item._id,
      latitude: item.latitude,
      longitude: item.longitude,
      title: item.title,
      iconPath: '/images/marker.png',
      width: 32,
      height: 32,
      callout: {
        content: item.title,
        color: '#333333',
        fontSize: 12,
        borderRadius: 4,
        padding: 6,
        display: 'ALWAYS'
      }
    }
  },

  goRoutePlan() {
    wx.navigateTo({ url: '/pages/route/route' })
  },

  // 切换视图模式
  switchView(e) {
    const mode = e.currentTarget.dataset.mode
    this.setData({ viewMode: mode })
  },

  // 查看详情
  goDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/detail/detail?id=${id}`
    })
  },

  // 点击地图标记
  onMarkerTap(e) {
    const id = e.detail.markerId
    wx.navigateTo({
      url: `/pages/detail/detail?id=${id}`
    })
  },

  // 格式化时间
  formatTime(date) {
    const d = date instanceof Date ? date : new Date(date)
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  },

  // 触底加载
  onReachBottom() {
    this.loadData()
  }
})