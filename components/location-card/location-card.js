// components/location-card/location-card.js
Component({
  properties: {
    title: {
      type: String,
      value: ''
    },
    address: {
      type: String,
      value: ''
    },
    distance: {
      type: String,
      value: ''
    }
  },

  data: {
    // 组件内部数据
  },

  methods: {
    onTap() {
      this.triggerEvent('tap', { title: this.data.title })
    }
  }
})