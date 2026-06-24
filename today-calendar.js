const CYCLE_START = '2026-06-29';

const ROUTINES = [
  {day:1,events:[['05:00','05:00','Wake'],['05:00','07:00','Getting kids ready for school'],['07:00','16:00','Work'],['17:00','18:00','Gym'],['21:00','21:00','Bedtime']]},
  {day:2,events:[['04:40','04:40','Wake'],['05:00','06:00','Gym'],['07:00','16:00','Work'],['21:00','21:00','Bedtime']]},
  {day:3,events:[['04:40','04:40','Wake'],['05:00','06:00','Gym'],['07:00','16:00','Work'],['16:30','17:00','Collect kids from school'],['21:00','21:00','Bedtime']]},
  {day:4,events:[['05:00','05:00','Wake'],['05:00','07:00','Getting kids ready for school'],['07:00','16:00','Work'],['16:30','17:00','Collect kids from school'],['21:00','21:00','Bedtime']]},
  {day:5,events:[['05:00','05:00','Wake'],['05:00','08:00','Getting kids ready for school'],['08:00','09:00','Take kids to school'],['17:00','18:00','Gym'],['21:00','21:00','Bedtime']]},
  {day:6,events:[['06:00','06:00','Wake'],['07:00','08:00','Gym'],['21:00','21:00','Bedtime']]},
  {day:7,events:[['06:00','06:00','Wake'],['21:00','21:00','Bedtime']]},
  {day:8,events:[['05:00','05:00','Wake'],['05:45','14:15','Work'],['14:45','15:15','Collect kids from school'],['15:45','16:30','Blaze dance'],['21:00','21:00','Bedtime']]},
  {day:9,events:[['05:00','05:00','Wake'],['05:00','07:00','Getting kids ready for school'],['07:00','07:30','Take kids to OSH'],['07:30','16:00','Work'],['16:30','17:00','Collect kids from school'],['21:00','21:00','Bedtime']]},
  {day:10,events:[['05:00','05:00','Wake'],['05:00','07:00','Getting kids ready for school'],['07:00','16:00','Work'],['17:00','18:00','Gym'],['21:00','21:00','Bedtime']]},
  {day:11,events:[['04:40','04:40','Wake'],['05:00','06:00','Gym'],['07:00','16:00','Work'],['21:00','21:00','Bedtime']]},
  {day:12,events:[['05:00','05:00','Wake'],['05:45','14:15','Work'],['14:45','15:15','Collect kids from school'],['16:00','17:00','Superkick'],['21:00','21:00','Bedtime']]},
  {day:13,events:[['06:00','06:00','Wake'],['21:00','21:00','Bedtime']]},
  {day:14,events:[['06:00','06:00','Wake'],['21:00','21:00','Bedtime']]}
];

const $ = id => document.getElementById(id);

const store = {
  get: k => JSON.parse(localStorage.getItem(k) || '[]'),
  set: (k, v) => localStorage.setItem(k, JSON.stringify(v))
};

