const api = require('./utils/api');

App({
  globalData: {
    openid: '',
    user: null
  },
  onLaunch() {
    api.init();
  }
});