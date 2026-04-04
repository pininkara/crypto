import { useEffect, useRef, useState, useCallback } from 'react';

interface AssetDayData {
  date: string;
  values: number[];
}

interface DayBar {
  date: string;
  values: number[];
  open: number;
  close: number;
  high: number;
  low: number;
  isFilled: boolean;
}

interface AssetChartProps {
  isDark: boolean;
}

const DARK_COLORS = {
  bg: '#131722',
  gridLine: '#1e222d',
  text: '#787b86',
  textBright: '#d1d4dc',
  up: '#26a69a',
  down: '#ef5350',
  neutral: '#5d606b',
  crosshair: '#758696',
  tooltipBg: '#1e222d',
  tooltipBorder: '#363a45',
  maxLine: '#f0b90b',
  minLine: '#8b5cf6',
  scrollbarBg: '#1e222d',
  scrollbarThumb: '#363a45',
};

const LIGHT_COLORS = {
  bg: '#ffffff',
  gridLine: '#e8e8e8',
  text: '#9ca3af',
  textBright: '#374151',
  up: '#16a34a',
  down: '#dc2626',
  neutral: '#9ca3af',
  crosshair: '#6b7280',
  tooltipBg: '#f9fafb',
  tooltipBorder: '#d1d5db',
  maxLine: '#d97706',
  minLine: '#7c3aed',
  scrollbarBg: '#e5e7eb',
  scrollbarThumb: '#9ca3af',
};

