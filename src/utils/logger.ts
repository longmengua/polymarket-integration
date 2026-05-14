import pino from "pino";
import { env } from "../config/env.js";

/**
 * 全專案共用 logger。
 *
 * development:
 * - 使用 pino-pretty，方便本機閱讀。
 *
 * production:
 * - 輸出 JSON structured log，方便 log collector / cloud logging 收集。
 */
export const logger = pino({
  // LOG_LEVEL 可用 info / debug / warn / error 等 pino level。
  level: env.LOG_LEVEL,
  transport:
    env.NODE_ENV === "development"
      ? {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:standard",
            ignore: "pid,hostname"
          }
        }
      : undefined
});
