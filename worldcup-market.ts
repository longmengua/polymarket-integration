import fs from "fs/promises";
import path from "path";

type Market = {
    id: string;
    question: string;
    slug?: string;
    active?: boolean;
    closed?: boolean;
    endDate?: string;
    groupItemTitle?: string;
    sportsMarketType?: string;
    outcomes?: string;
    outcomePrices?: string;
    lastTradePrice?: number;
    bestBid?: number;
    bestAsk?: number;
    events?: {
        slug?: string;
        title?: string;
        startTime?: string;
        eventDate?: string;
        seriesSlug?: string;
    }[];
};

type Fixture = {
    teamA: string;
    teamB: string;
    date: string;
};

type MatchOutcomeMarkets = {
    homeWin?: Market;
    awayWin?: Market;
    draw?: Market;
};

type OutputRow = {
    fixture: Fixture;
    eventSlug?: string;
    eventTitle?: string;
    outcomes: MatchOutcomeMarkets;
};

const FIXTURES: Fixture[] = [
    { teamA: "Mexico", teamB: "South Africa", date: "2026-06-11" },
    { teamA: "South Korea", teamB: "Czechia", date: "2026-06-11" },
    { teamA: "Canada", teamB: "Bosnia and Herzegovina", date: "2026-06-12" },
    { teamA: "USA", teamB: "Paraguay", date: "2026-06-12" },
    { teamA: "Qatar", teamB: "Switzerland", date: "2026-06-12" },
    { teamA: "Australia", teamB: "Türkiye", date: "2026-06-12" },
    { teamA: "Brazil", teamB: "Morocco", date: "2026-06-13" },
    { teamA: "Haiti", teamB: "Scotland", date: "2026-06-13" },
    { teamA: "Germany", teamB: "Curacao", date: "2026-06-13" },
    { teamA: "Ivory Coast", teamB: "Ecuador", date: "2026-06-13" },
    { teamA: "Netherlands", teamB: "Japan", date: "2026-06-14" },
    { teamA: "Sweden", teamB: "Tunisia", date: "2026-06-14" },
    { teamA: "Poland", teamB: "Senegal", date: "2026-06-14" },
    { teamA: "Saudi Arabia", teamB: "Uruguay", date: "2026-06-14" },
    { teamA: "Spain", teamB: "Cape Verde", date: "2026-06-15" },
    { teamA: "Belgium", teamB: "Egypt", date: "2026-06-15" },
    { teamA: "Iran", teamB: "New Zealand", date: "2026-06-15" },
    { teamA: "France", teamB: "Senegal", date: "2026-06-16" },
    { teamA: "Norway", teamB: "Iraq", date: "2026-06-16" },
    { teamA: "Argentina", teamB: "Algeria", date: "2026-06-16" },
    { teamA: "Austria", teamB: "Jordan", date: "2026-06-16" },
    { teamA: "Portugal", teamB: "TBD", date: "2026-06-17" },
    { teamA: "Colombia", teamB: "Uzbekistan", date: "2026-06-17" },
    { teamA: "England", teamB: "Croatia", date: "2026-06-17" },
    { teamA: "Ghana", teamB: "Panama", date: "2026-06-17" },
];

const TEAM_CODE: Record<string, string[]> = {
    Mexico: ["mex"],
    "South Africa": ["rsa", "south-africa"],
    "South Korea": ["kor", "south-korea"],
    Czechia: ["cze", "czechia", "czech-republic"],
    Canada: ["can"],
    "Bosnia and Herzegovina": ["bih", "bosnia"],
    USA: ["usa", "united-states"],
    Paraguay: ["par"],
    Qatar: ["qat"],
    Switzerland: ["sui", "switzerland"],
    Australia: ["aus"],
    Türkiye: ["tur", "turkiye", "turkey"],
    Brazil: ["bra"],
    Morocco: ["mar"],
    Haiti: ["hai"],
    Scotland: ["sco"],
    Germany: ["ger"],
    Curacao: ["cur", "curaçao", "curacao"],
    "Ivory Coast": ["civ", "ivory-coast", "cote-divoire"],
    Ecuador: ["ecu"],
    Netherlands: ["ned", "netherlands", "holland"],
    Japan: ["jpn", "japan"],
    Sweden: ["swe"],
    Tunisia: ["tun"],
    Poland: ["pol"],
    Senegal: ["sen"],
    "Saudi Arabia": ["ksa", "sau", "saudi-arabia"],
    Uruguay: ["uru"],
    Spain: ["esp", "spain"],
    "Cape Verde": ["cpv", "cape-verde"],
    Belgium: ["bel"],
    Egypt: ["egy"],
    Iran: ["irn", "iran"],
    "New Zealand": ["nzl", "new-zealand"],
    France: ["fra"],
    Norway: ["nor"],
    Iraq: ["irq", "iraq"],
    Argentina: ["arg"],
    Algeria: ["alg"],
    Austria: ["aut"],
    Jordan: ["jor"],
    Portugal: ["por"],
    Colombia: ["col"],
    Uzbekistan: ["uzb"],
    England: ["eng"],
    Croatia: ["cro"],
    Ghana: ["gha"],
    Panama: ["pan"],
};

async function fetchAllMarkets(): Promise<Market[]> {
    const all: Market[] = [];
    let offset = 0;
    const limit = 1000;

    while (true) {
        const url =
            `https://gamma-api.polymarket.com/markets` +
            `?limit=${limit}` +
            `&offset=${offset}` +
            `&active=true` +
            `&closed=false`;

        const res = await fetch(url);
        if (!res.ok) throw new Error(`Polymarket HTTP ${res.status}`);

        const data = (await res.json()) as Market[];
        all.push(...data);

        console.log(`offset=${offset}, got=${data.length}, total=${all.length}`);

        if (data.length < limit) break;
        offset += limit;
    }

    return all;
}

