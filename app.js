const eventRows = document.getElementById('event-rows');
const searchInput = document.getElementById('global-search');
const noEvents = document.getElementById('no-events');
const pauseButton = document.getElementById('pause-stream');
const toastRegion = document.getElementById('toast-region');
const activityRange = document.getElementById('activity-range');
const incidentList = document.getElementById('incident-list');
const settingsDialog = document.getElementById('settings-dialog');
const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
const sidebar = document.getElementById('primary-sidebar');
const eventHistory = [...eventRows.rows].map(readSeedEvent);

const simulatedEvents = [
  { title: 'Unusual outbound traffic', detail: 'Large data transfer detected', severity: 'High', ip: '89.248.165.16', flag: '🇬🇧', location: 'London, GB' },
  { title: 'Suspicious login', detail: 'Login from unrecognized device', severity: 'Medium', ip: '77.91.124.21', flag: '🇫🇷', location: 'Paris, FR' },
  { title: 'Malware detected', detail: 'Malicious file quarantined', severity: 'Critical', ip: '141.98.10.44', flag: '🇺🇦', location: 'Kyiv, UA' },
  { title: 'Port scan detected', detail: 'Repeated connection attempts', severity: 'Low', ip: '156.146.56.18', flag: '🇨🇦', location: 'Toronto, CA' }
];
const activityTotals = { 24: 1284, 7: 8462, 30: 34108 };
let streamPaused = false;
let historyExpanded = false;
let injectedCount = 0;
let streamIntervalSeconds = 9;
let streamTimer;

function readSeedEvent(row, index) {
  const eventInfo = row.querySelector('.event-type');
  const severity = row.querySelector('.severity').textContent.trim();
  const locationCell = row.querySelector('.location');
  const minutesAgo = Number(row.querySelector('.event-time').textContent.match(/\d+/)?.[0] || 0);
  return {
    title: eventInfo.querySelector('strong').textContent,
    detail: eventInfo.querySelector('small').textContent,
    severity,
    ip: row.querySelector('.mono').textContent,
    flag: locationCell.querySelector('.flag').textContent,
    location: locationCell.textContent.replace(locationCell.querySelector('.flag').textContent, '').trim(),
    occurredAt: new Date(Date.now() - minutesAgo * 60_000),
    id: `seed-${index}`
  };
}

function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  toastRegion.append(toast);
  window.setTimeout(() => toast.remove(), 3200);
}

