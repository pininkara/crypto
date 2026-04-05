package handler

import (
	"crypto/internal/config"
	"crypto/internal/model"
	"crypto/internal/repository"
	"crypto/pkg/binance"
	"fmt"
	"strconv"
	"strings"
	"time"

	"gopkg.in/telebot.v3"
)

// InitBot 实例并注册路由
func InitBot() (*telebot.Bot, error) {
	pref := telebot.Settings{
		Token:  config.Cfg.Telegram.Token,
		Poller: &telebot.LongPoller{Timeout: 10 * time.Second},
	}

	b, err := telebot.NewBot(pref)
	if err != nil {
		return nil, err
	}

	// 权限控制中间件：限制部分用户存取
	b.Use(func(next telebot.HandlerFunc) telebot.HandlerFunc {
		return func(c telebot.Context) error {
			allowed := config.Cfg.Telegram.AllowedUsers
			if len(allowed) > 0 {
				isAllowed := false
				for _, uid := range allowed {
					if c.Sender() != nil && c.Sender().ID == uid {
						isAllowed = true
						break
					}
				}
				if !isAllowed {
					return c.Send("⛔ 权限不足：您未被允许使用此机器人。")
				}
			}
			return next(c)
		}
	})

	b.Handle("/start", handleHelp)
	b.Handle("/help", handleHelp)
	b.Handle("/add", handleAddAlert)
	b.Handle("/list", handleListAlerts)
	b.Handle("/delete", handleDeleteAlert)
	b.Handle("/deleall", handleDeleteAllAlerts)
	b.Handle("/assets", handleRecordAssets)

	return b, nil
}

func handleAddAlert(c telebot.Context) error {
	args := c.Args()
	if len(args) != 2 {
		return c.Send("Usage: /add <symbol> <target_price>\nExample: /add ETHUSDT 3000")
	}

	symbol := strings.ToUpper(args[0])
	
	// 自动补全 USDT (优先排除结尾已经是稳定币的情况)
	if !strings.HasSuffix(symbol, "USDT") && !strings.HasSuffix(symbol, "USDC") && !strings.HasSuffix(symbol, "FDUSD") {
		// 如果长度<=5（如 BTC, DOGE）或者结尾不是常见的 Base 计价单位，那么认为它缺 Quotation 需补充 USDT
		if len(symbol) <= 5 || (!strings.HasSuffix(symbol, "BTC") && !strings.HasSuffix(symbol, "ETH") && !strings.HasSuffix(symbol, "BNB")) {
			symbol += "USDT"
		}
	}

	targetPrice, err := strconv.ParseFloat(args[1], 64)
	if err != nil {
		return c.Send("Invalid target price. Please provide a valid number.")
	}

	currentPrice, err := binance.GetSymbolPrice(symbol)
	if err != nil {
		return c.Send(fmt.Sprintf("Failed to fetch current price for %s: %v", symbol, err))
	}

	condition := "GREATER"
	if targetPrice < currentPrice {
		condition = "LESS"
	}

	alert := model.Alert{
		ChatID:      c.Chat().ID,
		Symbol:      symbol,
		TargetPrice: targetPrice,
		Condition:   condition,
		Active:      true,
	}

	if err := repository.DB.Create(&alert).Error; err != nil {
		return c.Send("Failed to save alert.")
	}

	msg := fmt.Sprintf("✅ Alert added successfully!\nSymbol: %s\nCurrent Price: %.2f\nTarget Price: %.2f\nCondition: When price goes %s than %.2f",
		symbol, currentPrice, targetPrice, condition, targetPrice)
	return c.Send(msg)
}

func handleHelp(c telebot.Context) error {
	msg := `🤖 Welcome to Crypto Toolbox Bot!
Here are the supported commands:
/add <symbol> <price> - Create a price alert (e.g. /add btc 100000)
/list - Show all active alerts
/delete <ID> - Delete an alert by ID
/deleall - Clear all alerts
/assets <target_amount> - Alert when total assets exceed amount (e.g. /assets 50000)
/help - Show this help message`
	return c.Send(msg)
}

