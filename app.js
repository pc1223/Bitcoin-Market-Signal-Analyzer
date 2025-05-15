import axios from 'axios';
import dayjs from 'dayjs';
import { RSI, MACD, BollingerBands, OBV } from 'technicalindicators';
import chalk from 'chalk';
import { HttpsProxyAgent } from 'https-proxy-agent';
import NodeCache from 'node-cache';
import dotenv from 'dotenv';
import fs from 'fs/promises';

// 加载环境变量
dotenv.config();

// 配置
const config = {
  PROXY_URL: process.env.PROXY_URL,
  CACHE_TTL: 300, // 缓存5分钟
  REQUEST_TIMEOUT: 10000, // 请求超时10秒
};

// 中文映射
const classificationMap = {
  'Extreme fear': '极度恐惧',
  'Fear': '恐惧',
  'Neutral': '中性',
  'Greed': '贪婪',
  'Extreme greed': '极度贪婪',
};

// 初始化缓存
const cache = new NodeCache({ stdTTL: config.CACHE_TTL });

// Axios 实例
const axiosInstance = axios.create({
  timeout: config.REQUEST_TIMEOUT,
  httpsAgent: config.PROXY_URL ? new HttpsProxyAgent(config.PROXY_URL) : undefined,
  proxy: false,
});

// 技术指标计算
function calculateRSI(closes, period = 14) {
  try {
    const rsi = RSI.calculate({ values: closes, period }).slice(-1)[0];
    return Number.isFinite(rsi) ? rsi : null;
  } catch (error) {
    console.error(chalk.red('RSI计算失败:', error.message));
    return null;
  }
}

function calculateMACD(closes) {
  try {
    const macd = MACD.calculate({
      values: closes,
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9,
    }).slice(-1)[0];
    return {
      histogram: macd.histogram,
      signal: macd.signal,
      MACD: macd.MACD,
      trend: macd.histogram > 0 ? '看涨' : '看跌',
    };
  } catch (error) {
    console.error(chalk.red('MACD计算失败:', error.message));
    return null;
  }
}

function calculateBollingerBands(closes, period = 20, stdDev = 2) {
  try {
    const bb = BollingerBands.calculate({ period, stdDev, values: closes }).slice(-1)[0];
    const latestClose = closes.at(-1);
    const bandwidth = ((bb.upper - bb.lower) / bb.middle) * 100;
    let position = '中性';
    if (latestClose > bb.upper) position = '超买';
    else if (latestClose < bb.lower) position = '超卖';
    return { upper: bb.upper, middle: bb.middle, lower: bb.lower, bandwidth, position };
  } catch (error) {
    console.error(chalk.red('布林带计算失败:', error.message));
    return null;
  }
}

function calculateOBV(closes, volumes) {
  try {
    const obv = OBV.calculate({ close: closes, volume: volumes }).slice(-1)[0];
    const prevObv = OBV.calculate({ close: closes, volume: volumes }).slice(-2)[0];
    return { value: obv, trend: obv > prevObv ? '上升' : '下降' };
  } catch (error) {
    console.error(chalk.red('OBV计算失败:', error.message));
    return null;
  }
}

function calculateVWAP(closes, volumes) {
  try {
    const sumPriceVolume = closes.reduce((sum, price, i) => sum + price * volumes[i], 0);
    const sumVolume = volumes.reduce((sum, vol) => sum + vol, 0);
    const vwap = sumPriceVolume / sumVolume;
    const latestClose = closes.at(-1);
    return { value: vwap, position: latestClose > vwap ? '高于VWAP' : '低于VWAP' };
  } catch (error) {
    console.error(chalk.red('VWAP计算失败:', error.message));
    return null;
  }
}

function calculateSMA(closes, period) {
  try {
    const sum = closes.slice(-period).reduce((sum, price) => sum + price, 0);
    return sum / period;
  } catch (error) {
    console.error(chalk.red(`SMA(${period})计算失败:`, error.message));
    return null;
  }
}

// 新增：计算 Pi Cycle Top
async function calculatePiCycleTop() {
  const cacheKey = 'pi_cycle_top';
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    // 添加延时以应对 CoinGecko 限速
    await new Promise(resolve => setTimeout(resolve, 1200));
    const { data } = await axiosInstance.get(
      'https://api.coingecko.com/api/v3/coins/bitcoin/market_chart',
      { params: { vs_currency: 'usd', days: 365, interval: 'daily' } }
    );
    if (!data?.prices?.length) throw new Error('无效的 CoinGecko 数据');
    const closes = data.prices.map(([_, price]) => price);
    if (closes.length < 350) throw new Error('数据不足以计算 350DMA');
    const sma111 = calculateSMA(closes, 111);
    const sma350 = calculateSMA(closes, 350) * 2;
    const result = {
      sma111,
      sma350,
      isTop: sma111 >= sma350,
      timestamp: dayjs(data.prices.at(-1)[0]).format('YYYY-MM-DD')
    };
    cache.set(cacheKey, result);
    return result;
  } catch (error) {
    console.error(chalk.red('Pi Cycle Top 计算失败:', error.message));
    return null;
  }
}

