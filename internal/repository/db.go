package repository

import (
	"crypto/internal/config"
	"crypto/internal/model"
	"log"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

var DB *gorm.DB

// InitDB 初始化数据库连接
func InitDB() {
	var err error
	DB, err = gorm.Open(sqlite.Open(config.Cfg.Database.DSN), &gorm.Config{})
	if err != nil {
		log.Fatalf("Failed to connect database: %v", err)
	}

	// 自动迁移模式
	err = DB.AutoMigrate(&model.Alert{})
	if err != nil {
		log.Fatalf("Failed to migrate database: %v", err)
	}

	log.Println("Database initialized and migrated")
}
