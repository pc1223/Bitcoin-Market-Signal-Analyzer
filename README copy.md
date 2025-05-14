# Bitcoin Market Signal Analyzer

## 项目概述

**Bitcoin Market Signal Analyzer** 是一个 Node.js 应用程序，用于分析比特币（BTC）的市场信号，帮助用户评估买入或卖出时机。项目通过以下数据源和指标生成综合市场报告：

- **Fear & Greed 指数**：从 CoinMarketCap API 获取，反映市场情绪（极度恐惧、恐惧、中性、贪婪、极度贪婪）。
- **技术指标**：基于 CoinGecko API 的价格和成交量数据，计算以下指标：
  - RSI（相对强弱指数）：识别超买/超卖。
  - MACD（移动平均线收敛-发散）：判断趋势方向。
  - Bollinger Bands（布林带）：分析价格波动和超买/超卖。
  - OBV（成交量净额）：衡量买卖压力。
  - VWAP（成交量加权平均价）：评估价格相对平均成交价的位置。
  - SMA（简单移动平均线）：50 日和 200 日均线，检测金叉/死叉。
- **输出**：生成详细的控制台报告，并将结果导出为 `report.json`。

项目特点：
- 支持代理（通过 `.env` 配置）。
- 使用缓存（5 分钟 TTL）减少 API 请求。
- 模块化设计，易于扩展（如添加新指标或币种）。

## 功能

- **数据获取**：
  - Fear & Greed 指数：CoinMarketCap Pro API。
  - 价格和成交量：CoinGecko API（过去 200 天每日数据）。
- **指标计算**：
  - RSI(14)：超买 (>70) 或超卖 (<30)。
  - MACD(12,26,9)：看涨/看跌趋势。
  - Bollinger Bands(20,2)：超买/超卖和带宽。
  - OBV：买压/卖压趋势。
  - VWAP：价格相对成交量加权均价。
  - SMA(50,200)：金叉/死叉信号。
- **综合评估**：
  - 基于所有指标计算得分（范围 -6.8 到 6.8）。
  - 输出建议：强烈买入、逐步买入、观望、逐步卖出、强烈卖出。
- **报告输出**：
  - 控制台显示详细指标和建议（中文）。
  - 导出 JSON 文件（`report.json`）。

## 安装

### 前提条件

- **Node.js**：v22.12.0 或更高版本（推荐使用最新 LTS 版本）。
- **操作系统**：Windows、Linux 或 macOS。
- **网络**：稳定的互联网连接，用于 API 请求。
- **可选**：代理服务器（如 Clash，需提供 HTTP 代理地址）。

### 步骤

1. **克隆或下载项目**：
   将项目文件置于 `C:\Users\Administrator\Desktop\fear-and-greed`（或你的目标目录）。

2. **安装依赖**：
   打开终端，进入项目目录，运行：
   ```bash
   npm install axios dayjs technicalindicators chalk https-proxy-agent node-cache dotenv
   ```

3. **配置环境变量**：
   在项目根目录创建 `.env` 文件，添加以下内容：
   ```env
   COINMARKETCAP_API_KEY=91e465cf-9e4d-4cee-8570-2b0705f0730e
   PROXY_URL=http://127.0.0.1:7890
   ```
   - `COINMARKETCAP_API_KEY`：CoinMarketCap Pro API 密钥（注册于 https://coinmarketcap.com/api/）。
   - `PROXY_URL`：代理服务器地址（如无需代理，设为 `PROXY_URL=` 或删除）。
   - 如果 API 密钥失效，注册新密钥并更新。

## 使用方法

1. **运行脚本**：
   在项目目录运行：
   ```bash
   node app.js
   ```

2. **输出**：
   - **控制台**：显示 Fear & Greed 指数、技术指标、综合评估和建议操作。
   - **JSON 文件**：结果导出到 `report.json`。
   - 示例输出：
     ```
     【恐慌与贪婪指数】
     情绪值：25（恐惧）
     更新时间：2025-05-14 11:05:00

     【技术指标】
     RSI(14)：28.50 → 超卖
     MACD：看涨 (Histogram: 150.20)
     布林带：超卖 (带宽: 5.20%)
     OBV：上升 (值: 123456789)
     VWAP：高于VWAP (值: $64000.00)
     50日SMA：$65000.00
     200日SMA：$62000.00
     当前价格：$65500.00
     当前成交量：$2.30B

     【综合评估】
     信号得分：3.30
     信号详情：恐惧（逐步买入） | RSI超卖（买入） | MACD看涨 | 布林带超卖（买入） | OBV上升（买压增加） | 价格高于VWAP（看涨） | 50日SMA高于200日SMA（金叉，看涨）
     建议操作：强烈买入

     报告已导出到 report.json
     ```

