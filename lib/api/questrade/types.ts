/**
 * TypeScript interfaces for Questrade API responses
 */

// OAuth Token Response
export interface QuestradeTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  api_server: string;
}

// Account Types
export interface QuestradeAccount {
  type: string; // RRSP, TFSA, RESP, Margin, etc.
  number: string;
  status: string;
  isPrimary: boolean;
  isBilling: boolean;
  clientAccountType: string;
}

export interface QuestradeAccountsResponse {
  accounts: QuestradeAccount[];
}

// Position Types
export interface QuestradePosition {
  symbol: string;
  symbolId: number;
  openQuantity: number;
  closedQuantity: number;
  currentMarketValue: number;
  currentPrice: number;
  averageEntryPrice: number;
  closedPnl: number;
  openPnl: number;
  totalCost: number;
  isRealTime: boolean;
  isUnderReorg: boolean;
}

export interface QuestradePositionsResponse {
  positions: QuestradePosition[];
}

// Balance Types
export interface QuestradeBalance {
  currency: string;
  cash: number;
  marketValue: number;
  totalEquity: number;
  buyingPower: number;
  maintenanceExcess: number;
  isRealTime: boolean;
}

export interface QuestradeBalancesResponse {
  perCurrencyBalances: QuestradeBalance[];
  combinedBalances: QuestradeBalance[];
  sodPerCurrencyBalances: QuestradeBalance[];
  sodCombinedBalances: QuestradeBalance[];
}

// Activity Types
export interface QuestradeActivity {
  tradeDate: string;
  transactionDate: string;
  settlementDate: string;
  action: string; // Buy, Sell, Dividend, Interest, etc.
  symbol: string;
  symbolId: number;
  quantity: number;
  price: number;
  grossAmount: number;
  commission: number;
  netAmount: number;
  type: string; // Trade, Dividend, Interest, etc.
  currency: string;
}

export interface QuestradeActivitiesResponse {
  activities: QuestradeActivity[];
}

// Quote Types
export interface QuestradeQuote {
  symbol: string;
  symbolId: number;
  tier: string;
  bidPrice: number;
  bidSize: number;
  askPrice: number;
  askSize: number;
  lastTradePriceTrHrs: number;
  lastTradePrice: number;
  lastTradeSize: number;
  lastTradeTick: string;
  lastTradeTime: string;
  volume: number;
  openPrice: number;
  highPrice: number;
  lowPrice: number;
  delay: number;
  isHalted: boolean;
  high52w: number;
  low52w: number;
  VWAP: number;
}

export interface QuestradeQuotesResponse {
  quotes: QuestradeQuote[];
}

// Symbol Search Types
export interface QuestradeSymbol {
  symbol: string;
  symbolId: number;
  description: string;
  securityType: string;
  listingExchange: string;
  isTradable: boolean;
  isQuotable: boolean;
  currency: string;
}

export interface QuestradeSymbolsResponse {
  symbols: QuestradeSymbol[];
}

// Symbol Details Types
export interface QuestradeSymbolDetail {
  symbol: string;
  symbolId: number;
  prevDayClosePrice: number;
  highPrice52: number;
  lowPrice52: number;
  averageVol3Months: number;
  averageVol20Days: number;
  outstandingShares: number;
  eps: number;
  pe: number;
  dividend: number;
  yield: number;
  exDate: string;
  marketCap: number;
  unitPrice: number;
  openPrice: number;
  highPrice: number;
  lowPrice: number;
  totalVolume: number;
  bidPrice: number;
  bidSize: number;
  askPrice: number;
  askSize: number;
  delay: number;
  isHalted: boolean;
  high52w: number;
  low52w: number;
  VWAP: number;
  description: string;
  securityType: string;
  listingExchange: string;
  isTradable: boolean;
  isQuotable: boolean;
  currency: string;
  industrySector: string;
  industryGroup: string;
  industrySubGroup: string;
}

export interface QuestradeSymbolDetailResponse {
  symbols: QuestradeSymbolDetail[];
}

// Order Types
export interface QuestradeOrder {
  id: number;
  symbol: string;
  symbolId: number;
  totalQuantity: number;
  openQuantity: number;
  filledQuantity: number;
  canceledQuantity: number;
  side: string; // Buy, Sell
  orderType: string; // Market, Limit, Stop, StopLimit, TrailingStop, TrailingStopLimit
  limitPrice?: number;
  stopPrice?: number;
  isAllOrNone: boolean;
  isAnonymous: boolean;
  icebergQuantity?: number;
  minQuantity?: number;
  avgExecPrice?: number;
  lastExecPrice?: number;
  source: string;
  timeInForce: string; // Day, GoodTillCanceled, GoodTillExtendedDay, GoodTillDate, ImmediateOrCancel, FillOrKill
  gtdDate?: string;
  state: string; // Queued, Pending, Accepted, Rejected, Canceled, PartialCanceled, Canceled, Partial, Executed, Expired, Replaced, Final
  clientReasonStr?: string;
  chainId: number;
  creationTime: string;
  updateTime: string;
  notes?: string;
  primaryRoute: string;
  secondaryRoute: string;
  orderRoute: string;
  venueHoldingOrder?: string;
  comissionCharged?: number;
  exchangeOrderId?: string;
  isSignificantShareHolder: boolean;
  isInsider: boolean;
  isLimitOffsetInTicks: boolean;
  userId: number;
  placementCommission?: number;
  legs?: QuestradeOrderLeg[];
  strategyType: string;
  triggerStopPrice?: number;
}

export interface QuestradeOrderLeg {
  legId: number;
  symbol: string;
  symbolId: number;
  legRatio: number;
  side: string;
  avgExecPrice?: number;
  lastExecPrice?: number;
}

export interface QuestradeOrdersResponse {
  orders: QuestradeOrder[];
}

// Execution Types
export interface QuestradeExecution {
  symbol: string;
  symbolId: number;
  quantity: number;
  side: string; // Buy, Sell
  price: number;
  id: number;
  orderId: number;
  orderChainId: number;
  exchangeExecId: string;
  timestamp: string;
  notes: string;
  venue: string;
  totalCost: number;
  orderPlacementCommission: number;
  commission: number;
  executionFee: number;
  secFee: number;
  canadianExecutionFee: number;
  parentId: number;
}

export interface QuestradeExecutionsResponse {
  executions: QuestradeExecution[];
}

// Candle Types
export interface QuestradeCandle {
  start: string;
  end: string;
  low: number;
  high: number;
  open: number;
  close: number;
  volume: number;
  VWAP: number;
}

export interface QuestradeCandlesResponse {
  candles: QuestradeCandle[];
}

// Error Types
export interface QuestradeError {
  code: string;
  message: string;
}

export interface QuestradeErrorResponse {
  code: string;
  message: string;
  errors?: QuestradeError[];
}

