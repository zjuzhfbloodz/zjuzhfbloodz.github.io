const DISPLAY_TYPES = ['person', 'cat', 'dog'];

function formatDate(iso) {
  const d = new Date(iso);
  const w = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return `${d.getMonth() + 1}月${d.getDate()}日 ${w[d.getDay()]}`;
}

function isArchived(item) {
  return !DISPLAY_TYPES.includes(item.type);
}

function render() {
  const host = document.getElementById('list');
  const sections = [];

  for (const d of petImagesData.dates) {
    const arr = (petImagesData.images[d] || []).filter(isArchived);
    if (!arr.length) continue;
    sections.push(`
      <section class="day">
        <h2>${formatDate(d)} · ${arr.length} 张</h2>
        <div class="gallery">
          ${arr.map(x => `
            <article class="card">
              <img src="${x.img}" alt="${x.time}" loading="lazy" />
              <div class="meta">${x.time}</div>
            </article>
          `).join('')}
        </div>
      </section>
    `);
  }

  host.innerHTML = sections.length ? sections.join('') : '<section class="day">暂无归档图片</section>';
}

render();
