// app.js
// 地图信息共享小程序 - 入口文件

App({
  globalData: {
    userInfo: null,
    openid: null
  },

  onLaunch() {
    // 初始化云开发
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
    } else {
      wx.cloud.init({
        env: 'cloud1-d2gqhvl917f27dc38', // TODO: 替换为你的云环境 ID
        traceUser: true
      })
    }

    // 获取用户 openid
    this.getOpenId()
  },

  // 获取 openid
  getOpenId() {
    wx.cloud.callFunction({
      name: 'login',
      success: res => {
        this.globalData.openid = res.result.openid
        console.log('openid:', this.globalData.openid)
      },
      fail: err => {
        console.error('获取 openid 失败', err)
      }
    })
  },

  // 获取当前用户信息
  getUserInfo(callback) {
    wx.getSetting({
      success: settingRes => {
        if (settingRes.authSetting['scope.userInfo']) {
          wx.getUserInfo({
            success: res => {
              this.globalData.userInfo = res.userInfo
              callback && callback(res.userInfo)
            }
          })
        } else {
          // 未授权，尝试一键获取
          wx.getUserProfile({
            desc: '用于展示发布者信息',
            success: res => {
              this.globalData.userInfo = res.userInfo
              callback && callback(res.userInfo)
            },
            fail: () => {
              callback && callback(null)
            }
          })
        }
      }
    })
  }
})