import { timingSafeEqual } from "node:crypto";

// 檢查 `Authorization: Bearer <CRON_SECRET>`。
// 沒設定 CRON_SECRET 時一律拒絕(fail closed)。
export function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;

  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(request.headers.get("authorization") ?? "");
  // 長度不同時 timingSafeEqual 會丟錯,所以先比長度;比對本身用定時比較防止時序攻擊
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
