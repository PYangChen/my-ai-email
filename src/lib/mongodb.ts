import mongoose from "mongoose";

// 把連線快取在 globalThis,避免開發時熱重載重複建立連線
const globalForMongoose = globalThis as unknown as {
  mongoose?: {
    conn: typeof mongoose | null;
    promise: Promise<typeof mongoose> | null;
  };
};

const cached = (globalForMongoose.mongoose ??= { conn: null, promise: null });

export async function connectDB() {
  // 在呼叫時才檢查,避免模組載入階段就丟錯而讓整支 API 掛掉
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) throw new Error("缺少 MONGODB_URI");

  if (cached.conn) return cached.conn;

  cached.promise ??= mongoose.connect(uri, {
    bufferCommands: false,
    serverSelectionTimeoutMS: 8000, // 連不上時 8 秒就放棄,不要卡住寄信流程
  });

  try {
    cached.conn = await cached.promise;
  } catch (err) {
    cached.promise = null;
    throw err;
  }
  return cached.conn;
}
