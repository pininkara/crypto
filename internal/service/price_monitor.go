package service

import (
	"crypto/internal/config"
	"crypto/internal/model"
	"crypto/internal/repository"
	"crypto/pkg/binance"
	"fmt"
	"log"
	"time"

	"gopkg.in/telebot.v3"
)

// StartPriceMonitor 开始后台轮询监控价格
func StartPriceMonitor(bot *telebot.Bot) {
	interval := config.Cfg.Telegram.MonitorInterval
	if interval <= 0 {
		interval = 30
	}
	ticker := time.NewTicker(time.Duration(interval) * time.Second)
	go func() {
		for range ticker.C {
			checkAlerts(bot)
		}
	}()
}

func checkAlerts(bot *telebot.Bot) {
	var activeAlerts []model.Alert
	if err := repository.DB.Where("active = ?", true).Find(&activeAlerts).Error; err != nil {
		log.Printf("Failed to query active alerts: %v", err)
		return
	}

	if len(activeAlerts) == 0 {
		return
	}

	// 优化：相同 symbol 的可以只拉取一次，这里为了简单直接每次都拉取
	pricesCache := make(map[string]float64)

	for _, alert := range activeAlerts {
		if alert.Symbol == "TOTAL_ASSETS" {
			continue
		}

		price, ok := pricesCache[alert.Symbol]
		if !ok {
			p, err := binance.GetSymbolPrice(alert.Symbol)
			if err != nil {
				log.Printf("Failed to get price for %s: %v", alert.Symbol, err)
				continue
			}
			price = p
			pricesCache[alert.Symbol] = price
		}

		triggered := false
		if alert.Condition == "GREATER" && price >= alert.TargetPrice {
			triggered = true
		} else if alert.Condition == "LESS" && price <= alert.TargetPrice {
			triggered = true
		}

		if triggered {
			msg := fmt.Sprintf("🚨 <b>Price Alert Triggered!</b> 🚨\n\nSymbol: %s\nTarget Price: %.2f\nCurrent Price: %.2f",
				alert.Symbol, alert.TargetPrice, price)
			
			_, err := bot.Send(&telebot.User{ID: alert.ChatID}, msg, telebot.ModeHTML)
			if err != nil {
				log.Printf("Failed to send alert to %d: %v", alert.ChatID, err)
			} else {
				// 发送成功后将 active 置为 false
				repository.DB.Model(&alert).Update("active", false)
				log.Printf("Alert %d triggered and fulfilled.", alert.ID)
			}
		}
	}
}
