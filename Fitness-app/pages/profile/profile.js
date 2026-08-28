const store = require('../../utils/store');

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

  refresh() {
    const user = store.getUser();
    const records = store.getRecords();
    const stats = store.computeStats(records);
    const typeMap = {};
    store.getTypes().forEach((t) => (typeMap[t.id] = t));

    const list = records.map((r) => ({
      ...r,
      icon: typeMap[r.type] ? typeMap[r.type].icon : '🏅',
      name: typeMap[r.type] ? typeMap[r.type].name : r.type
    }));

    this.setData({
      user,
      stats,
      goal: user.goal || 30,
      records: list
    });
  },

  onNickname(e) {
    this.setData({ 'user.nickname': e.detail.value });
  },

  saveNickname() {
    store.saveUser(this.data.user);
    wx.showToast({ title: '已保存', icon: 'success' });
  },

  onGoal(e) {
    this.setData({ goal: e.detail.value });
  },

  saveGoal() {
    const user = store.getUser();
    user.goal = this.data.goal;
    store.saveUser(user);
    wx.showToast({ title: '目标已更新', icon: 'success' });
  },

  clearData() {
    wx.showModal({
      title: '清除记录',
      content: '确定要清空所有打卡记录吗？此操作不可恢复。',
      confirmColor: '#EF4444',
      success: (res) => {
        if (res.confirm) {
          store.saveRecords([]);
          this.refresh();
          wx.showToast({ title: '已清除', icon: 'success' });
        }
      }
    });
  }
});