const store = require('../../utils/store');
const api = require('../../utils/api');

Page({
  data: {
    types: [],
    selected: '',
    duration: 30,
    note: ''
  },

  onLoad(options) {
    this.setData({
      types: store.getTypes(),
      selected: options.type || ''
    });
  },

  selectType(e) {
    this.setData({ selected: e.currentTarget.dataset.type });
  },

  onDuration(e) {
    this.setData({ duration: e.detail.value });
  },

  onNote(e) {
    this.setData({ note: e.detail.value });
  },

  async submit() {
    const { selected, duration, note } = this.data;
    if (!selected) {
      wx.showToast({ title: '请选择运动类型', icon: 'none' });
      return;
    }
    const m = Number(duration);
    if (!m || m <= 0) {
      wx.showToast({ title: '时长需大于 0', icon: 'none' });
      return;
    }
    wx.showLoading({ title: '打卡中' });
    try {
      await api.addRecord({
        type: selected,
        duration: m,
        note: note.trim()
      });
      wx.hideLoading();
      wx.showToast({ title: '打卡成功', icon: 'success' });
      setTimeout(() => {
        wx.navigateBack();
      }, 600);
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: e.message || '打卡失败', icon: 'none' });
    }
  }
});