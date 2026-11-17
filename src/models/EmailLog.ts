import mongoose, { type InferSchemaType, type Model } from "mongoose";

// 每次寄信(成功或失敗)留一筆紀錄
const emailLogSchema = new mongoose.Schema(
  {
    status: { type: String, enum: ["sent", "failed"], required: true },
    error: { type: String }, // 失敗原因
    from: { type: String, required: true },
    to: { type: String, required: true },
    subject: { type: String, required: true },
    resendId: { type: String }, // Resend 回傳的信件 ID
    sentAt: { type: Date, required: true, default: () => new Date() },
    // 當次寄出的晨報內容快照
    brief: { type: mongoose.Schema.Types.Mixed },
    html: { type: String },
  },
  { timestamps: true },
);

export type EmailLogDoc = InferSchemaType<typeof emailLogSchema>;

export const EmailLog: Model<EmailLogDoc> =
  mongoose.models.EmailLog ??
  mongoose.model<EmailLogDoc>("EmailLog", emailLogSchema);