func handleListAlerts(c telebot.Context) error {
	var alerts []model.Alert
	if err := repository.DB.Where("chat_id = ? AND active = ?", c.Chat().ID, true).Find(&alerts).Error; err != nil {
		return c.Send("Failed to retrieve alerts.")
	}

	if len(alerts) == 0 {
		return c.Send("You have no active alerts.")
	}

	var msg strings.Builder
	msg.WriteString("💰 Active Alerts:\n")
	for _, a := range alerts {
		if a.Symbol == "TOTAL_ASSETS" {
			// 特殊渲染：总资产提醒
			balance, _ := binance.GetTotalAccountBalance()
			msg.WriteString(fmt.Sprintf("🏦 总资产提醒: 目标 > %v USDT [ID:%d] (最新值: %.2f USDT)\n", a.TargetPrice, a.ID, balance))
		} else {
			// 取最新行情
			currentPrice, _ := binance.GetSymbolPrice(a.Symbol)
			
			symbolName := a.Symbol
			if strings.HasSuffix(symbolName, "USDT") {
				symbolName = strings.TrimSuffix(symbolName, "USDT")
			}
			
			sign := ">"
			emoji := "📈"
			if a.Condition == "LESS" {
				sign = "<"
				emoji = "📉"
			}
			msg.WriteString(fmt.Sprintf("🔷 %s: %v USDT\n  • %s Target: %s %v [ID:%d]\n", symbolName, currentPrice, emoji, sign, a.TargetPrice, a.ID))
		}
	}

	return c.Send(msg.String())
}

func handleDeleteAlert(c telebot.Context) error {
	args := c.Args()
	if len(args) != 1 {
		return c.Send("Usage: /delete <alert_id>\nExample: /delete 1")
	}

	alertID, err := strconv.Atoi(args[0])
	if err != nil {
		return c.Send("Invalid alert ID.")
	}

	res := repository.DB.Where("id = ? AND chat_id = ?", alertID, c.Chat().ID).Delete(&model.Alert{})
	if res.Error != nil {
		return c.Send("Failed to delete alert.")
	}
	if res.RowsAffected == 0 {
		return c.Send("Alert not found or already deleted.")
	}

	return c.Send("🗑️ Alert deleted successfully.")
}

func handleDeleteAllAlerts(c telebot.Context) error {
	res := repository.DB.Where("chat_id = ?", c.Chat().ID).Delete(&model.Alert{})
	if res.Error != nil {
		return c.Send("Failed to delete alerts.")
	}

	return c.Send(fmt.Sprintf("🗑️ All %d alerts deleted successfully.", res.RowsAffected))
}

func handleRecordAssets(c telebot.Context) error {
	args := c.Args()
	if len(args) == 0 {
		return c.Send("Usage: /assets <target_amount> [target_amount2] ...\nExample: /assets 50000 60000")
	}

	var saved []float64
	for _, arg := range args {
		targetAmount, err := strconv.ParseFloat(arg, 64)
		if err != nil {
			continue // Skip invalid numbers instead of failing the whole command
		}

		// 录入提醒数据库
		alert := model.Alert{
			ChatID:      c.Chat().ID,
			Symbol:      "TOTAL_ASSETS",
			TargetPrice: targetAmount,
			Condition:   "GREATER", // 默认监控拉升超额
			Active:      true,
		}

		if err := repository.DB.Create(&alert).Error; err == nil {
			saved = append(saved, targetAmount)
		}
	}

	if len(saved) == 0 {
		return c.Send("❌ 未能成功设置任何资产提醒，请检查输入的金额是否有效。")
	}

	// 格式化展示已保存的目标
	var targetsStr []string
	for _, s := range saved {
		targetsStr = append(targetsStr, fmt.Sprintf("%.2f", s))
	}
	joinedTargets := strings.Join(targetsStr, ", ")

	// 取一下当前的资产，告知他设定成功
	balance, err := binance.GetTotalAccountBalance()
	currentMsg := ""
	if err == nil {
		currentMsg = fmt.Sprintf("\n当前账户余额: %.2f USDT", balance)
	}

	msg := fmt.Sprintf("✅ 资产提醒设置成功！\n🎯 当总资产达到: > (%s) USDT 时将通知您。%s",
		joinedTargets, currentMsg)
	return c.Send(msg)
}

