package binance

import (
	"context"
	"fmt"
	"log"

	"crypto/internal/config"

	"github.com/adshao/go-binance/v2/futures"
)

var Client *futures.Client

// InitBinance 初始化币安 API 客户端
func InitBinance() {
	apiKey := config.Cfg.Binance.APIKey
	secretKey := config.Cfg.Binance.SecretKey

	// 如果没有配置 Key，仍然可以初始化，获取公开行情不需要权限
	Client = futures.NewClient(apiKey, secretKey)
	log.Println("Binance futures client initialized.")
}

// GetSymbolPrice 获取指定交易对的最新价格 (例如 "BTCUSDT")
func GetSymbolPrice(symbol string) (float64, error) {
	if Client == nil {
		return 0, fmt.Errorf("binance client not initialized")
	}

	prices, err := Client.NewListPricesService().Symbol(symbol).Do(context.Background())
	if err != nil {
		return 0, fmt.Errorf("failed to get price for symbol %s: %w", symbol, err)
	}

	for _, p := range prices {
		if p.Symbol == symbol {
			var price float64
			fmt.Sscanf(p.Price, "%f", &price)
			return price, nil
		}
	}

	return 0, fmt.Errorf("price not found for symbol %s", symbol)
}

// GetKlines 获取 K 线数据 
// interval: "1d", "1w", "1M", etc.
func GetKlines(symbol string, interval string, limit int) ([]*futures.Kline, error) {
	if Client == nil {
		return nil, fmt.Errorf("binance client not initialized")
	}

	klines, err := Client.NewKlinesService().Symbol(symbol).
		Interval(interval).Limit(limit).Do(context.Background())
	if err != nil {
		return nil, fmt.Errorf("failed to get klines for symbol %s: %w", symbol, err)
	}

	return klines, nil
}