const toMin = t => {
  let [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

const toTime = m =>
  String(Math.floor(m / 60)).padStart(2, '0') + ':' +
  String(m % 60).padStart(2, '0');

const fmt = d =>
  d.toLocaleDateString('en-AU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

const iso = d =>
  new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);

function cycleDay(date) {
  const start = new Date(CYCLE_START + 'T00:00:00');
  const diff = Math.floor((date - start) / 86400000);
  return ((diff % 14) + 14) % 14;
}

function routineFor(date) {
  return ROUTINES[cycleDay(date)];
}

function routineEvents(date) {
  return routineFor(date).events.map((e, i) => ({
    id: 'r' + i,
    date: iso(date),
    start: e[0],
    end: e[1],
    title: e[2],
    type: 'routine'
  }));
}

function customEvents(date) {
  return store.get('calendarEvents').filter(e => e.date === iso(date));
}

function tasks() {
  return store.get('todoTasks');
}

function freeWindows(events) {
  const active = events
    .filter(e => e.start !== e.end)
    .sort((a, b) => toMin(a.start) - toMin(b.start));

  const wake = events.find(e => /wake/i.test(e.title))?.start || '05:00';
  const bed = events.find(e => /bedtime/i.test(e.title))?.start || '21:00';

  let cursor = toMin(wake);
  const endDay = toMin(bed);
  const free = [];

  for (const e of active) {
    const s = toMin(e.start);
    const en = toMin(e.end);

    if (s > cursor) {
      free.push({
        start: toTime(cursor),
        end: toTime(s),
        mins: s - cursor,
        title: 'Free Time Window',
        type: 'free'
      });
    }

    cursor = Math.max(cursor, en);
  }

  if (cursor < endDay) {
    free.push({
      start: toTime(cursor),
      end: toTime(endDay),
      mins: endDay - cursor,
      title: 'Free Time Window',
      type: 'free'
    });
  }

  return free;
}

function todayBlocks(date) {
  const events = [...routineEvents(date), ...customEvents(date)];
  return [...events, ...freeWindows(events)]
    .sort((a, b) => toMin(a.start) - toMin(b.start));
}

function render() {
  const date = new Date(($('plannerDate')?.value) || new Date());

  if ($('plannerDate')) {
    $('plannerDate').value = iso(date);
  }

  $('plannerTitle').textContent = `Day ${routineFor(date).day} - ${fmt(date)}`;

  renderTimeline(date);
  renderTodos();
  renderSuggestions(date);
  renderPlanForDay(date);
}

function renderTimeline(date) {
  const el = $('calendarTimeline');
  el.innerHTML = '';

  todayBlocks(date).forEach(b => {
    const div = document.createElement('div');
    div.className = 'calendar-block ' + (b.type || '');

    div.innerHTML = `
      <div class="block-time">
        ${b.start}${b.start === b.end ? '' : ' - ' + b.end}
      </div>
      <div class="block-title">
        ${b.title}${b.mins ? ` (${b.mins} mins)` : ''}
      </div>
      ${b.type === 'task' ? `
        <div class="block-actions">
          <button class="planner-btn" onclick="completeTask('${b.taskId}','${b.id}')">
            Mark completed
          </button>
        </div>
      ` : ''}
    `;

    el.appendChild(div);
  });
}

function renderTodos() {
  const el = $('todoList');
  const open = tasks().filter(t => !t.completed && !t.scheduled);

  el.innerHTML = open.length
    ? ''
    : '<p class="empty-note">No unscheduled tasks.</p>';

  open.forEach(t => {
    const d = document.createElement('div');
    d.className = 'todo-item';

    d.innerHTML = `
      <b>${t.title}</b>
      <div class="todo-meta">${t.minutes} mins</div>
      <div class="block-actions">
        <button class="planner-btn" onclick="deleteTask('${t.id}')">Delete</button>
      </div>
    `;

    el.appendChild(d);
  });
}

function renderSuggestions(date) {
  const el = $('suggestions');
  const open = tasks().filter(t => !t.completed && !t.scheduled);

  const days = [1, 2, 3, 4, 5, 6, 7].map(n => {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
  });

  let html = '';

  for (const task of open) {
    const options = [];

    for (const d of days) {
      const wins = freeWindows([...routineEvents(d), ...customEvents(d)])
        .filter(w => w.mins >= Number(task.minutes));

      for (const win of wins) {
        const taskEnd = toTime(toMin(win.start) + Number(task.minutes));

        options.push({
          date: iso(d),
          start: win.start,
          label: `${fmt(d)} | ${win.start}-${taskEnd}`
        });
      }
    }

    if (options.length) {
      const selectId = `suggest-${task.id}`;

      html += `
        <div class="suggestion">
          <b>${task.title}</b>
          <div class="todo-meta">${task.minutes} mins</div>

          <select class="planner-input" id="${selectId}">
            ${options.map(o => `
              <option value="${o.date}|${o.start}">
                ${o.label}
              </option>
            `).join('')}
          </select>

          <button class="planner-btn primary" onclick="scheduleSelectedTask('${task.id}', '${selectId}')">
            Approve Selected Time
          </button>
        </div>
      `;
    }
  }

  el.innerHTML = html || '<p class="empty-note">No suggested tasks fit in the next 7 days.</p>';
}

function scheduleSelectedTask(taskId, selectId) {
  const selected = document.getElementById(selectId).value;
  const [date, start] = selected.split('|');
  scheduleTask(taskId, date, start);
}

function addTask() {
  const title = $('taskTitle').value.trim();
  const minutes = Number($('taskMinutes').value);

  if (!title || !minutes) return;

  const all = tasks();

  all.push({
    id: crypto.randomUUID(),
    title,
    minutes,
    completed: false,
    scheduled: false
  });

  store.set('todoTasks', all);

  $('taskTitle').value = '';
  $('taskMinutes').value = '';

  render();
}

function scheduleTask(id, date, start) {
  const all = tasks();
  const task = all.find(t => t.id === id);

  if (!task) return;

  const end = toTime(toMin(start) + Number(task.minutes));
  const events = store.get('calendarEvents');

  const event = {
    id: crypto.randomUUID(),
    taskId: id,
    date,
    start,
    end,
    title: task.title,
    type: 'task'
  };

  events.push(event);

  task.scheduled = true;
  task.eventId = event.id;

  store.set('calendarEvents', events);
  store.set('todoTasks', all);

  notifyIfToday(task.title, start, end, date);

  render();
}

function notifyIfToday(title, start, end, date) {
  const today = iso(new Date());

  if (date !== today) return;

  if (!('Notification' in window)) {
    alert(`Task scheduled for today: ${title} at ${start}-${end}`);
    return;
  }

  if (Notification.permission === 'granted') {
    new Notification('Task scheduled for today', {
      body: `${title} | ${start}-${end}`
    });
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        new Notification('Task scheduled for today', {
          body: `${title} | ${start}-${end}`
        });
      } else {
        alert(`Task scheduled for today: ${title} at ${start}-${end}`);
      }
    });
  } else {
    alert(`Task scheduled for today: ${title} at ${start}-${end}`);
  }
}