function relativeTime(date) {
  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60_000));
  if (elapsedMinutes === 0) return 'Just now';
  if (elapsedMinutes < 60) return `${elapsedMinutes} min ago`;
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours} hr ago`;
  return `${Math.floor(elapsedHours / 24)} day ago`;
}

function createCell(className, text) {
  const cell = document.createElement('td');
  if (className) cell.className = className;
  cell.textContent = text;
  return cell;
}

function createEventRow(item) {
  const row = document.createElement('tr');
  const severityClass = item.severity.toLowerCase();
  row.dataset.search = `${item.title} ${item.detail} ${item.severity} ${item.ip} ${item.location}`.toLowerCase();

  const eventCell = document.createElement('td');
  const eventType = document.createElement('span');
  eventType.className = 'event-type';
  const icon = document.createElement('span');
  icon.className = `event-symbol ${severityClass === 'critical' ? 'red-text' : severityClass === 'high' ? 'orange-text' : 'blue-text'}`;
  icon.textContent = severityClass === 'critical' ? '⌁' : severityClass === 'high' ? '↗' : severityClass === 'medium' ? '◉' : '⌕';
  const description = document.createElement('span');
  const title = document.createElement('strong');
  title.textContent = item.title;
  const detail = document.createElement('small');
  detail.textContent = item.detail;
  description.append(title, detail);
  eventType.append(icon, description);
  eventCell.append(eventType);
  row.append(eventCell);

  const severityCell = document.createElement('td');
  const severityBadge = document.createElement('span');
  severityBadge.className = `severity severity-${severityClass}`;
  severityBadge.textContent = item.severity;
  severityCell.append(severityBadge);
  row.append(severityCell);

  row.append(createCell('mono', item.ip));
  const locationCell = document.createElement('td');
  const location = document.createElement('span');
  location.className = 'location';
  const flag = document.createElement('i');
  flag.className = 'flag';
  flag.textContent = item.flag;
  location.append(flag, document.createTextNode(` ${item.location}`));
  locationCell.append(location);
  row.append(locationCell);
  row.append(createCell('event-time', relativeTime(item.occurredAt)));
  return row;
}

function renderEvents() {
  const query = searchInput.value.trim().toLowerCase();
  const matches = eventHistory.filter((item) => {
    const text = `${item.title} ${item.detail} ${item.severity} ${item.ip} ${item.location}`.toLowerCase();
    return !query || text.includes(query);
  });
  const displayed = query || historyExpanded ? matches : matches.slice(0, 5);
  eventRows.replaceChildren(...displayed.map(createEventRow));
  noEvents.hidden = displayed.length > 0;
  document.getElementById('toggle-event-history').innerHTML = historyExpanded
    ? 'Show recent events <span>↑</span>'
    : 'View all events <span>→</span>';
}

function updateActivityChart() {
  const range = Number(activityRange.value);
  const injectedInRange = injectedCount;
  const total = (activityTotals[range] || activityTotals[24]) + injectedInRange;
  document.getElementById('chart-total').textContent = total.toLocaleString();
  document.getElementById('threat-count').textContent = (activityTotals[24] + injectedInRange).toLocaleString();
  document.getElementById('event-nav-count').textContent = String(12 + injectedInRange);

  const now = new Date();
  const labels = range === 24
    ? Array.from({ length: 12 }, (_, index) => {
      const hour = (now.getHours() - 22 + index * 2 + 48) % 24;
      return `${hour % 12 || 12}${hour < 12 ? 'a' : 'p'}`;
    })
    : range === 7
      ? Array.from({ length: 7 }, (_, index) => new Intl.DateTimeFormat('en', { weekday: 'short' }).format(new Date(now.getTime() - (6 - index) * 86_400_000)))
      : Array.from({ length: 11 }, (_, index) => {
        const date = new Date(now.getTime() - (10 - index) * 86_400_000);
        return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(date);
      });
  document.getElementById('chart-labels').replaceChildren(...labels.map((label) => {
    const span = document.createElement('span');
    span.textContent = label;
    return span;
  }));
}

function addSimulatedEvent() {
  if (streamPaused) return;
  const event = simulatedEvents[injectedCount % simulatedEvents.length];
  eventHistory.unshift({ ...event, occurredAt: new Date(), id: `sim-${injectedCount}` });
  injectedCount += 1;
  if (eventHistory.length > 250) eventHistory.length = 250;
  renderEvents();
  updateActivityChart();
}

function setStreamPaused(paused, notify = false) {
  streamPaused = paused;
  document.body.classList.toggle('is-paused', streamPaused);
  pauseButton.setAttribute('aria-pressed', String(streamPaused));
  pauseButton.querySelector('span:last-child').textContent = streamPaused ? 'Resume stream' : 'Pause stream';
  pauseButton.querySelector('.pause-icon').textContent = streamPaused ? '▶' : 'Ⅱ';
  document.getElementById('simulation-status').textContent = streamPaused ? 'Simulation paused ' : 'Simulation running ';
  if (notify) showToast(streamPaused ? 'Simulated event stream paused.' : 'Simulated event stream resumed.');
}

function startStreamTimer(seconds) {
  streamIntervalSeconds = seconds;
  window.clearInterval(streamTimer);
  streamTimer = window.setInterval(addSimulatedEvent, seconds * 1000);
}

function escapeCsv(value) {
  const safeValue = /^[\s]*[=+\-@]/.test(String(value)) ? `'${value}` : String(value);
  return `"${safeValue.replaceAll('"', '""')}"`;
}

