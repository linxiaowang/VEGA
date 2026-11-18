/** 币安美股相关交易对：TradFi 永续为 TICKERUSDT，现货代币化为 TICKERBUSDT */

export interface StockInstrument {
  ticker: string;
  name: string;
  /** 合约 TradFi 永续，如 AAPLUSDT */
  perpSymbol: string;
  /** 现货代币化股票，如 AAPLBUSDT */
  spotSymbol: string;
}

export const STOCK_INSTRUMENTS: StockInstrument[] = [
  { ticker: "AAPL", name: "Apple", perpSymbol: "AAPLUSDT", spotSymbol: "AAPLBUSDT" },
  { ticker: "TSLA", name: "Tesla", perpSymbol: "TSLAUSDT", spotSymbol: "TSLABUSDT" },
  { ticker: "NVDA", name: "NVIDIA", perpSymbol: "NVDAUSDT", spotSymbol: "NVDABUSDT" },
  { ticker: "MSFT", name: "Microsoft", perpSymbol: "MSFTUSDT", spotSymbol: "MSFTBUSDT" },
  { ticker: "AMZN", name: "Amazon", perpSymbol: "AMZNUSDT", spotSymbol: "AMZNBUSDT" },
  { ticker: "GOOGL", name: "Alphabet", perpSymbol: "GOOGLUSDT", spotSymbol: "GOOGLBUSDT" },
  { ticker: "META", name: "Meta", perpSymbol: "METAUSDT", spotSymbol: "METABUSDT" },
  { ticker: "AMD", name: "AMD", perpSymbol: "AMDUSDT", spotSymbol: "AMDBUSDT" },
  { ticker: "NFLX", name: "Netflix", perpSymbol: "NFLXUSDT", spotSymbol: "NFLXBUSDT" },
  { ticker: "BABA", name: "Alibaba", perpSymbol: "BABAUSDT", spotSymbol: "BABABUSDT" },
  { ticker: "SPY", name: "S&P 500 ETF", perpSymbol: "SPYUSDT", spotSymbol: "SPYBUSDT" },
  { ticker: "QQQ", name: "Nasdaq 100 ETF", perpSymbol: "QQQUSDT", spotSymbol: "QQQBUSDT" },
  { ticker: "COIN", name: "Coinbase", perpSymbol: "COINUSDT", spotSymbol: "COINBUSDT" },
  { ticker: "PLTR", name: "Palantir", perpSymbol: "PLTRUSDT", spotSymbol: "PLTRBUSDT" },
  { ticker: "MSTR", name: "MicroStrategy", perpSymbol: "MSTRUSDT", spotSymbol: "MSTRBUSDT" },
  { ticker: "INTC", name: "Intel", perpSymbol: "INTCUSDT", spotSymbol: "INTCBUSDT" },
  { ticker: "ORCL", name: "Oracle", perpSymbol: "ORCLUSDT", spotSymbol: "ORCLBUSDT" },
  { ticker: "IBM", name: "IBM", perpSymbol: "IBMUSDT", spotSymbol: "IBMBUSDT" },
  { ticker: "JPM", name: "JPMorgan", perpSymbol: "JPMUSDT", spotSymbol: "JPMBUSDT" },
  { ticker: "HOOD", name: "Robinhood", perpSymbol: "HOODUSDT", spotSymbol: "HOODBUSDT" },
  { ticker: "TSM", name: "TSMC", perpSymbol: "TSMUSDT", spotSymbol: "TSMBUSDT" },
  { ticker: "ARM", name: "Arm", perpSymbol: "ARMUSDT", spotSymbol: "ARMBUSDT" },
  { ticker: "CRCL", name: "Circle", perpSymbol: "CRCLUSDT", spotSymbol: "CRCLBUSDT" },
  { ticker: "GME", name: "GameStop", perpSymbol: "GMEUSDT", spotSymbol: "GMEBUSDT" },
  { ticker: "PYPL", name: "PayPal", perpSymbol: "PYPLUSDT", spotSymbol: "PYPLBUSDT" },
  { ticker: "ADBE", name: "Adobe", perpSymbol: "ADBEUSDT", spotSymbol: "ADBEBUSDT" },
  { ticker: "LLY", name: "Eli Lilly", perpSymbol: "LLYUSDT", spotSymbol: "LLYBUSDT" },
  { ticker: "GS", name: "Goldman Sachs", perpSymbol: "GSUSDT", spotSymbol: "GSBUSDT" },
];

const byTicker = new Map(STOCK_INSTRUMENTS.map((item) => [item.ticker, item]));
const byAnySymbol = new Map<string, StockInstrument>();

for (const item of STOCK_INSTRUMENTS) {
  byAnySymbol.set(item.ticker, item);
  byAnySymbol.set(item.perpSymbol, item);
  byAnySymbol.set(item.spotSymbol, item);
}

export function resolveStockInstrument(input: string): StockInstrument | null {
  const key = input.trim().toUpperCase();
  return byTicker.get(key) ?? byAnySymbol.get(key) ?? null;
}

export function isStockPairSymbol(symbol: string) {
  const upper = symbol.toUpperCase();
  if (byAnySymbol.has(upper)) return true;
  // 代币化股票常见形态：AAPLBUSDT
  return STOCK_INSTRUMENTS.some((item) => item.spotSymbol === upper || item.perpSymbol === upper);
}
