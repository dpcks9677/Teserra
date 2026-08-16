import { getRatingSeries } from './profileStats.js';

function formatRatingDate(value) {
  const date = new Date(value);
  return `${date.getUTCFullYear()}.${String(date.getUTCMonth() + 1).padStart(2, '0')}.${String(date.getUTCDate()).padStart(2, '0')}`;
}

export function renderProfileRatingGraph(chart, userData, mode) {
  clearTimeout(chart.ratingHideTimer);
  clearTimeout(chart.ratingFadeTimer);
  const series = getRatingSeries(userData, mode);
  const ratings = series.map((point) => point.rating);
  const rawMin = Math.min(...ratings);
  const rawMax = Math.max(...ratings);
  const padding = rawMin === rawMax ? 25 : Math.max(10, (rawMax - rawMin) * 0.15);
  const min = rawMin - padding;
  const max = rawMax + padding;
  const points = series.map((point, index) => ({
    ...point,
    x: 1.5 + (index / (series.length - 1)) * 237,
    y: 4 + ((max - point.rating) / (max - min)) * 56
  }));
  const linePath = points.map((point, index) => `${index ? 'L' : 'M'}${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join('');
  const areaPath = `M0 ${points[0].y.toFixed(2)}${points.map((point) => `L${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join('')}L240 ${points.at(-1).y.toFixed(2)}V64H0Z`;
  chart.querySelector('.profile-rating-line')?.setAttribute('d', linePath);
  chart.querySelector('.profile-rating-area')?.setAttribute('d', areaPath);

  const pointElement = chart.querySelector('.profile-rating-point');
  const pointHalo = chart.querySelector('.profile-rating-point-halo');
  const tooltip = chart.querySelector('.profile-rating-tooltip');
  let activeIndex = series.length - 1;
  const showPoint = (index) => {
    clearTimeout(chart.ratingHideTimer);
    activeIndex = Math.max(0, Math.min(series.length - 1, index));
    const active = points[activeIndex];
    clearTimeout(chart.ratingFadeTimer);
    chart.classList.remove('is-rating-point-shrinking', 'is-rating-point-hiding');
    [pointElement, pointHalo].forEach((element) => {
      if (!element) return;
      element.style.left = `${(active.x / 240) * 100}%`;
      element.style.top = `${(active.y / 64) * 100}%`;
      element.removeAttribute('hidden');
    });
    if (tooltip) {
      tooltip.textContent = `${formatRatingDate(active.date)} · ${active.rating}`;
      const position = active.x / 240;
      tooltip.style.left = position < 0.2 ? '4px' : position > 0.8 ? 'auto' : `${position * 100}%`;
      tooltip.style.right = position > 0.8 ? '4px' : 'auto';
      tooltip.style.transform = position < 0.2 || position > 0.8 ? 'none' : 'translateX(-50%)';
      tooltip.classList.remove('hidden');
    }
  };
  const hidePoint = () => {
    chart.classList.add('is-rating-point-hiding');
    chart.ratingFadeTimer = setTimeout(() => {
      pointElement?.setAttribute('hidden', '');
      pointHalo?.setAttribute('hidden', '');
      tooltip?.classList.add('hidden');
      chart.classList.remove('is-rating-point-shrinking', 'is-rating-point-hiding');
    }, 300);
  };
  const scheduleHide = () => {
    clearTimeout(chart.ratingHideTimer);
    clearTimeout(chart.ratingFadeTimer);
    chart.classList.add('is-rating-point-shrinking');
    chart.ratingHideTimer = setTimeout(hidePoint, 1000);
  };

  chart.onpointermove = (event) => {
    const rect = chart.getBoundingClientRect();
    showPoint(Math.round(((event.clientX - rect.left) / rect.width) * (series.length - 1)));
  };
  chart.onpointerleave = scheduleHide;
  chart.onfocus = () => showPoint(activeIndex);
  chart.onblur = scheduleHide;
  chart.onkeydown = (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    showPoint(activeIndex + (event.key === 'ArrowRight' ? 1 : -1));
  };
}
