// 纯工具层：训练类型、日期与统计计算（不涉及任何存储，数据由云开发提供）
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

// 本地（北京时间）今天的日期串
function today() {
  return toDateStr(new Date());
}

function getTypes() {
  return TYPES;
}

// 计算统计信息。records 形如 [{ date, duration }]
function computeStats(records, todayStr) {
  const t = todayStr || today();
  const dayMinutes = {};
  let totalMinutes = 0;
  (records || []).forEach((r) => {
    const m = Number(r.duration) || 0;
    dayMinutes[r.date] = (dayMinutes[r.date] || 0) + m;
    totalMinutes += m;
  });

  const dates = Object.keys(dayMinutes).sort();
  let streak = 0;
  let cursor = t;
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
function todayMinutes(records, todayStr) {
  const t = todayStr || today();
  return (records || [])
    .filter((r) => r.date === t)
    .reduce((sum, r) => sum + (Number(r.duration) || 0), 0);
}

// 本周 7 天（周一~周日）
function weekDays(records) {
  const now = new Date();
  const day = now.getDay(); // 0 = 周日
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const result = [];
  const weekNames = ['一', '二', '三', '四', '五', '六', '日'];
  const set = {};
  (records || []).forEach((r) => {
    set[r.date] = true;
  });
  for (let i = 0; i < 7; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset + i);
    const ds = toDateStr(d);
    result.push({
      date: ds,
      label: weekNames[i],
      day: d.getDate(),
      checked: !!set[ds],
      isToday: ds === today()
    });
  }
  return result;
}

module.exports = {
  TYPES,
  getTypes,
  computeStats,
  todayMinutes,
  weekDays,
  today
};