// 获取 Fear & Greed 指数（修复为 Alternative.me）
async function getFearGreedIndex() {
  const cacheKey = 'fear_greed_index';
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    const res = await axiosInstance.get('https://api.alternative.me/fng/?limit=1');
    const data = res.data.data[0];
    const result = {
      value: parseInt(data.value),
      classification: data.value_classification,
      updateTime: data.timestamp * 1000
    };
    cache.set(cacheKey, result);
    return result;
  } catch (error) {
    console.error(chalk.red('获取 Fear & Greed 指数失败:', error.message));
    return null;
  }
}

// 获取历史价格（CoinGecko）
async function getBitcoinPriceData() {
  const cacheKey = 'bitcoin_price_data';
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    // 添加延时
    await new Promise(resolve => setTimeout(resolve, 1200));
    const url = 'https://api.coingecko.com/api/v3/coins/bitcoin/market_chart';
    const params = { vs_currency: 'usd', days: 200, interval: 'daily' };
    const { data } = await axiosInstance.get(url, { params });
    if (!data?.prices?.length || !data?.total_volumes?.length) throw new Error('无效的 CoinGecko 数据');
    const closes = data.prices.map(([_, price]) => price);
    const volumes = data.total_volumes.map(([_, vol]) => vol);
    const result = { closes, volumes };
    cache.set(cacheKey, result);
    return result;
  } catch (error) {
    console.error(chalk.red('获取 CoinGecko 数据失败:', error.message));
    return null;
  }
}

// 综合评估（新增 Pi Cycle Top）
function evaluateSignals(fg, rsi, macd, bb, obv, vwap, sma50, sma200, piCycle) {
  let score = 0;
  const signals = [];

  // Fear & Greed
  if (fg) {
    if (fg.value < 20) { score += 2; signals.push('极度恐惧（强烈买入）'); }
    else if (fg.value < 40) { score += 1; signals.push('恐惧（逐步买入）'); }
    else if (fg.value > 80) { score -= 2; signals.push('极度贪婪（强烈卖出）'); }
    else if (fg.value > 60) { score -= 1; signals.push('贪婪（逐步卖出）'); }
  }

  // RSI
  if (rsi) {
    if (rsi < 30) { score += 1; signals.push('RSI 超卖（买入）'); }
    else if (rsi > 70) { score -= 1; signals.push('RSI 超买（卖出）'); }
  }

  // MACD
  if (macd) {
    if (macd.histogram > 0) { score += 1; signals.push('MACD 看涨'); }
    else { score -= 1; signals.push('MACD 看跌'); }
  }

  // Bollinger Bands
  if (bb) {
    if (bb.position === '超卖') { score += 1; signals.push('布林带超卖（买入）'); }
    else if (bb.position === '超买') { score -= 1; signals.push('布林带超买（卖出）'); }
  }

  // OBV
  if (obv) {
    if (obv.trend === '上升') { score += 0.5; signals.push('OBV 上升（买压增加）'); }
    else { score -= 0.5; signals.push('OBV 下降（卖压增加）'); }
  }

  // VWAP
  if (vwap) {
    if (vwap.position === '高于VWAP') { score += 0.5; signals.push('价格高于 VWAP（看涨）'); }
    else { score -= 0.5; signals.push('价格低于 VWAP（看跌）'); }
  }

  // SMA
  if (sma50 && sma200) {
    if (sma50 > sma200) { score += 0.8; signals.push('50日 SMA 高于 200日 SMA（金叉，看涨）'); }
    else { score -= 0.8; signals.push('50日 SMA 低于 200日 SMA（死叉，看跌）'); }
  }

  // Pi Cycle Top
  if (piCycle && piCycle.isTop) {
    score -= 1.5;
    signals.push('Pi Cycle Top 触发（强烈卖出）');
  }

  // 综合建议
  let suggestion = '观望';
  if (score > 2.3) suggestion = '强烈买入';
  else if (score > 0.7) suggestion = '逐步买入';
  else if (score < -2.3) suggestion = '强烈卖出';
  else if (score < -0.7) suggestion = '逐步卖出';

  return { score, suggestion, signals };
}

