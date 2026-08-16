function toDate(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate();
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatAchievementCompletedAt(value) {
  const date = toDate(value);
  if (!date) return '';
  const pad = (number) => String(number).padStart(2, '0');
  const period = date.getHours() < 12 ? 'am' : 'pm';
  const hour = date.getHours() % 12 || 12;
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())} ${period} ${pad(hour)}:${pad(date.getMinutes())}에 달성`;
}

export function renderAchievementItem(definition, progress = {}, iconHtml = '') {
  const current = Math.min(Number(progress.current) || 0, definition.target || Infinity);
  const completedText = formatAchievementCompletedAt(progress.completedAt);
  const isBinary = definition.target <= 1;
  const progressText = definition.target ? `${current}/${definition.target}` : (progress.completed ? '달성' : '미달성');
  const item = document.createElement('article');
  item.className = `achievement-item${completedText ? ' is-complete' : ''}${isBinary && !completedText ? ' is-binary' : ''}`;
  item.setAttribute('aria-label', `${definition.name}, ${definition.description}, ${completedText || progressText}`);

  const icon = document.createElement('div');
  icon.className = 'achievement-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.innerHTML = iconHtml;

  const body = document.createElement('div');
  body.className = 'achievement-copy';
  const name = document.createElement('strong');
  name.textContent = definition.name;
  const description = document.createElement('span');
  description.textContent = definition.description;
  body.append(name, description);

  let status = null;
  if (completedText) {
    status = document.createElement('div');
    status.className = 'achievement-completed-at';
    status.textContent = completedText;
  } else if (!isBinary) {
    status = document.createElement('div');
    status.className = 'achievement-progress';
    const number = document.createElement('span');
    number.textContent = progressText;
    status.appendChild(number);
    if (definition.target) {
      const bar = document.createElement('div');
      bar.className = 'achievement-progress-bar';
      bar.setAttribute('role', 'progressbar');
      bar.setAttribute('aria-valuemin', '0');
      bar.setAttribute('aria-valuenow', String(current));
      bar.setAttribute('aria-valuemax', String(definition.target));
      const fill = document.createElement('span');
      fill.style.width = `${Math.min(100, (current / definition.target) * 100)}%`;
      bar.appendChild(fill);
      status.appendChild(bar);
    }
  }

  item.append(icon, body);
  if (status) item.append(status);
  return item;
}

export function renderAchievementList(container, entries) {
  if (!container) return;
  container.replaceChildren(...entries.map(({ definition, progress, iconHtml }) =>
    renderAchievementItem(definition, progress, iconHtml)
  ));
}
