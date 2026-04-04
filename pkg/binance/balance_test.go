package binance

import (
	"crypto/internal/config"
	"log"
	"testing"
)

func TestGetTotalAccountBalance(t *testing.T) {
	// Directly initialize config struct since we know Viper might fail if path is wrong
	// But actually we have no keys. The test will just hit an error.
	config.LoadConfig() // Requires running from crypto root
	InitBinance()

	total, err := GetTotalAccountBalance()
	if err != nil {
		t.Fatalf("Error: %v", err)
	}

	log.Printf("Final Total Account Balance: %f", total)
}
