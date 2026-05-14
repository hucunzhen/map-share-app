/**
 * 调用 map-route-analyzer 部署的 Web 服务（/api/route）。
 * 小程序需在「开发 → 开发管理 → 服务器域名」中将该域名（含非 443 端口时按后台要求）加入 request 合法域名。
 */

function formatHttpError(data) {
  if (!data) return '请求失败'
  if (typeof data.detail === 'string') return data.detail
  if (Array.isArray(data.detail)) {
    return data.detail
      .map((d) => (typeof d === 'object' && d.msg ? d.msg : String(d)))
      .join('；')
  }
  try {
    return JSON.stringify(data).slice(0, 240)
  } catch (_) {
    return '请求失败'
  }
}

function wxFailMessage(err) {
  if (!err) return '网络错误'
  if (typeof err === 'string') return err
  if (err.errMsg) return err.errMsg
  if (err.message) return err.message
  try {
    return JSON.stringify(err).slice(0, 120)
  } catch (_) {
    return '网络错误'
  }
}

/**
 * @param {string} apiBase 如 https://your-domain.com:18765 （无末尾 /）
 * @param {{ fromLat: number, fromLng: number, toLat: number, toLng: number, engine?: string, profile?: string, assumeSpeedKmh?: number, segments?: number, amapKey?: string }} params
 */
function planRoute(apiBase, params) {
  const base = String(apiBase || '').replace(/\/$/, '')
  const data = {
    mode: 'coords',
    from_lat: String(params.fromLat),
    from_lon: String(params.fromLng),
    to_lat: String(params.toLat),
    to_lon: String(params.toLng),
    engine: String(params.engine || 'amap'),
    profile: String(params.profile || 'driving')
  }
  if (params.assumeSpeedKmh != null && params.assumeSpeedKmh !== '') {
    data.assume_speed_kmh = String(params.assumeSpeedKmh)
  }
  if (params.segments != null && params.segments !== '') {
    data.segments = String(params.segments)
  }
  if (params.amapKey) {
    data.amap_key = String(params.amapKey)
  }

  return new Promise((resolve, reject) => {
    wx.request({
      url: `${base}/api/route`,
      method: 'POST',
      header: { 'content-type': 'application/x-www-form-urlencoded' },
      data,
      timeout: 60000,
      success(res) {
        let d = res.data
        if (typeof d === 'string') {
          try {
            d = JSON.parse(d)
          } catch (_) {
            reject(new Error('服务返回非 JSON'))
            return
          }
        }
        if (res.statusCode !== 200) {
          reject(new Error(formatHttpError(d)))
          return
        }
        if (!d || !d.ok || !d.route) {
          reject(new Error(d && (d.detail || d.message) ? formatHttpError(d) : '路线服务返回异常'))
          return
        }
        resolve(d.route)
      },
      fail(err) {
        reject(new Error(wxFailMessage(err)))
      }
    })
  })
}

module.exports = {
  planRoute,
  formatHttpError
}
