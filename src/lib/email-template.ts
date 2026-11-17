import type { DailyBrief } from "./daily-brief";

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// 只允許 http(s) 連結,避免 javascript: 之類的網址
function safeUrl(u: string): string {
  return /^https?:\/\//i.test(u) ? esc(u) : "#";
}

const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans TC','PingFang TC','Microsoft JhengHei',Arial,sans-serif";

function card(title: string, inner: string, bg = "#ffffff", border = "#e4e4e7") {
  return `
  <tr><td style="padding:0 0 16px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${bg};border:1px solid ${border};border-radius:12px;">
      <tr><td style="padding:20px;font-family:${FONT};color:#18181b;">
        <div style="font-size:13px;font-weight:600;color:#71717a;margin:0 0 12px 0;">${title}</div>
        ${inner}
      </td></tr>
    </table>
  </td></tr>`;
}

function failed(reason?: string) {
  return `<div style="font-size:14px;color:#dc2626;">資料取得失敗${
    reason ? `:${esc(reason.slice(0, 100))}` : ""
  }</div>`;
}

function stat(label: string, value: string) {
  return `<td style="padding:0 20px 8px 0;font-family:${FONT};">
    <div style="font-size:12px;color:#71717a;">${esc(label)}</div>
    <div style="font-size:15px;font-weight:600;color:#18181b;">${esc(value)}</div>
  </td>`;
}

export function buildEmail(b: DailyBrief): {
  subject: string;
  html: string;
  text: string;
} {
  const { weather, tsmc, news, ai, errors } = b;
  const subject = `每日晨報 ${b.date}`;

  const change = tsmc ? Number(tsmc.change.replace(/,/g, "")) : 0;
  // 台股慣例:上漲紅、下跌綠
  const changeColor = change > 0 ? "#dc2626" : change < 0 ? "#16a34a" : "#18181b";
  const arrow = change > 0 ? "▲" : change < 0 ? "▼" : "";

  const p = (s: string) =>
    `<p style="margin:12px 0 0 0;font-size:15px;line-height:1.7;color:#3f3f46;">${esc(s)}</p>`;

  const encouragement = card(
    "💬 今日鼓勵",
    ai
      ? `<div style="font-size:17px;line-height:1.8;">${esc(ai.encouragement)}</div>`
      : failed(errors.ai),
    "#fffbeb",
    "#fde68a",
  );

  const weatherCard = card(
    "🌤 今日天氣",
    weather
      ? `<div style="font-size:19px;font-weight:700;margin:0 0 12px 0;">${esc(weather.city)} · ${esc(weather.condition)}</div>
         <table role="presentation" cellpadding="0" cellspacing="0"><tr>
           ${stat("氣溫", `${weather.tempMin}–${weather.tempMax}°C`)}
           ${stat("降雨機率", `${weather.rainProbability}%`)}
         </tr></table>
         ${ai ? p(ai.weatherSummary) : ""}`
      : failed(errors.weather),
  );

  const stockCard = card(
    "📈 台積電 (2330) 昨日股價",
    tsmc
      ? `<div style="margin:0 0 12px 0;">
           <span style="font-size:30px;font-weight:700;color:${changeColor};">${esc(tsmc.close)}</span>
           <span style="font-size:15px;font-weight:600;color:${changeColor};margin-left:8px;">${arrow} ${esc(tsmc.change)}</span>
           <span style="font-size:12px;color:#a1a1aa;margin-left:8px;">交易日 ${esc(tsmc.tradingDate)}</span>
         </div>
         <table role="presentation" cellpadding="0" cellspacing="0"><tr>
           ${stat("開盤", tsmc.open)}${stat("最高", tsmc.high)}${stat("最低", tsmc.low)}${stat("成交股數", tsmc.volumeShares)}
         </tr></table>
         ${ai ? p(ai.stockSummary) : ""}`
      : failed(errors.tsmc),
  );

  const newsCard = card(
    "📰 科技新聞",
    `${
      ai
        ? `<div style="background:#f4f4f5;border-radius:8px;padding:12px;font-size:15px;line-height:1.7;margin:0 0 16px 0;">${esc(ai.newsSummary)}</div>`
        : ""
    }${
      news
        ? news
            .map(
              (n) => `<div style="padding:12px 0;border-top:1px solid #e4e4e7;">
              <a href="${safeUrl(n.link)}" style="font-size:16px;font-weight:600;color:#18181b;text-decoration:none;">${esc(n.title)}</a>
              <div style="font-size:14px;line-height:1.6;color:#52525b;margin-top:4px;">${esc(n.summary)}</div>
              <div style="font-size:12px;color:#a1a1aa;margin-top:4px;">${esc(new Date(n.publishedAt).toLocaleString("zh-TW", { timeZone: "Asia/Taipei" }))}</div>
            </div>`,
            )
            .join("")
        : failed(errors.news)
    }`,
  );

  const html = `<!doctype html>
<html lang="zh-TW"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#f4f4f5;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;">
    <tr><td align="center" style="padding:24px 12px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">
        <tr><td style="padding:0 0 16px 0;font-family:${FONT};">
          <div style="font-size:26px;font-weight:700;color:#18181b;">每日晨報</div>
          <div style="font-size:14px;color:#71717a;margin-top:4px;">${esc(b.date)} · 天氣、台積電、科技新聞與今日鼓勵</div>
        </td></tr>
        ${encouragement}${weatherCard}${stockCard}${newsCard}
        <tr><td style="padding:8px 0 0 0;font-family:${FONT};font-size:12px;color:#a1a1aa;text-align:center;">此信由 my-ai-email 自動產生</td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  // 純文字版本(給不支援 HTML 的信箱)
  const lines: string[] = [`每日晨報 ${b.date}`, ""];
  if (ai) lines.push("【今日鼓勵】", ai.encouragement, "");
  if (weather)
    lines.push(
      "【今日天氣】",
      `${weather.city} ${weather.condition},${weather.tempMin}–${weather.tempMax}°C,降雨機率 ${weather.rainProbability}%`,
      ...(ai ? [ai.weatherSummary] : []),
      "",
    );
  if (tsmc)
    lines.push(
      "【台積電 2330 昨日股價】",
      `${tsmc.tradingDate} 收盤 ${tsmc.close}(${tsmc.change}),開 ${tsmc.open} 高 ${tsmc.high} 低 ${tsmc.low}`,
      ...(ai ? [ai.stockSummary] : []),
      "",
    );
  if (news) {
    lines.push("【科技新聞】");
    if (ai) lines.push(ai.newsSummary, "");
    news.forEach((n, i) => lines.push(`${i + 1}. ${n.title}`, `   ${n.link}`));
  }

  return { subject, html, text: lines.join("\n") };
}
