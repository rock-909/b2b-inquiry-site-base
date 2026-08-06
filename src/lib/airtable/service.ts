/**
 * Airtable 核心服务类
 */

import "server-only";

// 动态引入 Airtable，避免构建期和初始化顺序问题
// import type 仅用于类型提示，实际模块在运行时按需加载
import type AirtableNS from "airtable";
import type {
  CreatedAirtableRecord,
  ProductLeadData,
} from "@/lib/airtable/types";
import { env, getRuntimeEnvString } from "@/lib/env";
import { logger } from "@/lib/logger";
import { resolveAirtableModule } from "@/lib/airtable/service-internal/client";
import { createLeadRecord } from "@/lib/airtable/service-internal/lead-records";

/**
 * Airtable 单次请求预算（毫秒）。
 *
 * Airtable SDK 默认 requestTimeout 为 300000ms（5 分钟）。对 B2B 买家提交表单
 * 而言，这意味着 CRM 挂起时响应可能被拖到几分钟，属于不可接受的等待。
 *
 * 取值 8000ms 的依据：
 * - Airtable 单条记录写入 p50 约 150-300ms、p99 一般在 2s 以内；
 * - 8s 约为默认 300s 的 1/37，远低于“分钟级”，买家绝不会等到几分钟。
 *
 * 这个值管两层：传给 SDK 的 requestTimeout 管单次 HTTP 尝试，process-lead.ts
 * 的 withAirtableBudget 管整条链路的墙上时间。
 *
 * 限流重试怎么算：airtable 0.12.2 的退避是
 * `Math.random() * min(600000, 5000 * 2^已重试次数)`（见
 * node_modules/airtable/lib/internal_config.json 与
 * exponential_backoff_with_jitter.js），首次退避是 0-5 秒均匀分布，而且这段
 * 等待不计入 requestTimeout。所以单次 429 的总耗时 = 首轮请求 + U(0,5s) +
 * 重试请求，按上面的 p50 算中位约 3s，通常仍落在 8s 里；连续 429 才会耗尽预算。
 * 预算到期按超时降级成一条非阻塞错误日志——宁可丢 CRM 记录，也不让买家干等，
 * 业主邮件才是主通道。
 *
 * inquiry 路由串行执行：先发业主邮件，拿到结果再写 Airtable，好把「这封通知
 * 没发出去」一次性写进同一条记录。任一通道成功即视为用户成功。
 */
export const AIRTABLE_REQUEST_TIMEOUT_MS = 8000;

type AirtableEnvKey =
  "AIRTABLE_API_KEY" | "AIRTABLE_BASE_ID" | "AIRTABLE_TABLE_NAME";

function readAirtableEnv(key: AirtableEnvKey): string | undefined {
  return getRuntimeEnvString(key) ?? env[key];
}

/**
 * Airtable配置和初始化
 * Airtable configuration and initialization
 */
export class AirtableService {
  private base: AirtableNS.Base | null = null;
  private tableName: string;
  private isConfigured: boolean = false;
  private airtableModule: unknown = null;
  private initializationError: Error | null = null;

  constructor() {
    this.tableName = readAirtableEnv("AIRTABLE_TABLE_NAME") || "Contacts";
    // 不在构造函数中执行初始化，延迟到首次调用方法时
  }

  /**
   * 初始化Airtable连接
   * Initialize Airtable connection
   */
  private async initializeAirtable(): Promise<void> {
    try {
      const apiKey = readAirtableEnv("AIRTABLE_API_KEY");
      const baseId = readAirtableEnv("AIRTABLE_BASE_ID");
      this.tableName = readAirtableEnv("AIRTABLE_TABLE_NAME") || this.tableName;

      if (!apiKey || !baseId) {
        logger.warn(
          "Airtable configuration missing - service will be disabled",
          {
            hasApiKey: Boolean(apiKey),
            hasBaseId: Boolean(baseId),
          },
        );
        return;
      }
      // 动态加载 airtable 模块
      if (!this.airtableModule) {
        this.airtableModule = await import("airtable");
      }

      const Airtable = resolveAirtableModule(this.airtableModule);
      if (!Airtable) {
        logger.warn("Airtable module did not expose expected API");
        return;
      }

      Airtable.configure({
        endpointUrl: "https://api.airtable.com",
        apiKey,
        // 覆盖 SDK 默认的 300000ms，避免挂起请求把 Cloudflare 调用拖住数分钟
        requestTimeout: AIRTABLE_REQUEST_TIMEOUT_MS,
      });

      this.base = Airtable.base(baseId);
      this.isConfigured = true;

      logger.info("Airtable service initialized successfully", {
        tableName: this.tableName,
      });
    } catch (error) {
      this.initializationError =
        error instanceof Error ? error : new Error(String(error));
      logger.error("Failed to initialize Airtable service", {
        error: this.initializationError.message,
      });
    }
  }

  /**
   * 确保 Airtable 已初始化
   */
  private async ensureReady(): Promise<void> {
    if (this.isConfigured && this.base) return;
    await this.initializeAirtable();
  }

  /**
   * 检查服务是否已配置
   * Check if service is configured
   */
  public isReady(): boolean {
    return this.isConfigured && this.base !== null;
  }

  private async requireBase(): Promise<AirtableNS.Base> {
    if (!this.isReady()) {
      await this.ensureReady();
    }

    if (!this.isReady()) {
      if (this.initializationError) {
        throw new Error(
          `Airtable service initialization failed: ${this.initializationError.message}`,
        );
      }
      throw new Error("Airtable service is not configured");
    }
    return this.base as AirtableNS.Base;
  }

  /** Create a product/general inquiry record in Airtable. */
  public async createLead(
    data: ProductLeadData,
  ): Promise<CreatedAirtableRecord> {
    const base = await this.requireBase();
    return createLeadRecord({ base, tableName: this.tableName, data });
  }
}
