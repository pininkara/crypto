package service

import (
	"crypto/internal/config"
	"crypto/internal/model"
	"crypto/internal/repository"
	"crypto/pkg/binance"
	"log"
	"math"
	"time"
)

// StartAssetTracker 启动自动资产追踪服务
func StartAssetTracker() {
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
		recordAssetBalance(cfg.ChatID)

		ticker := time.NewTicker(time.Duration(interval) * time.Second)
		defer ticker.Stop()
		for range ticker.C {
			recordAssetBalance(cfg.ChatID)
		}
	}()
}

func recordAssetBalance(chatID int64) {
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
}
