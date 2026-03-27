package handler

import (
	"math"
	"net/http"
	"strconv"
	"sync"

	"crypto/pkg/binance"

	"github.com/adshao/go-binance/v2/futures"
	"github.com/gin-gonic/gin"
)

type SimulateRequest struct {
	Symbol        string  `json:"symbol"`
	LowerBound    float64 `json:"lowerBound"`
	UpperBound    float64 `json:"upperBound"`
	GridCount     int     `json:"gridCount"`
	GridType      string  `json:"gridType"`
	GridCategory  string  `json:"gridCategory"`
	Investment    float64 `json:"investment"`
	Leverage      float64 `json:"leverage"`
	ProfitPerGrid float64 `json:"profitPerGrid"`
}

// HandleSimulateGrid 计算网格模拟利润
// 用一种简化的算法测算收益率：获取过去30天的1小时K线，统计价格穿越网格线的次数，作为套利次数。
func HandleSimulateGrid(c *gin.Context) {
	var req SimulateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request format"})
		return
	}

	if req.Symbol == "" {
		req.Symbol = "BTCUSDT"
	}
	if req.GridCount <= 0 || req.LowerBound <= 0 || req.UpperBound <= req.LowerBound {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid grid parameters"})
		return
	}

	// 并发拉取 3 个不同周期的 K 线：每日(5分钟), 每周(15分钟), 每月(1小时)
	var wg sync.WaitGroup
	var klines5m, klines15m, klines1h []*futures.Kline
	var err5m, err15m, err1h error

	wg.Add(3)
	go func() { defer wg.Done(); klines5m, err5m = binance.GetKlines(req.Symbol, "5m", 288) }()     // 288 * 5m = 24h
	go func() { defer wg.Done(); klines15m, err15m = binance.GetKlines(req.Symbol, "15m", 672) }()   // 672 * 15m = 7 days
	go func() { defer wg.Done(); klines1h, err1h = binance.GetKlines(req.Symbol, "1h", 720) }()      // 720 * 1h = 30 days
	wg.Wait()

	if err1h != nil || err15m != nil || err5m != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "未能找到全面的历史数据。请检查【交易对】名字是否有效并已上线币安合约市场。"})
		return
	}

	// 初始化网格价格线
	var gridLines []float64
	if req.GridType == "arithmetic" {
		step := (req.UpperBound - req.LowerBound) / float64(req.GridCount)
		for i := 0; i <= req.GridCount; i++ {
			gridLines = append(gridLines, req.LowerBound+float64(i)*step)
		}
	} else {
		// geometric
		ratio := math.Pow(req.UpperBound/req.LowerBound, 1.0/float64(req.GridCount))
		val := req.LowerBound
		for i := 0; i <= req.GridCount; i++ {
			gridLines = append(gridLines, val)
			val *= ratio
		}
	}

	// 统计穿越次数（一买一卖计1次完整套利，即穿过网格间距）
	var profitPerQuote float64

	// 若前端传递了手动配置的平均利润率则采用，否则保守预估
	if req.ProfitPerGrid > 0 {
		profitPerQuote = req.ProfitPerGrid / 100.0
	} else {
		// 简单每格利润（按比例）用于简易估算
		if req.GridType == "arithmetic" {
			step := (req.UpperBound - req.LowerBound) / float64(req.GridCount)
			profitPerQuote = step / ((req.UpperBound + req.LowerBound) / 2) // 平均利润率
		} else {
			profitPerQuote = math.Pow(req.UpperBound/req.LowerBound, 1.0/float64(req.GridCount)) - 1
		}
	}

	// 帮助类闭包，独立测算一个给定 K 线数组的回测记录
	runSimulation := func(klines []*futures.Kline) (int, float64) {
		var crossCount int
		var escapeCount int
		tKlines := len(klines)

		for _, kStr := range klines {
			high, _ := strconv.ParseFloat(kStr.High, 64)
			low, _ := strconv.ParseFloat(kStr.Low, 64)

			if high > req.UpperBound || low < req.LowerBound {
				escapeCount++
			}

			for i := 0; i < len(gridLines)-1; i++ {
				lineHigh := gridLines[i+1]
				lineLow := gridLines[i]
				if low <= lineLow && high >= lineHigh {
					crossCount++
				}
			}
		}

		hits := crossCount / 2
		escapeRate := 0.0
		if tKlines > 0 {
			escapeRate = float64(escapeCount) / float64(tKlines) * 100.0
		}
		return hits, escapeRate
	}

	hitsDaily, escapeRateDaily := runSimulation(klines5m)
	hitsWeekly, escapeRateWeekly := runSimulation(klines15m)
	hitsMonthly, escapeRateMonthly := runSimulation(klines1h)

	// 每单交易额度
	orderSize := (req.Investment / float64(req.GridCount)) * req.Leverage

	// 计算按真实周期配对的利润
	dailyProfit := float64(hitsDaily) * orderSize * profitPerQuote
	weeklyProfit := float64(hitsWeekly) * orderSize * profitPerQuote
	monthlyProfit := float64(hitsMonthly) * orderSize * profitPerQuote

	c.JSON(http.StatusOK, gin.H{
		"daily":         math.Round(dailyProfit*100) / 100,
		"weekly":        math.Round(weeklyProfit*100) / 100,
		"monthly":       math.Round(monthlyProfit*100) / 100,
		"hits_daily":    hitsDaily,
		"hits_weekly":   hitsWeekly,
		"hits_monthly":  hitsMonthly,
		"escape_daily":  math.Round(escapeRateDaily*100) / 100,
		"escape_weekly": math.Round(escapeRateWeekly*100) / 100,
		"escape_monthly":math.Round(escapeRateMonthly*100) / 100,
	})
}
