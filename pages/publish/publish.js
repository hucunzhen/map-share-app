// pages/publish/publish.js
// 发布页面

const app = getApp()

Page({
  data: {
    title: '',
    description: '',
    latitude: null,
    longitude: null,
    address: '',
    images: [],
    maxImages: 9,
    videos: [],
    maxVideos: 3,
    loading: false,
    locationLoading: false,
    hasLocation: false
  },

  onShow() {
    // 检查登录状态，未登录跳转到"我的"页
    if (!app.globalData.isLoggedIn) {
      wx.showModal({
        title: '请先登录',
        content: '发布位置信息需要先登录账号',
        confirmText: '去登录',
        success: res => {
          if (res.confirm) {
            wx.switchTab({ url: '/pages/mine/mine' })
          } else {
            wx.switchTab({ url: '/pages/home/home' })
          }
        }
      })
      return
    }
  },

  onLoad() {
    // 页面加载时自动获取位置
    this.getLocation()
  },

  // 获取当前位置
  getLocation() {
    this.setData({ locationLoading: true })

    wx.getLocation({
      type: 'gcj02',
      success: res => {
        this.setData({
          latitude: res.latitude,
          longitude: res.longitude,
          hasLocation: true,
          locationLoading: false
        })
        // 获取地址描述
        this.getAddress(res.latitude, res.longitude)
      },
      fail: err => {
        console.error('获取位置失败', err)
        this.setData({ locationLoading: false })
        wx.showToast({
          title: '请开启位置权限',
          icon: 'none'
        })
      }
    })
  },

  // 根据坐标获取地址
  getAddress(lat, lon) {
    wx.request({
      url: 'https://apis.map.qq.com/ws/geocoder/v1/',
      data: {
        location: `${lat},${lon}`,
        key: 'YOUR_TENCENT_MAP_KEY', // TODO: 替换为你的腾讯地图 Key
        get_poi: 1
      },
      success: res => {
        if (res.data && res.data.result) {
          this.setData({
            address: res.data.result.address || res.data.result.formatted_addresses?.recommend || ''
          })
        }
      }
    })
  },

  // 手动选择位置
  chooseLocation() {
    wx.chooseLocation({
      success: res => {
        this.setData({
          latitude: res.latitude,
          longitude: res.longitude,
          address: res.address || res.name || '',
          hasLocation: true
        })
      }
    })
  },

  // 输入标题
  onTitleInput(e) {
    this.setData({ title: e.detail.value })
  },

  // 输入描述
  onDescInput(e) {
    this.setData({ description: e.detail.value })
  },

  // 选择图片（从相册）
  chooseImages() {
    const remain = this.data.maxImages - this.data.images.length
    if (remain <= 0) {
      wx.showToast({ title: '最多9张图片', icon: 'none' })
      return
    }

    wx.chooseMedia({
      count: remain,
      mediaType: ['image'],
      sourceType: ['album'],
      success: res => {
        const newImages = res.tempFiles.map(item => ({
          tempFilePath: item.tempFilePath,
          size: item.size
        }))
        this.setData({
          images: [...this.data.images, ...newImages].slice(0, this.data.maxImages)
        })
      }
    })
  },

  // 拍照
  takePhoto() {
    const remain = this.data.maxImages - this.data.images.length
    if (remain <= 0) {
      wx.showToast({ title: '最多9张图片', icon: 'none' })
      return
    }

    wx.chooseMedia({
      count: remain,
      mediaType: ['image'],
      sourceType: ['camera'],
      success: res => {
        const newImages = res.tempFiles.map(item => ({
          tempFilePath: item.tempFilePath,
          size: item.size
        }))
        this.setData({
          images: [...this.data.images, ...newImages].slice(0, this.data.maxImages)
        })
      },
      fail: err => {
        // 用户拒绝摄像头权限
        if (err.errMsg && err.errMsg.includes('auth deny')) {
          wx.showModal({
            title: '摄像头权限',
            content: '需要在系统设置中开启摄像头权限',
            confirmText: '去设置',
            success: res => {
              if (res.confirm) {
                wx.openAppAuthorizeSetting()
              }
            }
          })
        }
      }
    })
  },

  // 删除图片
  deleteImage(e) {
    const index = e.currentTarget.dataset.index
    const images = [...this.data.images]
    images.splice(index, 1)
    this.setData({ images })
  },

  // 录像
  takeVideo() {
    if (this.data.videos.length >= this.data.maxVideos) {
      wx.showToast({ title: '最多3个视频', icon: 'none' })
      return
    }

    wx.chooseMedia({
      count: this.data.maxVideos - this.data.videos.length,
      mediaType: ['video'],
      sourceType: ['camera'],
      maxDuration: 60, // 最多60秒
      success: res => {
        const newVideos = res.tempFiles.map(item => {
          const duration = item.duration || 0
          const mins = Math.floor(duration / 60)
          const secs = Math.floor(duration % 60)
          return {
            tempFilePath: item.tempFilePath,
            size: item.size,
            duration: `${mins}:${String(secs).padStart(2, '0')}`
          }
        })
        this.setData({
          videos: [...this.data.videos, ...newVideos].slice(0, this.data.maxVideos)
        })
      },
      fail: err => {
        if (err.errMsg && err.errMsg.includes('auth deny')) {
          wx.showModal({
            title: '摄像头权限',
            content: '需要在系统设置中开启摄像头和麦克风权限',
            confirmText: '去设置',
            success: res => {
              if (res.confirm) {
                wx.openAppAuthorizeSetting()
              }
            }
          })
        }
      }
    })
  },

  // 删除视频
  deleteVideo(e) {
    const index = e.currentTarget.dataset.index
    const videos = [...this.data.videos]
    videos.splice(index, 1)
    this.setData({ videos })
  },

  // 预览图片
  previewImage(e) {
    const index = e.currentTarget.dataset.index
    wx.previewMedia({
      sources: this.data.images.map(img => ({
        url: img.tempFilePath,
        type: 'image'
      })),
      current: index
    })
  },

  // 提交发布
  submit() {
    // 校验登录
    if (!app.globalData.isLoggedIn) {
      wx.showToast({ title: '请先登录', icon: 'none' })
      return
    }

    // 校验必填
    if (!this.data.title.trim()) {
      wx.showToast({ title: '请输入标题', icon: 'none' })
      return
    }
    if (!this.data.hasLocation) {
      wx.showToast({ title: '请获取位置', icon: 'none' })
      return
    }

    this.setData({ loading: true })

    // 上传图片
    const uploadImages = this.data.images.map((img, index) => {
      return wx.cloud.uploadFile({
        cloudPath: `images/${Date.now()}_${index}.jpg`,
        filePath: img.tempFilePath
      })
    })

    // 上传视频
    const uploadVideos = this.data.videos.map((vid, index) => {
      return wx.cloud.uploadFile({
        cloudPath: `videos/${Date.now()}_${index}.mp4`,
        filePath: vid.tempFilePath
      })
    })

    Promise.all([...uploadImages, ...uploadVideos])
      .then(results => {
        const imageUrls = results.slice(0, this.data.images.length).map(r => r.fileID)
        const videoUrls = results.slice(this.data.images.length).map(r => r.fileID)

        // 写入数据库
        return wx.cloud.database().collection('location_info').add({
          data: {
            title: this.data.title.trim(),
            description: this.data.description.trim(),
            latitude: this.data.latitude,
            longitude: this.data.longitude,
            address: this.data.address,
            images: imageUrls,
            videos: videoUrls,
            author: app.globalData.openid || 'anonymous',
            authorName: app.globalData.userInfo ? app.globalData.userInfo.nickName : '',
            authorAvatar: app.globalData.userInfo ? app.globalData.userInfo.avatarUrl : '',
            createTime: new Date(),
            viewCount: 0,
            likeCount: 0
          }
        })
      })
      .then(res => {
        wx.showToast({ title: '发布成功', icon: 'success' })
        // 清空表单
        this.setData({
          title: '',
          description: '',
          images: [],
          videos: [],
          loading: false
        })
        // 跳转到详情页
        setTimeout(() => {
          wx.navigateTo({
            url: `/pages/detail/detail?id=${res._id}`
          })
        }, 1500)
      })
      .catch(err => {
        console.error('发布失败', err)
        this.setData({ loading: false })
        wx.showToast({ title: '发布失败，请重试', icon: 'none' })
      })
  }
})