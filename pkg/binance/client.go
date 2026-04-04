package binance

import (
	"context"
	"fmt"
	"log"

	"crypto/internal/config"

	binanceapi "github.com/adshao/go-binance/v2"
	"github.com/adshao/go-binance/v2/futures"
)

var Client *futures.Client
var SpotClient *binanceapi.Client

// InitBinance 初始化币安 API 客户端
func InitBinance() {
	apiKey := config.Cfg.Binance.APIKey
	secretKey := config.Cfg.Binance.SecretKey

	// 如果没有配置 Key，仍然可以初始化，获取公开行情不需要权限
	Client = futures.NewClient(apiKey, secretKey)
	SpotClient = binanceapi.NewClient(apiKey, secretKey)
	log.Println("Binance clients initialized.")
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

// GetFuturesAccountBalance 获取合约账户总资产（钱包余额 + 未实现盈亏）
func GetFuturesAccountBalance() (float64, error) {
	if Client == nil {
		return 0, fmt.Errorf("binance client not initialized")
	}

	account, err := Client.NewGetAccountService().Do(context.Background())
	if err != nil {
		return 0, fmt.Errorf("failed to get futures account: %w", err)
	}

	var totalBalance float64
	fmt.Sscanf(account.TotalMarginBalance, "%f", &totalBalance)
	return totalBalance, nil
}

// GetTotalAccountBalance 获取所有钱包总资产估值之和 (包含现货、合约、理财等)
func GetTotalAccountBalance() (float64, error) {
	if SpotClient == nil {
		return 0, fmt.Errorf("binance spot client not initialized")
	}

	balances, err := SpotClient.NewWalletBalanceService().QuoteAsset("USDT").Do(context.Background())
	if err != nil {
		return 0, fmt.Errorf("failed to get unified wallet balances: %w", err)
	}

	var total float64
	for _, b := range balances {
		var bal float64
		fmt.Sscanf(b.Balance, "%f", &bal)
		total += bal
	}

	return total, nil
}