function generateReport() {
  const rows = [
    ['SENTINEL simulated security report', new Date().toISOString()],
    ['Data source', 'Local browser simulation; not connected to a security service'],
    ['Simulated threats in last 24 hours', document.getElementById('threat-count').textContent],
    ['Open incidents', document.getElementById('queue-count').textContent],
    ['Risk score', document.querySelector('.risk-score').textContent.replace(/\s+/g, '')],
    [],
    ['Event', 'Description', 'Severity', 'Source IP', 'Location', 'Observed at']
  ];
  eventHistory.forEach((item) => rows.push([
    item.title, item.detail, item.severity, item.ip, item.location, item.occurredAt.toISOString()
  ]));
  const csv = rows.map((row) => row.map(escapeCsv).join(',')).join('\r\n');
  const blobUrl = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = `sentinel-demo-report-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  showToast('Demo security report downloaded as CSV.');
}

function acknowledgeIncident(incident) {
  if (!incident || incident.classList.contains('acknowledged')) return false;
  incident.classList.add('acknowledged');
  const button = incident.querySelector('.incident-action');
  button.textContent = '✓';
  button.setAttribute('aria-label', 'Incident acknowledged');
  const remaining = Math.max(0, Number(document.getElementById('queue-count').textContent) - 1);
  document.getElementById('queue-count').textContent = String(remaining);
  document.getElementById('incident-count').textContent = String(remaining).padStart(2, '0');
  return true;
}

function setCurrentDate() {
  document.getElementById('current-date').textContent = new Intl.DateTimeFormat('en', {
    weekday: 'short', month: 'short', day: '2-digit', year: 'numeric'
  }).format(new Date());
}

function setActiveNavigation(activeLink) {
  document.querySelectorAll('.primary-nav .nav-link').forEach((navLink) => {
    const active = navLink === activeLink;
    navLink.classList.toggle('active', active);
    if (active) navLink.setAttribute('aria-current', 'page');
    else navLink.removeAttribute('aria-current');
  });
}

function syncNavigationToLocation() {
  const hash = location.hash || '#overview';
  const currentLink = [...document.querySelectorAll('.primary-nav a[href^="#"]')]
    .find((link) => link.getAttribute('href') === hash);
  setActiveNavigation(currentLink);
}

function setMobileMenuOpen(open) {
  document.body.classList.toggle('mobile-menu-open', open);
  mobileMenuToggle.setAttribute('aria-expanded', String(open));
  mobileMenuToggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
  if (open) {
    const activeLink = sidebar.querySelector('.nav-link.active');
    (activeLink || sidebar.querySelector('.primary-nav .nav-link'))?.focus();
  } else {
    mobileMenuToggle.focus();
  }
}

mobileMenuToggle.addEventListener('click', () => {
  setMobileMenuOpen(mobileMenuToggle.getAttribute('aria-expanded') !== 'true');
});
document.getElementById('mobile-scrim').addEventListener('click', () => setMobileMenuOpen(false));
sidebar.addEventListener('click', (event) => {
  if (event.target.closest('a, button') && window.matchMedia('(max-width: 560px)').matches) {
    setMobileMenuOpen(false);
  }
});

searchInput.addEventListener('input', renderEvents);

pauseButton.addEventListener('click', () => setStreamPaused(!streamPaused, true));

document.getElementById('generate-report').addEventListener('click', generateReport);
document.getElementById('nav-report').addEventListener('click', generateReport);
document.getElementById('toggle-event-history').addEventListener('click', () => {
  historyExpanded = !historyExpanded;
  renderEvents();
  document.getElementById('events').scrollIntoView({ behavior: 'smooth', block: 'start' });
});
document.getElementById('view-incidents').addEventListener('click', () => {
  incidentList.scrollIntoView({ behavior: 'smooth', block: 'center' });
  incidentList.classList.add('attention-highlight');
  window.setTimeout(() => incidentList.classList.remove('attention-highlight'), 1400);
});
document.getElementById('acknowledge-all').addEventListener('click', () => {
  const openIncidents = [...incidentList.querySelectorAll('.incident-item:not(.acknowledged)')];
  if (openIncidents.length === 0) {
    showToast('There are no open incidents to acknowledge.');
    return;
  }
  openIncidents.forEach(acknowledgeIncident);
  showToast(`${openIncidents.length} incidents acknowledged.`);
});
incidentList.addEventListener('click', (event) => {
  const button = event.target.closest('.incident-action');
  if (!button) return;
  const incident = button.closest('.incident-item');
  if (acknowledgeIncident(incident)) showToast(`${incident.querySelector('strong').textContent} acknowledged.`);
});

document.getElementById('open-notifications').addEventListener('click', () => {
  const count = document.querySelectorAll('.incident-item:not(.acknowledged)').length;
  showToast(count ? `${count} open incident${count === 1 ? '' : 's'} need analyst attention.` : 'No open incident notifications.');
  document.getElementById('incidents').scrollIntoView({ behavior: 'smooth', block: 'center' });
});

document.getElementById('open-settings').addEventListener('click', () => {
  document.getElementById('simulation-interval').value = String(streamIntervalSeconds);
  document.getElementById('simulation-enabled').checked = !streamPaused;
  settingsDialog.showModal();
});
document.getElementById('settings-topbar').addEventListener('click', () => {
  document.getElementById('simulation-interval').value = String(streamIntervalSeconds);
  document.getElementById('simulation-enabled').checked = !streamPaused;
  settingsDialog.showModal();
});
document.getElementById('save-settings').addEventListener('click', () => {
  const interval = Number(document.getElementById('simulation-interval').value);
  setStreamPaused(!document.getElementById('simulation-enabled').checked);
  startStreamTimer(interval);
  settingsDialog.close();
  showToast(streamPaused ? 'Simulation settings saved; event generation is paused.' : `Simulation settings saved; events are generated every ${interval} seconds.`);
});
document.getElementById('profile-options').addEventListener('click', () => document.getElementById('profile-dialog').showModal());
document.getElementById('profile-topbar').addEventListener('click', () => document.getElementById('profile-dialog').showModal());
document.getElementById('map-details').addEventListener('click', () => document.getElementById('map-dialog').showModal());
document.getElementById('view-map').addEventListener('click', () => document.getElementById('map-dialog').showModal());
activityRange.addEventListener('change', updateActivityChart);

document.getElementById('assistant-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const input = document.getElementById('assistant-input');
  const answer = document.getElementById('assistant-answer');
  const question = input.value.trim().toLowerCase();
  if (!question) {
    input.focus();
    return;
  }
  const criticalEvents = eventHistory.filter((item) => item.severity === 'Critical').length;
  const openIncidents = document.querySelectorAll('.incident-item:not(.acknowledged)').length;
  if (question.includes('incident')) {
    answer.textContent = `There are ${openIncidents} open sample incidents in the queue. Acknowledge an incident to update the queue.`;
  } else if (question.includes('risk') || question.includes('vulnerab')) {
    answer.textContent = 'The sample risk posture is elevated at 72/100, with 3 critical, 12 high, and 28 medium findings. These are illustrative demo values.';
  } else if (question.includes('critical') || question.includes('threat') || question.includes('event')) {
    answer.textContent = `The sample event history contains ${criticalEvents} critical events. The latest is ${eventHistory.find((item) => item.severity === 'Critical')?.title || 'none'}; review the event stream for details.`;
  } else {
    answer.textContent = 'I can summarize the sample threats, open incidents, or risk posture. Try asking about one of those topics.';
  }
  input.value = '';
});

document.addEventListener('keydown', (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    searchInput.focus();
  }
  if (event.key === 'Escape' && document.activeElement === searchInput) {
    searchInput.value = '';
    renderEvents();
    searchInput.blur();
  }
  if (event.key === 'Escape' && document.body.classList.contains('mobile-menu-open')) {
    setMobileMenuOpen(false);
  }
});

document.querySelectorAll('.primary-nav a[href^="#"]').forEach((link) => {
  link.addEventListener('click', () => setActiveNavigation(link));
});
window.addEventListener('hashchange', syncNavigationToLocation);

setCurrentDate();
renderEvents();
updateActivityChart();
syncNavigationToLocation();
startStreamTimer(9);
