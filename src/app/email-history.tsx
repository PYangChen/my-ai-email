"use client";

import { useEffect, useState } from "react";
import type { DailyBrief } from "@/lib/daily-brief";

type Log = {
  _id: string;
  status: "sent" | "failed";
  error?: string;
  from: string;
  to: string;
  subject: string;
  resendId?: string;
  sentAt: string;
  brief?: DailyBrief;
  html?: string;
};

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("zh-TW", { timeZone: "Asia/Taipei", hour12: false });

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-zinc-50 p-4 dark:bg-zinc-800/60">
      <h4 className="mb-2 text-xs font-semibold tracking-wide text-zinc-500 dark:text-zinc-400">
        {title}
      </h4>
      {children}
    </div>
  );
}

function BriefView({ brief }: { brief: DailyBrief }) {
  const { weather, tsmc, news, ai } = brief;
  const change = tsmc ? Number(tsmc.change.replace(/,/g, "")) : 0;
  // 台股慣例:上漲紅、下跌綠
  const color =
    change > 0 ? "text-red-600 dark:text-red-400" : change < 0 ? "text-green-600 dark:text-green-400" : "";

  return (
    <div className="flex flex-col gap-3">
      {ai && (
        <Section title="💬 今日鼓勵">
          <p className="leading-7">{ai.encouragement}</p>
        </Section>
      )}
      {weather && (
        <Section title="🌤 天氣">
          <p className="font-medium">
            {weather.city} · {weather.condition} · {weather.tempMin}–{weather.tempMax}°C · 降雨 {weather.rainProbability}%
          </p>
          {ai && <p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-300">{ai.weatherSummary}</p>}
        </Section>
      )}
      {tsmc && (
        <Section title="📈 台積電 (2330)">
          <p className={`font-medium tabular-nums ${color}`}>
            {tsmc.tradingDate} 收盤 {tsmc.close}({tsmc.change})
          </p>
          <p className="text-sm tabular-nums text-zinc-500 dark:text-zinc-400">
            開 {tsmc.open} · 高 {tsmc.high} · 低 {tsmc.low} · 量 {tsmc.volumeShares}
          </p>
          {ai && <p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-300">{ai.stockSummary}</p>}
        </Section>
      )}
      {news && (
        <Section title="📰 科技新聞">
          {ai && <p className="mb-3 text-sm leading-6">{ai.newsSummary}</p>}
          <ul className="flex flex-col gap-2">
            {news.map((n) => (
              <li key={n.link}>
                <a
                  href={/^https?:\/\//i.test(n.link) ? n.link : undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium hover:underline"
                >
                  {n.title}
                </a>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}

function LogItem({ log }: { log: Log }) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<{ state: "idle" | "loading" | "ready" | "error"; html?: string; error?: string }>({ state: "idle" });

  const loadPreview = async () => {
    setPreview({ state: "loading" });
    try {
      const res = await fetch(`/api/email-logs?id=${log._id}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setPreview({ state: "ready", html: json.log.html ?? "" });
    } catch (e) {
      setPreview({ state: "error", error: e instanceof Error ? e.message : String(e) });
    }
  };

  const sent = log.status === "sent";

  return (
    <li className="rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 p-4 text-left"
      >
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
            sent
              ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
              : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
          }`}
        >
          {sent ? "已寄出" : "失敗"}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{log.subject}</span>
          <span className="block text-xs text-zinc-500 dark:text-zinc-400">
            {fmt(log.sentAt)} · 寄給 {log.to}
          </span>
        </span>
        <span className="shrink-0 text-zinc-400">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="flex flex-col gap-3 border-t border-zinc-200 p-4 dark:border-zinc-800">
          {!sent && log.error && (
            <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
              失敗原因:{log.error}
            </p>
          )}
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            寄件人 {log.from}
            {log.resendId ? ` · Resend ID ${log.resendId}` : ""}
          </p>

          {log.brief ? <BriefView brief={log.brief} /> : <p className="text-sm text-zinc-500">這筆紀錄沒有晨報內容。</p>}

          <div>
            {preview.state === "idle" && (
              <button
                onClick={loadPreview}
                className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                預覽實際寄出的信件
              </button>
            )}
            {preview.state === "loading" && <p className="text-sm text-zinc-500">載入信件中…</p>}
            {preview.state === "error" && (
              <p className="text-sm text-red-600 dark:text-red-400">載入失敗:{preview.error}</p>
            )}
            {preview.state === "ready" &&
              (preview.html ? (
                // sandbox 為空 = 不執行任何腳本,避免信件內容影響頁面
                <iframe
                  title={`信件預覽 ${log.subject}`}
                  sandbox=""
                  srcDoc={preview.html}
                  className="h-[640px] w-full rounded-xl border border-zinc-200 bg-white dark:border-zinc-700"
                />
              ) : (
                <p className="text-sm text-zinc-500">這筆紀錄沒有保存信件內容。</p>
              ))}
          </div>
        </div>
      )}
    </li>
  );
}

export default function EmailHistory() {
  const [logs, setLogs] = useState<Log[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/email-logs", { cache: "no-store" })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
        return json as { logs: Log[]; total: number };
      })
      .then((json) => {
        if (cancelled) return;
        setLogs(json.logs);
        setTotal(json.total);
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

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:py-14">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">寄信紀錄</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            每日晨報的寄送歷史{logs ? ` · 共 ${total} 筆,顯示最近 ${logs.length} 筆` : ""}
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

      {error && (
        <div className="mb-6 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          無法讀取寄信紀錄:{error}
        </div>
      )}

      {loading && !logs && (
        <p className="py-16 text-center text-zinc-500 dark:text-zinc-400">載入中…</p>
      )}

      {logs && logs.length === 0 && !error && (
        <p className="py-16 text-center text-zinc-500 dark:text-zinc-400">
          還沒有任何寄信紀錄。排程第一次執行後,就會出現在這裡。
        </p>
      )}

      {logs && logs.length > 0 && (
        <ul className="flex flex-col gap-3">
          {logs.map((log) => (
            <LogItem key={log._id} log={log} />
          ))}
        </ul>
      )}
    </div>
  );
}
