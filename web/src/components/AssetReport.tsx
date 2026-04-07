import { useState, useEffect } from 'react';

interface AssetRecord {
  id: number;
  amount: number;
  created_at: string;
  is_daily_high: boolean;
  is_daily_low: boolean;
}

interface PaginatedResponse {
  total: number;
  page: number;
  limit: number;
  data: AssetRecord[];
}

interface AssetReportProps {
  isDark: boolean;
}

export function AssetReport({ isDark }: AssetReportProps) {
  const [data, setData] = useState<AssetRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const limit = 20;

  const fetchData = async (p: number, start: string, end: string) => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        page: p.toString(),
        limit: limit.toString(),
      });
      if (start) query.append('start_date', start);
      if (end) query.append('end_date', end);

      const res = await fetch(`/api/asset-records?${query.toString()}`);
      if (res.ok) {
        const json: PaginatedResponse = await res.json();
        setData(json.data || []);
        setTotal(json.total);
      }
    } catch (err) {
      console.error("Failed to fetch asset records", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(page, startDate, endDate);
  }, [page]);

  const handleSearch = () => {
    setPage(1);
    fetchData(1, startDate, endDate);
  };

  const handleReset = () => {
    setStartDate('');
    setEndDate('');
    setPage(1);
    fetchData(1, '', '');
  };

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div className={`max-w-5xl mx-auto mt-8 p-6 rounded-2xl shadow-xl border backdrop-blur-xl transition-colors duration-300 ${
      isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white/80 border-slate-200'
    }`}>
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
        <h3 className={`text-xl font-bold flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>
          <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          快照历史底表
        </h3>

        <div className="flex flex-wrap items-center gap-3">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className={`px-3 py-2 rounded-lg text-sm border outline-none transition-colors duration-200 focus:ring-2 focus:ring-indigo-500 ${
              isDark ? 'bg-slate-800 border-slate-700 text-slate-200 placeholder-slate-500' : 'bg-slate-50 border-slate-200 text-slate-700'
            }`}
          />
          <span className={isDark ? 'text-slate-500' : 'text-slate-400'}>至</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className={`px-3 py-2 rounded-lg text-sm border outline-none transition-colors duration-200 focus:ring-2 focus:ring-indigo-500 ${
              isDark ? 'bg-slate-800 border-slate-700 text-slate-200 placeholder-slate-500' : 'bg-slate-50 border-slate-200 text-slate-700'
            }`}
          />
          <button
            onClick={handleSearch}
            className={`p-2 rounded-lg transition-colors duration-200 flex items-center justify-center shadow-sm ${
              isDark ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-indigo-500 hover:bg-indigo-600 text-white'
            }`}
            title="搜索"
          >
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          </button>
          <button
            onClick={handleReset}
            className={`p-2 rounded-lg transition-colors duration-200 flex items-center justify-center ${
              isDark ? 'bg-slate-700 hover:bg-slate-600 text-slate-300' : 'bg-slate-200 hover:bg-slate-300 text-slate-600'
            }`}
            title="重置"
          >
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg>
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
        <table className={`w-full text-left text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
          <thead className={`text-xs uppercase ${
            isDark ? 'bg-slate-800/80 text-slate-400' : 'bg-slate-100 text-slate-500'
          }`}>
            <tr>
              <th className="px-6 py-4 font-semibold tracking-wider">时间</th>
              <th className="px-6 py-4 font-semibold tracking-wider text-right">总资产净值 (USDT)</th>
              <th className="px-6 py-4 font-semibold tracking-wider text-center">日内状态</th>
            </tr>
          </thead>
          <tbody className={`divide-y transition-colors duration-300 ${isDark ? 'divide-slate-800/50' : 'divide-slate-200'}`}>
            {loading ? (
              <tr>
                <td colSpan={3} className="px-6 py-12 text-center text-slate-500">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                    加载中...
                  </div>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-6 py-12 text-center text-slate-500">
                  没有找到匹配的记录
                </td>
              </tr>
            ) : (
              data.map((record) => {
                const dateObj = new Date(record.created_at);
                const formatTime = dateObj.toLocaleString('zh-CN', { 
                  year: 'numeric', month: '2-digit', day: '2-digit', 
                  hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'Asia/Shanghai' 
                }).replace(/\//g, '-');
                
                let highlightClass = '';
                let statusBadge = null;
                
                if (record.is_daily_high) {
                  highlightClass = isDark ? 'bg-emerald-500/10' : 'bg-emerald-500/10';
                  statusBadge = <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-500/20">日高</span>;
                } else if (record.is_daily_low) {
                  highlightClass = isDark ? 'bg-rose-500/10' : 'bg-rose-500/10';
                  statusBadge = <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium text-rose-600 dark:text-rose-400 bg-rose-100 dark:bg-rose-500/20">日低</span>;
                }

                return (
                  <tr key={record.id} className={`${highlightClass} hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors`}>
                    <td className="px-6 py-3 whitespace-nowrap tabular-nums font-mono text-sm">
                      {formatTime}
                    </td>
                    <td className={`px-6 py-3 whitespace-nowrap text-right font-medium tabular-nums ${record.is_daily_high ? 'text-emerald-600 dark:text-emerald-400' : record.is_daily_low ? 'text-rose-600 dark:text-rose-400' : ''}`}>
                      ${record.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap text-center">
                      {statusBadge || <span className="text-slate-400 dark:text-slate-600">-</span>}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mt-6">
        <div className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          共 <span className="font-semibold text-indigo-500">{total}</span> 条记录
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1 || loading}
            className={`p-1.5 rounded-lg border transition-colors ${
              page === 1 || loading
                ? (isDark ? 'border-slate-800 text-slate-600 cursor-not-allowed hidden md:block' : 'border-slate-200 text-slate-400 cursor-not-allowed hidden md:block')
                : (isDark ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-300 text-slate-700 hover:bg-slate-50')
            }`}
          >
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"></polyline></svg>
          </button>
          <span className={`text-sm tabular-nums px-3 py-1 rounded-md ${isDark ? 'bg-slate-800/50 text-slate-300' : 'bg-slate-100 text-slate-700'}`}>
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages || loading || total === 0}
            className={`p-1.5 rounded-lg border transition-colors ${
              (page === totalPages || loading || total === 0)
                ? (isDark ? 'border-slate-800 text-slate-600 cursor-not-allowed hidden md:block' : 'border-slate-200 text-slate-400 cursor-not-allowed hidden md:block')
                : (isDark ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-300 text-slate-700 hover:bg-slate-50')
            }`}
          >
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </button>
        </div>
      </div>
    </div>
  );
}
