// 云开发数据访问层：所有后端交互统一走云函数「api」
const store = require('./store');

// 云环境 ID：留空时使用当前账号默认环境；正式项目请替换为你自己的环境 ID。
const ENV_ID = '';

let _today = '';
let loginPromise = null;

function init() {
  if (!wx.cloud) {
    console.error('请升级基础库至 2.2.3 及以上以使用云开发');
    return;
  }
  const options = { traceUser: true };
  if (ENV_ID) options.env = ENV_ID;
  wx.cloud.init(options);
}

// 调用云函数，自动提取 today 与错误
function call(action, data = {}) {
  return wx.cloud
    .callFunction({ name: 'api', data: Object.assign({ action }, data) })
    .then((res) => {
      const r = res.result || {};
      if (r.today) _today = r.today;
      if (r.ok === false) {
        throw new Error(r.msg || '操作失败');
      }
      return r;
    });
}

// 确保已登录并返回登录结果 { openid, user, today }
function ready() {
  if (!loginPromise) {
    loginPromise = call('login')
      .then((r) => {
        const app = getApp();
        app.globalData.openid = r.openid;
        app.globalData.user = r.user;
        return r;
      })
      .catch((e) => {
        loginPromise = null;
        throw e;
      });
  }
  return loginPromise;
}

function today() {
  return _today || store.today();
}

function getRecords() {
  return call('getRecords').then((r) => r.records || []);
}

function addRecord(data) {
  return call('addRecord', data);
}

function updateUser(data) {
  return call('updateUser', data);
}

function clearRecords() {
  return call('clearRecords');
}

function getTeam() {
  return call('team.info');
}

function createTeam(name) {
  return call('team.create', { name });
}

function joinTeam(code) {
  return call('team.join', { code });
}

function recode() {
  return call('team.recode');
}

function leaveTeam() {
  return call('team.leave');
}

// 实时监听：本队今日打卡变化
function watchCheckins(teamId, onChange) {
  if (!wx.cloud || !teamId) return null;
  const db = wx.cloud.database();
  const watcher = db
    .collection('checkins')
    .where({ teamId, date: today() })
    .watch({
      onChange,
      onError(err) {
        console.error('watch checkins error', err);
      }
    });
  return () => {
    try { watcher.close(); } catch (e) { /* ignore */ }
  };
}

// 实时监听：战队文档变化（成员增减、邀请码变更等）
function watchTeamDoc(teamId, onChange) {
  if (!wx.cloud || !teamId) return null;
  const db = wx.cloud.database();
  const watcher = db
    .collection('teams')
    .doc(teamId)
    .watch({
      onChange,
      onError(err) {
        console.error('watch team error', err);
      }
    });
  return () => {
    try { watcher.close(); } catch (e) { /* ignore */ }
  };
}

module.exports = {
  init,
  ready,
  today,
  getRecords,
  addRecord,
  updateUser,
  clearRecords,
  getTeam,
  createTeam,
  joinTeam,
  recode,
  leaveTeam,
  watchCheckins,
  watchTeamDoc
};