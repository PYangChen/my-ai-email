const TZ = "Asia/Taipei";
// 台北座標;如要改城市,改這裡即可
const LOCATION = { name: "台北", latitude: 25.033, longitude: 121.5654 };
const RSS_URL = "https://technews.tw/feed/"; // 科技新報;可換成任何科技新聞 RSS
const NEWS_LIMIT = 5;

// ---------- 工具 ----------
function taipeiDate(offsetDays = 0): Date {
  const now = new Date(Date.now() + offsetDays * 86400000);
  return now;
}
function ymd(d: Date): string {
  // en-CA 會輸出 YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
}

// ---------- 天氣 (Open-Meteo, 免 token) ----------
const WMO: Record<number, string> = {
  0: "晴", 1: "大致晴朗", 2: "局部多雲", 3: "陰",
  45: "霧", 48: "霧凇", 51: "毛毛雨", 53: "毛毛雨", 55: "強毛毛雨",
  61: "小雨", 63: "中雨", 65: "大雨", 80: "陣雨", 81: "陣雨", 82: "強陣雨",
  95: "雷雨", 96: "雷雨夾冰雹", 99: "強雷雨夾冰雹",
};

// 備援:wttr.in (免 token)。Open-Meteo 連不上時使用
async function getWeatherFallback() {
  const res = await fetch("https://wttr.in/Taipei?format=j1", {
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`wttr.in ${res.status}`);
  const day = (await res.json()).weather[0];
  const rain = Math.max(...day.hourly.map((h: { chanceofrain: string }) => Number(h.chanceofrain)));
  return {
    city: LOCATION.name,
    date: day.date,
    condition: day.hourly[4]?.weatherDesc?.[0]?.value ?? "未知",
    tempMax: Number(day.maxtempC),
    tempMin: Number(day.mintempC),
    rainProbability: rain,
    source: "wttr.in",
  };
}

async function getWeather() {
  // 兩個來源同時請求,取最先成功的;避免主來源逾時時白等
  return Promise.any([getWeatherPrimary(), getWeatherFallback()]);
}

async function getWeatherPrimary() {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${LOCATION.latitude}` +
    `&longitude=${LOCATION.longitude}` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
    `&timezone=${encodeURIComponent(TZ)}&forecast_days=1`;
  const res = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
  const d = (await res.json()).daily;
  return {
    city: LOCATION.name,
    date: d.time[0],
    condition: WMO[d.weather_code[0]] ?? `代碼 ${d.weather_code[0]}`,
    tempMax: d.temperature_2m_max[0],
    tempMin: d.temperature_2m_min[0],
    rainProbability: d.precipitation_probability_max[0],
  };
}

// ---------- 台積電昨日股價 (台灣證交所公開 API, 免 token) ----------
async function fetchTwseMonth(yyyymmdd: string) {
  const url = `https://www.twse.com.tw/exchangeReport/STOCK_DAY?response=json&date=${yyyymmdd}&stockNo=2330`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`TWSE ${res.status}`);
  const json = await res.json();
  return (json.data ?? []) as string[][];
}

async function getTsmc() {
  // 取「昨天(含)以前最近一個交易日」,週末/假日會自動往前找
  const yesterday = taipeiDate(-1);
  const target = ymd(yesterday); // YYYY-MM-DD
  let rows = await fetchTwseMonth(target.replace(/-/g, ""));

  const toIso = (roc: string) => {
    const [y, m, d] = roc.split("/");
    return `${Number(y) + 1911}-${m}-${d}`;
  };
  let candidates = rows.filter((r) => toIso(r[0]) <= target);

  // 若月初時本月還沒有符合的資料,退到上個月
  if (candidates.length === 0) {
    const [y, m] = target.split("-").map(Number);
    const prevMonth = new Date(Date.UTC(y, m - 2, 1));
    rows = await fetchTwseMonth(ymd(prevMonth).replace(/-/g, ""));
    candidates = rows;
  }
  const last = candidates[candidates.length - 1];
  if (!last) throw new Error("查無台積電交易資料");

  // 欄位: 日期, 成交股數, 成交金額, 開盤, 最高, 最低, 收盤, 漲跌價差, 成交筆數
  return {
    symbol: "2330",
    name: "台積電",
    tradingDate: toIso(last[0]),
    open: last[3],
    high: last[4],
    low: last[5],
    close: last[6],
    change: last[7],
    volumeShares: last[1],
  };
}

// ---------- 科技新聞 (RSS, 手動解析, 免額外套件) ----------
function decode(s: string) {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/\s*\[…\]\s*$/, "…")
    .trim();
}
function tag(block: string, name: string) {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  return m ? decode(m[1]) : "";
}

async function getTechNews() {
  const res = await fetch(RSS_URL, {
    cache: "no-store",
    headers: { "User-Agent": "Mozilla/5.0 (daily-brief)" },
  });
  if (!res.ok) throw new Error(`RSS ${res.status}`);
  const xml = await res.text();
  const items = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ?? [];
  return items.slice(0, NEWS_LIMIT).map((it) => ({
    title: tag(it, "title"),
    link: tag(it, "link"),
    publishedAt: tag(it, "pubDate"),
    summary: tag(it, "description").slice(0, 150),
  }));
}

// ---------- OpenAI 統整 ----------
async function summarize(data: {
  weather: unknown;
  tsmc: unknown;
  news: unknown;
}) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("缺少 OPENAI_API_KEY");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "你是貼心的每日晨報助理。請用繁體中文,根據使用者提供的資料,輸出 JSON,格式為 " +
            '{"weatherSummary": string, "stockSummary": string, "newsSummary": string, "encouragement": string}。' +
            "weatherSummary 含穿著/帶傘建議;stockSummary 只陳述事實,不給投資建議;" +
            "newsSummary 用 2-3 句總結重點;encouragement 是一段溫暖、真誠、呼應今天資訊的鼓勵話語。",
        },
        { role: "user", content: JSON.stringify(data) },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return JSON.parse(json.choices[0].message.content);
}

// ---------- 對外:組出完整晨報 ----------
export async function getDailyBrief() {
  // 三個外部來源各自容錯,單一失敗不會讓整支 API 掛掉
  const [weather, tsmc, news] = await Promise.allSettled([
    getWeather(),
    getTsmc(),
    getTechNews(),
  ]);
  const val = <T,>(r: PromiseSettledResult<T>) =>
    r.status === "fulfilled" ? r.value : null;
  const err = (r: PromiseSettledResult<unknown>) =>
    r.status === "rejected" ? String(r.reason?.message ?? r.reason) : undefined;

  const data = { weather: val(weather), tsmc: val(tsmc), news: val(news) };

  let ai = null;
  let aiError: string | undefined;
  try {
    ai = await summarize(data);
  } catch (e) {
    aiError = e instanceof Error ? e.message : String(e);
  }

  return {
    date: ymd(taipeiDate()),
    ...data,
    ai,
    errors: {
      weather: err(weather),
      tsmc: err(tsmc),
      news: err(news),
      ai: aiError,
    },
  };
}

export type DailyBrief = Awaited<ReturnType<typeof getDailyBrief>>;
