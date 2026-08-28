const store = require('../../utils/store');

Page({
  data: {
    greet: '你好',
    dateText: '',
    user: {},
    stats: {},
    todayMinutes: 0,
    goal: 30,
    progress: 0,
    week: [],
    types: [],
    recent: [],
    checkedToday: false
  },

  onShow() {
    this.refresh();
  },

  onPullDownRefresh() {
    this.refresh();
    wx.stopPullDownRefresh();
  },

  refresh() {
    const user = store.getUser();
    const records = store.getRecords();
    const stats = store.computeStats(records);
    const todayMinutes = store.todayMinutes(records);
    const goal = user.goal || 30;
    const progress = Math.min(100, Math.round((todayMinutes / goal) * 100));

    const now = new Date();
    const dateText = now.getMonth() + 1 + '月' + now.getDate() + '日';
    const h = now.getHours();
    let greet = '早上好';
    if (h >= 12 && h < 18) greet = '下午好';
    else if (h >= 18) greet = '晚上好';

    const typeMap = {};
    store.getTypes().forEach((t) => (typeMap[t.id] = t));
    const recent = records.slice(0, 5).map((r) => ({
      ...r,
      icon: typeMap[r.type] ? typeMap[r.type].icon : '🏅',
      name: typeMap[r.type] ? typeMap[r.type].name : r.type
    }));

    this.setData({
      greet,
      dateText,
      user,
      stats,
      todayMinutes,
      goal,
      progress,
      week: store.weekDays(),
      types: store.getTypes(),
      recent,
      checkedToday: todayMinutes > 0
    });
  },

  goCheckin() {
    wx.navigateTo({ url: '/pages/checkin/checkin' });
  },

  quickCheckin(e) {
    const type = e.currentTarget.dataset.type;
    wx.navigateTo({ url: '/pages/checkin/checkin?type=' + type });
  }
});