const store = require('../../utils/store');
const api = require('../../utils/api');

Page({
  data: {
    user: {},
    stats: {},
    goal: 30,
    records: []
  },

  onShow() {
    this.refresh();
  },

  async refresh() {
    try {
      await api.ready();
      const user = getApp().globalData.user || {};
      const records = await api.getRecords();
      const todayStr = api.today();
      const stats = store.computeStats(records, todayStr);
      const typeMap = {};
      store.getTypes().forEach((t) => (typeMap[t.id] = t));

      const list = records.map((r) => ({
        ...r,
        id: r._id || r.id,
        icon: typeMap[r.type] ? typeMap[r.type].icon : '🏅',
        name: typeMap[r.type] ? typeMap[r.type].name : r.type
      }));

      this.setData({
        user,
        stats,
        goal: user.goal || 30,
        records: list
      });
    } catch (e) {
      wx.showToast({ title: '加载失败，请检查云环境配置', icon: 'none' });
    }
  },

  onNickname(e) {
    this.setData({ 'user.nickname': e.detail.value });
  },

  async saveNickname() {
    const nickname = (this.data.user.nickname || '').trim();
    try {
      const r = await api.updateUser({ nickname });
      getApp().globalData.user = r.user;
      wx.showToast({ title: '已保存', icon: 'success' });
    } catch (e) {
      wx.showToast({ title: e.message || '保存失败', icon: 'none' });
    }
  },

  onGoal(e) {
    this.setData({ goal: e.detail.value });
  },

  async saveGoal() {
    try {
      const r = await api.updateUser({ goal: this.data.goal });
      getApp().globalData.user = r.user;
      this.setData({ user: r.user });
      wx.showToast({ title: '目标已更新', icon: 'success' });
    } catch (e) {
      wx.showToast({ title: e.message || '更新失败', icon: 'none' });
    }
  },

  clearData() {
    wx.showModal({
      title: '清除记录',
      content: '确定要清空所有打卡记录吗？此操作不可恢复。',
      confirmColor: '#EF4444',
      success: async (res) => {
        if (res.confirm) {
          try {
            await api.clearRecords();
            this.refresh();
            wx.showToast({ title: '已清除', icon: 'success' });
          } catch (e) {
            wx.showToast({ title: e.message || '清除失败', icon: 'none' });
          }
        }
      }
    });
  }
});