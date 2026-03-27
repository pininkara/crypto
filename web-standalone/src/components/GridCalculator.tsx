import React, { useState } from 'react';

const GridCalculator: React.FC = () => {
    const [symbol, setSymbol] = useState<string>('BTC');
    const [quoteCurrency, setQuoteCurrency] = useState<'USDT' | 'USDC'>('USDT');
    const [lowerBound, setLowerBound] = useState<number | ''>('');
    const [upperBound, setUpperBound] = useState<number | ''>('');
    const [gridCount, setGridCount] = useState<number | ''>('');
    const [gridType, setGridType] = useState<'arithmetic' | 'geometric'>('arithmetic');
    const [gridCategory, setGridCategory] = useState<'spot' | 'neutral' | 'long' | 'short'>('spot');
    const [investment, setInvestment] = useState<number | ''>('');
    const [leverage, setLeverage] = useState<number | ''>(1);
    
    const [profitPerGridInput, setProfitPerGridInput] = useState<string>('');
    const [simulationResult, setSimulationResult] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string>('');

    const handleSimulate = async () => {
        setLoading(true);
        setErrorMsg('');
        
        // 提取用户手动输入的预期利润率
        let finalProfit = 0;
        if (profitPerGridInput) {
            if (profitPerGridInput.includes('-')) {
                const parts = profitPerGridInput.split('-');
                const p1 = parseFloat(parts[0]);
                const p2 = parseFloat(parts[1]);
                if (isNaN(p1) || isNaN(p2)) {
                    setErrorMsg('自定义利润区间格式错误，请输入正常数字，如 "0.5-0.8"');
                    setLoading(false);
                    return;
                }
                finalProfit = (p1 + p2) / 2;
            } else {
                const p = parseFloat(profitPerGridInput);
                if (isNaN(p)) {
                    setErrorMsg('自定义利润格式错误，请填入正常数字');
                    setLoading(false);
                    return;
                }
                finalProfit = p;
            }
        }
        
        const finalLeverage = gridCategory === 'spot' ? 1 : Number(leverage) || 1;

        // 自动合并基础代币与计价代币
        let finalSymbol = symbol.toUpperCase().trim();
        if (!finalSymbol.endsWith('USDT') && !finalSymbol.endsWith('USDC') && !finalSymbol.endsWith('FDUSD')) {
            finalSymbol += quoteCurrency;
        }

        try {
            const lowerBoundNum = Number(lowerBound);
            const upperBoundNum = Number(upperBound);
            const gridCountNum = Number(gridCount);

            if (!lowerBoundNum || !upperBoundNum || !gridCountNum || upperBoundNum <= lowerBoundNum) {
                throw new Error("网格参数验证错误，上限必须大于下限");
            }

            let gridLines: number[] = [];
            if (gridType === 'arithmetic') {
                const step = (upperBoundNum - lowerBoundNum) / gridCountNum;
                for (let i = 0; i <= gridCountNum; i++) {
                    gridLines.push(lowerBoundNum + i * step);
                }
            } else {
                const ratio = Math.pow(upperBoundNum / lowerBoundNum, 1.0 / gridCountNum);
                let val = lowerBoundNum;
                for (let i = 0; i <= gridCountNum; i++) {
                    gridLines.push(val);
                    val *= ratio;
                }
            }

            let profitPerQuote = finalProfit;
            if (profitPerQuote <= 0) {
                if (gridType === 'arithmetic') {
                    const step = (upperBoundNum - lowerBoundNum) / gridCountNum;
                    profitPerQuote = step / ((upperBoundNum + lowerBoundNum) / 2);
                } else {
                    profitPerQuote = Math.pow(upperBoundNum / lowerBoundNum, 1.0 / gridCountNum) - 1;
                }
            } else {
                profitPerQuote = profitPerQuote / 100.0;
            }

            const fetchKlines = async (interval: string, limit: number) => {
                const url = `https://fapi.binance.com/fapi/v1/klines?symbol=${finalSymbol}&interval=${interval}&limit=${limit}`;
                const response = await fetch(url);
                if (!response.ok) throw new Error(`无法获取K线数据，可能交易对不正确: ${finalSymbol}`);
                return await response.json();
            };

            const [klines5m, klines15m, klines1h] = await Promise.all([
                fetchKlines('5m', 288),
                fetchKlines('15m', 672),
                fetchKlines('1h', 720)
            ]);

            const runSimulation = (klines: any[]) => {
                let crossCount = 0;
                let escapeCount = 0;
                const totalKlines = klines.length;

                for (let k of klines) {
                    const high = parseFloat(k[2]);
                    const low = parseFloat(k[3]);
                    if (high > upperBoundNum || low < lowerBoundNum) {
                        escapeCount++;
                    }
                    for (let i = 0; i < gridLines.length - 1; i++) {
                        const lineHigh = gridLines[i + 1];
                        const lineLow = gridLines[i];
                        if (low <= lineLow && high >= lineHigh) {
                            crossCount++;
                        }
                    }
                }

                const hits = Math.floor(crossCount / 2);
                const escapeRate = totalKlines > 0 ? (escapeCount / totalKlines) * 100.0 : 0;
                return { hits, escapeRate };
            };

            const daily = runSimulation(klines5m);
            const weekly = runSimulation(klines15m);
            const monthly = runSimulation(klines1h);

            const orderSize = (Number(investment) / gridCountNum) * finalLeverage;
            const dailyProfit = daily.hits * orderSize * profitPerQuote;
            const weeklyProfit = weekly.hits * orderSize * profitPerQuote;
            const monthlyProfit = monthly.hits * orderSize * profitPerQuote;

            setSimulationResult({
                daily: Number(dailyProfit.toFixed(2)),
                weekly: Number(weeklyProfit.toFixed(2)),
                monthly: Number(monthlyProfit.toFixed(2)),
                hits_daily: daily.hits,
                hits_weekly: weekly.hits,
                hits_monthly: monthly.hits,
                escape_daily: Number(daily.escapeRate.toFixed(2)),
                escape_weekly: Number(weekly.escapeRate.toFixed(2)),
                escape_monthly: Number(monthly.escapeRate.toFixed(2)),
            });
        } catch (e: any) {
            setErrorMsg(e.message || '请求异常，无法连接到源数据服务。');
        } finally {
            setTimeout(() => setLoading(false), 500);
        }
    };

    return (
        <div className="max-w-4xl mx-auto p-4 md:p-8 bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-100 dark:border-gray-800 transition-colors">
            <h2 className="text-2xl font-bold mb-6 text-gray-800 dark:text-gray-100">加密网格策略计算器</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">交易对</label>
                    <input 
                        type="text" 
                        value={symbol} 
                        onChange={(e) => setSymbol(e.target.value.toUpperCase())} 
                        className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
                        placeholder="例如: BTC"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">计价币种</label>
                    <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1 w-full h-[42px]">
                        <button
                            onClick={() => setQuoteCurrency('USDT')}
                            className={`flex-1 text-sm font-bold rounded-md transition-colors ${quoteCurrency === 'USDT' ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'}`}
                        >
                            USDT
                        </button>
                        <button
                            onClick={() => setQuoteCurrency('USDC')}
                            className={`flex-1 text-sm font-bold rounded-md transition-colors ${quoteCurrency === 'USDC' ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'}`}
                        >
                            USDC
                        </button>
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">网格下限</label>
                    <input 
                        type="number" 
                        value={lowerBound} 
                        onChange={(e) => setLowerBound(e.target.value === '' ? '' : Number(e.target.value))} 
                        className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
                        placeholder="例如: 1800"
                    />
                </div>
                
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">网格上限</label>
                    <input 
                        type="number" 
                        value={upperBound} 
                        onChange={(e) => setUpperBound(e.target.value === '' ? '' : Number(e.target.value))} 
                        className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
                        placeholder="例如: 3500"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">网格数量</label>
                    <input 
                        type="number" 
                        value={gridCount} 
                        onChange={(e) => setGridCount(e.target.value === '' ? '' : Number(e.target.value))} 
                        min="2"
                        className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
                        placeholder="例如: 50"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">网格类型</label>
                    <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1 w-full h-[42px]">
                        <button
                            onClick={() => setGridType('arithmetic')}
                            className={`flex-1 text-sm font-bold rounded-md transition-colors ${gridType === 'arithmetic' ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'}`}
                        >
                            等差网格
                        </button>
                        <button
                            onClick={() => setGridType('geometric')}
                            className={`flex-1 text-sm font-bold rounded-md transition-colors ${gridType === 'geometric' ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'}`}
                        >
                            等比网格
                        </button>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">网格分类方向</label>
                    <select 
                        value={gridCategory}
                        onChange={(e) => {
                            const val = e.target.value as any;
                            setGridCategory(val);
                            if (val === 'spot') setLeverage(1);
                        }}
                        className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
                    >
                        <option value="spot">现货网格</option>
                        <option value="neutral">合约网格（中性）</option>
                        <option value="long">合约网格（做多）</option>
                        <option value="short">合约网格（做空）</option>
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">自定义单格利润 (%)</label>
                    <input 
                        type="text" 
                        value={profitPerGridInput} 
                        onChange={(e) => setProfitPerGridInput(e.target.value)} 
                        className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
                        placeholder={gridType === 'arithmetic' ? "例如: 0.5 - 0.8" : "例如: 0.5"}
                    />
                </div>

                <div className="pt-4 border-t border-gray-200 dark:border-gray-800 col-span-1 md:col-span-2">
                    <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-200">模拟参数</h3>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">投资额 (USDT)</label>
                    <input 
                        type="number" 
                        value={investment} 
                        onChange={(e) => setInvestment(e.target.value === '' ? '' : Number(e.target.value))} 
                        className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
                        placeholder="例如: 1000"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">杠杆倍数 {gridCategory === 'spot' && <span className="text-xs text-orange-500">(现货仅限 1 倍)</span>}</label>
                    <input 
                        type="number" 
                        value={leverage} 
                        onChange={(e) => setLeverage(e.target.value === '' ? '' : Number(e.target.value))} 
                        min="1"
                        max="125"
                        disabled={gridCategory === 'spot'}
                        className={`w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none transition-colors ${gridCategory === 'spot' ? 'opacity-50 cursor-not-allowed' : ''}`}
                        placeholder="例如: 1"
                    />
                </div>
            </div>

            <button 
                onClick={handleSimulate}
                disabled={loading || !symbol || !investment || !gridCount || !lowerBound || !upperBound || !profitPerGridInput}
                className={`mt-8 w-full py-3 rounded-lg font-bold text-white transition-all shadow-md ${(!symbol || !investment || !gridCount || !lowerBound || !upperBound || !profitPerGridInput) ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 hover:shadow-lg active:scale-[0.98]'}`}
            >
                {loading ? '回测计算中...' : '开始模拟计算'}
            </button>

            {errorMsg && (
                <div className="mt-8 p-4 bg-red-50 dark:bg-red-900/30 rounded-xl border border-red-200 dark:border-red-800 flex items-start space-x-3 text-red-600 dark:text-red-400 animate-fade-in shadow-sm">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span className="font-medium mt-0.5">{errorMsg}</span>
                </div>
            )}

            {simulationResult && !errorMsg && (
                <div className="mt-8 p-6 bg-blue-50 dark:bg-blue-900/30 rounded-xl border border-blue-100 dark:border-blue-800 animate-fade-in">
                    <div className="flex flex-col md:flex-row md:items-center space-y-2 md:space-y-0 md:space-x-4 mb-6">
                        <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-200">预估回测收益</h3>
                        {investment && gridCount && profitPerGridInput && (
                            <div className="bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-300 px-3 py-1 rounded-md text-sm font-medium border border-blue-200 dark:border-blue-700 shadow-sm">
                                单格利润: {" "}
                                {(() => {
                                    const lev = gridCategory === 'spot' ? 1 : (leverage || 1);
                                    if (profitPerGridInput.includes('-')) {
                                        const p = profitPerGridInput.split('-');
                                        const minP = parseFloat(p[0]) || 0;
                                        const maxP = parseFloat(p[1]) || 0;
                                        const minV = (investment * lev / Number(gridCount)) * (minP / 100);
                                        const maxV = (investment * lev / Number(gridCount)) * (maxP / 100);
                                        return `${minV.toFixed(2)} - ${maxV.toFixed(2)} (${profitPerGridInput.includes('%') ? profitPerGridInput : profitPerGridInput + '%'})`;
                                    } else {
                                        const pct = parseFloat(profitPerGridInput) || 0;
                                        const val = (investment * lev / Number(gridCount)) * (pct / 100);
                                        return `${val.toFixed(2)} (${profitPerGridInput.includes('%') ? profitPerGridInput : profitPerGridInput + '%'})`;
                                    }
                                })()}
                            </div>
                        )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="p-4 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-lg text-center shadow flex flex-col justify-center">
                            <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">每日利润</div>
                            <div className="flex items-baseline justify-center space-x-2">
                                <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">${simulationResult.daily}</span>
                                <span className="text-sm font-medium text-blue-500 dark:text-blue-400">({investment ? ((simulationResult.daily / Number(investment)) * 100).toFixed(2) : 0}%)</span>
                            </div>
                            <div className="text-xs text-blue-500 dark:text-blue-400 mt-2">每日配对: {simulationResult.hits_daily}次</div>
                            <div className={`text-xs mt-1 font-bold ${simulationResult.escape_daily < 15 ? 'text-green-500' : simulationResult.escape_daily < 35 ? 'text-yellow-500' : 'text-red-500'}`}>
                                逃逸率: {simulationResult.escape_daily}%
                            </div>
                        </div>
                        <div className="p-4 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-lg text-center shadow flex flex-col justify-center">
                            <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">每周利润</div>
                            <div className="flex items-baseline justify-center space-x-2">
                                <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">${simulationResult.weekly}</span>
                                <span className="text-sm font-medium text-blue-500 dark:text-blue-400">({investment ? ((simulationResult.weekly / Number(investment)) * 100).toFixed(2) : 0}%)</span>
                            </div>
                            <div className="text-xs text-blue-500 dark:text-blue-400 mt-2">每周配对: {simulationResult.hits_weekly}次</div>
                            <div className={`text-xs mt-1 font-bold ${simulationResult.escape_weekly < 15 ? 'text-green-500' : simulationResult.escape_weekly < 35 ? 'text-yellow-500' : 'text-red-500'}`}>
                                逃逸率: {simulationResult.escape_weekly}%
                            </div>
                        </div>
                        <div className="p-4 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-lg text-center shadow flex flex-col justify-center">
                            <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">每月利润</div>
                            <div className="flex items-baseline justify-center space-x-2">
                                <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">${simulationResult.monthly}</span>
                                <span className="text-sm font-medium text-blue-500 dark:text-blue-400">({investment ? ((simulationResult.monthly / Number(investment)) * 100).toFixed(2) : 0}%)</span>
                            </div>
                            <div className="text-xs text-blue-500 dark:text-blue-400 mt-2">每月配对: {simulationResult.hits_monthly}次</div>
                            <div className={`text-xs mt-1 font-bold ${simulationResult.escape_monthly < 15 ? 'text-green-500' : simulationResult.escape_monthly < 35 ? 'text-yellow-500' : 'text-red-500'}`}>
                                逃逸率: {simulationResult.escape_monthly}%
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GridCalculator;
