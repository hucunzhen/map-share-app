// app.js
// 地图信息共享小程序 - 入口文件

App({
  globalData: {
    userInfo: null,
    openid: null,
    isLoggedIn: false,
    /** map-route-analyzer 根地址（无末尾 /），须与微信公众平台「request 合法域名」完全一致。
     * 当前为 https + 非 443 端口，后台须添加整行： https://dieinvain.duckdns.org:18765
     * 若只配置 https://dieinvain.duckdns.org（无端口），带 :18765 的请求会报 url not in domain list。
     * 真机/体验版必须配置域名；开发者工具可配合 project.private.config.json 里 urlCheck:false 先联调。
     */
    mapRouteApiBase: 'https://dieinvain.duckdns.org:18765',
    /** 可选；留空则路线服务使用其服务端环境变量中的高德 Key */
    mapRouteAmapKey: ''
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
        // 登录成功后检查用户是否已注册
        this.checkUserInfo()
      },
      fail: err => {
        console.error('获取 openid 失败', err)
      }
    })
  },

  // 检查用户是否已注册（从云数据库读取）
  checkUserInfo() {
    const openid = this.globalData.openid
    if (!openid) return

    const db = wx.cloud.database()
    db.collection('users').where({
      _openid: openid
    }).get().then(res => {
      if (res.data && res.data.length > 0) {
        this.globalData.userInfo = res.data[0]
        this.globalData.isLoggedIn = true
      }
    }).catch(err => {
      console.error('检查用户信息失败', err)
    })
  },

  // 保存用户登录信息到云数据库
  login(userInfo, callback) {
    const openid = this.globalData.openid
    if (!openid) {
      callback && callback(false)
      return
    }

    const db = wx.cloud.database()
    const userData = {
      nickName: userInfo.nickName,
      avatarUrl: userInfo.avatarUrl,
      updateTime: db.serverDate()
    }

    // 检查用户是否已存在
    db.collection('users').where({
      _openid: openid
    }).get().then(res => {
      if (res.data && res.data.length > 0) {
        // 已存在，更新信息
        db.collection('users').doc(res.data[0]._id).update({
          data: userData
        }).then(() => {
          this.globalData.userInfo = { ...res.data[0], ...userData }
          this.globalData.isLoggedIn = true
          callback && callback(true)
        }).catch(() => {
          callback && callback(false)
        })
      } else {
        // 新用户，创建记录
        userData.createTime = db.serverDate()
        db.collection('users').add({
          data: userData
        }).then(() => {
          this.globalData.userInfo = userData
          this.globalData.isLoggedIn = true
          callback && callback(true)
        }).catch(() => {
          callback && callback(false)
        })
      }
    }).catch(() => {
      callback && callback(false)
    })
  }
})