// 输出报告
async function generateReport() {
  try {
    // 并行获取数据
    const [fg, priceData, piCycle] = await Promise.all([
      getFearGreedIndex(),
      getBitcoinPriceData(),
      calculatePiCycleTop()
    ]);

    if (!fg || !priceData) {
      console.error(chalk.red('无法生成报告：核心数据获取失败'));
      return;
    }

    const { closes, volumes } = priceData;
    const rsi = calculateRSI(closes);
    const macd = calculateMACD(closes);
    const bb = calculateBollingerBands(closes);
    const obv = calculateOBV(closes, volumes);
    const vwap = calculateVWAP(closes, volumes);
    const sma50 = calculateSMA(closes, 50);
    const sma200 = calculateSMA(closes, 200);
    const latestClose = closes.at(-1);
    const latestVolume = volumes.at(-1);

    // 综合评估
    const { score, suggestion, signals } = evaluateSignals(fg, rsi, macd, bb, obv, vwap, sma50, sma200, piCycle);

    // 输出报告
    console.log(chalk.green('\n【恐慌与贪婪指数】'));
    console.log(`情绪值：${fg?.value || 'N/A'}（${fg ? classificationMap[fg.classification] || fg.classification : 'N/A'}）`);
    console.log(`更新时间：${fg ? dayjs(fg.updateTime).format('YYYY-MM-DD HH:mm:ss') : 'N/A'}`);

    console.log(chalk.cyan('\n【技术指标】'));
    console.log(`RSI(14)：${rsi ? rsi.toFixed(2) : 'N/A'} → ${rsi < 30 ? '超卖' : rsi > 70 ? '超买' : '中性'}`);
    console.log(`MACD：${macd ? macd.trend : 'N/A'} (Histogram: ${macd?.histogram?.toFixed(2) || 'N/A'})`);
    console.log(`布林带：${bb ? bb.position : 'N/A'} (带宽: ${bb?.bandwidth?.toFixed(2) || 'N/A'}%)`);
    console.log(`OBV：${obv ? obv.trend : 'N/A'} (值: ${obv?.value?.toFixed(0) || 'N/A'})`);
    console.log(`VWAP：${vwap ? vwap.position : 'N/A'} (值: $${vwap?.value?.toFixed(2) || 'N/A'})`);
    console.log(`50日 SMA：$${sma50 ? sma50.toFixed(2) : 'N/A'}`);
    console.log(`200日 SMA：$${sma200 ? sma200.toFixed(2) : 'N/A'}`);
    console.log(`当前价格：$${latestClose.toFixed(2)}`);
    console.log(`当前成交量：$${(latestVolume / 1e9).toFixed(2)}B`);

    console.log(chalk.magenta('\n【Pi Cycle Top】'));
    console.log(`111日 SMA：$${piCycle?.sma111?.toFixed(2) || 'N/A'}`);
    console.log(`350日 SMA×2：$${piCycle?.sma350?.toFixed(2) || 'N/A'}`);
    console.log(`信号：${piCycle?.isTop ? '市场可能过热（卖出）' : '未达顶部'}`);

    console.log(chalk.yellow('\n【综合评估】'));
    console.log(`信号得分：${score.toFixed(2)}`);
    console.log(`信号详情：${signals.length ? signals.join(' | ') : '无'}`);
    console.log(`建议操作：${suggestion}`);

    // 构造文本报告内容
    const reportText = 
`【恐慌与贪婪指数】
情绪值：${fg?.value || 'N/A'}（${fg ? classificationMap[fg.classification] || fg.classification : 'N/A'}）
更新时间：${fg ? dayjs(fg.updateTime).format('YYYY-MM-DD HH:mm:ss') : 'N/A'}

【技术指标】
RSI(14)：${rsi ? rsi.toFixed(2) : 'N/A'} → ${rsi < 30 ? '超卖' : rsi > 70 ? '超买' : '中性'}
MACD：${macd ? macd.trend : 'N/A'} (Histogram: ${macd?.histogram?.toFixed(2) || 'N/A'})
布林带：${bb ? bb.position : 'N/A'} (带宽: ${bb?.bandwidth?.toFixed(2) || 'N/A'}%)
OBV：${obv ? obv.trend : 'N/A'} (值: ${obv?.value?.toFixed(0) || 'N/A'})
VWAP：${vwap ? vwap.position : 'N/A'} (值: $${vwap?.value?.toFixed(2) || 'N/A'})
50日 SMA：$${sma50 ? sma50.toFixed(2) : 'N/A'}
200日 SMA：$${sma200 ? sma200.toFixed(2) : 'N/A'}
当前价格：$${latestClose.toFixed(2)}
当前成交量：$${(latestVolume / 1e9).toFixed(2)}B

【Pi Cycle Top】
111日 SMA：$${piCycle?.sma111?.toFixed(2) || 'N/A'}
350日 SMA×2：$${piCycle?.sma350?.toFixed(2) || 'N/A'}
信号：${piCycle?.isTop ? '市场可能过热（卖出）' : '未达顶部'}

【综合评估】
信号得分：${score.toFixed(2)}
信号详情：${signals.length ? signals.join(' | ') : '无'}
建议操作：${suggestion}

报告生成时间：${dayjs().format('YYYY-MM-DD HH:mm:ss')}`;

    // 导出到 report.txt
    await fs.writeFile('report.txt', reportText);
    console.log(chalk.gray('\n报告已导出到 report.txt'));

  } catch (error) {
    console.error(chalk.red('生成报告失败:', error.message));
  }
}

// 运行
generateReport();