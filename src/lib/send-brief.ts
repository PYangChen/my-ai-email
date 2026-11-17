import { getDailyBrief, type DailyBrief } from "@/lib/daily-brief";
import { buildEmail } from "@/lib/email-template";
import { connectDB } from "@/lib/mongodb";
import { EmailLog } from "@/models/EmailLog";

// 寄件人 / 收信人寫死在程式碼中
// 寄件人使用 Resend 預設寄件人(免驗證網域;未驗證網域時只能寄到 Resend 帳號本人信箱)
const FROM = "Daily Brief <onboarding@resend.dev>";
const TO = "cell.poyang@gmail.com";

// 簡單頻率限制:30 秒內只允許寄一次(單一 server 程序內有效)
const COOLDOWN_MS = 30_000;
let lastSentAt = 0;

export type SendResult =
  | {
      ok: true;
      id?: string;
      to: string;
      subject: string;
      dbSaved: boolean;
      dbError?: string;
    }
  | { ok: false; error: string; status: number; dbSaved?: boolean };

type LogInput = {
  status: "sent" | "failed";
  error?: string;
  subject?: string;
  resendId?: string;
  brief?: DailyBrief;
  html?: string;
};

// 存進 MongoDB。失敗只回報,不影響寄信結果(信已經寄出了)
async function saveLog(
  input: LogInput,
): Promise<{ saved: boolean; dbError?: string }> {
  try {
    await connectDB();
    await EmailLog.create({
      ...input,
      subject: input.subject ?? "(未產生)",
      from: FROM,
      to: TO,
      sentAt: new Date(),
    });
    return { saved: true };
  } catch (e) {
    const dbError = e instanceof Error ? e.message : String(e);
    console.error("[send-brief] 存入 MongoDB 失敗:", dbError);
    return { saved: false, dbError };
  }
}

// 產生晨報 → 寄信 → 存 MongoDB。排程 API 與網頁按鈕共用。
export async function sendBriefEmail(): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return { ok: false, error: "缺少 RESEND_API_KEY", status: 500 };

  const wait = lastSentAt + COOLDOWN_MS - Date.now();
  if (wait > 0) {
    return {
      ok: false,
      error: `請稍候 ${Math.ceil(wait / 1000)} 秒後再寄`,
      status: 429,
    };
  }
  lastSentAt = Date.now(); // 先占位,避免並發連按

  let brief: DailyBrief | undefined;
  let subject: string | undefined;
  let html: string | undefined;

  try {
    brief = await getDailyBrief();
    const email = buildEmail(brief);
    subject = email.subject;
    html = email.html;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ from: FROM, to: [TO], subject, html, text: email.text }),
      signal: AbortSignal.timeout(20000),
    });
    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      lastSentAt = 0; // 失敗不算一次,允許立刻重試
      const error = body?.message ?? `Resend ${res.status}`;
      const db = await saveLog({ status: "failed", error, subject, brief, html });
      return { ok: false, error, status: 502, dbSaved: db.saved };
    }

    const db = await saveLog({
      status: "sent",
      subject,
      resendId: body.id,
      brief,
      html,
    });
    return {
      ok: true,
      id: body.id,
      to: TO,
      subject,
      dbSaved: db.saved,
      dbError: db.dbError,
    };
  } catch (e) {
    lastSentAt = 0;
    const error = e instanceof Error ? e.message : String(e);
    const db = await saveLog({ status: "failed", error, subject, brief, html });
    return { ok: false, error, status: 500, dbSaved: db.saved };
  }
}
