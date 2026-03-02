    const WATCH_STOCKS = [
      { code: 'sh600519', name: '贵州茅台' },
      { code: 'sz000001', name: '平安银行' },
      { code: 'sz300750', name: '宁德时代' },
      { code: 'sh601318', name: '中国平安' },
      { code: 'sh600036', name: '招商银行' },
      { code: 'sz002415', name: '海康威视' }
    ];

    const API_TIMEOUT_MS = 4500;
    const API_ENDPOINTS = ['/api/quote', 'http://127.0.0.1:8787/api/quote'];

    const state = {
      currentSymbol: 'sh600519',
      currentQuote: null,
      minuteSeries: [],
      refreshTimer: null,
      requestId: 0
    };

    const el = {
      symbolInput: document.getElementById('symbolInput'),
      searchBtn: document.getElementById('searchBtn'),
      refreshBtn: document.getElementById('refreshBtn'),
      dataMode: document.getElementById('dataMode'),
      autoRefresh: document.getElementById('autoRefresh'),
      refreshInterval: document.getElementById('refreshInterval'),
      watchList: document.getElementById('watchList'),
      errorText: document.getElementById('errorText'),
      dataSource: document.getElementById('dataSource'),
      connectionStatus: document.getElementById('connectionStatus'),
      lastUpdate: document.getElementById('lastUpdate'),
      stockName: document.getElementById('stockName'),
      stockSymbol: document.getElementById('stockSymbol'),
      latestPrice: document.getElementById('latestPrice'),
      delta: document.getElementById('delta'),
      open: document.getElementById('open'),
      high: document.getElementById('high'),
      low: document.getElementById('low'),
      volume: document.getElementById('volume'),
      amount: document.getElementById('amount'),
      change: document.getElementById('change'),
      changePct: document.getElementById('changePct'),
      status: document.getElementById('status'),
      canvas: document.getElementById('minuteChart')
    };

    const ctx = el.canvas.getContext('2d');

    function validateSymbol(raw) {
      return /^(sh|sz)\d{6}$/i.test(raw.trim());
    }

    function normalizeSymbol(raw) {
      return raw.trim().toLowerCase();
    }

    function formatNumber(value, digits = 2) {
      if (typeof value !== 'number' || Number.isNaN(value)) return '--';
      return value.toLocaleString('zh-CN', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits
      });
    }

    function formatVolume(volume) {
      if (typeof volume !== 'number' || Number.isNaN(volume)) return '--';
      if (volume >= 1e8) return `${(volume / 1e8).toFixed(2)} 亿`;
      if (volume >= 1e4) return `${(volume / 1e4).toFixed(2)} 万`;
      return `${volume.toFixed(0)}`;
    }

    function formatAmount(amount) {
      if (typeof amount !== 'number' || Number.isNaN(amount)) return '--';
      if (amount >= 1e8) return `${(amount / 1e8).toFixed(2)} 亿元`;
      if (amount >= 1e4) return `${(amount / 1e4).toFixed(2)} 万元`;
      return `${amount.toFixed(0)} 元`;
    }

    function setError(msg = '') {
      el.errorText.textContent = msg;
    }

    function setTrendClass(target, value) {
      target.classList.remove('up', 'down');
      if (value > 0) target.classList.add('up');
      else if (value < 0) target.classList.add('down');
    }

    function setConnectionStatus(type, text) {
      el.connectionStatus.classList.remove('status-realtime', 'status-degraded', 'status-error');
      if (type === 'realtime') el.connectionStatus.classList.add('status-realtime');
      if (type === 'degraded') el.connectionStatus.classList.add('status-degraded');
      if (type === 'error') el.connectionStatus.classList.add('status-error');
      el.connectionStatus.textContent = `连接状态：${text}`;
    }

    function updateTimeLabel(date = new Date()) {
      const time = date.toLocaleTimeString('zh-CN', { hour12: false });
      el.lastUpdate.textContent = `最后更新时间：${time}`;
    }

    function renderQuote(quote) {
      state.currentQuote = quote;
      el.stockName.textContent = quote.name || '--';
      el.stockSymbol.textContent = quote.symbol ? quote.symbol.toUpperCase() : '--';
      el.latestPrice.textContent = formatNumber(quote.latest, 2);

      const deltaText = `${quote.change >= 0 ? '+' : ''}${formatNumber(quote.change, 2)} (${quote.changePct >= 0 ? '+' : ''}${formatNumber(quote.changePct, 2)}%)`;
      el.delta.textContent = deltaText;

      setTrendClass(el.latestPrice, quote.change);
      setTrendClass(el.delta, quote.change);

      el.open.textContent = formatNumber(quote.open, 2);
      el.high.textContent = formatNumber(quote.high, 2);
      el.low.textContent = formatNumber(quote.low, 2);
      el.volume.textContent = formatVolume(quote.volume);
      el.amount.textContent = formatAmount(quote.amount);
      el.change.textContent = `${quote.change >= 0 ? '+' : ''}${formatNumber(quote.change, 2)}`;
      el.changePct.textContent = `${quote.changePct >= 0 ? '+' : ''}${formatNumber(quote.changePct, 2)}%`;
      el.status.textContent = quote.status || '--';

      setTrendClass(el.change, quote.change);
      setTrendClass(el.changePct, quote.change);
    }

    function buildSimulatedSeries(basePrice, points = 120) {
      const safeBase = Number(basePrice) > 0 ? Number(basePrice) : 100;
      const arr = [];
      let p = safeBase;
      for (let i = 0; i < points; i += 1) {
        p += (Math.random() - 0.5) * safeBase * 0.0024;
        arr.push(Math.max(0.01, Number(p.toFixed(2))));
      }
      return arr;
    }

    function updateSeriesWithLatest(latest) {
      const safeLatest = Number(latest);
      if (!Number.isFinite(safeLatest) || safeLatest <= 0) return;
      if (!state.minuteSeries.length) {
        state.minuteSeries = buildSimulatedSeries(safeLatest);
        return;
      }
      state.minuteSeries.push(Number(safeLatest.toFixed(2)));
      if (state.minuteSeries.length > 180) {
        state.minuteSeries = state.minuteSeries.slice(-180);
      }
    }

    function drawChart() {
      const prices = state.minuteSeries;
      const dpr = window.devicePixelRatio || 1;
      const w = el.canvas.clientWidth;
      const h = el.canvas.clientHeight;
      el.canvas.width = Math.floor(w * dpr);
      el.canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      ctx.clearRect(0, 0, w, h);
      if (!prices.length) return;

      const min = Math.min(...prices);
      const max = Math.max(...prices);
      const pad = 18;
      const plotW = w - pad * 2;
      const plotH = h - pad * 2;
      const range = max - min || 1;

      ctx.strokeStyle = 'rgba(90,169,255,0.2)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      for (let i = 1; i <= 4; i += 1) {
        const y = pad + (plotH / 5) * i;
        ctx.beginPath();
        ctx.moveTo(pad, y);
        ctx.lineTo(pad + plotW, y);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      ctx.strokeStyle = '#5aa9ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      prices.forEach((price, idx) => {
        const x = pad + (idx / Math.max(1, prices.length - 1)) * plotW;
        const y = pad + ((max - price) / range) * plotH;
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      const gradient = ctx.createLinearGradient(0, pad, 0, pad + plotH);
      gradient.addColorStop(0, 'rgba(90,169,255,0.35)');
      gradient.addColorStop(1, 'rgba(90,169,255,0.02)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      prices.forEach((price, idx) => {
        const x = pad + (idx / Math.max(1, prices.length - 1)) * plotW;
        const y = pad + ((max - price) / range) * plotH;
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.lineTo(pad + plotW, pad + plotH);
      ctx.lineTo(pad, pad + plotH);
      ctx.closePath();
      ctx.fill();
    }

    function simulateQuote(symbol, nameHint = '模拟股票') {
      const previousClose = Number((20 + Math.random() * 200).toFixed(2));
      const latest = Number((previousClose * (1 + (Math.random() - 0.5) * 0.06)).toFixed(2));
      const open = Number((previousClose * (1 + (Math.random() - 0.5) * 0.02)).toFixed(2));
      const high = Number((Math.max(latest, open) * (1 + Math.random() * 0.02)).toFixed(2));
      const low = Number((Math.min(latest, open) * (1 - Math.random() * 0.02)).toFixed(2));
      const change = Number((latest - previousClose).toFixed(2));
      const changePct = Number(((change / previousClose) * 100).toFixed(2));

      return {
        symbol,
        name: nameHint,
        latest,
        open,
        high,
        low,
        volume: Math.round(5e6 + Math.random() * 2e8),
        amount: Math.round(5e7 + Math.random() * 5e9),
        change,
        changePct,
        status: '模拟数据',
        source: 'mock',
        timestamp: new Date().toISOString()
      };
    }

    async function fetchFromProxy(symbol) {
      let lastError = null;
      for (const endpoint of API_ENDPOINTS) {
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), API_TIMEOUT_MS);
        try {
          const url = `${endpoint}?symbol=${encodeURIComponent(symbol)}`;
          const res = await fetch(url, {
            method: 'GET',
            cache: 'no-store',
            signal: controller.signal
          });
          if (!res.ok) {
            const errText = await res.text();
            throw new Error(`HTTP ${res.status}${errText ? `: ${errText.slice(0, 120)}` : ''}`);
          }
          const data = await res.json();
          if (!data || typeof data.latest !== 'number') {
            throw new Error('返回数据格式不正确');
          }
          data.source = data.source || (endpoint.startsWith('http') ? 'local_proxy_8787' : 'local_proxy');
          return data;
        } catch (err) {
          if (err && err.name === 'AbortError') {
            lastError = new Error(`请求超时（>${API_TIMEOUT_MS / 1000}秒）`);
          } else {
            lastError = err;
          }
        } finally {
          window.clearTimeout(timeoutId);
        }
      }
      throw lastError || new Error('本地代理不可用');
    }

    function fetchTencentJsonp(symbol) {
      return new Promise((resolve, reject) => {
        const normalized = (symbol || '').toLowerCase();
        const cbName = `__qt_cb_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
        const varName = `v_${normalized}`;
        const script = document.createElement('script');
        const timeoutId = window.setTimeout(() => {
          cleanup();
          reject(new Error('腾讯 JSONP 超时'));
        }, API_TIMEOUT_MS);

        function cleanup() {
          window.clearTimeout(timeoutId);
          if (script.parentNode) script.parentNode.removeChild(script);
          try { delete window[cbName]; } catch (_) { window[cbName] = undefined; }
          try { delete window[varName]; } catch (_) { window[varName] = undefined; }
        }

        window[cbName] = function () {
          try {
            const raw = window[varName];
            const body = String(raw || '').replace(/^\w+="|";?$/g, '');
            const p = body.split('~');
            if (p.length < 38) throw new Error('腾讯 JSONP 数据结构无效');

            const latest = Number(p[3]);
            const prevClose = Number(p[4]);
            const open = Number(p[5]);
            const high = Number(p[33]);
            const low = Number(p[34]);
            const volumeHand = Number(p[36]);
            const amountWan = Number(p[37]);
            const change = Number((latest - prevClose).toFixed(2));
            const changePct = prevClose ? Number((((latest - prevClose) / prevClose) * 100).toFixed(2)) : 0;

            resolve({
              symbol: normalized,
              name: p[1] || normalized,
              latest,
              open,
              high,
              low,
              volume: Math.round(volumeHand * 100),
              amount: Math.round(amountWan * 10000),
              change,
              changePct,
              status: '实时',
              source: 'tencent_jsonp',
              timestamp: new Date().toISOString()
            });
          } catch (e) {
            reject(e);
          } finally {
            cleanup();
          }
        };

        script.src = `https://qt.gtimg.cn/q=${normalized}&callback=${cbName}`;
        script.onerror = function () {
          cleanup();
          reject(new Error('腾讯 JSONP 加载失败'));
        };
        document.body.appendChild(script);
      });
    }

    async function loadQuote(symbol, reason = 'manual') {
      const rid = ++state.requestId;
      const active = WATCH_STOCKS.find((s) => s.code === symbol);
      const nameHint = active ? active.name : symbol;
      setError('');
      highlightWatch(symbol);

      if (reason !== 'auto') {
        setConnectionStatus('realtime', '加载中');
        el.status.textContent = '加载中...';
      }

      const mode = el.dataMode.value;

      if (mode === 'mock') {
        const q = simulateQuote(symbol, nameHint);
        if (rid !== state.requestId) return;
        renderQuote(q);
        updateSeriesWithLatest(q.latest);
        drawChart();
        updateTimeLabel();
        el.dataSource.textContent = '数据源：模拟数据（手动模式）';
        setConnectionStatus('degraded', '降级');
        return;
      }

      try {
        const q = await fetchFromProxy(symbol);
        if (rid !== state.requestId) return;
        renderQuote(q);
        updateSeriesWithLatest(q.latest);
        drawChart();
        updateTimeLabel();
        el.dataSource.textContent = `数据源：${q.source || '本地代理'}`;
        setConnectionStatus('realtime', '实时');
      } catch (err) {
        try {
          const q2 = await fetchTencentJsonp(symbol);
          if (rid !== state.requestId) return;
          renderQuote(q2);
          updateSeriesWithLatest(q2.latest);
          drawChart();
          updateTimeLabel();
          el.dataSource.textContent = '数据源：腾讯 JSONP（直连）';
          setConnectionStatus('realtime', '实时');
          setError(`本地代理不可用，已切换腾讯直连：${err.message}`);
        } catch (err2) {
          const fallback = simulateQuote(symbol, nameHint);
          if (rid !== state.requestId) return;
          renderQuote(fallback);
          updateSeriesWithLatest(fallback.latest);
          drawChart();
          updateTimeLabel();
          el.dataSource.textContent = '数据源：模拟数据（API失败自动降级）';
          setConnectionStatus('degraded', '降级');
          setError(`实时接口异常：${err.message} / ${err2.message}`);
        }
      }
    }

    function highlightWatch(symbol) {
      Array.from(el.watchList.children).forEach((node) => {
        node.classList.toggle('active', node.dataset.code === symbol);
      });
    }

    function renderWatchList() {
      el.watchList.innerHTML = '';
      WATCH_STOCKS.forEach((item) => {
        const row = document.createElement('div');
        row.className = 'watch-item';
        row.dataset.code = item.code;
        row.innerHTML = `
          <div>
            <div>${item.code.toUpperCase()}</div>
            <div class="watch-name">${item.name}</div>
          </div>
          <div>查看</div>
        `;
        row.addEventListener('click', () => {
          state.currentSymbol = item.code;
          el.symbolInput.value = item.code;
          state.minuteSeries = [];
          loadQuote(item.code);
        });
        el.watchList.appendChild(row);
      });
      highlightWatch(state.currentSymbol);
    }

    function restartAutoRefresh() {
      if (state.refreshTimer) {
        window.clearInterval(state.refreshTimer);
        state.refreshTimer = null;
      }
      if (!el.autoRefresh.checked) return;
      const intervalSec = Number(el.refreshInterval.value) || 5;
      state.refreshTimer = window.setInterval(() => {
        loadQuote(state.currentSymbol, 'auto');
      }, intervalSec * 1000);
    }

    function onSearch() {
      const raw = el.symbolInput.value;
      if (!validateSymbol(raw)) {
        setConnectionStatus('error', '错误');
        setError('代码格式错误，请输入 sh600519 或 sz000001');
        return;
      }
      const symbol = normalizeSymbol(raw);
      state.currentSymbol = symbol;
      state.minuteSeries = [];
      loadQuote(symbol);
    }

    el.searchBtn.addEventListener('click', onSearch);
    el.symbolInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') onSearch();
    });

    el.refreshBtn.addEventListener('click', () => {
      loadQuote(state.currentSymbol);
    });

    el.dataMode.addEventListener('change', () => {
      loadQuote(state.currentSymbol);
    });

    el.autoRefresh.addEventListener('change', () => {
      restartAutoRefresh();
    });

    el.refreshInterval.addEventListener('change', () => {
      restartAutoRefresh();
    });

    window.addEventListener('resize', drawChart);

    renderWatchList();
    setConnectionStatus('realtime', '加载中');
    loadQuote(state.currentSymbol);
    restartAutoRefresh();
