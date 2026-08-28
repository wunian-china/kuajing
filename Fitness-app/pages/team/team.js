const api = require('../../utils/api');

Page({
  data: {
    team: {},
    members: [],
    checkedCount: 0,
    total: 0,
    hasTeam: false,
    showJoin: false,
    joinCode: '',
    loading: true
  },

  onShow() {
    this.load();
  },

  onHide() {
    this.unsubscribe();
  },

  onUnload() {
    this.unsubscribe();
  },

  _unsubs: [],
  _subscribedId: null,

  unsubscribe() {
    (this._unsubs || []).forEach((fn) => {
      try { fn(); } catch (e) { /* ignore */ }
    });
    this._unsubs = [];
    this._subscribedId = null;
  },

  load() {
    this.fetch().then(({ team }) => {
      if (team && team._id && this._subscribedId !== team._id) {
        this.subscribe(team._id);
      }
    });
  },

  async fetch() {
    try {
      await api.ready();
      const res = await api.getTeam();
      const team = res.team || null;
      if (!team) {
        this.setData({
          hasTeam: false,
          team: {},
          members: [],
          checkedCount: 0,
          total: 0,
          loading: false
        });
        return { team: null };
      }
      const openid = getApp().globalData.openid;
      const members = (res.members || []).map((m) => ({
        ...m,
        id: m.openid,
        name: m.nickname,
        isMe: m.openid === openid
      }));
      this.setData({
        hasTeam: true,
        team,
        members,
        checkedCount: members.filter((m) => m.checked).length,
        total: members.length,
        loading: false
      });
      return { team };
    } catch (e) {
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败，请检查云环境配置', icon: 'none' });
      return { team: null };
    }
  },

  subscribe(teamId) {
    this.unsubscribe();
    this._subscribedId = teamId;
    const off1 = api.watchCheckins(teamId, () => this.fetch());
    const off2 = api.watchTeamDoc(teamId, () => this.fetch());
    if (off1) this._unsubs.push(off1);
    if (off2) this._unsubs.push(off2);
  },

  copyCode() {
    if (!this.data.team.code) return;
    wx.setClipboardData({
      data: this.data.team.code,
      success() {
        wx.showToast({ title: '邀请码已复制', icon: 'success' });
      }
    });
  },

  async refreshCode() {
    try {
      await api.recode();
      wx.showToast({ title: '邀请码已更新', icon: 'none' });
      this.fetch();
    } catch (e) {
      wx.showToast({ title: e.message || '刷新失败', icon: 'none' });
    }
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

  async confirmJoin() {
    const code = this.data.joinCode.trim();
    if (!code) {
      wx.showToast({ title: '请输入邀请码', icon: 'none' });
      return;
    }
    try {
      await api.joinTeam(code);
      wx.showToast({ title: '加入成功', icon: 'success' });
      this.setData({ showJoin: false });
      this.load();
    } catch (e) {
      wx.showToast({ title: e.message || '加入失败', icon: 'none' });
    }
  },

  async createTeam() {
    try {
      await api.createTeam();
      wx.showToast({ title: '创建成功', icon: 'success' });
      this.load();
    } catch (e) {
      wx.showToast({ title: e.message || '创建失败', icon: 'none' });
    }
  },

  noop() {},

  onShareAppMessage() {
    const code = this.data.team.code ? this.data.team.code : '';
    return {
      title: code
        ? '来「一起健身」组队打卡，邀请码 ' + code
        : '来「一起健身」和我组队打卡，互相监督！',
      path: '/pages/index/index'
    };
  }
});