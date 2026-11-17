"use client";

import { useEffect, useState } from "react";

type Weather = {
  city: string;
  date: string;
  condition: string;
  tempMax: number;
  tempMin: number;
  rainProbability: number;
  source?: string;
};
type Tsmc = {
  symbol: string;
  name: string;
  tradingDate: string;
  open: string;
  high: string;
  low: string;
  close: string;
  change: string;
  volumeShares: string;
};
type News = {
  title: string;
  link: string;
  publishedAt: string;
  summary: string;
};
type Brief = {
  date: string;
  weather: Weather | null;
  tsmc: Tsmc | null;
  news: News[] | null;
  ai: {
    weatherSummary: string;
    stockSummary: string;
    newsSummary: string;
    encouragement: string;
  } | null;
  errors: Partial<Record<"weather" | "tsmc" | "news" | "ai", string>>;
};

function Card({
  title,
  children,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 ${className}`}
    >
      <h2 className="mb-3 text-sm font-semibold tracking-wide text-zinc-500 dark:text-zinc-400">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Unavailable({ reason }: { reason?: string }) {
  return (
    <p className="text-sm text-red-600 dark:text-red-400">
      資料取得失敗{reason ? `:${reason.slice(0, 120)}` : ""}
    </p>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-zinc-500 dark:text-zinc-400">{label}</div>
      <div className="font-medium tabular-nums">{value}</div>
    </div>
  );
}

export default function DailyBrief() {
  const [data, setData] = useState<Brief | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [tick, setTick] = useState(0); // 每次 +1 就重新抓一次

  useEffect(() => {
    let cancelled = false;
    fetch("/api/daily-brief", { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<Brief>;
      })
      .then((json) => {
        if (cancelled) return;
        setData(json);
        setError(null);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tick]);

  const refresh = () => {
    setLoading(true);
    setTick((t) => t + 1);
  };

  const change = data?.tsmc ? Number(data.tsmc.change.replace(/,/g, "")) : 0;
  // 台股慣例:上漲紅、下跌綠
  const changeColor =
    change > 0
      ? "text-red-600 dark:text-red-400"
      : change < 0
        ? "text-green-600 dark:text-green-400"
        : "";

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:py-14">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            每日晨報
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {data ? data.date : "—"} · 天氣、台積電、科技新聞與今日鼓勵
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="shrink-0 rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          {loading ? "載入中…" : "重新整理"}
        </button>
      </header>

      {loading && !data && (
        <p className="py-16 text-center text-zinc-500 dark:text-zinc-400">
          正在整理今天的資訊,約需 10 秒…
        </p>
      )}

      {error && (
        <div className="mb-6 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          無法取得 /api/daily-brief:{error}
        </div>
      )}

      {data && (
        <div className="flex flex-col gap-5">
          <Card
            title="💬 今日鼓勵"
            className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950"
          >
            {data.ai ? (
              <p className="text-lg leading-8">{data.ai.encouragement}</p>
            ) : (
              <Unavailable reason={data.errors.ai} />
            )}
          </Card>

          <Card title="🌤 今日天氣">
            {data.weather ? (
              <>
                <div className="mb-3 flex flex-wrap items-baseline gap-x-6 gap-y-2">
                  <div className="text-xl font-semibold">
                    {data.weather.city} · {data.weather.condition}
                  </div>
                  <Stat
                    label="氣溫"
                    value={`${data.weather.tempMin}–${data.weather.tempMax}°C`}
                  />
                  <Stat
                    label="降雨機率"
                    value={`${data.weather.rainProbability}%`}
                  />
                </div>
                {data.ai && (
                  <p className="leading-7 text-zinc-700 dark:text-zinc-300">
                    {data.ai.weatherSummary}
                  </p>
                )}
                <p className="mt-2 text-xs text-zinc-400">
                  {data.weather.date}
                  {data.weather.source ? ` · 來源 ${data.weather.source}` : ""}
                </p>
              </>
            ) : (
              <Unavailable reason={data.errors.weather} />
            )}
          </Card>

          <Card title="📈 台積電 (2330) 昨日股價">
            {data.tsmc ? (
              <>
                <div className="mb-4 flex items-baseline gap-3">
                  <span
                    className={`text-3xl font-bold tabular-nums ${changeColor}`}
                  >
                    {data.tsmc.close}
                  </span>
                  <span className={`font-medium tabular-nums ${changeColor}`}>
                    {change > 0 ? "▲" : change < 0 ? "▼" : ""} {data.tsmc.change}
                  </span>
                  <span className="text-xs text-zinc-400">
                    交易日 {data.tsmc.tradingDate}
                  </span>
                </div>
                <div className="mb-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <Stat label="開盤" value={data.tsmc.open} />
                  <Stat label="最高" value={data.tsmc.high} />
                  <Stat label="最低" value={data.tsmc.low} />
                  <Stat label="成交股數" value={data.tsmc.volumeShares} />
                </div>
                {data.ai && (
                  <p className="leading-7 text-zinc-700 dark:text-zinc-300">
                    {data.ai.stockSummary}
                  </p>
                )}
              </>
            ) : (
              <Unavailable reason={data.errors.tsmc} />
            )}
          </Card>

          <Card title="📰 科技新聞">
            {data.ai && (
              <p className="mb-4 rounded-lg bg-zinc-100 p-3 leading-7 dark:bg-zinc-800">
                {data.ai.newsSummary}
              </p>
            )}
            {data.news ? (
              <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {data.news.map((n) => (
                  <li key={n.link} className="py-3 first:pt-0 last:pb-0">
                    <a
                      href={n.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium hover:underline"
                    >
                      {n.title}
                    </a>
                    <p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                      {n.summary}
                    </p>
                    <p className="mt-1 text-xs text-zinc-400">
                      {new Date(n.publishedAt).toLocaleString("zh-TW")}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <Unavailable reason={data.errors.news} />
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
