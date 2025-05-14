import axios from 'axios';
import dayjs from 'dayjs';
import { RSI } from 'technicalindicators';
import chalk from 'chalk';
import { HttpsProxyAgent } from 'https-proxy-agent';
import NodeCache from 'node-cache'; // 新增缓存库
import dotenv from 'dotenv'; // 新增环境变量支持

// 加载环境变量
dotenv.config();

// 配置
const config = {
  COINMARKETCAP_API_KEY: process.env.COINMARKETCAP_API_KEY || '91e465cf-9e4d-4cee-8570-2b0705f0730e',
  PROXY_URL: process.env.PROXY_URL || 'http://127.0.0.1:7890',
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

// 计算 RSI
function calculateRSI(closes, period = 14) {
  try {
    const rsi = RSI.calculate({ values: closes, period }).slice(-1)[0];
    return Number.isFinite(rsi) ? rsi : null;
  } catch (error) {
    console.error(chalk.red('RSI计算失败:', error.message));
    return null;
  }
}

// 获取 Fear & Greed 指数
async function getFearGreedIndex() {
  const cacheKey = 'fear_greed_index';
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    const res = await axiosInstance.get('https://pro-api.coinmarketcap.com/v3/fear-and-greed/latest', {
      headers: { 'X-CMC_PRO_API_KEY': config.COINMARKETCAP_API_KEY },
    });

    const data = res.data?.data;
    if (!data?.value || !data?.value_classification) {
      throw new Error('无效的Fear & Greed数据');
    }

    const result = {
      value: data.value,
      classification: data.value_classification,
      updateTime: data.update_time,
    };

    cache.set(cacheKey, result);
    return result;
  } catch (error) {
    console.error(chalk.red('获取Fear & Greed指数失败:', error.message));
    return null;
  }
}

// 获取历史价格（CoinGecko）
async function getBitcoinPriceData() {
  const cacheKey = 'bitcoin_price_data';
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    const url = 'https://api.coingecko.com/api/v3/coins/bitcoin/market_chart';
    const params = {
      vs_currency: 'usd',
      days: 30,
      interval: 'daily',
    };

    const { data } = await axiosInstance.get(url, { params });
    if (!data?.prices?.length || !data?.total_volumes?.length) {
      throw new Error('无效的CoinGecko数据');
    }

    const closes = data.prices.map(([_, price]) => price);
    const volumes = data.total_volumes.map(([_, vol]) => vol);

    const result = { closes, volumes };
    cache.set(cacheKey, result);
    return result;
  } catch (error) {
    console.error(chalk.red('获取CoinGecko数据失败:', error.message));
    return null;
  }
}

// 输出报告
async function generateReport() {
  try {
    // 并行获取数据
    const [fg, priceData] = await Promise.all([getFearGreedIndex(), getBitcoinPriceData()]);

    if (!fg || !priceData) {
      console.error(chalk.red('无法生成报告：数据获取失败'));
      return;
    }

    const { closes, volumes } = priceData;
    const rsi = calculateRSI(closes);

    const classificationCN = classificationMap[fg.classification] || fg.classification;
    const latestClose = closes.at(-1);
    const latestVolume = volumes.at(-1);

    // 策略建议
    let suggestion = '观望';
    if (fg.value < 20 || rsi < 30) suggestion = '强烈买入';
    else if (fg.value < 40 || rsi < 40) suggestion = '逐步买入';
    else if (fg.value > 80 || rsi > 75) suggestion = '强烈卖出';
    else if (fg.value > 60 || rsi > 65) suggestion = '逐步卖出';

    // 输出分析
    console.log(chalk.green('\n【恐慌与贪婪指数分析】'));
    console.log(`情绪值：${fg.value}（${classificationCN}）`);
    console.log(`更新时间：${dayjs(fg.updateTime).format('YYYY-MM-DD HH:mm:ss')}`);

    console.log(chalk.cyan('\n【技术指标分析】'));
    console.log(`RSI(14)：${rsi ? rsi.toFixed(2) : 'N/A'} → ${rsi < 30 ? '超卖' : rsi > 70 ? '超买' : '中性'}`);
    console.log(`当前价格：$${latestClose.toFixed(2)}`);
    console.log(`当前成交量：$${(latestVolume / 1e9).toFixed(2)}B`);

    console.log(chalk.yellow('\n【综合建议】'));
    console.log(`建议操作：${suggestion}`);
  } catch (error) {
    console.error(chalk.red('生成报告失败:', error.message));
  }
}

// 运行
generateReport();