3. **检查 JSON 输出**：
   打开 `report.json`，确认包含以下字段：
   - `timestamp`：报告生成时间。
   - `fearGreed`：Fear & Greed 指数数据。
   - `technical`：所有技术指标（RSI、MACD、布林带、OBV、VWAP、SMA、价格、成交量）。
   - `evaluation`：得分、建议和信号详情。

## 项目结构

```
fear-and-greed/
├── app.js          # 主程序
├── .env           # 环境变量配置文件
├── package.json   # Node.js 项目配置
├── report.json    # 输出报告（运行后生成）
└── node_modules/  # 依赖项（安装后生成）
```

## 依赖项

| 依赖包              | 用途                              |
|---------------------|-----------------------------------|
| `axios`             | 发送 HTTP 请求（API 调用）        |
| `dayjs`             | 日期和时间处理                   |
| `technicalindicators`| 计算技术指标（RSI、MACD 等）     |
| `chalk`             | 控制台彩色输出                   |
| `https-proxy-agent` | 支持代理请求                     |
| `node-cache`        | 缓存 API 响应                    |
| `dotenv`            | 加载 `.env` 环境变量             |

## 配置说明

- **`.env` 文件**：
  - 必须包含 `COINMARKETCAP_API_KEY`，否则 Fear & Greed 指数无法获取。
  - `PROXY_URL` 可选，推荐本地代理（如 `http://127.0.0.1:7890`）以提高请求稳定性。
- **缓存**：
  - 缓存有效期 5 分钟（`CACHE_TTL: 300`），减少 API 请求频率。
  - 可在 `app.js` 修改 `CACHE_TTL`（单位：秒）。
- **请求超时**：
  - 默认 10 秒（`REQUEST_TIMEOUT: 10000`），可在 `app.js` 调整。

## 注意事项

1. **API 速率限制**：
   - **CoinGecko**：免费 API 限制 10-50 请求/分钟。`days: 200` 可能触发 429 错误，建议：
     - 减小 `days`（如 100，修改 `getBitcoinPriceData` 中的 `params`）。
     - 延长缓存时间（`CACHE_TTL: 600`）。
     - 检查代理稳定性或禁用（`PROXY_URL=`）。
   - **CoinMarketCap**：免费 API 限制 30 请求/分钟。若 401 错误，替换 `COINMARKETCAP_API_KEY`。

2. **依赖版本**：
   - 确保 `technicalindicators` 支持 OBV 和 Bollinger Bands（最新版本即可）。
   - 若指标计算失败，更新依赖：
     ```bash
     npm update technicalindicators
     ```

3. **错误排查**：
   - **API 失败**：检查 `.env` 配置、网络连接或代理。
   - **运行缓慢**：验证 Node.js 版本（v22.12.0）或减少 `days`。
   - **其他错误**：运行 `node app.js` 时记录完整错误日志。

4. **性能**：
   - 计算 7 个指标（Fear & Greed + 6 个技术指标）较轻量，缓存减少 API 调用。
   - 若需优化，考虑减少指标或缩短数据范围。

## 扩展功能

1. **新增指标**：
   - **ATR（平均真实波幅）**：衡量波动性。
     ```javascript
     const { ATR } = require('technicalindicators');
     function calculateATR(highs, lows, closes, period = 14) {
       return ATR.calculate({ high: highs, low: lows, close: closes, period }).slice(-1)[0];
     }
     ```
   - **Stochastic Oscillator**：识别超买/超卖。
   - 编辑 `app.js` 添加新指标。

2. **CSV 导出**：
   - 将报告导出为 CSV：
     ```javascript
     const { Parser } = require('json2csv');
     const fields = ['timestamp', 'fearGreed.value', 'technical.rsi', ...];
     const csv = new Parser({ fields }).parse(report);
     await fs.writeFile('report.csv', csv);
     ```

3. **可视化**：
   - 使用 `chart.js` 绘制价格、SMA、VWAP 图表：
     ```javascript
     const { createCanvas } = require('canvas');
     const Chart = require('chart.js');
     ```

4. **多币种支持**：
   - 扩展到 ETH、BNB，修改 `getBitcoinPriceData`：
     ```javascript
     const coinId = 'ethereum';
     const url = `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart`;
     ```

5. **自动化**：
   - 每日定时运行：
     ```javascript
     const schedule = require('node-schedule');
     schedule.scheduleJob('0 9 * * *', generateReport);
     ```

## 贡献

欢迎提交 Issue 或 Pull Request，建议改进：
- 添加新指标或数据源。
- 优化 API 请求或缓存策略。
- 增强报告输出（如 CSV、可视化）。

## 许可证

MIT License

## 联系方式

如有问题，请联系：
- 邮箱：example@email.com（请替换为你的邮箱）
- 或通过 GitHub Issue 反馈。