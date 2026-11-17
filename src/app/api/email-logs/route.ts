import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { EmailLog } from "@/models/EmailLog";

// GET /api/email-logs            → 最近的寄信紀錄(不含信件 HTML,避免資料量過大)
// GET /api/email-logs?limit=50   → 指定筆數(1~100,預設 30)
// GET /api/email-logs?id=<_id>   → 單筆完整紀錄(含信件 HTML,供預覽)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    await connectDB();

    const id = searchParams.get("id");
    if (id) {
      if (!mongoose.isValidObjectId(id)) {
        return NextResponse.json({ ok: false, error: "id 格式不正確" }, { status: 400 });
      }
      const doc = await EmailLog.findById(id).lean();
      if (!doc) {
        return NextResponse.json({ ok: false, error: "找不到這筆紀錄" }, { status: 404 });
      }
      return NextResponse.json({ ok: true, log: { ...doc, _id: String(doc._id) } });
    }

    const limit = Math.min(
      Math.max(Number(searchParams.get("limit")) || 30, 1),
      100,
    );
    const [docs, total] = await Promise.all([
      EmailLog.find()
        .sort({ sentAt: -1 })
        .limit(limit)
        .select("-html")
        .lean(),
      EmailLog.estimatedDocumentCount(),
    ]);

    return NextResponse.json({
      ok: true,
      total,
      logs: docs.map((d) => ({ ...d, _id: String(d._id) })),
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
