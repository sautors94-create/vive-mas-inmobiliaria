// Minimal, dependency-free trend charts for admin dashboard (Fase 5.3)
// Uses simple SVG bars + labels (no external chart library)

(function () {
  const ns = 'http://www.w3.org/2000/svg';

  const formatCompact = (n) => {
    const num = Number(n || 0);
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(num % 1_000_000 === 0 ? 0 : 1) + 'M';
    if (num >= 1_000) return (num / 1_000).toFixed(num % 1_000 === 0 ? 0 : 1) + 'k';
    return String(num);
  };

  const clear = (el) => {
    while (el && el.firstChild) el.removeChild(el.firstChild);
  };

  // data: { labels: [], series: [{ name, values:[...], color }] }
  const renderBarTrend = (container, data) => {
    if (!container) return;
    clear(container);

    const width = container.clientWidth || 720;
    const height = 240;
    const pad = { left: 46, right: 16, top: 18, bottom: 42 };

    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('width', String(width));
    svg.setAttribute('height', String(height));
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.classList.add('admin-trend-svg');

    // background grid
    const gridCount = 4;
    const maxValue = Math.max(...(data.series?.[0]?.values || [0]), 1);
    for (let i = 0; i <= gridCount; i++) {
      const y = pad.top + (i * (height - pad.top - pad.bottom)) / gridCount;
      const line = document.createElementNS(ns, 'line');
      line.setAttribute('x1', String(pad.left));
      line.setAttribute('x2', String(width - pad.right));
      line.setAttribute('y1', String(y));
      line.setAttribute('y2', String(y));
      line.setAttribute('stroke', 'rgba(229,231,235,0.9)');
      line.setAttribute('stroke-width', '1');
      svg.appendChild(line);
    }

    // bars from first series
    const series = data.series?.[0];
    const values = series?.values || [];
    const labels = data.labels || [];
    const n = Math.max(values.length, labels.length, 1);

    const plotW = (width - pad.left - pad.right);
    const plotH = (height - pad.top - pad.bottom);
    const barGap = 10;
    const barW = Math.max(10, (plotW - barGap * (n - 1)) / n);

    values.forEach((v, i) => {
      const clamped = Number(v || 0);
      const x = pad.left + i * (barW + barGap);
      const barH = (clamped / maxValue) * plotH;
      const y = pad.top + (plotH - barH);

      const rect = document.createElementNS(ns, 'rect');
      rect.setAttribute('x', String(x));
      rect.setAttribute('y', String(y));
      rect.setAttribute('width', String(barW));
      rect.setAttribute('height', String(barH));
      rect.setAttribute('rx', '10');
      rect.setAttribute('fill', series?.color || 'var(--primary)');
      rect.setAttribute('opacity', '0.95');
      svg.appendChild(rect);

      // value label (compact)
      const text = document.createElementNS(ns, 'text');
      text.setAttribute('x', String(x + barW / 2));
      text.setAttribute('y', String(y - 8));
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('font-size', '11');
      text.setAttribute('fill', 'rgba(17,24,39,0.75)');
      text.textContent = clamped === 0 ? '' : formatCompact(clamped);
      svg.appendChild(text);

      // x label
      const xLabel = document.createElementNS(ns, 'text');
      xLabel.setAttribute('x', String(x + barW / 2));
      xLabel.setAttribute('y', String(height - 18));
      xLabel.setAttribute('text-anchor', 'middle');
      xLabel.setAttribute('font-size', '11');
      xLabel.setAttribute('fill', 'rgba(107,114,128,0.95)');
      xLabel.textContent = labels[i] || '';
      svg.appendChild(xLabel);
    });

    const legend = document.createElement('div');
    legend.className = 'admin-trend-legend';
    legend.innerHTML = `
      <div class="admin-trend-legend-item">
        <span class="dot" style="background:${series?.color || 'var(--primary)'}"></span>
        <span class="name">${series?.name || 'Tendencia'}</span>
      </div>
      <div class="admin-trend-hint">Últimos 6 periodos</div>
    `;

    container.appendChild(legend);
    container.appendChild(svg);
  };

  window.adminCharts = {
    renderBarTrend
  };
})();

