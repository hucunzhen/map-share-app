// 路线规划：请求 map-route-analyzer /api/route，在 <map> 上绘制 polyline

const app = getApp()
const { planRoute } = require('../../utils/maproute.js')

const ROUTE_PROFILE_OPTIONS = [
  { value: 'driving', label: '开车' },
  { value: 'walking', label: '步行' },
  { value: 'cycling', label: '骑行' }
]

Page({
  data: {
    latitude: 28.0,
    longitude: 120.6,
    scale: 12,
    markers: [],
    polyline: [],
    pickHint: '先点「选起点 / 选终点」，再在地图上点选位置；或从详情页带入终点。',
    routeSummary: '',
    planning: false,
    routeProfile: 'driving',
    routeProfileOptions: ROUTE_PROFILE_OPTIONS
  },

  pickPhase: null,
  fromPt: null,
  toPt: null,

  onLoad(options) {
    const toLat = options.toLat != null && options.toLat !== '' ? parseFloat(options.toLat) : NaN
    const toLng = options.toLng != null && options.toLng !== '' ? parseFloat(options.toLng) : NaN
    if (!Number.isNaN(toLat) && !Number.isNaN(toLng)) {
      this.toPt = { latitude: toLat, longitude: toLng }
    }
    this.syncMarkers()
    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        this.setData({
          latitude: res.latitude,
          longitude: res.longitude,
          scale: 13
        })
        if (!this.fromPt) {
          this.fromPt = { latitude: res.latitude, longitude: res.longitude }
        }
        this.syncMarkers()
      },
      fail: () => {
        this.syncMarkers()
      }
    })
  },

  onReady() {
    this._mapCtx = wx.createMapContext('routeMap', this)
  },

  syncMarkers() {
    const markers = []
    let id = 1
    if (this.fromPt) {
      markers.push({
        id: id++,
        latitude: this.fromPt.latitude,
        longitude: this.fromPt.longitude,
        title: '起点',
        iconPath: '/images/marker.png',
        width: 28,
        height: 28,
        callout: { content: '起点', display: 'BYCLICK' }
      })
    }
    if (this.toPt) {
      markers.push({
        id: id++,
        latitude: this.toPt.latitude,
        longitude: this.toPt.longitude,
        title: '终点',
        iconPath: '/images/marker.png',
        width: 28,
        height: 28,
        callout: { content: '终点', display: 'BYCLICK' }
      })
    }
    this.setData({ markers })
  },

  onPickFrom() {
    this.pickPhase = 'from'
    this.setData({ pickHint: '请在地图上点击设置起点（GCJ-02）。' })
  },

  onPickTo() {
    this.pickPhase = 'to'
    this.setData({ pickHint: '请在地图上点击设置终点（GCJ-02）。' })
  },

  onRouteProfileTap(e) {
    const v = e.currentTarget.dataset.profile
    if (!v) return
    const ok = ROUTE_PROFILE_OPTIONS.some((o) => o.value === v)
    if (!ok) return
    this.setData({ routeProfile: v })
  },

  onMapTap(e) {
    const lat = e.detail && e.detail.latitude
    const lng = e.detail && e.detail.longitude
    if (lat == null || lng == null) return
    if (this.pickPhase === 'from') {
      this.fromPt = { latitude: lat, longitude: lng }
      this.pickPhase = null
      this.setData({ pickHint: '已更新起点。' })
      this.syncMarkers()
      return
    }
    if (this.pickPhase === 'to') {
      this.toPt = { latitude: lat, longitude: lng }
      this.pickPhase = null
      this.setData({ pickHint: '已更新终点。' })
      this.syncMarkers()
    }
  },

  onClear() {
    this.pickPhase = null
    this.fromPt = null
    this.toPt = null
    this.setData({
      polyline: [],
      routeSummary: '',
      pickHint: '已清空。请重新选点。'
    })
    this.syncMarkers()
  },

  onPlan() {
    const base = app.globalData.mapRouteApiBase
    if (!base || !String(base).trim()) {
      wx.showModal({
        title: '未配置服务地址',
        content: '请在 app.js 的 globalData 中设置 mapRouteApiBase 为已部署的 map-route-analyzer 根 URL（https），并在微信公众平台配置 request 合法域名。',
        showCancel: false
      })
      return
    }
    if (!this.fromPt || !this.toPt) {
      wx.showToast({ title: '请先设置起点和终点', icon: 'none' })
      return
    }
    const profile = this.data.routeProfile || 'driving'
    this.setData({ planning: true, routeSummary: '' })
    planRoute(base, {
      fromLat: this.fromPt.latitude,
      fromLng: this.fromPt.longitude,
      toLat: this.toPt.latitude,
      toLng: this.toPt.longitude,
      engine: 'amap',
      profile,
      amapKey: app.globalData.mapRouteAmapKey || ''
    })
      .then((route) => {
        const path = route.path_lat_lng
        if (!path || !path.length) {
          wx.showToast({ title: '未返回路线坐标', icon: 'none' })
          this.setData({ polyline: [], planning: false })
          return
        }
        const points = path.map((pair) => ({
          latitude: pair[0],
          longitude: pair[1]
        }))
        const polyline = [
          {
            points,
            color: '#DC2626DD',
            width: 5,
            borderColor: '#991B1B',
            borderWidth: 1
          }
        ]
        const km = (route.distance_m / 1000).toFixed(2)
        const min = Math.round(route.duration_s / 60)
        const opt = ROUTE_PROFILE_OPTIONS.find((o) => o.value === (route.profile || profile))
        const modeLabel = opt ? opt.label : route.profile || profile
        const summary = `约 ${km} km · 约 ${min} 分钟 · ${route.point_count || points.length} 个点 · ${modeLabel}`
        this.setData({ polyline, routeSummary: summary, planning: false })
        if (this._mapCtx && typeof this._mapCtx.includePoints === 'function') {
          this._mapCtx.includePoints({
            points,
            padding: [56, 56, 56, 56]
          })
        }
      })
      .catch((err) => {
        const msg = err && err.message ? err.message : '规划失败'
        this.setData({ polyline: [], planning: false })
        if (msg.length > 18) {
          wx.showModal({ title: '路线规划失败', content: msg, showCancel: false })
        } else {
          wx.showToast({ title: msg.slice(0, 40), icon: 'none' })
        }
      })
  }
})
