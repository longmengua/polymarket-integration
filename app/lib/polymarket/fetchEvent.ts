const GAMMA_API = "https://gamma-api.polymarket.com";

/**
 * 固定查詢條件（MVP）
 *
 * 👉 之後要改策略，只改這裡
 */
const DEFAULT_QUERY: FetchEventsParams = {
    tag_slug: "fifa-world-cup",
    active: true,
    closed: false,
    limit: 200,
    order: "volume",
    ascending: false,
};

/**
 * Gamma API 查詢參數
 */
export type FetchEventsParams = {
    tag_slug?: string;
    active?: boolean;
    closed?: boolean;
    limit?: number;
    order?: string;
    ascending?: boolean;
};

/**
 * Response 格式
 */
export interface FetchEventsResponse {
    id: string
    ticker: string
    slug: string
    title: string
    description: string
    resolutionSource: string
    startDate: string
    creationDate: string
    endDate?: string
    image: string
    icon: string
    active: boolean
    closed: boolean
    archived: boolean
    new: boolean
    featured: boolean
    restricted: boolean
    liquidity: number
    volume: number
    openInterest: number
    sortBy: string
    createdAt: string
    updatedAt: string
    competitive: number
    volume24hr: number
    volume1wk: number
    volume1mo: number
    volume1yr: number
    enableOrderBook: boolean
    liquidityClob: number
    negRisk: boolean
    negRiskMarketID: string
    commentCount: number
    markets: Market[]
    tags: Tag[]
    cyom: boolean
    showAllOutcomes: boolean
    showMarketImages: boolean
    enableNegRisk: boolean
    automaticallyActive: boolean
    gmpChartMode: string
    negRiskAugmented: boolean
    featuredOrder?: number
    estimateValue?: boolean
    cumulativeMarkets: boolean
    pendingDeployment: boolean
    deploying: boolean
    deployingTimestamp: string
    requiresTranslation: boolean
    eventMetadata: EventMetadata
}

export interface Market {
    id: string
    question: string
    conditionId: string
    slug: string
    resolutionSource?: string
    endDate?: string
    liquidity?: string
    startDate: string
    image: string
    icon: string
    description: string
    outcomes: string
    outcomePrices: string
    volume: string
    active: boolean
    closed: boolean
    marketMakerAddress: string
    createdAt: string
    updatedAt: string
    new: boolean
    featured: boolean
    submitted_by: string
    archived: boolean
    resolvedBy: string
    restricted: boolean
    groupItemTitle: string
    groupItemThreshold: string
    questionID: string
    enableOrderBook: boolean
    orderPriceMinTickSize: number
    orderMinSize: number
    volumeNum: number
    liquidityNum?: number
    endDateIso?: string
    startDateIso?: string
    hasReviewedDates: boolean
    volume24hr?: number
    volume1wk?: number
    volume1mo?: number
    volume1yr?: number
    clobTokenIds: string
    umaBond: string
    umaReward: string
    volume24hrClob?: number
    volume1wkClob?: number
    volume1moClob?: number
    volume1yrClob?: number
    volumeClob: number
    liquidityClob?: number
    makerBaseFee: number
    takerBaseFee: number
    customLiveness: number
    acceptingOrders: boolean
    negRisk: boolean
    negRiskMarketID: string
    negRiskRequestID: string
    ready: boolean
    funded: boolean
    acceptingOrdersTimestamp: string
    cyom: boolean
    competitive?: number
    pagerDutyNotificationEnabled: boolean
    approved: boolean
    rewardsMinSize: number
    rewardsMaxSpread: number
    spread: number
    oneDayPriceChange?: number
    oneWeekPriceChange?: number
    oneMonthPriceChange?: number
    lastTradePrice: number
    bestBid: number
    bestAsk: number
    automaticallyActive: boolean
    clearBookOnStart: boolean
    seriesColor?: string
    showGmpSeries: boolean
    showGmpOutcome: boolean
    manualActivation: boolean
    negRiskOther: boolean
    umaResolutionStatuses: string
    pendingDeployment: boolean
    deploying: boolean
    deployingTimestamp: string
    rfqEnabled: boolean
    holdingRewardsEnabled: boolean
    feesEnabled: boolean
    requiresTranslation: boolean
    feeType: string
    feeSchedule: FeeSchedule
    volume24hrAmm?: number
    volume1wkAmm?: number
    volume1moAmm?: number
    volume1yrAmm?: number
    volumeAmm?: number
    liquidityAmm?: number
    oneHourPriceChange?: number
    oneYearPriceChange?: number
    closedTime?: string
    umaEndDate?: string
    umaResolutionStatus?: string
    automaticallyResolved?: boolean
    clobRewards?: ClobReward[]
}

export interface FeeSchedule {
    exponent: number
    rate: number
    takerOnly: boolean
    rebateRate: number
}

export interface ClobReward {
    id: string
    conditionId: string
    assetAddress: string
    rewardsAmount: number
    rewardsDailyRate: number
    startDate: string
    endDate: string
}

export interface Tag {
    id: string
    label: string
    slug: string
    forceShow?: boolean
    createdAt: string
    updatedAt: string
    requiresTranslation: boolean
    publishedAt?: string
    updatedBy?: number
    forceHide?: boolean
    isCarousel?: boolean
}

export interface EventMetadata {
    context_description: string
    context_requires_regen: boolean
    context_updated_at: string
}


/**
 * 取得 events（原始資料）
 *
 * 👉 有 params → 完全使用
 * 👉 無 params / 空物件 → 使用 DEFAULT
 */
export async function fetchEventsRaw(params?: FetchEventsParams): Promise<FetchEventsResponse[]> {
    const isEmpty =
        !params || Object.keys(params).length === 0;

    const finalParams = isEmpty ? DEFAULT_QUERY : params;

    const query = new URLSearchParams();

    Object.entries(finalParams).forEach(([key, value]) => {
        if (value !== undefined) {
            query.append(key, String(value));
        }
    });

    const res = await fetch(`${GAMMA_API}/events?${query.toString()}`, {
        next: { revalidate: 5 }, // ISR cache
    });

    if (!res.ok) {
        throw new Error("Failed to fetch events");
    }

    return res.json();
}