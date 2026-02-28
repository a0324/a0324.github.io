(function () {
  'use strict';

  // ==========================================
  // CONSTANTS
  // ==========================================
  var STORAGE_KEY = 'meditation_sessions';

  var LEVELS = [
    { level: 1, name: '入門', minMinutes: 0 },
    { level: 2, name: '初級', minMinutes: 60 },
    { level: 3, name: '中級', minMinutes: 180 },
    { level: 4, name: '上級', minMinutes: 500 },
    { level: 5, name: '熟練', minMinutes: 1000 },
    { level: 6, name: '達人', minMinutes: 2000 },
    { level: 7, name: '名人', minMinutes: 4000 },
    { level: 8, name: '仙人', minMinutes: 7000 },
    { level: 9, name: '覚者', minMinutes: 11000 },
    { level: 10, name: '悟り', minMinutes: 16000 }
  ];

  var CONCENTRATION_LABELS = [
    '',
    'とても低い',
    '低い',
    '普通',
    '高い',
    'とても高い'
  ];

  var DAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];

  // ==========================================
  // STATE
  // ==========================================
  var selectedDuration = null;
  var selectedConcentration = null;
  var swInterval = null;
  var swStartTime = null;
  var swElapsed = 0;
  var swRunning = false;
  var calendarYear, calendarMonth;
  var weeklyChart = null;

  // ==========================================
  // DATA LAYER
  // ==========================================
  function loadSessions() {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch (e) {
      return [];
    }
  }

  function saveSessions(sessions) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    } catch (e) {
      alert('データの保存に失敗しました。ストレージの空き容量を確認してください。');
    }
  }

  function addSession(data) {
    var sessions = loadSessions();
    var now = new Date();
    sessions.push({
      id: Date.now().toString(),
      date: now.toISOString().split('T')[0],
      duration: data.duration,
      concentration: data.concentration,
      notes: data.notes || '',
      createdAt: now.toISOString()
    });
    saveSessions(sessions);
  }

  function deleteSession(id) {
    var sessions = loadSessions().filter(function (s) { return s.id !== id; });
    saveSessions(sessions);
  }

  // ==========================================
  // STATS COMPUTATION
  // ==========================================
  function getCurrentLevel(totalMinutes) {
    var current = LEVELS[0];
    for (var i = 0; i < LEVELS.length; i++) {
      if (totalMinutes >= LEVELS[i].minMinutes) {
        current = LEVELS[i];
      } else {
        break;
      }
    }
    return current;
  }

  function getNextLevel(totalMinutes) {
    for (var i = 0; i < LEVELS.length; i++) {
      if (totalMinutes < LEVELS[i].minMinutes) {
        return LEVELS[i];
      }
    }
    return null;
  }

  function getProgressToNextLevel(totalMinutes) {
    var current = getCurrentLevel(totalMinutes);
    var next = getNextLevel(totalMinutes);
    if (!next) return { percent: 100, remaining: 0 };
    var range = next.minMinutes - current.minMinutes;
    var progress = totalMinutes - current.minMinutes;
    return {
      percent: Math.floor((progress / range) * 100),
      remaining: next.minMinutes - totalMinutes
    };
  }

  function computeStreaks(sessions) {
    if (sessions.length === 0) return { current: 0, longest: 0 };

    var dateSet = {};
    sessions.forEach(function (s) { dateSet[s.date] = true; });
    var dates = Object.keys(dateSet).sort().reverse();

    var today = new Date().toISOString().split('T')[0];
    var yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    var currentStreak = 0;
    var startDate;

    if (dateSet[today]) {
      startDate = today;
    } else if (dateSet[yesterday]) {
      startDate = yesterday;
    } else {
      return { current: 0, longest: computeLongestStreak(dates) };
    }

    var checkDate = new Date(startDate + 'T00:00:00');
    while (dateSet[checkDate.toISOString().split('T')[0]]) {
      currentStreak++;
      checkDate.setDate(checkDate.getDate() - 1);
    }

    return {
      current: currentStreak,
      longest: Math.max(currentStreak, computeLongestStreak(dates))
    };
  }

  function computeLongestStreak(sortedDatesDesc) {
    var dates = sortedDatesDesc.slice().reverse();
    if (dates.length === 0) return 0;
    var longest = 1;
    var current = 1;
    for (var i = 1; i < dates.length; i++) {
      var prev = new Date(dates[i - 1] + 'T00:00:00');
      var curr = new Date(dates[i] + 'T00:00:00');
      var diff = (curr - prev) / 86400000;
      if (diff === 1) {
        current++;
        if (current > longest) longest = current;
      } else {
        current = 1;
      }
    }
    return longest;
  }

  function computeStats(sessions) {
    var totalSessions = sessions.length;
    var totalMinutes = sessions.reduce(function (sum, s) { return sum + s.duration; }, 0);
    var streaks = computeStreaks(sessions);
    return {
      totalSessions: totalSessions,
      totalMinutes: totalMinutes,
      currentStreak: streaks.current,
      longestStreak: streaks.longest,
      level: getCurrentLevel(totalMinutes),
      nextLevel: getNextLevel(totalMinutes),
      progress: getProgressToNextLevel(totalMinutes)
    };
  }

  // ==========================================
  // STOPWATCH
  // ==========================================
  function updateStopwatchDisplay() {
    var total = swElapsed;
    if (swRunning) {
      total = swElapsed + (Date.now() - swStartTime);
    }
    var totalSeconds = Math.floor(total / 1000);
    var minutes = Math.floor(totalSeconds / 60);
    var seconds = totalSeconds % 60;
    document.getElementById('sw-minutes').textContent = pad(minutes);
    document.getElementById('sw-seconds').textContent = pad(seconds);
  }

  function pad(n) {
    return n < 10 ? '0' + n : '' + n;
  }

  function startStopwatch() {
    swStartTime = Date.now();
    swRunning = true;
    swInterval = setInterval(updateStopwatchDisplay, 200);

    document.getElementById('sw-start').classList.add('hidden');
    document.getElementById('sw-stop').classList.remove('hidden');
    document.getElementById('sw-reset').classList.add('hidden');
    document.getElementById('sw-hint').textContent = '瞑想中...';
    document.querySelector('.m-stopwatch-display').classList.add('running');
  }

  function stopStopwatch() {
    swElapsed += Date.now() - swStartTime;
    swRunning = false;
    clearInterval(swInterval);

    document.getElementById('sw-stop').classList.add('hidden');
    document.getElementById('sw-start').classList.remove('hidden');
    document.getElementById('sw-reset').classList.remove('hidden');
    document.getElementById('sw-hint').textContent = '瞑想お疲れさまでした';
    document.querySelector('.m-stopwatch-display').classList.remove('running');

    updateStopwatchDisplay();

    var totalMinutes = Math.round(swElapsed / 60000);
    if (totalMinutes >= 1) {
      switchToRecordWithDuration(totalMinutes);
    }
  }

  function resetStopwatch() {
    swElapsed = 0;
    swRunning = false;
    clearInterval(swInterval);
    updateStopwatchDisplay();
    document.getElementById('sw-start').classList.remove('hidden');
    document.getElementById('sw-stop').classList.add('hidden');
    document.getElementById('sw-reset').classList.add('hidden');
    document.getElementById('sw-hint').textContent = '静かに座り、呼吸に意識を向けましょう';
    document.querySelector('.m-stopwatch-display').classList.remove('running');
  }

  function switchToRecordWithDuration(minutes) {
    // Switch to record tab
    switchTab('record');

    // Set the duration
    selectedDuration = minutes;
    document.querySelectorAll('.m-duration-btn').forEach(function (b) {
      b.classList.remove('active');
      if (parseInt(b.dataset.minutes) === minutes) {
        b.classList.add('active');
      }
    });

    // If not a preset, set custom input
    var isPreset = false;
    document.querySelectorAll('.m-duration-btn').forEach(function (b) {
      if (parseInt(b.dataset.minutes) === minutes) isPreset = true;
    });
    if (!isPreset) {
      document.getElementById('custom-minutes').value = minutes;
    }
  }

  function initStopwatch() {
    document.getElementById('sw-start').addEventListener('click', startStopwatch);
    document.getElementById('sw-stop').addEventListener('click', stopStopwatch);
    document.getElementById('sw-reset').addEventListener('click', resetStopwatch);
  }

  // ==========================================
  // RECORD TAB
  // ==========================================
  function initRecordTab() {
    document.querySelectorAll('.m-duration-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.m-duration-btn').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        selectedDuration = parseInt(btn.dataset.minutes);
        document.getElementById('custom-minutes').value = '';
      });
    });

    var customInput = document.getElementById('custom-minutes');
    customInput.addEventListener('input', function () {
      if (customInput.value) {
        document.querySelectorAll('.m-duration-btn').forEach(function (b) { b.classList.remove('active'); });
        selectedDuration = parseInt(customInput.value);
      }
    });

    document.querySelectorAll('.m-conc-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.m-conc-btn').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        selectedConcentration = parseInt(btn.dataset.level);
        document.getElementById('conc-description').textContent =
          '集中度: ' + CONCENTRATION_LABELS[selectedConcentration];
      });
    });

    document.getElementById('save-btn').addEventListener('click', handleSave);
  }

  function handleSave() {
    if (!selectedDuration || selectedDuration < 1) {
      alert('瞑想時間を選択してください');
      return;
    }
    if (!selectedConcentration) {
      alert('集中度を選択してください');
      return;
    }

    var notes = document.getElementById('notes').value.trim();

    addSession({
      duration: selectedDuration,
      concentration: selectedConcentration,
      notes: notes
    });

    // Reset form
    selectedDuration = null;
    selectedConcentration = null;
    document.querySelectorAll('.m-duration-btn').forEach(function (b) { b.classList.remove('active'); });
    document.querySelectorAll('.m-conc-btn').forEach(function (b) { b.classList.remove('active'); });
    document.getElementById('custom-minutes').value = '';
    document.getElementById('notes').value = '';
    document.getElementById('conc-description').textContent = '';

    // Reset stopwatch
    resetStopwatch();

    showToast();
  }

  function showToast() {
    var toast = document.getElementById('save-toast');
    toast.classList.remove('hidden');
    toast.classList.add('show');
    setTimeout(function () {
      toast.classList.remove('show');
      setTimeout(function () {
        toast.classList.add('hidden');
      }, 300);
    }, 2000);
  }

  // ==========================================
  // DASHBOARD
  // ==========================================
  function renderDashboard() {
    var sessions = loadSessions();
    var stats = computeStats(sessions);

    renderLevelCard(stats);
    renderStatsGrid(stats);
    renderWeeklyChart(sessions);

    var now = new Date();
    calendarYear = now.getFullYear();
    calendarMonth = now.getMonth();
    renderCalendar(sessions, calendarYear, calendarMonth);
    renderRecentSessions(sessions);
  }

  function renderLevelCard(stats) {
    document.getElementById('level-number').textContent = stats.level.level;
    document.getElementById('level-display').textContent = stats.level.level;
    document.getElementById('level-name').textContent = stats.level.name;
    document.getElementById('level-progress').style.width = stats.progress.percent + '%';

    var text = stats.nextLevel
      ? '次のレベルまであと ' + stats.progress.remaining + ' 分'
      : '最高レベルに到達！';
    document.getElementById('progress-text').textContent = text;
  }

  function renderStatsGrid(stats) {
    document.getElementById('total-sessions').textContent = stats.totalSessions;
    document.getElementById('total-minutes').textContent = stats.totalMinutes;
    document.getElementById('current-streak').textContent = stats.currentStreak;
    document.getElementById('longest-streak').textContent = stats.longestStreak;
  }

  // ==========================================
  // WEEKLY CHART (Chart.js)
  // ==========================================
  function renderWeeklyChart(sessions) {
    var now = new Date();
    var dayOfWeek = now.getDay();
    var monday = new Date(now);
    monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7));
    monday.setHours(0, 0, 0, 0);

    var labels = [];
    var data = [];
    var bgColors = [];

    for (var i = 0; i < 7; i++) {
      var d = new Date(monday);
      d.setDate(monday.getDate() + i);
      var dateStr = d.toISOString().split('T')[0];
      var dayMinutes = sessions
        .filter(function (s) { return s.date === dateStr; })
        .reduce(function (sum, s) { return sum + s.duration; }, 0);

      labels.push(DAY_LABELS[d.getDay()]);
      data.push(dayMinutes);

      var isToday = dateStr === now.toISOString().split('T')[0];
      bgColors.push(isToday ? '#6c63ff' : '#b8b5ff');
    }

    var canvas = document.getElementById('weekly-chart');
    var ctx = canvas.getContext('2d');

    if (weeklyChart) {
      weeklyChart.destroy();
    }

    weeklyChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: '瞑想時間（分）',
          data: data,
          backgroundColor: bgColors,
          borderRadius: 6,
          borderSkipped: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function (context) {
                return context.parsed.y + ' 分';
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              stepSize: 10,
              callback: function (value) { return value + '分'; }
            },
            grid: {
              color: 'rgba(0,0,0,0.05)'
            }
          },
          x: {
            grid: { display: false }
          }
        }
      }
    });
  }

  // ==========================================
  // CALENDAR HEATMAP
  // ==========================================
  function renderCalendar(sessions, year, month) {
    var container = document.getElementById('calendar-grid');
    container.innerHTML = '';

    document.getElementById('cal-month-label').textContent =
      year + '年' + (month + 1) + '月';

    // Day headers
    DAY_LABELS.forEach(function (label) {
      var header = document.createElement('div');
      header.className = 'm-cal-header';
      header.textContent = label;
      container.appendChild(header);
    });

    // Build date->minutes map
    var dateMinutes = {};
    sessions.forEach(function (s) {
      var d = new Date(s.date + 'T00:00:00');
      if (d.getFullYear() === year && d.getMonth() === month) {
        dateMinutes[s.date] = (dateMinutes[s.date] || 0) + s.duration;
      }
    });

    var firstDay = new Date(year, month, 1);
    var startDow = firstDay.getDay();
    var daysInMonth = new Date(year, month + 1, 0).getDate();
    var todayStr = new Date().toISOString().split('T')[0];

    // Empty cells
    for (var i = 0; i < startDow; i++) {
      var empty = document.createElement('div');
      empty.className = 'm-cal-day empty';
      container.appendChild(empty);
    }

    // Day cells
    for (var day = 1; day <= daysInMonth; day++) {
      var dateStr = year + '-' +
        String(month + 1).padStart(2, '0') + '-' +
        String(day).padStart(2, '0');
      var minutes = dateMinutes[dateStr] || 0;
      var level = minutesToHeatLevel(minutes);

      var cell = document.createElement('div');
      cell.className = 'm-cal-day level-' + level;
      if (dateStr === todayStr) {
        cell.classList.add('today');
      }
      cell.textContent = day;
      if (minutes > 0) {
        cell.title = minutes + '分';
      }
      container.appendChild(cell);
    }
  }

  function minutesToHeatLevel(minutes) {
    if (minutes === 0) return 0;
    if (minutes < 10) return 1;
    if (minutes < 20) return 2;
    if (minutes < 40) return 3;
    return 4;
  }

  // ==========================================
  // RECENT SESSIONS
  // ==========================================
  function renderRecentSessions(sessions) {
    var container = document.getElementById('recent-sessions');
    container.innerHTML = '';

    var recent = sessions.slice().sort(function (a, b) { return b.id - a.id; }).slice(0, 10);

    if (recent.length === 0) {
      container.innerHTML = '<p class="m-empty-state">まだ記録がありません</p>';
      return;
    }

    recent.forEach(function (session) {
      var item = document.createElement('div');
      item.className = 'm-session-item';

      var header = document.createElement('div');
      header.className = 'm-session-header';

      var dateSpan = document.createElement('span');
      dateSpan.className = 'm-session-date';
      dateSpan.textContent = formatDate(session.date);

      var durationSpan = document.createElement('span');
      durationSpan.className = 'm-session-duration';
      durationSpan.textContent = session.duration + '分';

      header.appendChild(dateSpan);
      header.appendChild(durationSpan);
      item.appendChild(header);

      var details = document.createElement('div');
      details.className = 'm-session-details';

      var concSpan = document.createElement('span');
      concSpan.className = 'm-session-conc';
      concSpan.innerHTML = '集中度: ' + renderConcentrationDots(session.concentration);
      details.appendChild(concSpan);

      if (session.notes) {
        var notesP = document.createElement('p');
        notesP.className = 'm-session-notes';
        notesP.textContent = session.notes;
        details.appendChild(notesP);
      }

      item.appendChild(details);

      var deleteBtn = document.createElement('button');
      deleteBtn.className = 'm-session-delete';
      deleteBtn.textContent = '削除';
      deleteBtn.addEventListener('click', (function (sid) {
        return function () {
          if (confirm('この記録を削除しますか？')) {
            deleteSession(sid);
            renderDashboard();
          }
        };
      })(session.id));
      item.appendChild(deleteBtn);

      container.appendChild(item);
    });
  }

  function formatDate(dateStr) {
    var parts = dateStr.split('-');
    return parseInt(parts[1]) + '月' + parseInt(parts[2]) + '日';
  }

  function renderConcentrationDots(level) {
    var dots = '';
    for (var i = 1; i <= 5; i++) {
      dots += '<span class="m-dot ' + (i <= level ? 'filled' : '') + '"></span>';
    }
    return dots;
  }

  // ==========================================
  // TAB NAVIGATION
  // ==========================================
  function switchTab(targetId) {
    document.querySelectorAll('.m-tab').forEach(function (t) {
      t.classList.remove('active');
      if (t.dataset.tab === targetId) t.classList.add('active');
    });
    document.querySelectorAll('.m-section').forEach(function (s) { s.classList.remove('active'); });
    document.getElementById(targetId).classList.add('active');

    if (targetId === 'dashboard') {
      renderDashboard();
    }
  }

  function initTabs() {
    document.querySelectorAll('.m-tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        switchTab(tab.dataset.tab);
      });
    });

    document.getElementById('cal-prev').addEventListener('click', function () {
      calendarMonth--;
      if (calendarMonth < 0) { calendarMonth = 11; calendarYear--; }
      renderCalendar(loadSessions(), calendarYear, calendarMonth);
    });

    document.getElementById('cal-next').addEventListener('click', function () {
      calendarMonth++;
      if (calendarMonth > 11) { calendarMonth = 0; calendarYear++; }
      renderCalendar(loadSessions(), calendarYear, calendarMonth);
    });
  }

  // ==========================================
  // INIT
  // ==========================================
  function init() {
    initTabs();
    initStopwatch();
    initRecordTab();
    renderDashboard();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
