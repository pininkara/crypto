import { useState, useEffect } from 'react';

type CalTarget = 'pnl' | 'leverage' | 'margin';
type MarginUnit = 'usdt' | 'token';

export default function ClosePositionCalculator() {
  const [token, setToken] = useState('BTC');
  const [direction, setDirection] = useState<1 | -1>(1);
  const [openPrice, setOpenPrice] = useState('');
  const [closePrice, setClosePrice] = useState('');
  const [calTarget, setCalTarget] = useState<CalTarget>('pnl');
  const [marginUnit, setMarginUnit] = useState<MarginUnit>('usdt');

  // Input states
  const [pnlInput, setPnlInput] = useState('');
  const [leverageInput, setLeverageInput] = useState('');
  const [marginInput, setMarginInput] = useState('');

  // Result states
  const [resultPnl, setResultPnl] = useState<number | null>(null);
  const [resultLeverage, setResultLeverage] = useState<number | null>(null);
  const [resultMarginUsdt, setResultMarginUsdt] = useState<number | null>(null);
  const [resultMarginToken, setResultMarginToken] = useState<number | null>(null);
  const [resultRoe, setResultRoe] = useState<number | null>(null);

  // Computed display token name
  const displayToken = token.trim().toUpperCase() || '代币';

  useEffect(() => {
    const pOpen = parseFloat(openPrice);
    const pClose = parseFloat(closePrice);
    
    // Clear results if price inputs are invalid
    if (isNaN(pOpen) || isNaN(pClose) || pOpen <= 0 || pClose <= 0) {
      clearResults();
      return;
    }

    let pnl = 0;
    let lev = 0;
    let marginUsdt = 0;
    let valid = false;

    if (calTarget === 'pnl') {
      lev = parseFloat(leverageInput);
      const m = parseFloat(marginInput);
      if (!isNaN(lev) && !isNaN(m) && lev > 0 && m > 0) {
        marginUsdt = marginUnit === 'usdt' ? m : m * pOpen;
        pnl = (marginUsdt * lev / pOpen) * (pClose - pOpen) * direction;
        valid = true;
      }
    } else if (calTarget === 'leverage') {
      pnl = parseFloat(pnlInput);
      const m = parseFloat(marginInput);
      if (!isNaN(pnl) && !isNaN(m) && m > 0 && pClose !== pOpen) {
        marginUsdt = marginUnit === 'usdt' ? m : m * pOpen;
        lev = (pnl * pOpen) / (marginUsdt * (pClose - pOpen) * direction);
        if (lev > 0) valid = true;
      }
    } else if (calTarget === 'margin') {
      pnl = parseFloat(pnlInput);
      lev = parseFloat(leverageInput);
      if (!isNaN(pnl) && !isNaN(lev) && lev > 0 && pClose !== pOpen) {
        marginUsdt = (pnl * pOpen) / (lev * (pClose - pOpen) * direction);
        if (marginUsdt > 0) valid = true;
      }
    }

    if (valid) {
      setResultPnl(pnl);
      setResultLeverage(lev);
      setResultMarginUsdt(marginUsdt);
      setResultMarginToken(marginUsdt / pOpen);
      setResultRoe((pnl / marginUsdt) * 100);
    } else {
      clearResults();
    }
  }, [openPrice, closePrice, calTarget, marginUnit, pnlInput, leverageInput, marginInput, direction]);

  const clearResults = () => {
    setResultPnl(null);
    setResultLeverage(null);
    setResultMarginUsdt(null);
    setResultMarginToken(null);
    setResultRoe(null);
  };

  const formatNumber = (num: number, decimals: number = 2) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(num);
  };

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-800 transition-colors animate-fade-in relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-400 to-rose-500"></div>
      
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100 dark:border-gray-700">
        <div>
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">平仓计算器</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">U本位线性合约计算 (正向合约)</p>
        </div>
        <div className="p-2 bg-teal-50 dark:bg-teal-900/30 rounded-lg">
          <svg className="w-6 h-6 text-teal-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        {/* Left Column: Inputs */}
        <div className="md:col-span-7 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">代币</label>
              <input
                type="text"
                value={token}
                onChange={(e) => setToken(e.target.value.toUpperCase())}
                placeholder="例如: BTC"
                className="w-full p-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-shadow transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">方向</label>
              <div className="flex rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600">
                <button
                  type="button"
                  onClick={() => setDirection(1)}
                  className={`flex-1 py-2.5 text-sm font-medium transition-colors ${direction === 1 ? 'bg-green-500 text-white' : 'bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'}`}
                >
                  做多 (Long)
                </button>
                <button
                  type="button"
                  onClick={() => setDirection(-1)}
                  className={`flex-1 py-2.5 text-sm font-medium transition-colors ${direction === -1 ? 'bg-red-500 text-white' : 'bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'}`}
                >
                  做空 (Short)
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">开仓价 (USDT)</label>
              <input
                type="number"
                value={openPrice}
                onChange={(e) => setOpenPrice(e.target.value)}
                min="0"
                step="any"
                className="w-full p-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-shadow transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">平仓价 (USDT)</label>
              <input
                type="number"
                value={closePrice}
                onChange={(e) => setClosePrice(e.target.value)}
                min="0"
                step="any"
                className="w-full p-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-shadow transition-colors"
              />
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
            <div className="mb-4">
              <label className="block text-sm font-bold text-gray-800 dark:text-gray-200 mb-2">选择要计算的项 (三选一)</label>
              <div className="grid grid-cols-3 gap-2">
                {(['pnl', 'leverage', 'margin'] as CalTarget[]).map((target) => (
                  <button
                    key={target}
                    onClick={() => setCalTarget(target)}
                    className={`py-2 px-3 text-sm font-medium rounded-md transition-colors ${calTarget === target ? 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200 border border-teal-300 dark:border-teal-700 shadow-sm' : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                  >
                    {target === 'pnl' ? '平仓盈亏' : target === 'leverage' ? '杠杆倍数' : '初始保证金'}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              {calTarget !== 'pnl' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">平仓盈亏 (USDT)</label>
                  <input
                    type="number"
                    value={pnlInput}
                    onChange={(e) => setPnlInput(e.target.value)}
                    step="any"
                    placeholder="输入盈亏金额"
                    className="w-full p-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  />
                </div>
              )}
              
              {calTarget !== 'leverage' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">杠杆倍数</label>
                  <input
                    type="number"
                    value={leverageInput}
                    onChange={(e) => setLeverageInput(e.target.value)}
                    min="1"
                    step="1"
                    placeholder="例如: 10"
                    className="w-full p-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  />
                </div>
              )}

              {calTarget !== 'margin' && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      初始保证金
                    </label>
                    <div className="flex items-center space-x-2 text-xs">
                      <span className="text-gray-500 dark:text-gray-400">单位:</span>
                      <button
                        type="button"
                        onClick={() => setMarginUnit('usdt')}
                        className={`px-2 py-0.5 rounded ${marginUnit === 'usdt' ? 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                      >
                        USDT
                      </button>
                      <button
                        type="button"
                        onClick={() => setMarginUnit('token')}
                        className={`px-2 py-0.5 rounded ${marginUnit === 'token' ? 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                      >
                        {displayToken}
                      </button>
                    </div>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      value={marginInput}
                      onChange={(e) => setMarginInput(e.target.value)}
                      min="0"
                      step="any"
                      placeholder={`输入保证金数量`}
                      className="w-full p-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 pr-16"
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                      <span className="text-gray-500 dark:text-gray-400 sm:text-sm">
                        {marginUnit === 'usdt' ? 'USDT' : displayToken}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Results */}
        <div className="md:col-span-5">
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800/80 dark:to-gray-900 p-6 rounded-2xl h-full border border-gray-200 dark:border-gray-700 shadow-inner flex flex-col">
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-6 flex items-center">
              <svg className="w-5 h-5 mr-2 text-teal-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              计算结果
            </h3>

            <div className="space-y-6 flex-1">
              <div className="relative">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">平仓盈亏 (PnL)</p>
                <div className={`text-2xl font-bold ${resultPnl === null ? 'text-gray-400 dark:text-gray-600' : (resultPnl > 0 ? 'text-green-600 dark:text-green-400' : resultPnl < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-800 dark:text-gray-200')}`}>
                  {resultPnl !== null ? `${resultPnl > 0 ? '+' : ''}${formatNumber(resultPnl, 4)} USDT` : '--'}
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">收益率 (ROE)</p>
                <div className={`text-xl font-bold ${resultRoe === null ? 'text-gray-400 dark:text-gray-600' : (resultRoe > 0 ? 'text-green-600 dark:text-green-400' : resultRoe < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-800 dark:text-gray-200')}`}>
                  {resultRoe !== null ? `${resultRoe > 0 ? '+' : ''}${formatNumber(resultRoe, 2)}%` : '--'}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">杠杆倍数</p>
                  <div className="text-lg font-bold text-gray-800 dark:text-gray-200">
                    {resultLeverage !== null ? `${formatNumber(resultLeverage, 2)}x` : '--'}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">初始保证金</p>
                  <div className="text-lg font-bold text-gray-800 dark:text-gray-200">
                    {resultMarginUsdt !== null ? `${formatNumber(resultMarginUsdt, 4)} USDT` : '--'}
                  </div>
                  {resultMarginToken !== null && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1" title="折合代币">
                      ≈ {formatNumber(resultMarginToken, 6)} {displayToken}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {resultPnl === null && (
              <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 rounded-lg text-sm flex items-start border border-blue-100 dark:border-blue-800/50">
                <svg className="w-5 h-5 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p>请在左侧输入完整且合理的参数。参数不合法或有缺失时不会显示结果。</p>
              </div>
            )}
            
            {resultPnl !== null && calTarget === 'leverage' && resultLeverage !== null && resultLeverage <= 0 && (
              <div className="mt-6 p-4 bg-orange-50 dark:bg-orange-900/20 text-orange-800 dark:text-orange-300 rounded-lg text-sm flex items-start border border-orange-100 dark:border-orange-800/50">
                 <svg className="w-5 h-5 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p>计算出的杠杆倍数异常，请检查输入的盈亏是否能与持仓方向及价格匹配。</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
