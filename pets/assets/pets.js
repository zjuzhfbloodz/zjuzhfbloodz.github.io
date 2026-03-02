    const state = { type: 'all', showBox: false, data: null, startDate: null, endDate: null };
    const DISPLAY_TYPES = ['person', 'cat', 'dog'];

    function normalizedType(item) {
      return DISPLAY_TYPES.includes(item.type) ? item.type : 'other';
    }

    function formatDate(iso) {
      const d = new Date(iso);
      const w = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
      return `${d.getMonth() + 1}月${d.getDate()}日 ${w[d.getDay()]}`;
    }

    function btn(text, onClick, active) {
      const b = document.createElement('button');
      b.className = `btn ${active ? 'active' : ''}`;
      b.textContent = text;
      b.onclick = onClick;
      return b;
    }

    function renderSummary() {
      const all = Object.values(state.data.images).flat();
      const persons = all.filter(x => normalizedType(x) === 'person').length;
      const dogs = all.filter(x => normalizedType(x) === 'dog').length;
      const cats = all.filter(x => normalizedType(x) === 'cat').length;
      const others = all.filter(x => normalizedType(x) === 'other').length;

      document.getElementById('summary').innerHTML = `
        <div class="chip">总图<b>${all.length}</b></div>
        <div class="chip">🧍 人物<b>${persons}</b></div>
        <div class="chip">🐕 狗狗<b>${dogs}</b></div>
        <div class="chip">🐱 猫咪<b>${cats}</b></div>
        <div class="chip">🗂 其他<b>${others}</b></div>
      `;
    }

    function initRangeFilters() {
      const dates = [...state.data.dates].sort();
      state.startDate = dates[0] || null;
      state.endDate = dates[dates.length - 1] || null;
      const s = document.getElementById('startDate');
      const e = document.getElementById('endDate');
      s.value = state.startDate || '';
      e.value = state.endDate || '';
      document.getElementById('applyRangeBtn').onclick = () => {
        state.startDate = s.value || state.startDate;
        state.endDate = e.value || state.endDate;
        renderDay();
      };
    }

    function petTypeLabel(type) {
      if (type === 'person') return '人物';
      if (type === 'dog') return '狗狗';
      if (type === 'cat') return '猫咪';
      if (type === 'other') return '其他';
      return '其他';
    }

    function renderTypeButtons() {
      const wrap = document.getElementById('typeButtons');
      wrap.innerHTML = '';
      const opts = [
        ['all', '全部'],
        ['person', '人物'],
        ['cat', '猫咪'],
        ['dog', '狗狗'],
        ['other', '其他']
      ];
      opts.forEach(([key, label]) => {
        wrap.appendChild(btn(label, () => {
          state.type = key;
          renderTypeButtons();
          renderDay();
        }, state.type === key));
      });

      wrap.appendChild(btn(state.showBox ? '显示原图' : '红框标注', () => {
        state.showBox = !state.showBox;
        renderTypeButtons();
        renderDay();
      }, state.showBox));

    }

    function renderDay() {
      const day = document.getElementById('day');
      const empty = document.getElementById('empty');
      const start = state.startDate || '0000-01-01';
      const end = state.endDate || '9999-12-31';
      const inRange = Object.entries(state.data.images)
        .filter(([d]) => d >= start && d <= end)
        .flatMap(([, arr]) => arr);

      const list = inRange
        .filter(x => state.type === 'all' ? true : normalizedType(x) === state.type)
        .sort((a,b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`));

      if (!list.length) {
        day.style.display = 'none';
        empty.style.display = 'block';
        empty.textContent = '所选筛选条件下没有图片。';
        return;
      }

      day.style.display = 'block';
      empty.style.display = 'none';
      const typeLabel = state.type === 'all' ? '全部' : petTypeLabel(state.type);
      day.innerHTML = `
        <h2>${start} ~ ${end} · ${typeLabel} · 共 ${list.length} 张</h2>
        <div class="gallery">
          ${list.map(x => `
            <article class="card" onclick="openModal('${state.showBox && x.boxedImg ? x.boxedImg : x.img}')">
              <img src="${state.showBox && x.boxedImg ? x.boxedImg : x.img}" alt="${x.date} ${x.time}" loading="lazy" />
              <div class="meta">
                <div class="time">${x.date} ${x.time}</div>
                <span class="tag ${normalizedType(x)}">${petTypeLabel(normalizedType(x))}</span>
              </div>
            </article>
          `).join('')}
        </div>
      `;
    }

    function openModal(src) {
      document.getElementById('modalImg').src = src;
      document.getElementById('modal').classList.add('active');
    }

    function closeModal() {
      document.getElementById('modal').classList.remove('active');
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModal();
    });

    (function init() {
      if (typeof petImagesData === 'undefined') {
        document.getElementById('empty').style.display = 'block';
        document.getElementById('empty').textContent = '数据加载失败';
        return;
      }
      state.data = petImagesData;
      renderSummary();
      initRangeFilters();
      renderTypeButtons();
      renderDay();
    })();