function norm(s: string): string {
    return s
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .replace(/&/g, "and")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

function getEvent(m: Market) {
    return m.events?.[0];
}

function getEventSlug(m: Market): string | undefined {
    return getEvent(m)?.slug;
}

function getEventTitle(m: Market): string | undefined {
    return getEvent(m)?.title;
}

function buildFixtureKey(fixture: Fixture): string {
    const aCodes = TEAM_CODE[fixture.teamA] || [norm(fixture.teamA)];
    const bCodes = TEAM_CODE[fixture.teamB] || [norm(fixture.teamB)];
    const date = fixture.date;

    return `${aCodes[0]}-${bCodes[0]}-${date}`;
}

function eventMatchesFixture(eventSlug: string, eventTitle: string, fixture: Fixture): boolean {
    const slug = norm(eventSlug);
    const title = norm(eventTitle);

    const aTokens = TEAM_CODE[fixture.teamA] || [norm(fixture.teamA)];
    const bTokens = TEAM_CODE[fixture.teamB] || [norm(fixture.teamB)];

    const date = fixture.date;

    const slugHasDate = slug.includes(date);
    const titleHasA = aTokens.some((x) => title.includes(norm(x))) || title.includes(norm(fixture.teamA));
    const titleHasB = bTokens.some((x) => title.includes(norm(x))) || title.includes(norm(fixture.teamB));

    const slugHasA = aTokens.some((x) => slug.includes(norm(x))) || slug.includes(norm(fixture.teamA));
    const slugHasB = bTokens.some((x) => slug.includes(norm(x))) || slug.includes(norm(fixture.teamB));

    return (slugHasDate && slugHasA && slugHasB) || (titleHasA && titleHasB);
}

function classifyOutcome(market: Market, fixture: Fixture): "HOME" | "AWAY" | "DRAW" | null {
    const text = norm(`${market.groupItemTitle || ""} ${market.question || ""} ${market.slug || ""}`);

    if (text.includes("draw")) return "DRAW";

    const homeTokens = [
        norm(fixture.teamA),
        ...(TEAM_CODE[fixture.teamA] || []).map(norm),
    ];

    const awayTokens = [
        norm(fixture.teamB),
        ...(TEAM_CODE[fixture.teamB] || []).map(norm),
    ];

    const hasHome = homeTokens.some((t) => text.includes(t));
    const hasAway = awayTokens.some((t) => text.includes(t));

    if (hasHome && !hasAway) return "HOME";
    if (hasAway && !hasHome) return "AWAY";

    const group = norm(market.groupItemTitle || "");
    if (homeTokens.some((t) => group === t || group.startsWith(`${t}-`))) return "HOME";
    if (awayTokens.some((t) => group === t || group.startsWith(`${t}-`))) return "AWAY";

    return null;
}

function pickBest(existing: Market | undefined, next: Market): Market {
    if (!existing) return next;

    const existingLiquidity = Number((existing as any).liquidityNum ?? existing.liquidity ?? 0);
    const nextLiquidity = Number((next as any).liquidityNum ?? (next as any).liquidity ?? 0);

    return nextLiquidity > existingLiquidity ? next : existing;
}

export async function buildWorldCupFixtureMarketsFile(): Promise<string> {
    const markets = await fetchAllMarkets();

    const fifaMarkets = markets.filter((m) => {
        const event = getEvent(m);
        return (
            event?.seriesSlug === "soccer-fifwc" ||
            getEventSlug(m)?.startsWith("fifwc-") ||
            m.slug?.startsWith("fifwc-")
        );
    });

    console.log("TOTAL MARKETS:", markets.length);
    console.log("FIFWC MARKETS:", fifaMarkets.length);

    const output: OutputRow[] = FIXTURES.map((fixture) => {
        const related = fifaMarkets.filter((m) => {
            const event = getEvent(m);
            return eventMatchesFixture(event?.slug || "", event?.title || "", fixture);
        });

        const outcomes: MatchOutcomeMarkets = {};
        let eventSlug: string | undefined;
        let eventTitle: string | undefined;

        for (const market of related) {
            eventSlug ||= getEventSlug(market);
            eventTitle ||= getEventTitle(market);

            const outcome = classifyOutcome(market, fixture);

            if (outcome === "HOME") outcomes.homeWin = pickBest(outcomes.homeWin, market);
            if (outcome === "AWAY") outcomes.awayWin = pickBest(outcomes.awayWin, market);
            if (outcome === "DRAW") outcomes.draw = pickBest(outcomes.draw, market);
        }

        console.log(`${fixture.teamA} vs ${fixture.teamB}`, {
            related: related.length,
            homeWin: !!outcomes.homeWin,
            awayWin: !!outcomes.awayWin,
            draw: !!outcomes.draw,
            eventSlug,
        });

        return { fixture, eventSlug, eventTitle, outcomes };
    });

    const dir = path.join(process.cwd(), "data");
    await fs.mkdir(dir, { recursive: true });

    const file = path.join(dir, `worldcup-fixture-markets-${Date.now()}.json`);
    await fs.writeFile(file, JSON.stringify(output, null, 2), "utf8");

    console.log("saved:", file);
    return file;
}

if (import.meta.url === `file://${process.argv[1]}`) {
    buildWorldCupFixtureMarketsFile().catch((err) => {
        console.error(err);
        process.exit(1);
    });
}