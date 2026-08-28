const store = require('../../utils/store');
const api = require('../../utils/api');

const WEEK_LABELS = ['一', '二', '三', '四', '五', '六', '日'];

function pad(n) {
  return n < 10 ? '0' + n : '' + n;
}

function toDateStr(d) {
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

// '2026-08-28' -> '8月28日 周五'
function dateText(dateStr) {
  const p = dateStr.split('-').map(Number);
  const wd = ['日', '一', '二', '三', '四', '五', '六'];
  const w = new Date(p[0], p[1] - 1, p[2]).getDay();
  return p[1] + '月' + p[2] + '日 周' + wd[w];
}

function timeText(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return pad(d.getHours()) + ':' + pad(d.getMinutes());
}

Page({
  data: {
    weekLabels: WEEK_LABELS,
    title: '',
    year: 0,
    month: 0,
    cells: [],
    monthDays: 0,
    monthMinutes: 0,
    canNext: false,
    selectedDate: '',
    selectedDateText: '',
    selectedRecords: []
  },

  onLoad() {
    const now = new Date();
    this.setData({ year: now.getFullYear(), month: now.getMonth() + 1 });
  },

  onShow() {
    this.refresh();
  },

  async refresh() {
    try {
      await api.ready();
      this.records = await api.getRecords();
      this.todayStr = store.today();
      this.build();
    } catch (e) {
      wx.showToast({ title: '加载失败，请检查云环境配置', icon: 'none' });
    }
  },

  build() {
    const { year, month } = this.data;
    const records = this.records || [];

    const typeMap = {};
    store.getTypes().forEach((t) => (typeMap[t.id] = t));
    this._typeMap = typeMap;

    // 按日期聚合
    const byDay = {};
    records.forEach((r) => {
      if (!byDay[r.date]) byDay[r.date] = { minutes: 0, list: [] };
      byDay[r.date].minutes += Number(r.duration) || 0;
      byDay[r.date].list.push(r);
    });
    this._byDay = byDay;

    // 生成月历网格（周一起始，固定 6 行）
    const first = new Date(year, month - 1, 1);
    const wd = first.getDay();
    const mondayOffset = wd === 0 ? 6 : wd - 1;
    const start = new Date(year, month - 1, 1 - mondayOffset);

    const prefix = year + '-' + pad(month);
    const cells = [];
    let monthDays = 0;
    let monthMinutes = 0;

    for (let i = 0; i < 42; i++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      const ds = toDateStr(d);
      const inMonth = d.getMonth() === month - 1;
      const info = byDay[ds];
      const minutes = info ? info.minutes : 0;
      cells.push({
        date: ds,
        day: d.getDate(),
        inMonth,
        checked: !!info,
        minutes,
        isToday: ds === this.todayStr
      });
      if (inMonth && info) {
        monthDays++;
        monthMinutes += minutes;
      }
    }

    // 默认选中：今天 > 本月首个打卡日 > 本月首日
    let selectedDate = this.data.selectedDate;
    if (!selectedDate || selectedDate.slice(0, 7) !== prefix) {
      if (this.todayStr.slice(0, 7) === prefix) {
        selectedDate = this.todayStr;
      } else {
        const firstChecked = cells.find((c) => c.inMonth && c.checked);
        selectedDate = firstChecked ? firstChecked.date : prefix + '-01';
      }
    }

    // 下月能否翻页（不浏览未来月份）
    const tYear = Number(this.todayStr.slice(0, 4));
    const tMonth = Number(this.todayStr.slice(5, 7));
    const ny = month === 12 ? year + 1 : year;
    const nm = month === 12 ? 1 : month + 1;
    const canNext = ny < tYear || (ny === tYear && nm <= tMonth);

    this.setData({
      title: year + '年' + month + '月',
      cells,
      monthDays,
      monthMinutes,
      canNext,
      selectedDate,
      selectedDateText: dateText(selectedDate),
      selectedRecords: this.recordsFor(selectedDate)
    });
  },

  recordsFor(date) {
    const info = (this._byDay && this._byDay[date]) || { list: [] };
    const typeMap = this._typeMap || {};
    return info.list.map((r) => ({
      id: r._id || r.id,
      icon: typeMap[r.type] ? typeMap[r.type].icon : '🏅',
      name: typeMap[r.type] ? typeMap[r.type].name : r.type,
      duration: r.duration,
      note: r.note || '',
      time: timeText(r.timestamp)
    }));
  },

  onTapDate(e) {
    const date = e.currentTarget.dataset.date;
    this.setData({
      selectedDate: date,
      selectedDateText: dateText(date),
      selectedRecords: this.recordsFor(date)
    });
  },

  prevMonth() {
    this.changeMonth(-1);
  },

  nextMonth() {
    if (!this.data.canNext) return;
    this.changeMonth(1);
  },

  changeMonth(delta) {
    let { year, month } = this.data;
    month += delta;
    if (month < 1) {
      month = 12;
      year--;
    }
    if (month > 12) {
      month = 1;
      year++;
    }
    this.setData({ year, month, selectedDate: '' });
    this.build();
  }
});