function completeTask(taskId, eventId) {
  store.set(
    'todoTasks',
    tasks().map(t =>
      t.id === taskId
        ? {...t, completed: true, scheduled: false}
        : t
    )
  );

  store.set(
    'calendarEvents',
    store.get('calendarEvents').filter(e => e.id !== eventId)
  );

  render();
}

function deleteTask(id) {
  store.set(
    'todoTasks',
    tasks().filter(t => t.id !== id)
  );

  render();
}

function addCalendarItem() {
  const date = $('customDate').value;
  const start = $('customStart').value;
  const end = $('customEnd').value;
  const title = $('customTitle').value.trim();

  if (!date || !start || !end || !title) return;

  const events = store.get('calendarEvents');

  events.push({
    id: crypto.randomUUID(),
    date,
    start,
    end,
    title,
    type: 'custom'
  });

  store.set('calendarEvents', events);

  $('customTitle').value = '';

  render();
}

function getTodayAssignedTasks(date) {
  const todayIso = iso(date);

  return store.get('calendarEvents')
    .filter(e => e.date === todayIso && e.type === 'task')
    .sort((a, b) => toMin(a.start) - toMin(b.start));
}

function getYesterdayDiary(date) {
  const yesterday = new Date(date);
  yesterday.setDate(yesterday.getDate() - 1);

  const diaryEntries = JSON.parse(localStorage.getItem('dailyDiaryEntries') || '{}');
  return diaryEntries[iso(yesterday)]?.entry || '';
}

function getFreeWindowsText(date) {
  const windows = freeWindows([...routineEvents(date), ...customEvents(date)]);

  if (!windows.length) {
    return 'No clear free windows today.';
  }

  return windows
    .map(w => `${w.start}-${w.end} (${w.mins} mins)`)
    .join(', ');
}

function getTodayScheduleText(date) {
  return todayBlocks(date)
    .filter(b => b.type !== 'free')
    .map(b => `${b.start}${b.start === b.end ? '' : '-' + b.end}: ${b.title}`)
    .join('\n');
}

function getTodayTasksText(date) {
  const assigned = getTodayAssignedTasks(date);

  if (!assigned.length) {
    return 'No assigned tasks today.';
  }

  return assigned
    .map(t => `${t.start}-${t.end}: ${t.title}`)
    .join('\n');
}

