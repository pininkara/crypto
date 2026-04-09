package main

import (
	"log"
	"math/rand"
	"strconv"
	"time"

	"crypto/internal/config"
	"crypto/internal/handler"
	"crypto/internal/repository"
	"crypto/internal/service"
	"crypto/pkg/binance"

	"github.com/gin-gonic/gin"
	"gopkg.in/telebot.v3"
)

func main() {
	rand.Seed(time.Now().UnixNano())

	// 1. 加载配置
	log.Println("Loading configuration...")
	config.LoadConfig() // 会在 ./config/ 和当前目录下自动寻找 config.toml

	// 2. 初始化数据库
	log.Println("Initializing database...")
	repository.InitDB()

	// 3. 初始化 Binance 客户端
	log.Println("Initializing Binance Client...")
	binance.InitBinance()

	// 4. 启动 Telegram Bot
	var bot *telebot.Bot
	var err error
	if config.Cfg.Modules.EnableTelegram == "true" || config.Cfg.Modules.EnableTelegram == "1" || config.Cfg.Modules.EnableTelegram == "True" || config.Cfg.Modules.EnableTelegram == "" { // default to mapstructure true behaviour
		log.Println("Telegram bot module is enabled.")
		bot, err = handler.InitBot()
		if err != nil {
			log.Fatalf("Failed to initialize telegram bot: %v", err)
		}
		
		// 启动价格监控
		service.StartPriceMonitor(bot)
		
		// 异步启动机器人，防止阻塞 Gin
		go func() {
			log.Println("Starting Telegram bot...")
			bot.Start()
		}()
	}

	// 5. 启动自动资产追踪
	service.StartAssetTracker(bot)

	// 6. 启动 Gin Web 服务
	if config.Cfg.Modules.EnableAPI == "true" || config.Cfg.Modules.EnableAPI == "1" || config.Cfg.Modules.EnableAPI == "True" || config.Cfg.Modules.EnableAPI == "" {
		log.Println("API module is enabled. Starting Gin server...")
		if config.Cfg.App.Env == "production" {
			gin.SetMode(gin.ReleaseMode)
		}
		
		r := gin.Default()
		
		// 路由设置
		r.GET("/api/ping", func(c *gin.Context) {
			c.JSON(200, gin.H{
				"message": "pong",
			})
		})
		
		// 注册模拟计算网格策略的回测接口
		r.POST("/api/simulate", handler.HandleSimulateGrid)
		
		// 注册总资产查询接口
		r.GET("/api/assets", handler.HandleGetAssets)
		r.POST("/api/assets/sync", handler.HandleSyncAssets)
		r.GET("/api/asset-records", handler.HandleGetAssetRecords)
		
		if !config.Cfg.AssetTracker.UploaderMode {
			r.POST("/api/assets/receive", handler.HandleReceiveAsset)
		}
		
		// 挂载静态资源：服务于基于 Vite 编译打包后的 web/dist
		r.Static("/assets", "./web/dist/assets")
		r.StaticFile("/", "./web/dist/index.html")
		r.StaticFile("/index.html", "./web/dist/index.html")
		
		// 适配前端路由 (React Router 时有用，不过这里单页面如果只有 / 直接返回即可，加上 NoRoute 保证刷新不报 404)
		r.NoRoute(func(c *gin.Context) {
			c.File("./web/dist/index.html")
		})
		
		if err := r.Run(":" + getPort()); err != nil {
			log.Fatalf("Failed to run server: %v", err)
		}
	} else {
		// 如果不启动 API 服务，需要阻塞在这里，否则程序退出
		select {}
	}
}

func getPort() string {
	if !config.Cfg.AssetTracker.UploaderMode && config.Cfg.AssetTracker.ReceiverPort != 0 {
		return strconv.Itoa(config.Cfg.AssetTracker.ReceiverPort)
	}
	if config.Cfg.App.Port == 0 {
		return "8080"
	}
	return strconv.Itoa(config.Cfg.App.Port)
}
