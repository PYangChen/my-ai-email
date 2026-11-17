import { after, NextResponse } from "next/server";
import { isAuthorized } from "@/lib/auth";
import { sendBriefEmail } from "@/lib/send-brief";

// 背景工作(after)可執行的最長秒數。產生晨報 + OpenAI + 寄信約 10~20 秒,留點餘裕。
// 部署平台若有上限(例如 Vercel Hobby 為 60 秒),請設在上限以內。
export const maxDuration = 60;

// 需要標頭:Authorization: Bearer <CRON_SECRET>
// 供 cron-job.org 排程呼叫;GET 與 POST 都接受(cron-job.org 預設是 GET)。
//
// 為了不讓排程服務等到逾時(cron-job.org 約 30 秒),驗證通過後立刻回 202,
// 實際的「產生晨報 → 寄信 → 存 MongoDB」在回應送出後於背景執行。
// 因此回 202 只代表「已受理」,不代表信已寄出;結果請看 server log 與 MongoDB 的 emaillogs。
async function handle(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  after(async () => {
    try {
      const result = await sendBriefEmail();
      if (result.ok) {
        console.log(
          `[send-email] 已寄出 id=${result.id} dbSaved=${result.dbSaved}` +
            (result.dbError ? ` dbError=${result.dbError}` : ""),
        );
      } else {
        console.error(`[send-email] 寄信失敗 (${result.status}): ${result.error}`);
      }
    } catch (e) {
      console.error("[send-email] 背景工作發生未預期錯誤:", e);
    }
  });

  return NextResponse.json(
    { ok: true, accepted: true, message: "已受理,正在背景寄信" },
    { status: 202 },
  );
}

export const GET = handle;
export const POST = handle;
