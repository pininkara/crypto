package handler

import (
	"math"
	"net/http"
	"sort"
	"strconv"
	"sync"
	"time"

	"crypto/internal/config"
	"crypto/internal/model"
	"crypto/internal/repository"
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

// AssetDayData 表示某天的资产数据
type AssetDayData struct {
	Date   string    `json:"date"`
	Values []float64 `json:"values"`
}

// HandleGetAssets 返回按日期聚合的总资产数据
func HandleGetAssets(c *gin.Context) {
	var records []model.AssetRecord
	if err := repository.DB.Order("created_at ASC").Find(&records).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve asset records"})
		return
	}

	if len(records) == 0 {
		c.JSON(http.StatusOK, []AssetDayData{})
		return
	}

	// 按日期分组
	dayMap := make(map[string][]float64)
	for _, r := range records {
		dateStr := r.CreatedAt.Format("2006-01-02")
		dayMap[dateStr] = append(dayMap[dateStr], r.Amount)
	}

	// 提取所有日期并排序
	var dates []string
	for d := range dayMap {
		dates = append(dates, d)
	}
	sort.Strings(dates)

	// 填充无数据的日期（复制前一天的值）
	startDate, _ := time.Parse("2006-01-02", dates[0])
	endDate, _ := time.Parse("2006-01-02", dates[len(dates)-1])

	var result []AssetDayData
	var lastValues []float64

	for d := startDate; !d.After(endDate); d = d.AddDate(0, 0, 1) {
		dateStr := d.Format("2006-01-02")
		if vals, ok := dayMap[dateStr]; ok {
			lastValues = vals
			result = append(result, AssetDayData{Date: dateStr, Values: vals})
		} else if lastValues != nil {
			// 无数据日期，复制前一天最后一个值
			lastVal := lastValues[len(lastValues)-1]
			result = append(result, AssetDayData{Date: dateStr, Values: []float64{lastVal}})
		}
	}

	c.JSON(http.StatusOK, result)
}

// HandleSyncAssets 立即调用 Binance API 获取当前资产并记录到数据库
func HandleSyncAssets(c *gin.Context) {
	// 获取配置的 ChatID
	chatID := config.Cfg.AssetTracker.ChatID
	if chatID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请在配置文件中设置 asset_tracker.chat_id 后再使用同步功能。"})
		return
	}

	balance, err := binance.GetTotalAccountBalance()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "获取 Binance 资产失败: " + err.Error()})
		return
	}

	// 保留两位小数
	balance = math.Round(balance*100) / 100

	record := model.AssetRecord{
		ChatID: chatID,
		Amount: balance,
	}

	if err := repository.DB.Create(&record).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "保存资产记录到数据库失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "同步成功", "balance": balance})
}