function renderPlanForDay(date) {
  const assignedEl = $('todayAssignedTasks');
  const suggestionsEl = $('dailySuggestions');

  if (!assignedEl || !suggestionsEl) return;

  const assigned = getTodayAssignedTasks(date);

  if (assigned.length) {
    assignedEl.innerHTML = assigned.map(t => `
      <div class="todo-item">
        <b>${t.title}</b>
        <div class="todo-meta">${t.start} - ${t.end}</div>
      </div>
    `).join('');
  } else {
    assignedEl.innerHTML = `<p class="empty-note">No tasks assigned for today yet.</p>`;
  }

  loadDailyAgentSuggestion(date);
}

async function loadDailyAgentSuggestion(date) {
  const suggestionsEl = $('dailySuggestions');
  if (!suggestionsEl) return;

  const diary = getYesterdayDiary(date);
  const todaySchedule = getTodayScheduleText(date);
  const todayTasks = getTodayTasksText(date);
  const freeWindowsText = getFreeWindowsText(date);

  if (!diary) {
    suggestionsEl.innerHTML = `
      <strong>Plan for the Day:</strong>
      No diary entry was saved yesterday. Add a Daily Diary entry tonight to improve tomorrow’s AI plan.
    `;
    return;
  }

  suggestionsEl.innerHTML = 'Generating AI plan for the day...';

  try {
    const response = await fetch('/.netlify/functions/daily-agent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        diary,
        todaySchedule,
        todayTasks,
        freeWindows: freeWindowsText
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.details || data.error || 'Agent request failed');
    }

    suggestionsEl.innerHTML = `
      <strong>AI Plan for the Day:</strong>
      ${data.summary || 'No AI summary returned.'}
    `;
  } catch (error) {
    suggestionsEl.innerHTML = `
      <strong>Plan for the Day:</strong>
      AI plan could not load. Check that your Netlify Function is deployed and your AI Gateway/OpenAI setup is active.
    `;
  }
}

function saveDailyDiary() {
  const input = $('dailyDiaryInput');
  const message = $('diarySavedMessage');

  if (!input || !message) return;

  const text = input.value.trim();
  const today = iso(new Date());

  if (!text) {
    message.innerHTML = 'Write a short diary entry first.';
    return;
  }

  const diaryEntries = JSON.parse(localStorage.getItem('dailyDiaryEntries') || '{}');

  diaryEntries[today] = {
    date: today,
    entry: text,
    savedAt: new Date().toISOString()
  };

  localStorage.setItem('dailyDiaryEntries', JSON.stringify(diaryEntries));

  message.innerHTML = `
    <strong>Saved:</strong>
    This diary entry will help shape tomorrow’s suggested priorities.
  `;
}

function loadDailyDiary() {
  const input = $('dailyDiaryInput');
  const count = $('diaryCount');

  if (!input || !count) return;

  const today = iso(new Date());
  const diaryEntries = JSON.parse(localStorage.getItem('dailyDiaryEntries') || '{}');

  if (diaryEntries[today]) {
    input.value = diaryEntries[today].entry;
    count.innerText = `${input.value.length}/300`;
  }

  input.addEventListener('input', () => {
    count.innerText = `${input.value.length}/300`;
  });
}

function rollOverMissedTasks() {
  const today = iso(new Date());
  const events = store.get('calendarEvents');

  const overdue = events.filter(e =>
    e.type === 'task' && e.date < today
  );

  if (!overdue.length) return;

  store.set(
    'todoTasks',
    tasks().map(t =>
      overdue.some(e => e.taskId === t.id)
        ? {...t, scheduled: false, eventId: null}
        : t
    )
  );

  store.set(
    'calendarEvents',
    events.filter(e => !(e.type === 'task' && e.date < today))
  );
}

document.addEventListener('DOMContentLoaded', () => {
  rollOverMissedTasks();
  loadDailyDiary();

  if ($('plannerDate')) {
    $('plannerDate').addEventListener('change', render);
  }

  render();
});
