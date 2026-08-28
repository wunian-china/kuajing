const store = require('../../utils/store');

Page({
  data: {
    team: {},
    members: [],
    checkedCount: 0,
    total: 0,
    showJoin: false,
    joinCode: ''
  },

  onShow() {
    this.refresh();
  },

  refresh() {
    const team = store.getTeam();
    const user = store.getUser();
    const records = store.getRecords();
    const stats = store.computeStats(records);
    const myMinutes = store.todayMinutes(records);

    const me = {
      id: 'me',
      name: user.nickname,
      avatarText: user.avatarText,
      streak: stats.streak,
      minutes: myMinutes,
      checked: myMinutes > 0,
      isMe: true
    };
    const members = [me].concat(team.members.map((m) => ({ ...m })));
    const checkedCount = members.filter((m) => m.checked).length;

    this.setData({
      team,
      members,
      checkedCount,
      total: members.length
    });
  },

  copyCode() {
    wx.setClipboardData({
      data: this.data.team.code,
      success() {
        wx.showToast({ title: '邀请码已复制', icon: 'success' });
      }
    });
  },

  refreshCode() {
    store.refreshCode();
    this.refresh();
    wx.showToast({ title: '邀请码已更新', icon: 'none' });
  },

  showJoin() {
    this.setData({ showJoin: true, joinCode: '' });
  },

  hideJoin() {
    this.setData({ showJoin: false });
  },

  onJoinCode(e) {
    this.setData({ joinCode: e.detail.value });
  },

  confirmJoin() {
    const res = store.joinTeamByCode(this.data.joinCode.trim());
    if (res.ok) {
      wx.showToast({ title: '加入成功', icon: 'success' });
      this.setData({ showJoin: false });
      this.refresh();
    } else {
      wx.showToast({ title: '邀请码不正确', icon: 'none' });
    }
  },

  noop() {},

  onShareAppMessage() {
    return {
      title: '来「一起健身」和我组队打卡，互相监督！',
      path: '/pages/index/index'
    };
  }
});