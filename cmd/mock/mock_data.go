package main

import (
	"log"
	"math/rand"
	"time"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

type AssetRecord struct {
	ID        uint      `gorm:"primarykey" json:"id"`
	ChatID    int64     `gorm:"index" json:"chat_id"`
	Amount    float64   `json:"amount"`
	CreatedAt time.Time `json:"created_at"`
}

func main() {
	db, err := gorm.Open(sqlite.Open("data/crypto.db"), &gorm.Config{})
	if err != nil {
		log.Fatal(err)
	}

	// Delete all first to have a clean mock set
	db.Exec("DELETE FROM asset_records")

	chatID := int64(449675031)

	baseAmount := 800.0 // Starting balance 40 days ago
	now := time.Now()

	log.Println("Generating mock data for the last 40 days...")

	// Generate for last 40 days
	for i := 40; i >= 0; i-- {
		date := now.AddDate(0, 0, -i)
		
		// generate 2 to 4 records per day
		recordsCount := rand.Intn(3) + 2
		
		for j := 0; j < recordsCount; j++ {
			// Random step between -15 and +18 to simulate crypto volatility (slight upward bias)
			change := rand.Float64()*33 - 15 
			baseAmount = baseAmount + change
            
			if baseAmount < 200 { 
				baseAmount = 200 
			}
            
            // Round to 2 decimals
			baseAmount = float64(int(baseAmount*100)) / 100

			// Assign a random time in the middle of that date
			recordTime := time.Date(date.Year(), date.Month(), date.Day(), 8+rand.Intn(14), rand.Intn(60), rand.Intn(60), 0, time.Local)

			db.Create(&AssetRecord{
				ChatID:    chatID,
				Amount:    baseAmount,
				CreatedAt: recordTime,
			})
		}
	}
    log.Println("Mock data inserted successfully!")
}
