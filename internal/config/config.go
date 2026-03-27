package config

import (
	"log"
	"strings"

	"github.com/spf13/viper"
)

type Config struct {
	App      AppConfig
	Database DatabaseConfig
	Modules  ModulesConfig
	Telegram TelegramConfig
	Binance  BinanceConfig
}

type AppConfig struct {
	Env  string
	Port int
}

type DatabaseConfig struct {
	DSN string
}

type ModulesConfig struct {
	EnableTelegram string `mapstructure:"enable_telegram"` // Viper boolean mapping sometimes needs mapstructure
	EnableGridCalc string `mapstructure:"enable_grid_calc"`
	EnableAPI      string `mapstructure:"enable_api"`
}

type TelegramConfig struct {
	Token           string
	AllowedUsers    []int64 `mapstructure:"allowed_users"`
	MonitorInterval int     `mapstructure:"monitor_interval"`
}

type BinanceConfig struct {
	APIKey    string `mapstructure:"api_key"`
	SecretKey string `mapstructure:"secret_key"`
}

var Cfg *Config

// LoadConfig 读取配置文件
func LoadConfig() {
	viper.SetConfigName("config")
	viper.SetConfigType("toml")
	viper.AddConfigPath("./config") // 优先读取 ./config 目录下的 config.toml
	viper.AddConfigPath(".")        // 兼容在根目录下的 config.toml
	viper.AutomaticEnv()
	viper.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))

	if err := viper.ReadInConfig(); err != nil {
		log.Fatalf("Error reading config file, %s", err)
	}

	Cfg = &Config{}
	if err := viper.Unmarshal(Cfg); err != nil {
		log.Fatalf("Unable to decode into struct, %v", err)
	}
}
