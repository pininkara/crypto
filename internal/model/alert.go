package model

import "time"

// Alert 表示一个价格提醒
type Alert struct {
	ID          uint      `gorm:"primarykey" json:"id"`
	ChatID      int64     `gorm:"index" json:"chat_id"`         // Telegram Chat ID
	Symbol      string    `gorm:"index" json:"symbol"`          // 交易对, 例如 BTCUSDT
	TargetPrice float64   `json:"target_price"`                 // 目标价
	Condition   string    `json:"condition"`                    // 触发条件 "GREATER" 或 "LESS"
	Active      bool      `gorm:"default:true" json:"active"`   // 是否激活
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}
