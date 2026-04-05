package service

import (
	"crypto/internal/config"
	"crypto/internal/model"
	"crypto/internal/repository"
	"crypto/pkg/binance"
	"fmt"
	"log"
	"math"
	"time"

	"gopkg.in/telebot.v3"
)

// StartAssetTracker 启动自动资产追踪服务
func StartAssetTracker(bot *telebot.Bot) {
	cfg := config.Cfg.AssetTracker

	// 检查是否启用
	if cfg.Enable != "true" && cfg.Enable != "1" && cfg.Enable != "True" {
		log.Println("Asset tracker is disabled.")
		return
	}

	if cfg.ChatID == 0 {
		log.Println("Asset tracker: chat_id not configured, skipping.")
		return
	}

	interval := cfg.Interval
	if interval <= 0 {
		interval = 3600 // 默认 1 小时
	}

	log.Printf("Asset tracker started. Interval: %ds, ChatID: %d", interval, cfg.ChatID)

	// 启动时立即执行一次
	go func() {
		recordAssetBalance(cfg.ChatID, bot)

		ticker := time.NewTicker(time.Duration(interval) * time.Second)
		defer ticker.Stop()
		for range ticker.C {
			recordAssetBalance(cfg.ChatID, bot)
		}
	}()
}

func recordAssetBalance(chatID int64, bot *telebot.Bot) {
	balance, err := binance.GetTotalAccountBalance()
	if err != nil {
		log.Printf("Asset tracker: failed to get balance: %v", err)
		return
	}

	// 保留两位小数
	balance = math.Round(balance*100) / 100

	record := model.AssetRecord{
		ChatID: chatID,
		Amount: balance,
	}

	if err := repository.DB.Create(&record).Error; err != nil {
		log.Printf("Asset tracker: failed to save record: %v", err)
		return
	}

	log.Printf("Asset tracker: recorded balance %.2f for chat %d", balance, chatID)

	// 推送警报逻辑
	if bot != nil {
		var alerts []model.Alert
		if err := repository.DB.Where("chat_id = ? AND symbol = 'TOTAL_ASSETS' AND active = ?", chatID, true).Find(&alerts).Error; err == nil {
			for _, a := range alerts {
				if balance >= a.TargetPrice {
					msg := fmt.Sprintf("🚨 **总资产提醒** 🚨\n当前总资产: `%.2f` USDT\n已达到或超过设定的界限: `%.2f`", balance, a.TargetPrice)
					
					// 推送 TG 消息
					user := &telebot.User{ID: chatID}
					bot.Send(user, msg, telebot.ModeMarkdown)

					// 触发即失效：硬删除这条提醒
					repository.DB.Delete(&a)
					log.Printf("Asset tracker: triggered alert ID %d", a.ID)
				}
			}
		}
	}
}
