# VEGA

参考 TradingView 的股票 / 加密货币行情站：

- 首页行情榜（加密货币 + 美股切换）
- 专业图表终端（K 线、周期、MA/EMA、成交量、Watchlist）
- 真实数据：全部来自币安公开 API
  - 加密：USDT 交易对
  - 美股：TradFi 永续（如 `AAPLUSDT`，优先 `fapi.binance.com`），失败则回退现货代币化股票（如 `AAPLBUSDT`）

## 启动

```bash
npm install
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。

## 主要路由

| 路径 | 说明 |
| --- | --- |
| `/` | 行情首页 |
| `/chart/crypto/BTCUSDT` | 加密货币图表 |
| `/chart/stock/AAPL` | 美股图表（内部映射币安合约/代币化股票） |

## 技术栈

- Next.js App Router + TypeScript + Tailwind CSS
- TradingView [Lightweight Charts](https://github.com/tradingview/lightweight-charts) v5
- 服务端 API 代理：优先 `fapi.binance.com`，回退 `data-api.binance.vision` / `api.binance.com`