const AssetChart = ({ isDark }: AssetChartProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [data, setData] = useState<DayBar[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  
  const viewRef = useRef({
    startIdx: 0,
    visibleCount: 30,
    isDragging: false,
    dragStartX: 0,
    dragStartIdx: 0,
    mouseX: -1,
    mouseY: -1,
  });

  const fetchData = useCallback(() => {
    fetch('/api/assets')
      .then(res => res.json())
      .then((raw: AssetDayData[]) => {
        if (!raw || raw.length === 0) {
          setData([]);
          setLoading(false);
          return;
        }
        
        const bars: DayBar[] = raw.map((d, i) => {
          const prevClose = i > 0 ? raw[i - 1].values[raw[i - 1].values.length - 1] : d.values[0];
          return {
            date: d.date,
            values: d.values,
            open: prevClose,
            close: d.values[d.values.length - 1],
            high: Math.max(...d.values),
            low: Math.min(...d.values),
            isFilled: d.values.length === 1 && i > 0 && d.values[0] === raw[i - 1].values[raw[i - 1].values.length - 1],
          };
        });
        
        setData(bars);
        const vc = Math.min(30, bars.length);
        viewRef.current.visibleCount = vc;
        viewRef.current.startIdx = Math.max(0, bars.length - vc);
        setLoading(false);
      })
      .catch(() => {
        setError('获取数据失败');
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSync = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      const res = await fetch('/api/assets/sync', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        // 重新获取数据以刷新图表
        fetchData();
      } else {
        alert(data.error || '同步失败');
      }
    } catch (e) {
      alert('同步请求失败');
    } finally {
      setSyncing(false);
    }
  };

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || data.length === 0) return;

    const COLORS = isDark ? DARK_COLORS : LIGHT_COLORS;

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';

    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);

    const W = rect.width;
    const H = rect.height;
    const PADDING_TOP = 30;
    const PADDING_BOTTOM = 50;
    const PADDING_LEFT = 10;
    const PADDING_RIGHT = 80;
    const CHART_W = W - PADDING_LEFT - PADDING_RIGHT;
    const CHART_H = H - PADDING_TOP - PADDING_BOTTOM;

    const { startIdx, visibleCount, mouseX, mouseY } = viewRef.current;
    const endIdx = Math.min(startIdx + visibleCount, data.length);
    const visibleData = data.slice(startIdx, endIdx);

    if (visibleData.length === 0) return;

    // 清空
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, W, H);

    // 计算价格范围
    let minPrice = Infinity;
    let maxPrice = -Infinity;
    for (const bar of visibleData) {
      if (bar.high > maxPrice) maxPrice = bar.high;
      if (bar.low < minPrice) minPrice = bar.low;
      if (bar.open > maxPrice) maxPrice = bar.open;
      if (bar.open < minPrice) minPrice = bar.open;
    }

    const priceRange = maxPrice - minPrice;
    const margin = priceRange === 0 ? maxPrice * 0.05 : priceRange * 0.1;
    const adjustedMin = minPrice - margin;
    const adjustedMax = maxPrice + margin;
    const adjustedRange = adjustedMax - adjustedMin;

    const priceToY = (price: number) => {
      return PADDING_TOP + CHART_H * (1 - (price - adjustedMin) / adjustedRange);
    };

    const barWidth = CHART_W / visibleData.length;
    const candleWidth = Math.max(2, barWidth * 0.6);

    // 网格线和价格标签
    const gridLines = 6;
    ctx.strokeStyle = COLORS.gridLine;
    ctx.lineWidth = 1;
    ctx.font = '11px monospace';
    ctx.fillStyle = COLORS.text;
    ctx.textAlign = 'right';

    for (let i = 0; i <= gridLines; i++) {
      const price = adjustedMin + (adjustedRange / gridLines) * i;
      const y = priceToY(price);
      ctx.beginPath();
      ctx.moveTo(PADDING_LEFT, y);
      ctx.lineTo(W - PADDING_RIGHT, y);
      ctx.stroke();
      ctx.fillText(formatNumber(price), W - 8, y + 4);
    }

    // 当前范围的实际最高和最低
    let rangeMaxPrice = -Infinity;
    let rangeMinPrice = Infinity;
    for (let i = 0; i < visibleData.length; i++) {
      const bar = visibleData[i];
      if (bar.high > rangeMaxPrice) { rangeMaxPrice = bar.high; }
      if (bar.low < rangeMinPrice) { rangeMinPrice = bar.low; }
    }

    // 最高值虚线
    const maxY = priceToY(rangeMaxPrice);
    ctx.save();
    ctx.strokeStyle = COLORS.maxLine;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(PADDING_LEFT, maxY);
    ctx.lineTo(W - PADDING_RIGHT, maxY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    ctx.fillStyle = COLORS.maxLine;
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`▲ ${formatNumber(rangeMaxPrice)}`, W - 8, maxY - 4);

    // 最低值虚线
    const minY = priceToY(rangeMinPrice);
    ctx.save();
    ctx.strokeStyle = COLORS.minLine;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(PADDING_LEFT, minY);
    ctx.lineTo(W - PADDING_RIGHT, minY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    ctx.fillStyle = COLORS.minLine;
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`▼ ${formatNumber(rangeMinPrice)}`, W - 8, minY + 14);

    // K 柱
    for (let i = 0; i < visibleData.length; i++) {
      const bar = visibleData[i];
      const x = PADDING_LEFT + barWidth * i + barWidth / 2;
      
      if (bar.isFilled) {
        ctx.fillStyle = COLORS.neutral;
        ctx.globalAlpha = 0.4;
        ctx.beginPath();
        ctx.arc(x, priceToY(bar.close), 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        continue;
      }

      const isUp = bar.close >= bar.open;
      const color = isUp ? COLORS.up : COLORS.down;

      if (bar.values.length === 1) {
        const y = priceToY(bar.values[0]);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, Math.min(4, candleWidth / 2.5), 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x - candleWidth / 3, y);
        ctx.lineTo(x + candleWidth / 3, y);
        ctx.stroke();
      } else {
        const bodyTop = priceToY(bar.high);
        const bodyBottom = priceToY(bar.low);
        const bodyHeight = Math.max(1, bodyBottom - bodyTop);

        ctx.fillStyle = color;
        const r = Math.min(2, candleWidth / 4);
        roundRect(ctx, x - candleWidth / 2, bodyTop, candleWidth, bodyHeight, r);
        ctx.fill();
      }
    }

    // 日期轴
    ctx.fillStyle = COLORS.text;
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    const labelStep = Math.max(1, Math.floor(visibleData.length / 8));
    for (let i = 0; i < visibleData.length; i += labelStep) {
      const bar = visibleData[i];
      const x = PADDING_LEFT + barWidth * i + barWidth / 2;
      const label = bar.date.slice(5);
      ctx.fillText(label, x, H - PADDING_BOTTOM + 18);
    }

    // 十字准线
    if (mouseX >= PADDING_LEFT && mouseX <= W - PADDING_RIGHT &&
        mouseY >= PADDING_TOP && mouseY <= H - PADDING_BOTTOM) {
      const barIndex = Math.floor((mouseX - PADDING_LEFT) / barWidth);
      if (barIndex >= 0 && barIndex < visibleData.length) {
        const bar = visibleData[barIndex];
        const bx = PADDING_LEFT + barWidth * barIndex + barWidth / 2;

        ctx.save();
        ctx.strokeStyle = COLORS.crosshair;
        ctx.lineWidth = 0.5;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(bx, PADDING_TOP);
        ctx.lineTo(bx, H - PADDING_BOTTOM);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(PADDING_LEFT, mouseY);
        ctx.lineTo(W - PADDING_RIGHT, mouseY);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();

        // 价格标签
        const hoverPrice = adjustedMin + adjustedRange * (1 - (mouseY - PADDING_TOP) / CHART_H);
        ctx.fillStyle = COLORS.tooltipBg;
        ctx.fillRect(W - PADDING_RIGHT, mouseY - 10, PADDING_RIGHT, 20);
        ctx.strokeStyle = COLORS.tooltipBorder;
        ctx.strokeRect(W - PADDING_RIGHT, mouseY - 10, PADDING_RIGHT, 20);
        ctx.fillStyle = COLORS.textBright;
        ctx.font = '11px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(formatNumber(hoverPrice), W - 8, mouseY + 4);

        // 日期标签
        const dateLabel = bar.date;
        const dlWidth = ctx.measureText(dateLabel).width + 12;
        ctx.fillStyle = COLORS.tooltipBg;
        ctx.fillRect(bx - dlWidth / 2, H - PADDING_BOTTOM + 2, dlWidth, 20);
        ctx.strokeStyle = COLORS.tooltipBorder;
        ctx.strokeRect(bx - dlWidth / 2, H - PADDING_BOTTOM + 2, dlWidth, 20);
        ctx.fillStyle = COLORS.textBright;
        ctx.textAlign = 'center';
        ctx.fillText(dateLabel, bx, H - PADDING_BOTTOM + 16);

        // Tooltip
        const tooltipW = 170;
        const tooltipH = bar.values.length > 1 ? 90 : 60;
        let tx = bx + 15;
        let ty = mouseY - tooltipH / 2;
        if (tx + tooltipW > W - PADDING_RIGHT) tx = bx - tooltipW - 15;
        if (ty < PADDING_TOP) ty = PADDING_TOP;
        if (ty + tooltipH > H - PADDING_BOTTOM) ty = H - PADDING_BOTTOM - tooltipH;

        ctx.fillStyle = COLORS.tooltipBg;
        ctx.globalAlpha = 0.95;
        roundRect(ctx, tx, ty, tooltipW, tooltipH, 6);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = COLORS.tooltipBorder;
        roundRect(ctx, tx, ty, tooltipW, tooltipH, 6);
        ctx.stroke();

        ctx.fillStyle = COLORS.textBright;
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`📅 ${bar.date}`, tx + 10, ty + 18);
        
        if (bar.values.length > 1) {
          ctx.font = '11px monospace';
          ctx.fillStyle = COLORS.up;
          ctx.fillText(`📈 最高: ${formatNumber(bar.high)}`, tx + 10, ty + 38);
          ctx.fillStyle = COLORS.down;
          ctx.fillText(`📉 最低: ${formatNumber(bar.low)}`, tx + 10, ty + 56);
          ctx.fillStyle = COLORS.textBright;
          ctx.fillText(`📊 记录: ${bar.values.length} 次`, tx + 10, ty + 74);
        } else {
          ctx.font = '11px monospace';
          ctx.fillStyle = COLORS.textBright;
          ctx.fillText(`💰 资产: ${formatNumber(bar.close)}`, tx + 10, ty + 38);
          if (bar.isFilled) {
            ctx.fillStyle = COLORS.neutral;
            ctx.fillText(`(复制前日数据)`, tx + 10, ty + 54);
          }
        }
      }
    }

    // 滚动条
    const scrollBarY = H - 18;
    const scrollBarH = 6;
    const totalBars = data.length;
    const scrollRatio = CHART_W / totalBars;
    const thumbW = Math.max(20, visibleCount * scrollRatio);
    const thumbX = PADDING_LEFT + (startIdx / totalBars) * CHART_W;

    ctx.fillStyle = COLORS.scrollbarBg;
    roundRect(ctx, PADDING_LEFT, scrollBarY, CHART_W, scrollBarH, 3);
    ctx.fill();

    ctx.fillStyle = COLORS.scrollbarThumb;
    roundRect(ctx, thumbX, scrollBarY, thumbW, scrollBarH, 3);
    ctx.fill();

  }, [data, isDark]);

  // resize 监听
  useEffect(() => {
    const handleResize = () => {
      requestAnimationFrame(draw);
    };
    window.addEventListener('resize', handleResize);
    draw();
    return () => window.removeEventListener('resize', handleResize);
  }, [draw]);

  // 鼠标/触摸事件
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.length === 0) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const view = viewRef.current;
      const delta = e.deltaY > 0 ? 2 : -2;
      const newCount = Math.max(5, Math.min(data.length, view.visibleCount + delta));
      
      const rect = canvas.getBoundingClientRect();
      const mouseRatio = (e.clientX - rect.left - 10) / (rect.width - 90);
      const centerIdx = view.startIdx + view.visibleCount * mouseRatio;
      
      view.visibleCount = newCount;
      view.startIdx = Math.max(0, Math.min(data.length - newCount, Math.round(centerIdx - newCount * mouseRatio)));
      requestAnimationFrame(draw);
    };

    const handleMouseDown = (e: MouseEvent) => {
      const view = viewRef.current;
      view.isDragging = true;
      view.dragStartX = e.clientX;
      view.dragStartIdx = view.startIdx;
      canvas.style.cursor = 'grabbing';
    };

    const handleMouseMove = (e: MouseEvent) => {
      const view = viewRef.current;
      const rect = canvas.getBoundingClientRect();
      view.mouseX = e.clientX - rect.left;
      view.mouseY = e.clientY - rect.top;

      if (view.isDragging) {
        const dx = e.clientX - view.dragStartX;
        const barWidth = (rect.width - 90) / view.visibleCount;
        const indexDelta = Math.round(-dx / barWidth);
        view.startIdx = Math.max(0, Math.min(data.length - view.visibleCount, view.dragStartIdx + indexDelta));
      }
      requestAnimationFrame(draw);
    };

    const handleMouseUp = () => {
      viewRef.current.isDragging = false;
      canvas.style.cursor = 'crosshair';
    };

    const handleMouseLeave = () => {
      viewRef.current.isDragging = false;
      viewRef.current.mouseX = -1;
      viewRef.current.mouseY = -1;
      canvas.style.cursor = 'crosshair';
      requestAnimationFrame(draw);
    };

    let touchStartX = 0;
    let touchStartIdx = 0;
    let lastTouchDist = 0;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        touchStartX = e.touches[0].clientX;
        touchStartIdx = viewRef.current.startIdx;
      } else if (e.touches.length === 2) {
        lastTouchDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const view = viewRef.current;
      const rect = canvas.getBoundingClientRect();

      if (e.touches.length === 1) {
        const dx = e.touches[0].clientX - touchStartX;
        const barWidth = (rect.width - 90) / view.visibleCount;
        const indexDelta = Math.round(-dx / barWidth);
        view.startIdx = Math.max(0, Math.min(data.length - view.visibleCount, touchStartIdx + indexDelta));

        view.mouseX = e.touches[0].clientX - rect.left;
        view.mouseY = e.touches[0].clientY - rect.top;
      } else if (e.touches.length === 2) {
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const scale = dist / lastTouchDist;
        lastTouchDist = dist;
        const newCount = Math.max(5, Math.min(data.length, Math.round(view.visibleCount / scale)));
        view.visibleCount = newCount;
        view.startIdx = Math.max(0, Math.min(data.length - newCount, view.startIdx));
      }
      requestAnimationFrame(draw);
    };

    const handleTouchEnd = () => {
      viewRef.current.mouseX = -1;
      viewRef.current.mouseY = -1;
      requestAnimationFrame(draw);
    };

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseleave', handleMouseLeave);
    canvas.addEventListener('touchstart', handleTouchStart, { passive: true });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd);

    return () => {
      canvas.removeEventListener('wheel', handleWheel);
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchend', handleTouchEnd);
    };
  }, [data, draw]);

  const COLORS = isDark ? DARK_COLORS : LIGHT_COLORS;

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-8 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-800 transition-colors text-center py-20">
        <div className="inline-block w-8 h-8 border-4 border-blue-300 border-t-blue-600 rounded-full animate-spin" />
        <p className="mt-4 text-gray-500 dark:text-gray-400">加载资产数据中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-8 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-800 transition-colors text-center py-20">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="max-w-4xl mx-auto p-4 md:p-8 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-800 transition-colors text-center py-20 animate-fade-in">
        <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-2">暂无资产数据</h2>
        <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
          使用 Telegram Bot 发送 <code className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-sm font-mono">/assets &lt;金额&gt;</code> 来记录您的总资产。
        </p>
      </div>
    );
  }

  const latestValue = data[data.length - 1].close;
  const yesterdayValue = data.length > 1 ? data[data.length - 2].close : 0;
  const totalChange = yesterdayValue > 0 ? latestValue - yesterdayValue : 0;
  const totalChangePercent = yesterdayValue > 0 ? (totalChange / yesterdayValue) * 100 : 0;

  return (
    <div className="max-w-4xl mx-auto animate-fade-in">
      {/* 统计卡片与同步按钮 */}
      <div className="flex flex-col md:flex-row gap-4 mb-4 items-start md:items-center">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 flex-1 w-full">
          <div className="p-3 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">当前资产</p>
            <p className="text-lg font-bold text-gray-800 dark:text-gray-100 font-mono">{formatNumber(latestValue)}</p>
          </div>
          <div className="p-3 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">总变动</p>
            <p className={`text-lg font-bold font-mono ${totalChange >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
              {totalChange >= 0 ? '+' : ''}{formatNumber(totalChange)}
            </p>
          </div>
          <div className="p-3 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">变动率</p>
            <p className={`text-lg font-bold font-mono ${totalChangePercent >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
              {totalChangePercent >= 0 ? '+' : ''}{totalChangePercent.toFixed(2)}%
            </p>
          </div>
          <div className="p-3 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">记录天数</p>
            <p className="text-lg font-bold text-gray-800 dark:text-gray-100 font-mono">{data.length}</p>
          </div>
        </div>
        
        <div className="w-full md:w-auto">
          <button 
            onClick={handleSync}
            disabled={syncing}
            className="w-full md:w-auto px-6 py-4 md:py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md font-medium transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {syncing ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                同步中...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                立即同步
              </>
            )}
          </button>
        </div>
      </div>

      {/* 图表 */}
      <div 
        ref={containerRef}
        className={`rounded-xl shadow-lg overflow-hidden ${isDark ? 'border border-gray-700' : 'border border-gray-200'}`}
        style={{ background: COLORS.bg, height: '420px' }}
      >
        <canvas
          ref={canvasRef}
          style={{ display: 'block', width: '100%', height: '100%', cursor: 'crosshair' }}
        />
      </div>

      {/* 图例 */}
      <div className="flex flex-wrap items-center gap-4 mt-3 px-1 text-xs text-gray-500 dark:text-gray-400">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-full" style={{background: COLORS.up}} />
          上涨
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-full" style={{background: COLORS.down}} />
          下跌
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm" style={{background: COLORS.neutral, opacity: 0.4}} />
          无数据 (延用前日)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-6 border-t-2 border-dashed" style={{borderColor: COLORS.maxLine}} />
          区间最高
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-6 border-t-2 border-dashed" style={{borderColor: COLORS.minLine}} />
          区间最低
        </span>
        <span className="ml-auto">🖱️ 滚轮缩放 · 拖拽平移</span>
      </div>
    </div>
  );
};

function formatNumber(n: number): string {
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (Math.abs(n) >= 1e4) return (n / 1e4).toFixed(2) + 'W';
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  if (w < 0) { x += w; w = -w; }
  if (h < 0) { y += h; h = -h; }
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

export default AssetChart;
