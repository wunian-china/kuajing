// 云函数「api」：统一处理用户、打卡记录、战队的所有后端逻辑
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

// 北京时间日期串（云端为 UTC，+8 得到北京日期）
function bjDate(offsetDays = 0) {
  const d = new Date(Date.now() + 8 * 3600 * 1000 + offsetDays * 86400000);
  return d.toISOString().slice(0, 10);
}

function shift(dateStr, n) {
  const d = new Date(dateStr.slice(0, 4), Number(dateStr.slice(5, 7)) - 1, Number(dateStr.slice(8, 10)));
  d.setDate(d.getDate() + n);
  const p = (x) => (x < 10 ? '0' + x : '' + x);
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

function randomCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function computeStats(records, todayStr) {
  const dayMinutes = {};
  let totalMinutes = 0;
  (records || []).forEach((r) => {
    const m = Number(r.duration) || 0;
    dayMinutes[r.date] = (dayMinutes[r.date] || 0) + m;
    totalMinutes += m;
  });
  const dates = Object.keys(dayMinutes).sort();
  let streak = 0;
  let cursor = todayStr;
  if (!dayMinutes[cursor]) cursor = shift(cursor, -1);
  while (dayMinutes[cursor]) {
    streak++;
    cursor = shift(cursor, -1);
  }
  return { totalDays: dates.length, totalMinutes, streak };
}

// 确保用户存在并返回（含 _id 字段）
async function getUser(openid) {
  const ref = db.collection('users').doc(openid);
  let user = null;
  try {
    const res = await ref.get();
    user = res.data || null;
  } catch (e) {
    user = null;
  }
  if (!user) {
    user = {
      openid,
      nickname: '健身达人',
      avatarText: '健',
      avatarUrl: '',
      goal: 30,
      teamId: '',
      createdAt: Date.now()
    };
    await ref.set({ data: user });
  }
  return Object.assign({ _id: openid }, user);
}

function publicUser(user) {
  return {
    openid: user.openid,
    nickname: user.nickname,
    avatarText: user.avatarText,
    avatarUrl: user.avatarUrl || '',
    goal: user.goal,
    teamId: user.teamId || ''
  };
}

async function removeMember(teamId, openid) {
  let team = null;
  try {
    team = (await db.collection('teams').doc(teamId).get()).data;
  } catch (e) {
    return;
  }
  if (!team) return;
  const members = (team.memberOpenids || []).filter((o) => o !== openid);
  if (members.length === 0) {
    await db.collection('teams').doc(teamId).remove();
  } else {
    await db.collection('teams').doc(teamId).update({ data: { memberOpenids: members } });
  }
}

async function ensureUniqueCode() {
  let code = randomCode();
  for (;;) {
    const c = await db.collection('teams').where({ code }).count();
    if (c.total === 0) return code;
    code = randomCode();
  }
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const action = event.action;

  try {
    if (action === 'login') {
      const user = await getUser(OPENID);
      return { ok: true, openid: OPENID, user: publicUser(user), today: bjDate() };
    }

    if (action === 'updateUser') {
      const patch = {};
      if (event.nickname !== undefined) patch.nickname = String(event.nickname).slice(0, 20) || '健身达人';
      if (event.goal !== undefined) {
        const g = Number(event.goal);
        patch.goal = isNaN(g) ? 30 : Math.max(5, Math.min(600, g));
      }
      if (event.avatarUrl !== undefined) patch.avatarUrl = event.avatarUrl;
      if (Object.keys(patch).length) {
        await db.collection('users').doc(OPENID).update({ data: patch });
      }
      const user = await getUser(OPENID);
      return { ok: true, user: publicUser(user) };
    }

    if (action === 'addRecord') {
      const type = event.type;
      const duration = Number(event.duration) || 0;
      const note = String(event.note || '').trim().slice(0, 100);
      if (!type || duration <= 0) return { ok: false, msg: '参数错误' };
      const user = await getUser(OPENID);
      const date = bjDate();
      const doc = {
        openid: OPENID,
        teamId: user.teamId || '',
        date,
        type,
        duration,
        note,
        timestamp: Date.now()
      };
      const res = await db.collection('checkins').add({ data: doc });
      return { ok: true, record: Object.assign({ _id: res._id }, doc), today: date };
    }

    if (action === 'getRecords') {
      const res = await db
        .collection('checkins')
        .where({ openid: OPENID })
        .orderBy('timestamp', 'desc')
        .limit(1000)
        .get();
      return { ok: true, records: res.data, today: bjDate() };
    }

    if (action === 'clearRecords') {
      const res = await db.collection('checkins').where({ openid: OPENID }).limit(1000).get();
      for (const d of res.data) {
        await db.collection('checkins').doc(d._id).remove();
      }
      return { ok: true };
    }

    if (action === 'team.create') {
      const user = await getUser(OPENID);
      if (user.teamId) {
        await removeMember(user.teamId, OPENID);
      }
      const code = await ensureUniqueCode();
      const team = {
        code,
        name: event.name ? String(event.name).slice(0, 12) : user.nickname + '的战队',
        ownerOpenid: OPENID,
        memberOpenids: [OPENID],
        createdAt: Date.now()
      };
      const res = await db.collection('teams').add({ data: team });
      await db.collection('users').doc(OPENID).update({ data: { teamId: res._id } });
      return { ok: true, teamId: res._id, team: Object.assign({ _id: res._id }, team) };
    }

    if (action === 'team.join') {
      const code = String(event.code || '').trim();
      if (!code) return { ok: false, msg: '请输入邀请码' };
      const res = await db.collection('teams').where({ code }).limit(1).get();
      if (!res.data.length) return { ok: false, msg: '邀请码不正确' };
      const team = res.data[0];
      const members = team.memberOpenids || [];
      if (!members.includes(OPENID)) {
        members.push(OPENID);
        await db.collection('teams').doc(team._id).update({ data: { memberOpenids: members } });
      }
      await db.collection('users').doc(OPENID).update({ data: { teamId: team._id } });
      return { ok: true, teamId: team._id };
    }

    if (action === 'team.info') {
      let teamId = event.teamId;
      if (!teamId) {
        const user = await getUser(OPENID);
        teamId = user.teamId;
      }
      if (!teamId) {
        return { ok: true, team: null, members: [], isOwner: false, today: bjDate() };
      }
      let team = null;
      try {
        team = (await db.collection('teams').doc(teamId).get()).data;
      } catch (e) {
        team = null;
      }
      if (!team) {
        return { ok: true, team: null, members: [], isOwner: false, today: bjDate() };
      }
      const memberOpenids = team.memberOpenids || [];
      const todayStr = bjDate();
      const members = [];
      if (memberOpenids.length) {
        let ures = await db.collection('users').where({ openid: _.in(memberOpenids) }).limit(100).get();
        let cres = await db.collection('checkins').where({ openid: _.in(memberOpenids) }).limit(1000).get();
        const byOpenid = {};
        cres.data.forEach((c) => {
          (byOpenid[c.openid] = byOpenid[c.openid] || []).push(c);
        });
        const order = memberOpenids;
        const list = ures.data.map((u) => {
          const recs = byOpenid[u.openid] || [];
          const stats = computeStats(recs, todayStr);
          const tm = recs
            .filter((r) => r.date === todayStr)
            .reduce((s, r) => s + (Number(r.duration) || 0), 0);
          return {
            openid: u.openid,
            nickname: u.nickname,
            avatarText: u.avatarText,
            avatarUrl: u.avatarUrl || '',
            streak: stats.streak,
            minutes: tm,
            checked: tm > 0
          };
        });
        list.sort((a, b) => order.indexOf(a.openid) - order.indexOf(b.openid));
        members.push(...list);
      }
      return {
        ok: true,
        team: Object.assign({ _id: teamId }, team),
        members,
        isOwner: team.ownerOpenid === OPENID,
        today: todayStr
      };
    }

    if (action === 'team.recode') {
      const user = await getUser(OPENID);
      if (!user.teamId) return { ok: false, msg: '尚未加入战队' };
      let team = null;
      try {
        team = (await db.collection('teams').doc(user.teamId).get()).data;
      } catch (e) {
        team = null;
      }
      if (!team) return { ok: false, msg: '战队不存在' };
      if (team.ownerOpenid !== OPENID) return { ok: false, msg: '仅队长可刷新邀请码' };
      const code = await ensureUniqueCode();
      await db.collection('teams').doc(user.teamId).update({ data: { code } });
      return { ok: true, code };
    }

    if (action === 'team.leave') {
      const user = await getUser(OPENID);
      if (user.teamId) {
        await removeMember(user.teamId, OPENID);
        await db.collection('users').doc(OPENID).update({ data: { teamId: '' } });
      }
      return { ok: true };
    }

    return { ok: false, msg: '未知操作: ' + action };
  } catch (err) {
    console.error('api error', action, err);
    return { ok: false, msg: err.message || '服务异常' };
  }
};