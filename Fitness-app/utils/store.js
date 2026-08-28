// 数据层：本地存储模拟后端。真实项目请替换为云开发/自建后端。
const USER_KEY = 'fitness_user';
const RECORDS_KEY = 'fitness_records';
const TEAM_KEY = 'fitness_team';

// 训练类型
const TYPES = [
  { id: 'run', name: '跑步', icon: '🏃', unit: '分钟' },
  { id: 'strength', name: '力量', icon: '🏋️', unit: '分钟' },
  { id: 'yoga', name: '瑜伽', icon: '🧘', unit: '分钟' },
  { id: 'cycling', name: '骑行', icon: '🚴', unit: '分钟' },
  { id: 'swim', name: '游泳', icon: '🏊', unit: '分钟' },
  { id: 'walk', name: '散步', icon: '🚶', unit: '分钟' }
];

function pad(n) {
  return n < 10 ? '0' + n : '' + n;
}

function toDateStr(d) {
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

function addDays(dateStr, n) {
  const d = parseDate(dateStr);
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

function parseDate(dateStr) {
  const parts = dateStr.split('-').map(Number);
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function today() {
  return toDateStr(new Date());
}

function getStorage(key, def) {
  try {
    const v = wx.getStorageSync(key);
    return v === '' || v === undefined || v === null ? def : v;
  } catch (e) {
    return def;
  }
}

function setStorage(key, val) {
  try {
    wx.setStorageSync(key, val);
  } catch (e) {
    // ignore
  }
}

function getDefaultUser() {
  return {
    nickname: '健身达人',
    avatarText: '健',
    goal: 30, // 每日目标（分钟）
    joined: false
  };
}

const MOCK_FRIENDS = [
  { id: 'u1', name: '阿强', avatarText: '强', streak: 12, minutes: 45, checked: true },
  { id: 'u2', name: '小雨', avatarText: '雨', streak: 7, minutes: 30, checked: true },
  { id: 'u3', name: '大鹏', avatarText: '鹏', streak: 3, minutes: 20, checked: false }
];

function getDefaultTeam() {
  return {
    name: '燃脂小分队',
    code: randomCode(), // 默认随机；后续可由用户刷新
    members: MOCK_FRIENDS
  };
}

function randomCode() {
  let s = '';
  for (let i = 0; i < 6; i++) {
    s += Math.floor(Math.random() * 10);
  }
  return s;
}

function getTypes() {
  return TYPES;
}

function getUser() {
  const u = getStorage(USER_KEY, null);
  return u ? Object.assign({}, getDefaultUser(), u) : getDefaultUser();
}

function saveUser(u) {
  setStorage(USER_KEY, u);
}

function getRecords() {
  return getStorage(RECORDS_KEY, []);
}

function saveRecords(records) {
  setStorage(RECORDS_KEY, records);
}

function addRecord(record) {
  const records = getRecords();
  record.id = Date.now() + '';
  record.timestamp = Date.now();
  records.unshift(record);
  saveRecords(records);
  return record;
}

function getTeam() {
  return getStorage(TEAM_KEY, getDefaultTeam());
}

function saveTeam(team) {
  setStorage(TEAM_KEY, team);
}

// 计算统计信息
function computeStats(records) {
  const dayMinutes = {};
  let totalMinutes = 0;
  records.forEach((r) => {
    const m = Number(r.duration) || 0;
    dayMinutes[r.date] = (dayMinutes[r.date] || 0) + m;
    totalMinutes += m;
  });

  const dates = Object.keys(dayMinutes).sort();
  let streak = 0;
  let cursor = today();
  if (!dayMinutes[cursor]) {
    cursor = addDays(cursor, -1);
  }
  while (dayMinutes[cursor]) {
    streak++;
    cursor = addDays(cursor, -1);
  }

  return {
    totalDays: dates.length,
    totalMinutes,
    streak,
    dates
  };
}

// 今日已打卡分钟数
function todayMinutes(records) {
  const t = today();
  return records
    .filter((r) => r.date === t)
    .reduce((sum, r) => sum + (Number(r.duration) || 0), 0);
}

// 本周 7 天（周一~周日）
function weekDays() {
  const now = new Date();
  const day = now.getDay(); // 0 = 周日
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const result = [];
  const weekNames = ['一', '二', '三', '四', '五', '六', '日'];
  const set = {};
  getRecords().forEach((r) => {
    set[r.date] = true;
  });
  for (let i = 0; i < 7; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset + i);
    const ds = toDateStr(d);
    const isToday = ds === today();
    result.push({
      date: ds,
      label: weekNames[i],
      day: d.getDate(),
      checked: !!set[ds],
      isToday
    });
  }
  return result;
}

// 刷新邀请码
function refreshCode() {
  const team = getTeam();
  team.code = randomCode();
  saveTeam(team);
  return team;
}

// 通过邀请码“加入”团队（模拟：写入用户已加入并返回团队）
function joinTeamByCode(code) {
  const team = getTeam();
  if (team.code === code) {
    const user = getUser();
    user.joined = true;
    saveUser(user);
    return { ok: true, team };
  }
  return { ok: false };
}

function init() {
  if (!getStorage(USER_KEY, null)) {
    setStorage(USER_KEY, getDefaultUser());
  }
  if (!getStorage(RECORDS_KEY, null)) {
    setStorage(RECORDS_KEY, []);
  }
  if (!getStorage(TEAM_KEY, null)) {
    setStorage(TEAM_KEY, getDefaultTeam());
  }
}

module.exports = {
  TYPES,
  getTypes,
  getUser,
  saveUser,
  getRecords,
  saveRecords,
  addRecord,
  getTeam,
  saveTeam,
  computeStats,
  todayMinutes,
  weekDays,
  refreshCode,
  joinTeamByCode,
  today,
  init
};