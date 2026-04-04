package model

import "time"

// AssetRecord 表示一条总资产记录
type AssetRecord struct {
	ID        uint      `gorm:"primarykey" json:"id"`
	ChatID    int64     `gorm:"index" json:"chat_id"` // Telegram Chat ID
	Amount    float64   `json:"amount"`                // 总资产金额
	CreatedAt time.Time `json:"created_at"`
}
