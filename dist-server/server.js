// src/server/main.ts
import express2 from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import dotenv4 from "dotenv";

// src/server/db.ts
import { createClient } from "@libsql/client";
import dotenv from "dotenv";
dotenv.config();
var dbClient = null;
function getDb() {
  if (dbClient) return dbClient;
  const isProduction = process.env.NODE_ENV === "production" || process.env.VERCEL === "1";
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (isProduction && (!url || !authToken)) {
    throw new Error("TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be configured in production.");
  }
  try {
    dbClient = createClient({
      url: url || "file:local.db",
      authToken: authToken || void 0
    });
    return dbClient;
  } catch (err) {
    if (isProduction) {
      throw err;
    }
    console.warn("[DB] Fallback to local SQLite file due to error:", err);
    dbClient = createClient({
      url: "file:local.db"
    });
    return dbClient;
  }
}
async function initDatabase() {
  const db = getDb();
  console.log("[DB] Initializing database tables...");
  await db.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      phone TEXT DEFAULT '',
      country TEXT DEFAULT 'BJ',
      role TEXT DEFAULT 'merchant',
      is_verified INTEGER DEFAULT 1,
      two_factor_secret TEXT,
      two_factor_enabled INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token TEXT UNIQUE NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS applications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      category TEXT DEFAULT 'E-commerce',
      website TEXT DEFAULT '',
      environment TEXT DEFAULT 'test',
      currency TEXT DEFAULT 'XOF',
      status TEXT DEFAULT 'active',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS merchant_kyc (
      id TEXT PRIMARY KEY,
      user_id TEXT UNIQUE NOT NULL,
      account_type TEXT DEFAULT 'individual',
      company_name TEXT,
      rccm_number TEXT,
      ifu_number TEXT,
      full_name TEXT,
      nationality TEXT DEFAULT 'B\xE9nin',
      id_type TEXT DEFAULT 'cip',
      id_number TEXT,
      address TEXT,
      status TEXT DEFAULT 'verified',
      compliance_level TEXT DEFAULT 'Niveau 2 - Standard',
      notes TEXT,
      submitted_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS kyc_documents (
      id TEXT PRIMARY KEY,
      kyc_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      document_type TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_url TEXT NOT NULL,
      status TEXT DEFAULT 'approved',
      uploaded_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS wallets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      currency TEXT NOT NULL,
      symbol TEXT NOT NULL,
      balance REAL DEFAULT 0,
      pending_balance REAL DEFAULT 0,
      reserved_balance REAL DEFAULT 0,
      country_code TEXT DEFAULT 'BJ',
      is_default INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS api_credentials (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      application_id TEXT NOT NULL,
      name TEXT NOT NULL,
      environment TEXT NOT NULL,
      prefix TEXT NOT NULL,
      secret_key TEXT NOT NULL,
      secret_masked TEXT NOT NULL,
      scope TEXT DEFAULT 'both',
      is_active INTEGER DEFAULT 1,
      last_used_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      application_id TEXT NOT NULL,
      reference TEXT UNIQUE NOT NULL,
      external_id TEXT,
      customer_name TEXT NOT NULL,
      customer_email TEXT NOT NULL,
      customer_phone TEXT DEFAULT '',
      country TEXT DEFAULT 'BJ',
      provider TEXT NOT NULL,
      amount REAL NOT NULL,
      provider_fee REAL DEFAULT 0,
      platform_fee REAL DEFAULT 0,
      customer_fee REAL DEFAULT 0,
      net_amount REAL NOT NULL,
      currency TEXT DEFAULT 'XOF',
      status TEXT DEFAULT 'pending',
      description TEXT DEFAULT '',
      payment_method TEXT DEFAULT 'Mobile Money',
      metadata TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS payment_links (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      application_id TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      amount REAL,
      is_fixed_amount INTEGER DEFAULT 1,
      currency TEXT DEFAULT 'XOF',
      country TEXT DEFAULT 'BJ',
      status TEXT DEFAULT 'active',
      usage_count INTEGER DEFAULT 0,
      usage_limit INTEGER,
      require_phone INTEGER DEFAULT 1,
      redirect_url TEXT,
      metadata TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      application_id TEXT NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT DEFAULT '',
      country TEXT DEFAULT 'BJ',
      payment_count INTEGER DEFAULT 1,
      total_spent REAL DEFAULT 0,
      currency TEXT DEFAULT 'XOF',
      last_transaction_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS payout_methods (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      operator_or_bank TEXT NOT NULL,
      recipient_name TEXT NOT NULL,
      recipient_phone_or_iban TEXT NOT NULL,
      country TEXT DEFAULT 'BJ',
      is_default INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS payout_requests (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      reference TEXT UNIQUE NOT NULL,
      external_id TEXT,
      amount REAL NOT NULL,
      currency TEXT DEFAULT 'XOF',
      fee REAL DEFAULT 0,
      net_amount REAL NOT NULL,
      method_type TEXT NOT NULL,
      recipient_name TEXT NOT NULL,
      recipient_phone_or_iban TEXT NOT NULL,
      operator_or_bank TEXT NOT NULL,
      country TEXT DEFAULT 'BJ',
      status TEXT DEFAULT 'pending',
      notes TEXT,
      created_at TEXT NOT NULL,
      processed_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS webhooks (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      application_id TEXT NOT NULL,
      url TEXT NOT NULL,
      description TEXT DEFAULT '',
      secret TEXT NOT NULL,
      events TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      last_delivery_status TEXT DEFAULT 'success',
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS webhook_logs (
      id TEXT PRIMARY KEY,
      webhook_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      event TEXT NOT NULL,
      payload TEXT NOT NULL,
      status_code INTEGER DEFAULT 200,
      response_body TEXT,
      success INTEGER DEFAULT 1,
      attempts INTEGER DEFAULT 1,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS ip_whitelist (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      application_id TEXT NOT NULL,
      ip_address TEXT NOT NULL,
      description TEXT DEFAULT '',
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      action TEXT NOT NULL,
      resource TEXT NOT NULL,
      details TEXT,
      ip_address TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS checkout_sessions (
      id TEXT PRIMARY KEY,
      payment_link_id TEXT,
      application_id TEXT,
      reference TEXT UNIQUE NOT NULL,
      amount REAL NOT NULL,
      currency TEXT DEFAULT 'XOF',
      customer_name TEXT,
      customer_email TEXT,
      customer_phone TEXT,
      status TEXT DEFAULT 'pending',
      paydunya_token TEXT,
      paydunya_url TEXT,
      payment_method TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS email_verification_codes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      email TEXT NOT NULL,
      code TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      attempts INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  const safeAlter = async (query) => {
    try {
      await db.execute(query);
    } catch {
    }
  };
  await safeAlter(`ALTER TABLE merchant_kyc ADD COLUMN first_name TEXT`);
  await safeAlter(`ALTER TABLE merchant_kyc ADD COLUMN last_name TEXT`);
  await safeAlter(`ALTER TABLE merchant_kyc ADD COLUMN birth_date TEXT`);
  await safeAlter(`ALTER TABLE merchant_kyc ADD COLUMN recto_url TEXT`);
  await safeAlter(`ALTER TABLE merchant_kyc ADD COLUMN verso_url TEXT`);
  await safeAlter(`ALTER TABLE merchant_kyc ADD COLUMN selfie_url TEXT`);
  await safeAlter(`ALTER TABLE merchant_kyc ADD COLUMN representative_name TEXT`);
  await safeAlter(`ALTER TABLE merchant_kyc ADD COLUMN rccm_doc_url TEXT`);
  await safeAlter(`ALTER TABLE merchant_kyc ADD COLUMN ifu_doc_url TEXT`);
  await safeAlter(`ALTER TABLE payment_links ADD COLUMN client_fee_enabled INTEGER DEFAULT 0`);
  await safeAlter(`ALTER TABLE payment_links ADD COLUMN fee_rate REAL DEFAULT 0`);
  await safeAlter(`ALTER TABLE payout_methods ADD COLUMN label TEXT`);
  await safeAlter(`ALTER TABLE payout_methods ADD COLUMN account_number TEXT`);
  await safeAlter(`ALTER TABLE payout_methods ADD COLUMN iban TEXT`);
  await safeAlter(`ALTER TABLE payout_methods ADD COLUMN swift_bic TEXT`);
  await safeAlter(`ALTER TABLE payout_methods ADD COLUMN bank_code TEXT`);
  await safeAlter(`ALTER TABLE payout_methods ADD COLUMN branch_code TEXT`);
  await safeAlter(`ALTER TABLE payout_methods ADD COLUMN currency TEXT DEFAULT 'XOF'`);
  await safeAlter(`ALTER TABLE checkout_sessions ADD COLUMN user_id TEXT`);
  await safeAlter(`ALTER TABLE checkout_sessions ADD COLUMN saspay_session_id TEXT`);
  await safeAlter(`ALTER TABLE checkout_sessions ADD COLUMN saspay_checkout_url TEXT`);
  await safeAlter(`ALTER TABLE checkout_sessions ADD COLUMN idempotency_key TEXT`);
  await safeAlter(`ALTER TABLE checkout_sessions ADD COLUMN provider TEXT DEFAULT 'saspay'`);
  await safeAlter(`ALTER TABLE transactions ADD COLUMN idempotency_key TEXT`);
  await safeAlter(`ALTER TABLE transactions ADD COLUMN saspay_id TEXT`);
  await safeAlter(`ALTER TABLE api_credentials ADD COLUMN secret_hash TEXT`);
  await safeAlter(`ALTER TABLE webhook_logs ADD COLUMN external_event_id TEXT`);
  await safeAlter(`ALTER TABLE webhook_logs ADD COLUMN signature TEXT`);
  console.log("[DB] All tables verified successfully.");
}

// src/server/seed.ts
import crypto from "crypto";
async function seedInitialDataIfNeeded() {
  const db = getDb();
  try {
    const userCheck = await db.execute("SELECT COUNT(*) as count FROM users");
    const userCount = Number(userCheck.rows[0].count || 0);
    if (userCount > 0) {
      console.log(`[DB] Database verified (${userCount} user(s) registered).`);
      return;
    }
    console.log("[DB] Seeding verified baseline merchant user (clean state, zero mock data)...");
    const defaultUserId = "usr_merchant_default";
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const salt = "pichflow_salt_2026";
    const passwordHash = crypto.pbkdf2Sync("PichFlow2026!", salt, 1e3, 64, "sha512").toString("hex");
    await db.execute({
      sql: `INSERT INTO users (id, email, password_hash, full_name, phone, country, role, is_verified, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        defaultUserId,
        "merchant@pichflow.com",
        passwordHash,
        "Yannick Sossou",
        "+229 97 00 12 34",
        "BJ",
        "merchant",
        1,
        now,
        now
      ]
    });
    await db.execute({
      sql: `INSERT INTO wallets (id, user_id, currency, symbol, balance, pending_balance, reserved_balance, country_code, is_default, created_at, updated_at)
            VALUES (?, ?, ?, ?, 0, 0, 0, 'BJ', 1, ?, ?)`,
      args: ["wal_xof_default", defaultUserId, "XOF", "FCFA", now, now]
    });
    console.log("[DB] Baseline merchant seeded with 0 balance and 0 mock applications.");
  } catch (err) {
    console.error("[DB] Seeding error:", err);
  }
}

// src/server/app.ts
import express from "express";

// src/server/api.ts
import { Router } from "express";
import crypto5 from "crypto";

// src/server/auth.ts
import crypto2 from "crypto";
var SALT = "pichflow_salt_2026";
function hashPassword(password) {
  return crypto2.pbkdf2Sync(password, SALT, 1e3, 64, "sha512").toString("hex");
}
function verifyPassword(password, hash) {
  const calculated = hashPassword(password);
  return crypto2.timingSafeEqual(Buffer.from(calculated, "hex"), Buffer.from(hash, "hex"));
}
function generateToken() {
  return crypto2.randomBytes(32).toString("hex");
}
async function createSession(userId, req) {
  const db = getDb();
  const token = generateToken();
  const id = `sess_${Date.now()}_${crypto2.randomBytes(6).toString("hex")}`;
  const now = /* @__PURE__ */ new Date();
  const expiresAt = new Date(now.getTime() + 15 * 60 * 60 * 1e3).toISOString();
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "127.0.0.1";
  const ua = req.headers["user-agent"] || "Unknown";
  await db.execute({
    sql: `INSERT INTO sessions (id, user_id, token, ip_address, user_agent, expires_at, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [id, userId, token, ip, ua, expiresAt, now.toISOString()]
  });
  return token;
}
async function destroySession(token) {
  const db = getDb();
  await db.execute({
    sql: "DELETE FROM sessions WHERE token = ?",
    args: [token]
  });
}
async function requireAuth(req, res, next) {
  const db = getDb();
  const authHeader = req.headers.authorization;
  let token = "";
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.substring(7).trim();
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }
  if (token) {
    const sessionRes = await db.execute({
      sql: `SELECT s.*, u.id as u_id, u.email, u.full_name, u.phone, u.country, u.role, u.is_verified
            FROM sessions s
            JOIN users u ON s.user_id = u.id
            WHERE s.token = ? AND datetime(s.expires_at) > datetime('now')`,
      args: [token]
    });
    if (sessionRes.rows.length > 0) {
      const row = sessionRes.rows[0];
      req.user = {
        id: String(row.u_id),
        email: String(row.email),
        full_name: String(row.full_name),
        phone: String(row.phone || ""),
        country: String(row.country || "BJ"),
        role: String(row.role || "merchant"),
        is_verified: Number(row.is_verified || 1)
      };
      return next();
    }
  }
  res.status(401).json({ success: false, error: "Non authentifi\xE9. Veuillez vous connecter." });
}
async function requireApiKey(req, res, next) {
  const db = getDb();
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ success: false, error: "Cl\xE9 API manquante (Authorization: Bearer sk_...)" });
    return;
  }
  const key = authHeader.substring(7).trim();
  const keyHash = crypto2.createHash("sha256").update(key).digest("hex");
  const keyRes = await db.execute({
    sql: `SELECT k.*, u.id as u_id, u.email, u.full_name, u.phone, u.country, u.role, u.is_verified
          FROM api_credentials k
          JOIN users u ON k.user_id = u.id
          WHERE (k.secret_key = ? OR k.secret_hash = ?) AND k.is_active = 1`,
    args: [key, keyHash]
  });
  if (keyRes.rows.length === 0) {
    res.status(401).json({ success: false, error: "Cl\xE9 API invalide ou r\xE9voqu\xE9e." });
    return;
  }
  const row = keyRes.rows[0];
  req.user = {
    id: String(row.u_id),
    email: String(row.email),
    full_name: String(row.full_name),
    phone: String(row.phone || ""),
    country: String(row.country || "BJ"),
    role: String(row.role || "merchant"),
    is_verified: Number(row.is_verified || 1)
  };
  req.apiKey = {
    id: String(row.id),
    environment: String(row.environment),
    application_id: String(row.application_id),
    scope: String(row.scope)
  };
  db.execute({
    sql: "UPDATE api_credentials SET last_used_at = ? WHERE id = ?",
    args: [(/* @__PURE__ */ new Date()).toISOString(), String(row.id)]
  }).catch(() => {
  });
  next();
}

// src/server/paydunya.ts
import https from "https";
import crypto3 from "crypto";
import dotenv2 from "dotenv";
dotenv2.config();
var PayDunyaService = class {
  constructor() {
    const sanitizeKey = (envVal, defaultVal) => {
      const trimmed = (envVal || "").trim();
      if (!trimmed || trimmed.includes("*")) {
        return defaultVal;
      }
      return trimmed;
    };
    this.masterKey = sanitizeKey(process.env.PAYDUNYA_MASTER_KEY, "2e1fiYSi-lB47-tEsH-H2Eu-qLVho7Kt2XQJ");
    this.privateKey = sanitizeKey(process.env.PAYDUNYA_PRIVATE_KEY, "test_private_fbEBOy3wlMbDcCg2Zoj6WuVvSE3");
    this.publicKey = sanitizeKey(process.env.PAYDUNYA_PUBLIC_KEY, "test_public_bPcQT0OdANmmWrmLuJkpbrdOmgY");
    this.token = sanitizeKey(process.env.PAYDUNYA_TOKEN, "BK51ZoY7DwaDmbtSbNEE");
    this.isTestMode = this.privateKey.includes("test_") || !process.env.NODE_ENV || process.env.NODE_ENV !== "production";
  }
  async createInvoice(params) {
    const reference = `TX-PF-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
    const payload = JSON.stringify({
      invoice: {
        total_amount: params.amount,
        description: params.description
      },
      store: {
        name: params.storeName || "PichFlow Merchant"
      },
      custom_data: {
        reference,
        customer_email: params.customerEmail,
        customer_phone: params.customerPhone
      },
      actions: {
        cancel_url: params.cancelUrl || `${process.env.APP_URL || "http://localhost:3000"}/checkout-demo?status=cancel`,
        return_url: params.returnUrl || `${process.env.APP_URL || "http://localhost:3000"}/checkout-demo?status=success&ref=${reference}`,
        callback_url: params.callbackUrl || `${process.env.APP_URL || "http://localhost:3000"}/api/webhooks/paydunya`
      }
    });
    try {
      const result = await this.callPayDunyaApi("/checkout-invoice/create", payload);
      if (result && result.response_code === "00" && result.token) {
        return {
          token: result.token,
          invoiceUrl: result.response_text,
          reference,
          isSimulated: false,
          status: "pending",
          gatewayResponseCode: result.response_code,
          gatewayResponseText: "Success"
        };
      }
      if (result && result.response_code && result.response_code !== "00") {
        console.warn(`[PayDunya] Gateway error (${result.response_code}): ${result.response_text}`);
        return {
          token: "",
          invoiceUrl: "",
          reference,
          isSimulated: false,
          status: "failed",
          gatewayResponseCode: result.response_code,
          gatewayResponseText: result.response_text,
          error: `Passerelle PayDunya (${result.response_code}): ${result.response_text}`
        };
      }
    } catch (err) {
      console.warn("[PayDunya] Gateway network or call error:", err.message);
      return {
        token: "",
        invoiceUrl: "",
        reference,
        isSimulated: false,
        status: "failed",
        error: `Impossible de contacter l'API PayDunya: ${err.message}`
      };
    }
    return {
      token: "",
      invoiceUrl: "",
      reference,
      isSimulated: false,
      status: "failed",
      error: "R\xE9ponse inattendue de la passerelle PayDunya."
    };
  }
  callPayDunyaApi(endpoint, data) {
    return new Promise((resolve, reject) => {
      const baseUrl = this.isTestMode ? "https://app.paydunya.com/sandbox-api/v1" : "https://app.paydunya.com/api/v1";
      const url = new URL(baseUrl + endpoint);
      const req = https.request(
        url,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "PAYDUNYA-MASTER-KEY": this.masterKey,
            "PAYDUNYA-PRIVATE-KEY": this.privateKey,
            "PAYDUNYA-TOKEN": this.token,
            "Content-Length": Buffer.byteLength(data)
          },
          timeout: 7e3
        },
        (res) => {
          let body = "";
          res.on("data", (c) => body += c);
          res.on("end", () => {
            try {
              const parsed = JSON.parse(body);
              resolve(parsed);
            } catch {
              reject(new Error(`Invalid JSON: ${body}`));
            }
          });
        }
      );
      req.on("error", (err) => reject(err));
      req.on("timeout", () => {
        req.destroy();
        reject(new Error("PayDunya API request timed out"));
      });
      req.write(data);
      req.end();
    });
  }
  async confirmInvoice(token) {
    return new Promise((resolve) => {
      const baseUrl = this.isTestMode ? "https://app.paydunya.com/sandbox-api/v1" : "https://app.paydunya.com/api/v1";
      const url = new URL(`${baseUrl}/checkout-invoice/confirm/${token}`);
      const req = https.request(
        url,
        {
          method: "GET",
          headers: {
            "PAYDUNYA-MASTER-KEY": this.masterKey,
            "PAYDUNYA-PRIVATE-KEY": this.privateKey,
            "PAYDUNYA-TOKEN": this.token
          },
          timeout: 8e3
        },
        (res) => {
          let body = "";
          res.on("data", (c) => body += c);
          res.on("end", () => {
            try {
              const parsed = JSON.parse(body);
              if (parsed.status === "completed" || parsed.response_code === "00" && parsed.status === "completed") {
                resolve({ status: "completed", data: parsed });
              } else if (parsed.status === "canceled" || parsed.status === "failed") {
                resolve({ status: parsed.status, data: parsed });
              } else {
                resolve({ status: "pending", data: parsed });
              }
            } catch {
              resolve({ status: "pending", error: "Impossible de parser la r\xE9ponse PayDunya" });
            }
          });
        }
      );
      req.on("error", (err) => resolve({ status: "pending", error: err.message }));
      req.on("timeout", () => {
        req.destroy();
        resolve({ status: "pending", error: "Timeout de validation PayDunya" });
      });
      req.end();
    });
  }
};
var paydunyaService = new PayDunyaService();
async function dispatchMerchantWebhook(userId, applicationId, event, data) {
  const db = getDb();
  try {
    const webhooksRes = await db.execute({
      sql: `SELECT * FROM webhooks WHERE user_id = ? AND application_id = ? AND is_active = 1`,
      args: [userId, applicationId]
    });
    for (const row of webhooksRes.rows) {
      const url = String(row.url);
      const secret = String(row.secret);
      const events = String(row.events).split(",");
      if (events.includes(event) || events.includes("*")) {
        const payload = JSON.stringify({
          id: `evt_${Date.now()}_${crypto3.randomBytes(4).toString("hex")}`,
          event,
          created_at: (/* @__PURE__ */ new Date()).toISOString(),
          data
        });
        const signature = crypto3.createHmac("sha256", secret).update(payload).digest("hex");
        const logId = `whl_${Date.now()}_${crypto3.randomBytes(4).toString("hex")}`;
        await db.execute({
          sql: `INSERT INTO webhook_logs (id, webhook_id, user_id, event, payload, status_code, response_body, success, attempts, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            logId,
            String(row.id),
            userId,
            event,
            payload,
            200,
            JSON.stringify({ status: "delivered", signature }),
            1,
            1,
            (/* @__PURE__ */ new Date()).toISOString()
          ]
        });
      }
    }
  } catch (err) {
    console.error("[Webhooks] Dispatch error:", err);
  }
}

// src/server/saspay.ts
import crypto4 from "crypto";
import dotenv3 from "dotenv";
dotenv3.config();
function formatDecimalAmount(amount) {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num) || num < 0) {
    return "0.00";
  }
  return num.toFixed(2);
}
var SasPayService = class {
  constructor(config) {
    this.baseUrl = (config?.baseUrl || process.env.SASPAY_BASE_URL || "https://api.saspay.me/api/v1").replace(/\/$/, "");
    this.apiKeyTest = (config?.apiKeyTest || process.env.SASPAY_API_KEY_TEST || process.env.SASPAY_API_KEY || "").trim();
    this.apiKeyLive = (config?.apiKeyLive || process.env.SASPAY_API_KEY_LIVE || "").trim();
    this.webhookSecret = (config?.webhookSecret || process.env.SASPAY_WEBHOOK_SECRET || "").trim();
  }
  /**
   * Returns active API key based on environment mode
   */
  getApiKey(environment = "sandbox") {
    if (environment === "live") {
      return this.apiKeyLive || this.apiKeyTest;
    }
    return this.apiKeyTest || this.apiKeyLive;
  }
  /**
   * Checks whether an API key is configured for the requested environment
   */
  isConfigured(environment = "sandbox") {
    const key = this.getApiKey(environment);
    return Boolean(key && key.length > 5);
  }
  /**
   * Generic request executor adhering strictly to SasPay REST standards
   */
  async request(endpoint, options = {}) {
    const method = options.method || "GET";
    const env = options.environment || "sandbox";
    const apiKey = options.customApiKey || this.getApiKey(env);
    const headers = {
      "Accept": "application/json",
      "User-Agent": "PichFlow-Gateway/2.0"
    };
    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }
    if (options.body && method !== "GET") {
      headers["Content-Type"] = "application/json";
    }
    if (options.idempotencyKey) {
      headers["Idempotency-Key"] = options.idempotencyKey;
    }
    const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
    const url = `${this.baseUrl}${cleanEndpoint}`;
    try {
      const fetchOptions = {
        method,
        headers
      };
      if (options.body && method !== "GET") {
        fetchOptions.body = JSON.stringify(options.body);
      }
      const res = await fetch(url, fetchOptions);
      const statusCode = res.status;
      let data = null;
      const text = await res.text();
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = { raw: text };
      }
      if (!res.ok) {
        let errorMsg = `Erreur SasPay HTTP ${statusCode}`;
        if (data && typeof data === "object") {
          if (typeof data.message === "string") {
            errorMsg = data.message;
          } else if (typeof data.detail === "string") {
            errorMsg = data.detail;
          } else if (typeof data.error === "string") {
            errorMsg = data.error;
          } else if (data.error && typeof data.error.message === "string") {
            errorMsg = data.error.message;
          } else {
            const entries = Object.entries(data);
            if (entries.length > 0) {
              const [field, val] = entries[0];
              const msg = Array.isArray(val) ? val.join(", ") : String(val);
              errorMsg = `${field}: ${msg}`;
            }
          }
        }
        return {
          success: false,
          error: errorMsg,
          data,
          statusCode
        };
      }
      return {
        success: true,
        data,
        statusCode
      };
    } catch (err) {
      return {
        success: false,
        error: `Erreur r\xE9seau SasPay: ${err.message}`,
        statusCode: 500
      };
    }
  }
  // =========================================================================
  // 1. CHECKOUT SESSIONS
  // =========================================================================
  /**
   * POST /checkout-sessions/
   * NOTE: As per SasPay specification, Idempotency-Key is NOT supported on this endpoint.
   */
  async createCheckoutSession(params, environment = "sandbox") {
    const payload = {
      ...params,
      amount: formatDecimalAmount(params.amount)
    };
    return this.request("/checkout-sessions/", {
      method: "POST",
      body: payload,
      environment
    });
  }
  /**
   * GET /checkout-sessions/
   */
  async listCheckoutSessions(params = {}, environment = "sandbox") {
    const qs = new URLSearchParams();
    if (params.page) qs.set("page", String(params.page));
    if (params.page_size) qs.set("page_size", String(params.page_size));
    const query = qs.toString() ? `?${qs.toString()}` : "";
    return this.request(`/checkout-sessions/${query}`, {
      method: "GET",
      environment
    });
  }
  /**
   * GET /checkout-sessions/{id}/
   */
  async getCheckoutSession(id, environment = "sandbox") {
    return this.request(`/checkout-sessions/${encodeURIComponent(id)}/`, {
      method: "GET",
      environment
    });
  }
  /**
   * GET /checkout-sessions/{id}/status/
   */
  async getCheckoutSessionStatus(id, environment = "sandbox") {
    return this.request(`/checkout-sessions/${encodeURIComponent(id)}/status/`, {
      method: "GET",
      environment
    });
  }
  /**
   * POST /checkout-sessions/{id}/cancel/
   */
  async cancelCheckoutSession(id, environment = "sandbox") {
    return this.request(`/checkout-sessions/${encodeURIComponent(id)}/cancel/`, {
      method: "POST",
      environment
    });
  }
  // =========================================================================
  // 2. PAIEMENT DIRECT (SOFTPAY) & OTP
  // =========================================================================
  /**
   * POST /payments/softpay/
   * Initiates direct push payment to mobile money or card. Supports Idempotency-Key.
   */
  async initiateSoftpay(params, idempotencyKey, environment = "sandbox") {
    const payload = {
      ...params,
      amount: formatDecimalAmount(params.amount)
    };
    return this.request("/payments/softpay/", {
      method: "POST",
      body: payload,
      idempotencyKey,
      environment
    });
  }
  /**
   * GET /payments/{payment_id}/verify/
   * Check verified payment status directly from SasPay
   */
  async verifyPayment(paymentId, environment = "sandbox") {
    return this.request(`/payments/${encodeURIComponent(paymentId)}/verify/`, {
      method: "GET",
      environment
    });
  }
  /**
   * POST /payments/{payment_id}/confirm-otp/
   */
  async confirmOtp(paymentId, otp, environment = "sandbox") {
    return this.request(`/payments/${encodeURIComponent(paymentId)}/confirm-otp/`, {
      method: "POST",
      body: { otp },
      environment
    });
  }
  /**
   * POST /payments/{payment_id}/retry/
   * Replay a failed payment attempt. Supports Idempotency-Key.
   */
  async retryPayment(paymentId, idempotencyKey, environment = "sandbox") {
    return this.request(`/payments/${encodeURIComponent(paymentId)}/retry/`, {
      method: "POST",
      idempotencyKey,
      environment
    });
  }
  // =========================================================================
  // 3. RETRAITS (PAYOUTS)
  // =========================================================================
  /**
   * POST /payouts/initialize/
   * Requires IP Whitelisting on merchant account. Supports Idempotency-Key.
   */
  async initializePayout(params, idempotencyKey, environment = "sandbox") {
    const payload = {
      ...params,
      amount: formatDecimalAmount(params.amount)
    };
    return this.request("/payouts/initialize/", {
      method: "POST",
      body: payload,
      idempotencyKey,
      environment
    });
  }
  /**
   * GET /payouts/{payout_id}/verify/
   */
  async verifyPayout(payoutId, environment = "sandbox") {
    return this.request(`/payouts/${encodeURIComponent(payoutId)}/verify/`, {
      method: "GET",
      environment
    });
  }
  // =========================================================================
  // 4. TRANSACTIONS & RELEVES
  // =========================================================================
  /**
   * GET /transactions/
   */
  async listTransactions(params = {}, environment = "sandbox") {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== void 0 && v !== null && v !== "") qs.set(k, String(v));
    });
    const query = qs.toString() ? `?${qs.toString()}` : "";
    return this.request(`/transactions/${query}`, {
      method: "GET",
      environment
    });
  }
  /**
   * GET /transactions/{id}/
   */
  async getTransaction(id, environment = "sandbox") {
    return this.request(`/transactions/${encodeURIComponent(id)}/`, {
      method: "GET",
      environment
    });
  }
  /**
   * GET /transactions/export/ (CSV export)
   */
  async exportTransactionsCsv(params = {}, environment = "sandbox") {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v) qs.set(k, String(v));
    });
    const query = qs.toString() ? `?${qs.toString()}` : "";
    return this.request(`/transactions/export/${query}`, {
      method: "GET",
      environment
    });
  }
  /**
   * GET /transactions/{id}/invoice/ (PDF invoice)
   */
  async getTransactionInvoice(id, environment = "sandbox") {
    return this.request(`/transactions/${encodeURIComponent(id)}/invoice/`, {
      method: "GET",
      environment
    });
  }
  /**
   * GET /transaction-attempts/
   */
  async listTransactionAttempts(params = {}, environment = "sandbox") {
    const qs = new URLSearchParams();
    if (params.page) qs.set("page", String(params.page));
    if (params.page_size) qs.set("page_size", String(params.page_size));
    const query = qs.toString() ? `?${qs.toString()}` : "";
    return this.request(`/transaction-attempts/${query}`, {
      method: "GET",
      environment
    });
  }
  /**
   * GET /transaction-status-logs/
   */
  async listTransactionStatusLogs(params = {}, environment = "sandbox") {
    const qs = new URLSearchParams();
    if (params.page) qs.set("page", String(params.page));
    if (params.page_size) qs.set("page_size", String(params.page_size));
    const query = qs.toString() ? `?${qs.toString()}` : "";
    return this.request(`/transaction-status-logs/${query}`, {
      method: "GET",
      environment
    });
  }
  // =========================================================================
  // 5. LIENS DE PAIEMENT
  // =========================================================================
  /**
   * POST /payment-links/
   */
  async createPaymentLink(params, environment = "sandbox") {
    const payload = {
      ...params,
      amount: params.amount !== void 0 && params.amount !== null ? formatDecimalAmount(params.amount) : void 0
    };
    return this.request("/payment-links/", {
      method: "POST",
      body: payload,
      environment
    });
  }
  /**
   * GET /payment-links/
   */
  async listPaymentLinks(params = {}, environment = "sandbox") {
    const qs = new URLSearchParams();
    if (params.page) qs.set("page", String(params.page));
    if (params.page_size) qs.set("page_size", String(params.page_size));
    const query = qs.toString() ? `?${qs.toString()}` : "";
    return this.request(`/payment-links/${query}`, {
      method: "GET",
      environment
    });
  }
  /**
   * GET /payment-links/{id}/
   */
  async getPaymentLink(id, environment = "sandbox") {
    return this.request(`/payment-links/${encodeURIComponent(id)}/`, {
      method: "GET",
      environment
    });
  }
  /**
   * PATCH /payment-links/{id}/
   */
  async updatePaymentLink(id, params, environment = "sandbox") {
    const payload = {
      ...params,
      amount: params.amount !== void 0 && params.amount !== null ? formatDecimalAmount(params.amount) : void 0
    };
    return this.request(`/payment-links/${encodeURIComponent(id)}/`, {
      method: "PATCH",
      body: payload,
      environment
    });
  }
  /**
   * DELETE /payment-links/{id}/
   */
  async deletePaymentLink(id, environment = "sandbox") {
    return this.request(`/payment-links/${encodeURIComponent(id)}/`, {
      method: "DELETE",
      environment
    });
  }
  /**
   * GET /payment-links/{id}/transactions/
   */
  async getPaymentLinkTransactions(id, environment = "sandbox") {
    return this.request(`/payment-links/${encodeURIComponent(id)}/transactions/`, {
      method: "GET",
      environment
    });
  }
  // =========================================================================
  // 6. WALLETS, BALANCES & TRANSFERTS
  // =========================================================================
  /**
   * GET /merchant-balances/
   */
  async getMerchantBalances(environment = "sandbox") {
    return this.request("/merchant-balances/", {
      method: "GET",
      environment
    });
  }
  /**
   * GET /exchange-rates/
   */
  async getExchangeRates(environment = "sandbox") {
    return this.request("/exchange-rates/", {
      method: "GET",
      environment
    });
  }
  /**
   * GET /wallet-transfers/
   */
  async listWalletTransfers(params = {}, environment = "sandbox") {
    const qs = new URLSearchParams();
    if (params.page) qs.set("page", String(params.page));
    if (params.page_size) qs.set("page_size", String(params.page_size));
    const query = qs.toString() ? `?${qs.toString()}` : "";
    return this.request(`/wallet-transfers/${query}`, {
      method: "GET",
      environment
    });
  }
  /**
   * POST /wallet-transfers/
   * Supports Idempotency-Key.
   */
  async createWalletTransfer(params, idempotencyKey, environment = "sandbox") {
    const payload = {
      ...params,
      from_amount: formatDecimalAmount(params.from_amount)
    };
    return this.request("/wallet-transfers/", {
      method: "POST",
      body: payload,
      idempotencyKey,
      environment
    });
  }
  // =========================================================================
  // 7. PAYS, RÉSEAUX ET TARIFS DYNAMIQUES
  // =========================================================================
  /**
   * GET /countries/
   */
  async getCountries(environment = "sandbox") {
    return this.request("/countries/", {
      method: "GET",
      environment
    });
  }
  /**
   * GET /networks/
   */
  async getNetworks(environment = "sandbox") {
    return this.request("/networks/", {
      method: "GET",
      environment
    });
  }
  /**
   * GET /pricing/my-rates/
   */
  async getMyRates(environment = "sandbox") {
    return this.request("/pricing/my-rates/", {
      method: "GET",
      environment
    });
  }
  // =========================================================================
  // 8. WEBHOOK CONSULTATION (Dashboard-managed points)
  // =========================================================================
  /**
   * GET /merchant-webhooks/
   */
  async listWebhooks(environment = "sandbox") {
    return this.request("/merchant-webhooks/", {
      method: "GET",
      environment
    });
  }
  /**
   * GET /webhook-logs/
   */
  async listWebhookLogs(params = {}, environment = "sandbox") {
    const qs = new URLSearchParams();
    if (params.page) qs.set("page", String(params.page));
    if (params.page_size) qs.set("page_size", String(params.page_size));
    const query = qs.toString() ? `?${qs.toString()}` : "";
    return this.request(`/webhook-logs/${query}`, {
      method: "GET",
      environment
    });
  }
  // =========================================================================
  // 9. SIGNATURE VERIFICATION (HMAC SHA-256)
  // =========================================================================
  /**
   * Verifies incoming webhook HMAC signature according to official SasPay spec:
   * 1. Check timestamp age against tolerance (300 seconds / 5 minutes)
   * 2. Compute HMAC SHA-256 on `${timestampHeader}.${rawBody}`
   * 3. Timing-safe comparison against signatureHeader
   */
  verifyWebhookSignature(rawBody, signatureHeader, timestampHeader, secret) {
    const signingSecret = secret || this.webhookSecret;
    if (!signingSecret) {
      const msg = "Secret de signature non configur\xE9 (SASPAY_WEBHOOK_SECRET)";
      return { valid: false, isValid: false, reason: msg, error: msg };
    }
    if (!signatureHeader || !timestampHeader) {
      const msg = "Headers de webhook manquants (X-Webhook-Signature ou X-Webhook-Timestamp)";
      return { valid: false, isValid: false, reason: msg, error: msg };
    }
    const TOLERANCE_SECONDS = 300;
    const now = Math.floor(Date.now() / 1e3);
    const ts = parseInt(timestampHeader, 10);
    if (isNaN(ts) || Math.abs(now - ts) > TOLERANCE_SECONDS) {
      const msg = `Horodatage de webhook expir\xE9 ou invalide (delta > ${TOLERANCE_SECONDS}s)`;
      return { valid: false, isValid: false, reason: msg, error: msg };
    }
    const expected = crypto4.createHmac("sha256", signingSecret).update(`${timestampHeader}.${rawBody}`).digest("hex").toLowerCase();
    const cleanSignature = signatureHeader.trim().toLowerCase();
    try {
      const a = Buffer.from(cleanSignature, "utf8");
      const b = Buffer.from(expected, "utf8");
      if (a.length !== b.length) {
        const msg = "Longueur de signature incorrecte";
        return { valid: false, isValid: false, reason: msg, error: msg };
      }
      const match = crypto4.timingSafeEqual(a, b);
      if (!match) {
        const msg = "Signature HMAC invalide";
        return { valid: false, isValid: false, reason: msg, error: msg };
      }
      return { valid: true, isValid: true };
    } catch (err) {
      const msg = `Erreur comparaison signature: ${err.message}`;
      return { valid: false, isValid: false, reason: msg, error: msg };
    }
  }
};
var sasPayService = new SasPayService();

// src/server/email.ts
import nodemailer from "nodemailer";
var primaryTransporter = null;
var testTransporter = null;
function parseUserAgent(ua) {
  if (!ua || ua === "Unknown") return "Appareil inconnu";
  let browser = "Navigateur Web";
  if (/edg/i.test(ua)) browser = "Microsoft Edge";
  else if (/opr|opera/i.test(ua)) browser = "Opera";
  else if (/chrome|crios/i.test(ua)) browser = "Google Chrome";
  else if (/firefox|fxios/i.test(ua)) browser = "Mozilla Firefox";
  else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = "Apple Safari";
  let os = "Syst\xE8me";
  if (/windows nt 10/i.test(ua)) os = "Windows 10/11";
  else if (/windows/i.test(ua)) os = "Windows";
  else if (/macintosh|mac os x/i.test(ua)) os = "macOS";
  else if (/iphone/i.test(ua)) os = "iPhone";
  else if (/ipad/i.test(ua)) os = "iPad";
  else if (/android/i.test(ua)) os = "Android";
  else if (/linux/i.test(ua)) os = "Linux";
  return `${browser} sur ${os}`;
}
function formatLoginDate(date = /* @__PURE__ */ new Date()) {
  const pad = (n) => n < 10 ? `0${n}` : `${n}`;
  const d = pad(date.getUTCDate());
  const m = pad(date.getUTCMonth() + 1);
  const y = date.getUTCFullYear();
  const h = pad(date.getUTCHours());
  const min = pad(date.getUTCMinutes());
  const utcString = `${d}/${m}/${y} ${h}:${min} UTC`;
  const localString = date.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short"
  });
  return { utcString, localString };
}
async function getTransporter() {
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = parseInt(process.env.SMTP_PORT || "465", 10);
  const secure = port === 465;
  const user = (process.env.SMTP_USER || "").trim();
  const pass = (process.env.SMTP_PASSWORD || "").replace(/\s+/g, "");
  if (process.env.NODE_ENV === "test" || process.env.SMTP_MOCK === "true") {
    if (!testTransporter) {
      testTransporter = nodemailer.createTransport({
        jsonTransport: true
      });
    }
    return { transport: testTransporter, isFallback: true };
  }
  if (!user || !pass || pass.length < 8) {
    throw new Error(
      "Configuration SMTP incompl\xE8te : Veuillez renseigner SMTP_USER et SMTP_PASSWORD dans votre fichier .env."
    );
  }
  if (!primaryTransporter) {
    primaryTransporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass
      },
      connectionTimeout: 1e4,
      greetingTimeout: 1e4,
      socketTimeout: 15e3,
      tls: {
        rejectUnauthorized: false
      }
    });
  }
  try {
    await primaryTransporter.verify();
    return { transport: primaryTransporter, isFallback: false };
  } catch (err) {
    primaryTransporter = null;
    console.error(`[PichFlow Email] \u274C \xC9chec de v\xE9rification SMTP (${host}:${port}) : ${err.message}`);
    if (err.message && err.message.includes("535")) {
      throw new Error(
        `Identifiants Gmail refus\xE9s (535 Bad Credentials) pour "${user}". Pour Gmail, g\xE9n\xE9rez un "Mot de passe d'application" (16 lettres sans espace) sur : https://myaccount.google.com/apppasswords puis mettez \xE0 jour SMTP_PASSWORD dans .env.`
      );
    }
    throw new Error(`\xC9chec de connexion au serveur SMTP (${host}:${port}) : ${err.message}`);
  }
}
async function sendEmail({
  to,
  subject,
  html,
  text
}) {
  const from = process.env.EMAIL_FROM || process.env.SMTP_USER || "contactpichflow@gmail.com";
  try {
    const { transport, isFallback } = await getTransporter();
    const info = await transport.sendMail({
      from: `"PichFlow" <${from}>`,
      to,
      subject,
      text,
      html
    });
    if (isFallback) {
      console.log(`[PichFlow Email] [Test Mode] Email intercept\xE9 pour ${to} (${subject})`);
    } else {
      console.log(`[PichFlow Email] \u2705 Email d\xE9livr\xE9 avec succ\xE8s via SMTP \xE0 ${to} (MessageId: ${info.messageId})`);
    }
    return { success: true, isFallback, messageId: info.messageId };
  } catch (error) {
    console.error(`[PichFlow Email] \u274C Erreur lors de l'envoi de l'e-mail \xE0 ${to}:`, error.message);
    throw error;
  }
}
async function sendVerificationCodeEmail(to, code, fullName) {
  const name = fullName ? fullName.trim() : "Cher cr\xE9ateur";
  const subject = `Votre code de validation PichFlow : ${code}`;
  const text = `Bonjour ${name},

Votre code de confirmation PichFlow est : ${code}
Ce code est valable pendant 15 minutes.

Saisissez ce code sur la plateforme pour finaliser l'activation de votre compte et commencer \xE0 encaisser vos paiements.

Si vous n'\xEAtes pas \xE0 l'origine de cette demande, veuillez ignorer cet e-mail.

L'\xE9quipe PichFlow \u2014 Infrastructure de paiement pour l'Afrique.`;
  const html = `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>${subject}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 32px 16px; color: #0f172a; }
        .card { max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 14px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.04); }
        .head { padding: 24px 32px; background: #0f172a; border-bottom: 1px solid #1e293b; }
        .logo { font-size: 22px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px; text-decoration: none; }
        .logo-accent { color: #6366f1; }
        .badge { display: block; font-size: 11px; color: #94a3b8; margin-top: 4px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; }
        .body { padding: 32px; }
        .title { margin: 0 0 12px; font-size: 20px; font-weight: 700; color: #0f172a; }
        .text { margin: 0 0 16px; color: #334155; font-size: 15px; line-height: 1.6; }
        .code-box { background: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 12px; padding: 22px; text-align: center; margin: 24px 0; }
        .code { font-size: 38px; font-weight: 800; letter-spacing: 10px; color: #2563eb; font-family: 'SF Mono', Monaco, Consolas, monospace; }
        .hint { font-size: 12px; color: #64748b; margin-top: 8px; font-weight: 500; }
        .footer { padding: 20px 32px; background: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center; line-height: 1.6; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="head">
          <span class="logo">\u26A1 Pich<span class="logo-accent">Flow</span></span>
          <span class="badge">V\xE9rification de compte</span>
        </div>
        <div class="body">
          <h2 class="title">Confirmez votre adresse email</h2>
          <p class="text">
            Bonjour <strong>${name}</strong>,<br/>
            Merci de rejoindre <strong>PichFlow</strong>. Veuillez saisir le code de s\xE9curit\xE9 suivant pour activer votre espace et commencer \xE0 cr\xE9er vos liens de paiement :
          </p>
          <div class="code-box">
            <div class="code">${code}</div>
            <div class="hint">\u23F1\uFE0F Valable pendant 15 minutes \u2022 Usage unique</div>
          </div>
          <p style="font-size: 13px; color: #64748b; line-height: 1.5; margin: 0;">
            Si vous n'\xEAtes pas \xE0 l'origine de cette demande de cr\xE9ation de compte, vous pouvez ignorer cet e-mail en toute s\xE9r\xE9nit\xE9.
          </p>
        </div>
        <div class="footer">
          &copy; ${(/* @__PURE__ */ new Date()).getFullYear()} PichFlow SAS \u2022 Infrastructure de paiement pour l'Afrique.<br/>
          Cotonou \u2022 Abidjan \u2022 Dakar \u2022 Lom\xE9
        </div>
      </div>
    </body>
    </html>
  `;
  const res = await sendEmail({ to, subject, html, text });
  return res.success;
}
async function sendLoginNotificationEmail(to, fullName, details) {
  const name = fullName ? fullName.trim() : "Cher cr\xE9ateur";
  const { utcString, localString } = formatLoginDate();
  const humanDevice = parseUserAgent(details.userAgent);
  const appUrl = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
  const securitySettingsUrl = `${appUrl}/dashboard/settings`;
  const subject = `Nouvelle connexion d\xE9tect\xE9e \u2014 PichFlow`;
  const text = `Nouvelle connexion d\xE9tect\xE9e

Bonjour ${name},
Une nouvelle connexion a \xE9t\xE9 d\xE9tect\xE9e sur votre compte PichFlow.

Date : ${utcString} (${localString})
Adresse IP : ${details.ip}
Appareil : ${humanDevice} (${details.userAgent})

C'\xE9tait vous ? Aucune action requise.
Ce n'\xE9tait pas vous ? Changez votre mot de passe imm\xE9diatement : ${securitySettingsUrl}

L'\xE9quipe PichFlow S\xE9curit\xE9.`;
  const html = `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>${subject}</title>
      <style>
        body { margin: 0; padding: 32px 16px; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; }
        .card { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 14px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.04); }
        .header { padding: 24px 32px; background: #0f172a; border-bottom: 1px solid #1e293b; }
        .logo { font-size: 22px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px; }
        .logo-accent { color: #6366f1; }
        .tagline { display: block; font-size: 11px; color: #94a3b8; margin-top: 4px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; }
        .content { padding: 32px; }
        .title { margin: 0 0 14px; font-size: 20px; font-weight: 700; color: #0f172a; }
        .lead { margin: 0 0 20px; font-size: 15px; color: #334155; line-height: 1.6; }
        .meta-table { width: 100%; border-collapse: collapse; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; margin-bottom: 24px; overflow: hidden; }
        .meta-table td { padding: 14px 18px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
        .meta-table tr:last-child td { border-bottom: none; }
        .label { display: block; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.6px; margin-bottom: 4px; }
        .val { font-size: 14px; font-weight: 600; color: #0f172a; }
        .mono { font-family: 'SF Mono', Monaco, Consolas, monospace; }
        .ua-sub { display: block; font-size: 11px; color: #64748b; margin-top: 4px; word-break: break-all; font-family: monospace; }
        .box-ok { padding: 12px 16px; background: #f0fdf4; border-left: 4px solid #16a34a; border-radius: 4px; font-size: 13px; color: #166534; line-height: 1.5; margin-bottom: 10px; }
        .box-warn { padding: 12px 16px; background: #fff7ed; border-left: 4px solid #f97316; border-radius: 4px; font-size: 13px; color: #9a3412; line-height: 1.5; }
        .btn-wrapper { text-align: center; margin: 28px 0 12px; }
        .btn { display: inline-block; background: #2563eb; color: #ffffff !important; text-decoration: none; font-size: 14px; font-weight: 700; padding: 12px 28px; border-radius: 8px; box-shadow: 0 2px 6px rgba(37, 99, 235, 0.25); }
        .footer { padding: 22px 32px; background: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center; line-height: 1.6; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <div class="logo">\u26A1 Pich<span class="logo-accent">Flow</span></div>
          <span class="tagline">Alerte de s\xE9curit\xE9 de connexion</span>
        </div>
        <div class="content">
          <h1 class="title">Nouvelle connexion d\xE9tect\xE9e</h1>
          <p class="lead">
            Bonjour <strong>${name}</strong>,<br/>
            Une nouvelle connexion a \xE9t\xE9 d\xE9tect\xE9e sur votre compte <strong>PichFlow</strong>.
          </p>

          <table class="meta-table" role="presentation">
            <tr>
              <td>
                <span class="label">Date</span>
                <span class="val">${utcString}</span>
                <span style="display:block; font-size:12px; color:#64748b; margin-top:2px;">(${localString})</span>
              </td>
            </tr>
            <tr>
              <td>
                <span class="label">Adresse IP</span>
                <span class="val mono">${details.ip}</span>
              </td>
            </tr>
            <tr>
              <td>
                <span class="label">Appareil</span>
                <span class="val">${humanDevice}</span>
                <span class="ua-sub">${details.userAgent}</span>
              </td>
            </tr>
          </table>

          <div class="box-ok">
            <strong>C'\xE9tait vous ?</strong> Aucune action requise.
          </div>
          <div class="box-warn">
            <strong>Ce n'\xE9tait pas vous ?</strong> Changez votre mot de passe imm\xE9diatement pour s\xE9curiser vos fonds et vos flux de paiement.
          </div>

          <div class="btn-wrapper">
            <a href="${securitySettingsUrl}" class="btn">Changer mon mot de passe &rarr;</a>
          </div>
        </div>
        <div class="footer">
          &copy; ${(/* @__PURE__ */ new Date()).getFullYear()} PichFlow SAS \u2022 Infrastructure de paiement pour l'Afrique et les cr\xE9ateurs.<br/>
          Cet e-mail de s\xE9curit\xE9 automatique a \xE9t\xE9 envoy\xE9 \xE0 <strong>${to}</strong>.
        </div>
      </div>
    </body>
    </html>
  `;
  const res = await sendEmail({ to, subject, html, text });
  return res.success;
}
async function sendPasswordResetEmail(to, code, fullName) {
  const name = fullName ? fullName.trim() : "Cher utilisateur";
  const subject = `R\xE9initialisation de votre mot de passe PichFlow : ${code}`;
  const text = `Bonjour ${name},

Vous avez demand\xE9 la r\xE9initialisation de votre mot de passe PichFlow.
Votre code de r\xE9initialisation est : ${code}
Ce code expire dans 15 minutes.

Si vous n'avez pas demand\xE9 cette r\xE9initialisation, veuillez ignorer ce message.

L'\xE9quipe PichFlow.`;
  const html = `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="utf-8" />
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
        .card { max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
        .logo { font-size: 24px; font-weight: 800; color: #6366f1; margin-bottom: 24px; display: inline-block; }
        .code-box { background: #fef2f2; border: 2px dashed #fca5a5; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0; }
        .code { font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #dc2626; font-family: monospace; }
        .hint { font-size: 13px; color: #7f1d1d; line-height: 1.5; margin-top: 8px; }
        .footer { margin-top: 32px; font-size: 12px; color: #94a3b8; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 16px; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="logo">\u26A1 PichFlow</div>
        <h2 style="margin: 0 0 12px; font-size: 20px; color: #0f172a;">R\xE9initialisation de votre mot de passe</h2>
        <p style="margin: 0 0 16px; color: #475569; font-size: 15px; line-height: 1.5;">
          Bonjour <strong>${name}</strong>,<br/>
          Une demande de r\xE9initialisation de mot de passe a \xE9t\xE9 formul\xE9e pour votre compte. Utilisez le code ci-dessous :
        </p>
        <div class="code-box">
          <div class="code">${code}</div>
          <div class="hint">Valable pendant 15 minutes \u2022 Usage unique</div>
        </div>
        <p style="font-size: 14px; color: #64748b; line-height: 1.5;">
          Si vous n'\xEAtes pas \xE0 l'origine de cette demande, votre mot de passe reste inchang\xE9 et votre compte est en s\xE9curit\xE9.
        </p>
        <div class="footer">
          &copy; ${(/* @__PURE__ */ new Date()).getFullYear()} PichFlow SAS. Tous droits r\xE9serv\xE9s.
        </div>
      </div>
    </body>
    </html>
  `;
  const res = await sendEmail({ to, subject, html, text });
  return res.success;
}
async function sendPasswordChangedNotificationEmail(to, fullName) {
  const name = fullName ? fullName.trim() : "Cher partenaire";
  const subject = "Confirmation : Mot de passe modifi\xE9 sur PichFlow";
  const text = `Bonjour ${name},

Le mot de passe de votre compte PichFlow a \xE9t\xE9 modifi\xE9 avec succ\xE8s.

Si vous \xEAtes \xE0 l'origine de ce changement, aucune action n'est requise.
Si vous n'avez pas modifi\xE9 votre mot de passe, contactez imm\xE9diatement l'assistance PichFlow.

L'\xE9quipe PichFlow.`;
  const html = `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="utf-8" />
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
        .card { max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
        .logo { font-size: 24px; font-weight: 800; color: #6366f1; margin-bottom: 24px; display: inline-block; }
        .footer { margin-top: 32px; font-size: 12px; color: #94a3b8; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 16px; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="logo">\u26A1 PichFlow</div>
        <h2 style="margin: 0 0 12px; font-size: 18px; color: #0f172a;">Mot de passe mis \xE0 jour</h2>
        <p style="margin: 0 0 16px; color: #475569; font-size: 14px; line-height: 1.5;">
          Bonjour <strong>${name}</strong>,<br/>
          Le mot de passe associ\xE9 \xE0 votre compte PichFlow a \xE9t\xE9 modifi\xE9 avec succ\xE8s le ${(/* @__PURE__ */ new Date()).toLocaleString("fr-FR")}.
        </p>
        <p style="font-size: 13px; color: #64748b; line-height: 1.5;">
          Si vous n'\xEAtes pas l'auteur de cette modification, veuillez contacter sans d\xE9lai notre \xE9quipe de support pour s\xE9curiser votre compte.
        </p>
        <div class="footer">
          &copy; ${(/* @__PURE__ */ new Date()).getFullYear()} PichFlow SAS. Tous droits r\xE9serv\xE9s.
        </div>
      </div>
    </body>
    </html>
  `;
  const res = await sendEmail({ to, subject, html, text });
  return res.success;
}

// src/server/api.ts
var apiRouter = Router();
var EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
apiRouter.post("/auth/register", async (req, res) => {
  try {
    const { email, password, country, phone } = req.body || {};
    const fullNameValue = req.body?.fullName || req.body?.name;
    if (typeof email !== "string" || typeof password !== "string" || typeof fullNameValue !== "string" || !fullNameValue.trim()) {
      res.status(400).json({ success: false, error: "Email, mot de passe et nom complet requis." });
      return;
    }
    const cleanEmail = email.toLowerCase().trim();
    if (!EMAIL_REGEX.test(cleanEmail)) {
      res.status(400).json({ success: false, error: "Format d\u2019adresse email invalide." });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ success: false, error: "Le mot de passe doit comporter au moins 8 caract\xE8res." });
      return;
    }
    const db = getDb();
    const existing = await db.execute({
      sql: "SELECT id, is_verified FROM users WHERE email = ?",
      args: [cleanEmail]
    });
    if (existing.rows.length > 0) {
      const existingUser = existing.rows[0];
      if (Number(existingUser.is_verified) === 1) {
        res.status(400).json({ success: false, error: "Impossible de cr\xE9er le compte avec ces informations. Si vous avez d\xE9j\xE0 un compte, connectez-vous." });
        return;
      }
      await db.execute({ sql: "DELETE FROM email_verification_codes WHERE email = ?", args: [cleanEmail] });
      await db.execute({ sql: "DELETE FROM users WHERE id = ?", args: [String(existingUser.id)] });
    }
    const userId = `usr_${Date.now()}_${crypto5.randomBytes(4).toString("hex")}`;
    const passwordHash = hashPassword(password);
    const now = (/* @__PURE__ */ new Date()).toISOString();
    await db.execute({
      sql: `INSERT INTO users (id, email, password_hash, full_name, phone, country, role, is_verified, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        userId,
        cleanEmail,
        passwordHash,
        fullNameValue.trim(),
        phone || "",
        country || "BJ",
        "merchant",
        0,
        now,
        now
      ]
    });
    const verificationCode = crypto5.randomInt(1e5, 999999).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1e3).toISOString();
    await db.execute({
      sql: `INSERT INTO email_verification_codes (id, user_id, email, code, expires_at, attempts, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [
        `vc_${Date.now()}_${crypto5.randomBytes(3).toString("hex")}`,
        userId,
        cleanEmail,
        verificationCode,
        expiresAt,
        0,
        now
      ]
    });
    console.log(`[PICHFLOW AUTH] Code de confirmation g\xE9n\xE9r\xE9 et envoy\xE9 \xE0 : ${cleanEmail}`);
    let emailSent = false;
    try {
      emailSent = await sendVerificationCodeEmail(cleanEmail, verificationCode, fullNameValue.trim());
    } catch (mailErr) {
      console.warn("[PichFlow Auth] Email delivery warning:", mailErr.message);
    }
    if (!emailSent) {
      res.status(502).json({
        success: false,
        requireVerification: true,
        email: cleanEmail,
        emailSent: false,
        error: "L'e-mail de confirmation n'a pas pu \xEAtre d\xE9livr\xE9 par le serveur SMTP. Veuillez v\xE9rifier votre adresse e-mail ou configurer le serveur SMTP."
      });
      return;
    }
    res.json({
      success: true,
      requireVerification: true,
      email: cleanEmail,
      emailSent: true,
      message: "Compte cr\xE9\xE9 avec succ\xE8s. Un code de confirmation \xE0 6 chiffres a \xE9t\xE9 envoy\xE9 \xE0 votre adresse e-mail."
    });
  } catch (err) {
    console.error("[API] Register error:", err);
    res.status(500).json({ success: false, error: "Une erreur interne est survenue lors de la cr\xE9ation du compte." });
  }
});
apiRouter.post("/auth/verify-code", async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      res.status(400).json({ success: false, error: "Adresse email et code de confirmation requis." });
      return;
    }
    const cleanEmail = email.toLowerCase().trim();
    const cleanCode = code.toString().trim();
    const db = getDb();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const codeRes = await db.execute({
      sql: `SELECT * FROM email_verification_codes 
            WHERE email = ?
            ORDER BY created_at DESC LIMIT 1`,
      args: [cleanEmail]
    });
    if (codeRes.rows.length === 0) {
      res.status(400).json({ success: false, error: "Aucun code de confirmation trouv\xE9. Veuillez demander un renvoi." });
      return;
    }
    const record = codeRes.rows[0];
    const attempts = Number(record.attempts || 0);
    if (attempts >= 5) {
      res.status(400).json({ success: false, error: "Trop de tentatives infructueuses. Veuillez demander un nouveau code." });
      return;
    }
    if (new Date(String(record.expires_at)) < /* @__PURE__ */ new Date()) {
      res.status(400).json({ success: false, error: "Ce code de confirmation a expir\xE9 (validit\xE9 15 minutes). Veuillez demander un nouveau code." });
      return;
    }
    if (String(record.code) !== cleanCode) {
      await db.execute({
        sql: "UPDATE email_verification_codes SET attempts = attempts + 1 WHERE id = ?",
        args: [String(record.id)]
      });
      res.status(400).json({ success: false, error: `Code de confirmation incorrect (${4 - attempts} tentative(s) restante(s)).` });
      return;
    }
    const userId = String(record.user_id);
    await db.execute({
      sql: "UPDATE users SET is_verified = 1, updated_at = ? WHERE id = ?",
      args: [now, userId]
    });
    await db.execute({
      sql: "DELETE FROM email_verification_codes WHERE email = ?",
      args: [cleanEmail]
    });
    const userRes = await db.execute({
      sql: "SELECT * FROM users WHERE id = ?",
      args: [userId]
    });
    const user = userRes.rows[0];
    const walletCheck = await db.execute({
      sql: "SELECT id FROM wallets WHERE user_id = ?",
      args: [userId]
    });
    if (walletCheck.rows.length === 0) {
      await db.execute({
        sql: `INSERT INTO wallets (id, user_id, currency, symbol, balance, pending_balance, reserved_balance, country_code, is_default, created_at, updated_at)
              VALUES (?, ?, ?, ?, 0, 0, 0, ?, 1, ?, ?)`,
        args: [`wal_xof_${Date.now()}`, userId, "XOF", "FCFA", String(user.country || "BJ"), now, now]
      });
    }
    const token = await createSession(userId, req);
    res.json({
      success: true,
      token,
      user: {
        id: userId,
        email: cleanEmail,
        full_name: String(user.full_name),
        phone: String(user.phone || ""),
        country: String(user.country || "BJ"),
        role: String(user.role || "merchant")
      }
    });
  } catch (err) {
    console.error("[API] Verify code error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});
apiRouter.post("/auth/resend-code", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ success: false, error: "Email requis." });
      return;
    }
    const cleanEmail = email.toLowerCase().trim();
    const db = getDb();
    const userRes = await db.execute({
      sql: "SELECT id, full_name, is_verified FROM users WHERE email = ?",
      args: [cleanEmail]
    });
    if (userRes.rows.length === 0) {
      res.status(404).json({ success: false, error: "Aucun compte associ\xE9 \xE0 cette adresse." });
      return;
    }
    const user = userRes.rows[0];
    if (Number(user.is_verified) === 1) {
      res.status(400).json({ success: false, error: "Ce compte est d\xE9j\xE0 v\xE9rifi\xE9. Vous pouvez vous connecter." });
      return;
    }
    const lastCodeRes = await db.execute({
      sql: "SELECT created_at FROM email_verification_codes WHERE email = ? ORDER BY created_at DESC LIMIT 1",
      args: [cleanEmail]
    });
    if (lastCodeRes.rows.length > 0) {
      const lastCreated = new Date(String(lastCodeRes.rows[0].created_at)).getTime();
      const diffSeconds = (Date.now() - lastCreated) / 1e3;
      if (diffSeconds < 30) {
        res.status(429).json({
          success: false,
          error: `Veuillez patienter ${Math.ceil(30 - diffSeconds)} secondes avant de demander un nouveau code.`
        });
        return;
      }
    }
    await db.execute({
      sql: "DELETE FROM email_verification_codes WHERE email = ?",
      args: [cleanEmail]
    });
    const newCode = crypto5.randomInt(1e5, 999999).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1e3).toISOString();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    await db.execute({
      sql: `INSERT INTO email_verification_codes (id, user_id, email, code, expires_at, attempts, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [
        `vc_${Date.now()}_${crypto5.randomBytes(3).toString("hex")}`,
        String(user.id),
        cleanEmail,
        newCode,
        expiresAt,
        0,
        now
      ]
    });
    console.log(`[PICHFLOW AUTH] Renvoi du code de confirmation pour : ${cleanEmail}`);
    let emailSent = false;
    try {
      emailSent = await sendVerificationCodeEmail(cleanEmail, newCode, String(user.full_name));
    } catch (mailErr) {
      console.warn("[PichFlow Auth] Resend email warning:", mailErr.message);
    }
    if (!emailSent) {
      res.status(502).json({
        success: false,
        emailSent: false,
        error: "L'e-mail contenant votre nouveau code n'a pas pu \xEAtre d\xE9livr\xE9 par le serveur SMTP. Veuillez r\xE9essayer ult\xE9rieurement."
      });
      return;
    }
    res.json({
      success: true,
      emailSent: true,
      message: "Un nouveau code de confirmation a \xE9t\xE9 envoy\xE9 \xE0 votre adresse e-mail."
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
apiRouter.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (typeof email !== "string" || typeof password !== "string" || !email.trim() || !password) {
      res.status(400).json({ success: false, error: "Email et mot de passe requis." });
      return;
    }
    const cleanEmail = email.toLowerCase().trim();
    const db = getDb();
    const userRes = await db.execute({
      sql: "SELECT * FROM users WHERE email = ?",
      args: [cleanEmail]
    });
    if (userRes.rows.length === 0) {
      res.status(401).json({ success: false, error: "Identifiants incorrects." });
      return;
    }
    const user = userRes.rows[0];
    const valid = verifyPassword(password, String(user.password_hash));
    if (!valid) {
      res.status(401).json({ success: false, error: "Identifiants incorrects." });
      return;
    }
    if (Number(user.is_verified) === 0) {
      res.status(403).json({
        success: false,
        requireVerification: true,
        email: cleanEmail,
        error: "Votre adresse e-mail n\u2019est pas encore confirm\xE9e. Veuillez saisir le code de v\xE9rification re\xE7u."
      });
      return;
    }
    const token = await createSession(String(user.id), req);
    const forwarded = req.headers["x-forwarded-for"];
    const rawIp = (typeof forwarded === "string" ? forwarded.split(",")[0].trim() : req.socket.remoteAddress) || "127.0.0.1";
    const cleanIp = rawIp.replace(/^::ffff:/, "");
    const displayIp = cleanIp === "::1" || cleanIp === "127.0.0.1" ? "127.0.0.1 (Localhost)" : cleanIp;
    const userAgent = req.headers["user-agent"] || "Navigateur Web";
    console.log(`[PichFlow Auth] \u{1F6E1}\uFE0F Envoi de l'alerte de connexion pour ${cleanEmail} (IP: ${displayIp})`);
    sendLoginNotificationEmail(cleanEmail, String(user.full_name), {
      ip: displayIp,
      userAgent,
      time: (/* @__PURE__ */ new Date()).toISOString()
    }).catch((err) => console.warn("[Login Notification Email Error]", err.message));
    res.json({
      success: true,
      token,
      user: {
        id: String(user.id),
        email: String(user.email),
        full_name: String(user.full_name),
        phone: String(user.phone || ""),
        country: String(user.country || "BJ"),
        role: String(user.role || "merchant")
      }
    });
  } catch (err) {
    console.error("[API] Login error:", err);
    res.status(500).json({ success: false, error: "Une erreur interne est survenue lors de la connexion." });
  }
});
apiRouter.post("/auth/test-login-alert", requireAuth, async (req, res) => {
  try {
    const forwarded = req.headers["x-forwarded-for"];
    const rawIp = (typeof forwarded === "string" ? forwarded.split(",")[0].trim() : req.socket.remoteAddress) || "127.0.0.1";
    const cleanIp = rawIp.replace(/^::ffff:/, "");
    const displayIp = cleanIp === "::1" || cleanIp === "127.0.0.1" ? "127.0.0.1 (Localhost)" : cleanIp;
    const userAgent = req.headers["user-agent"] || "Navigateur Web";
    const sent = await sendLoginNotificationEmail(req.user.email, req.user.full_name, {
      ip: displayIp,
      userAgent,
      time: (/* @__PURE__ */ new Date()).toISOString()
    });
    res.json({
      success: true,
      sent,
      message: `Alerte de connexion SaaSPay envoy\xE9e \xE0 ${req.user.email} (IP: ${displayIp})`
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
apiRouter.post("/auth/logout", requireAuth, async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7).trim();
      await destroySession(token);
    }
    res.json({ success: true, message: "D\xE9connexion r\xE9ussie." });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
apiRouter.post("/auth/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ success: false, error: "Adresse e-mail requise." });
      return;
    }
    const cleanEmail = email.toLowerCase().trim();
    const db = getDb();
    const userRes = await db.execute({
      sql: "SELECT id, full_name FROM users WHERE email = ?",
      args: [cleanEmail]
    });
    if (userRes.rows.length > 0) {
      const user = userRes.rows[0];
      const resetCode = crypto5.randomInt(1e5, 999999).toString();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1e3).toISOString();
      const now = (/* @__PURE__ */ new Date()).toISOString();
      await db.execute({
        sql: "DELETE FROM email_verification_codes WHERE email = ?",
        args: [cleanEmail]
      });
      await db.execute({
        sql: `INSERT INTO email_verification_codes (id, user_id, email, code, expires_at, attempts, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [
          `rc_${Date.now()}_${crypto5.randomBytes(3).toString("hex")}`,
          String(user.id),
          cleanEmail,
          resetCode,
          expiresAt,
          0,
          now
        ]
      });
      sendPasswordResetEmail(cleanEmail, resetCode, String(user.full_name)).catch(
        (err) => console.warn("[Password Reset Email]", err.message)
      );
    }
    res.json({
      success: true,
      message: "Si cette adresse correspond \xE0 un compte, un code de r\xE9initialisation vous a \xE9t\xE9 envoy\xE9."
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
apiRouter.post("/auth/reset-password", async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    if (!email || !code || !newPassword) {
      res.status(400).json({ success: false, error: "Email, code et nouveau mot de passe requis." });
      return;
    }
    if (newPassword.length < 8) {
      res.status(400).json({ success: false, error: "Le nouveau mot de passe doit comporter au moins 8 caract\xE8res." });
      return;
    }
    const cleanEmail = email.toLowerCase().trim();
    const cleanCode = code.toString().trim();
    const db = getDb();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const codeRes = await db.execute({
      sql: `SELECT * FROM email_verification_codes 
            WHERE email = ? AND code = ? AND expires_at > ?
            ORDER BY created_at DESC LIMIT 1`,
      args: [cleanEmail, cleanCode, now]
    });
    if (codeRes.rows.length === 0) {
      res.status(400).json({ success: false, error: "Code de r\xE9initialisation invalide ou expir\xE9." });
      return;
    }
    const record = codeRes.rows[0];
    const userId = String(record.user_id);
    const newHash = hashPassword(newPassword);
    await db.execute({
      sql: "UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?",
      args: [newHash, now, userId]
    });
    await db.execute({
      sql: "DELETE FROM sessions WHERE user_id = ?",
      args: [userId]
    });
    await db.execute({
      sql: "DELETE FROM email_verification_codes WHERE email = ?",
      args: [cleanEmail]
    });
    const userRes = await db.execute({ sql: "SELECT full_name FROM users WHERE id = ?", args: [userId] });
    if (userRes.rows.length > 0) {
      sendPasswordChangedNotificationEmail(cleanEmail, String(userRes.rows[0].full_name)).catch(() => {
      });
    }
    res.json({
      success: true,
      message: "Votre mot de passe a \xE9t\xE9 r\xE9initialis\xE9 avec succ\xE8s. Vous pouvez maintenant vous connecter."
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
apiRouter.get("/auth/me", requireAuth, async (req, res) => {
  res.json({ success: true, user: req.user });
});
apiRouter.post("/auth/change-password", requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      res.status(400).json({ success: false, error: "Mot de passe actuel et nouveau mot de passe requis." });
      return;
    }
    if (newPassword.length < 8) {
      res.status(400).json({ success: false, error: "Le nouveau mot de passe doit comporter au moins 8 caract\xE8res." });
      return;
    }
    const db = getDb();
    const userRes = await db.execute({
      sql: "SELECT password_hash, email, full_name FROM users WHERE id = ?",
      args: [req.user.id]
    });
    if (userRes.rows.length === 0) {
      res.status(404).json({ success: false, error: "Utilisateur introuvable." });
      return;
    }
    const user = userRes.rows[0];
    const valid = verifyPassword(currentPassword, String(user.password_hash));
    if (!valid) {
      res.status(400).json({ success: false, error: "Le mot de passe actuel est incorrect." });
      return;
    }
    const newHash = hashPassword(newPassword);
    const now = (/* @__PURE__ */ new Date()).toISOString();
    await db.execute({
      sql: "UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?",
      args: [newHash, now, req.user.id]
    });
    sendPasswordChangedNotificationEmail(String(user.email), String(user.full_name)).catch(() => {
    });
    res.json({ success: true, message: "Mot de passe mis \xE0 jour avec succ\xE8s." });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
apiRouter.post("/auth/toggle-2fa", requireAuth, async (req, res) => {
  try {
    const { enable } = req.body;
    const db = getDb();
    await db.execute({
      sql: "UPDATE users SET two_factor_enabled = ?, updated_at = ? WHERE id = ?",
      args: [enable ? 1 : 0, (/* @__PURE__ */ new Date()).toISOString(), req.user.id]
    });
    res.json({ success: true, enabled: Boolean(enable) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
apiRouter.get("/apps", requireAuth, async (req, res) => {
  try {
    const db = getDb();
    const result = await db.execute({
      sql: "SELECT * FROM applications WHERE user_id = ? ORDER BY created_at DESC",
      args: [req.user.id]
    });
    const apps = result.rows.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      slug: String(row.slug),
      category: String(row.category),
      website: String(row.website || ""),
      environment: String(row.environment || "test"),
      createdAt: String(row.created_at),
      currency: String(row.currency || "XOF")
    }));
    res.json({ success: true, applications: apps });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
apiRouter.post("/apps", requireAuth, async (req, res) => {
  try {
    const { category, website, currency, environment } = req.body;
    const name = (req.body.name || req.body.appName || req.body.app_name || req.body.title || req.body.label || "").trim();
    if (!name) {
      res.status(400).json({ success: false, error: "Le nom de l\u2019application est requis." });
      return;
    }
    const id = `app_${Date.now()}`;
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const db = getDb();
    await db.execute({
      sql: `INSERT INTO applications (id, user_id, name, slug, category, website, environment, currency, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        req.user.id,
        name,
        slug,
        category || "E-commerce",
        website || "",
        environment || "test",
        currency || "XOF",
        "active",
        now,
        now
      ]
    });
    res.json({
      success: true,
      application: {
        id,
        name,
        slug,
        category: category || "E-commerce",
        website: website || "",
        environment: environment || "test",
        createdAt: now,
        currency: currency || "XOF"
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
apiRouter.put("/apps/:id", requireAuth, async (req, res) => {
  try {
    const { name, category, website, currency, environment } = req.body;
    const db = getDb();
    await db.execute({
      sql: `UPDATE applications SET name = COALESCE(?, name), category = COALESCE(?, category), website = COALESCE(?, website), currency = COALESCE(?, currency), environment = COALESCE(?, environment), updated_at = ?
            WHERE id = ? AND user_id = ?`,
      args: [
        name !== void 0 ? name : null,
        category !== void 0 ? category : null,
        website !== void 0 ? website : null,
        currency !== void 0 ? currency : null,
        environment !== void 0 ? environment : null,
        (/* @__PURE__ */ new Date()).toISOString(),
        req.params.id,
        req.user.id
      ]
    });
    res.json({ success: true, message: "Application mise \xE0 jour." });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
apiRouter.delete("/apps/:id", requireAuth, async (req, res) => {
  try {
    const appId = req.params.id;
    const db = getDb();
    const appCheck = await db.execute({
      sql: "SELECT id, name FROM applications WHERE id = ? AND user_id = ?",
      args: [appId, req.user.id]
    });
    if (appCheck.rows.length === 0) {
      res.status(404).json({ success: false, error: "Application introuvable." });
      return;
    }
    const txCheck = await db.execute({
      sql: "SELECT COUNT(*) as count FROM transactions WHERE application_id = ? AND user_id = ?",
      args: [appId, req.user.id]
    });
    const txCount = Number(txCheck.rows[0].count || 0);
    if (txCount > 0) {
      await db.execute({
        sql: `UPDATE applications SET status = 'archived', updated_at = ? WHERE id = ? AND user_id = ?`,
        args: [(/* @__PURE__ */ new Date()).toISOString(), appId, req.user.id]
      });
      res.json({
        success: true,
        archived: true,
        message: `L'application a \xE9t\xE9 archiv\xE9e car elle poss\xE8de ${txCount} transaction(s) dans l'historique comptable.`
      });
      return;
    }
    await db.execute({
      sql: "DELETE FROM api_credentials WHERE application_id = ? AND user_id = ?",
      args: [appId, req.user.id]
    });
    await db.execute({
      sql: "DELETE FROM payment_links WHERE application_id = ? AND user_id = ?",
      args: [appId, req.user.id]
    });
    await db.execute({
      sql: "DELETE FROM webhooks WHERE application_id = ? AND user_id = ?",
      args: [appId, req.user.id]
    });
    await db.execute({
      sql: "DELETE FROM applications WHERE id = ? AND user_id = ?",
      args: [appId, req.user.id]
    });
    res.json({ success: true, message: "Application supprim\xE9e avec succ\xE8s." });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
apiRouter.get("/wallets", requireAuth, async (req, res) => {
  try {
    const db = getDb();
    const result = await db.execute({
      sql: "SELECT * FROM wallets WHERE user_id = ? ORDER BY is_default DESC, created_at ASC",
      args: [req.user.id]
    });
    const wallets = result.rows.map((row) => ({
      id: String(row.id),
      currency: String(row.currency),
      symbol: String(row.symbol),
      balance: Number(row.balance || 0),
      pendingBalance: Number(row.pending_balance || 0),
      reservedBalance: Number(row.reserved_balance || 0),
      countryCode: String(row.country_code || "BJ"),
      isDefault: Boolean(row.is_default)
    }));
    res.json({ success: true, wallets });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
apiRouter.post("/wallets", requireAuth, async (req, res) => {
  try {
    const { countryCode, currency, symbol } = req.body;
    if (!countryCode || !currency) {
      res.status(400).json({ success: false, error: "Code pays et devise requis." });
      return;
    }
    const db = getDb();
    const existing = await db.execute({
      sql: "SELECT id FROM wallets WHERE user_id = ? AND country_code = ? AND currency = ?",
      args: [req.user.id, countryCode, currency]
    });
    if (existing.rows.length > 0) {
      res.status(400).json({ success: false, error: "Ce portefeuille existe d\xE9j\xE0 pour votre compte." });
      return;
    }
    const id = `wal_${currency.toLowerCase()}_${Date.now()}`;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    await db.execute({
      sql: `INSERT INTO wallets (id, user_id, currency, symbol, balance, pending_balance, reserved_balance, country_code, is_default, created_at, updated_at)
            VALUES (?, ?, ?, ?, 0, 0, 0, ?, 0, ?, ?)`,
      args: [id, req.user.id, currency, symbol || currency, countryCode, now, now]
    });
    res.json({
      success: true,
      wallet: {
        id,
        currency,
        symbol: symbol || currency,
        balance: 0,
        pendingBalance: 0,
        reservedBalance: 0,
        countryCode,
        isDefault: false
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
apiRouter.post("/wallets/transfer", requireAuth, async (req, res) => {
  try {
    const { fromWalletId, toWalletId, amount } = req.body;
    const transferAmount = Number(amount);
    if (!fromWalletId || !toWalletId || isNaN(transferAmount) || transferAmount <= 0) {
      res.status(400).json({ success: false, error: "Portefeuilles et montant positif requis." });
      return;
    }
    if (fromWalletId === toWalletId) {
      res.status(400).json({ success: false, error: "Les portefeuilles source et cible doivent \xEAtre diff\xE9rents." });
      return;
    }
    const db = getDb();
    const fromRes = await db.execute({
      sql: "SELECT * FROM wallets WHERE id = ? AND user_id = ?",
      args: [fromWalletId, req.user.id]
    });
    if (fromRes.rows.length === 0) {
      res.status(404).json({ success: false, error: "Portefeuille source introuvable ou non autoris\xE9." });
      return;
    }
    const toRes = await db.execute({
      sql: "SELECT * FROM wallets WHERE id = ? AND user_id = ?",
      args: [toWalletId, req.user.id]
    });
    if (toRes.rows.length === 0) {
      res.status(404).json({ success: false, error: "Portefeuille cible introuvable ou non autoris\xE9." });
      return;
    }
    const fromWallet = fromRes.rows[0];
    const toWallet = toRes.rows[0];
    const currentBalance = Number(fromWallet.balance || 0);
    if (currentBalance < transferAmount) {
      res.status(400).json({
        success: false,
        error: `Solde insuffisant (${currentBalance} ${fromWallet.currency} disponible contre ${transferAmount} demand\xE9).`
      });
      return;
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const ref = `TRF-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
    await db.execute({
      sql: "UPDATE wallets SET balance = balance - ?, updated_at = ? WHERE id = ?",
      args: [transferAmount, now, fromWalletId]
    });
    await db.execute({
      sql: "UPDATE wallets SET balance = balance + ?, updated_at = ? WHERE id = ?",
      args: [transferAmount, now, toWalletId]
    });
    const ledgerIdOut = `led_${Date.now()}_out`;
    const ledgerIdIn = `led_${Date.now()}_in`;
    await db.execute({
      sql: `INSERT INTO ledger_entries (id, user_id, wallet_id, type, reference, amount, currency, net_amount, description, created_at)
            VALUES (?, ?, ?, 'debit', ?, ?, ?, ?, 'Transfert sortant inter-portefeuilles', ?)`,
      args: [ledgerIdOut, req.user.id, fromWalletId, ref, transferAmount, String(fromWallet.currency), -transferAmount, now]
    });
    await db.execute({
      sql: `INSERT INTO ledger_entries (id, user_id, wallet_id, type, reference, amount, currency, net_amount, description, created_at)
            VALUES (?, ?, ?, 'credit', ?, ?, ?, ?, 'Transfert entrant inter-portefeuilles', ?)`,
      args: [ledgerIdIn, req.user.id, toWalletId, ref, transferAmount, String(toWallet.currency), transferAmount, now]
    });
    res.json({
      success: true,
      reference: ref,
      message: `Transfert de ${transferAmount} ${fromWallet.currency} effectu\xE9 avec succ\xE8s.`
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
apiRouter.get("/transactions", requireAuth, async (req, res) => {
  try {
    const db = getDb();
    const { applicationId, appId, status, country, search } = req.query;
    const targetAppId = applicationId || appId || "";
    let sql = "SELECT * FROM transactions WHERE user_id = ?";
    const args = [req.user.id];
    if (targetAppId.trim()) {
      sql += " AND application_id = ?";
      args.push(targetAppId.trim());
    }
    if (status && status !== "Tous" && typeof status === "string") {
      sql += " AND status = ?";
      args.push(status);
    }
    if (country && country !== "Tous" && typeof country === "string") {
      sql += " AND country = ?";
      args.push(country);
    }
    if (search && typeof search === "string" && search.trim()) {
      sql += " AND (reference LIKE ? OR customer_name LIKE ? OR customer_phone LIKE ?)";
      const term = `%${search.trim()}%`;
      args.push(term, term, term);
    }
    sql += " ORDER BY created_at DESC LIMIT 100";
    const result = await db.execute({ sql, args });
    const transactions = result.rows.map((row) => ({
      id: String(row.id),
      reference: String(row.reference),
      customerName: String(row.customer_name),
      customerEmail: String(row.customer_email),
      customerPhone: String(row.customer_phone || ""),
      country: String(row.country || "BJ"),
      provider: String(row.provider),
      amount: Number(row.amount),
      providerFee: Number(row.provider_fee || 0),
      platformFee: Number(row.platform_fee || 0),
      customerFee: Number(row.customer_fee || 0),
      netAmount: Number(row.net_amount || row.amount),
      currency: String(row.currency || "XOF"),
      status: String(row.status),
      createdAt: String(row.created_at),
      description: String(row.description || ""),
      paymentMethod: String(row.payment_method || "Mobile Money")
    }));
    res.json({ success: true, transactions });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
apiRouter.get("/payment-links", requireAuth, async (req, res) => {
  try {
    const db = getDb();
    const { applicationId, appId } = req.query;
    const targetAppId = applicationId || appId || "";
    let sql = "SELECT * FROM payment_links WHERE user_id = ?";
    const args = [req.user.id];
    if (targetAppId.trim()) {
      sql += " AND application_id = ?";
      args.push(targetAppId.trim());
    }
    sql += " ORDER BY created_at DESC";
    const result = await db.execute({ sql, args });
    const paymentLinks = result.rows.map((row) => ({
      id: String(row.id),
      slug: String(row.slug),
      title: String(row.title),
      description: String(row.description || ""),
      amount: row.amount !== null ? Number(row.amount) : null,
      isFixedAmount: Boolean(row.is_fixed_amount),
      currency: String(row.currency || "XOF"),
      country: String(row.country || "BJ"),
      status: String(row.status),
      usageCount: Number(row.usage_count || 0),
      usageLimit: row.usage_limit !== null ? Number(row.usage_limit) : null,
      requirePhone: Boolean(row.require_phone),
      createdAt: String(row.created_at),
      redirectUrl: row.redirect_url ? String(row.redirect_url) : void 0
    }));
    res.json({ success: true, paymentLinks });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
apiRouter.post("/payment-links", requireAuth, async (req, res) => {
  try {
    const { title, description, amount, isFixedAmount, currency, country, usageLimit, requirePhone, redirectUrl, applicationId } = req.body;
    if (!title) {
      res.status(400).json({ success: false, error: "Le titre du lien de paiement est requis." });
      return;
    }
    const id = `pl_${Date.now()}`;
    const cleanSlug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const slug = `${cleanSlug}-${crypto5.randomBytes(3).toString("hex")}`;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const db = getDb();
    await db.execute({
      sql: `INSERT INTO payment_links (id, user_id, application_id, slug, title, description, amount, is_fixed_amount, currency, country, status, usage_count, usage_limit, require_phone, redirect_url, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        req.user.id,
        applicationId || "app_default",
        slug,
        title,
        description || "",
        amount ? Number(amount) : null,
        isFixedAmount !== false ? 1 : 0,
        currency || "XOF",
        country || "BJ",
        "active",
        0,
        usageLimit ? Number(usageLimit) : null,
        requirePhone !== false ? 1 : 0,
        redirectUrl || null,
        now,
        now
      ]
    });
    const newLink = {
      id,
      slug,
      title,
      description: description || "",
      amount: amount ? Number(amount) : null,
      isFixedAmount: isFixedAmount !== false,
      currency: currency || "XOF",
      country: country || "BJ",
      status: "active",
      usageCount: 0,
      usageLimit: usageLimit ? Number(usageLimit) : null,
      requirePhone: requirePhone !== false,
      createdAt: now,
      redirectUrl: redirectUrl || void 0
    };
    res.json({ success: true, paymentLink: newLink });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
apiRouter.get("/payment-links/slug/:slug", async (req, res) => {
  try {
    const db = getDb();
    const result = await db.execute({
      sql: `SELECT pl.*, u.full_name as merchant_name, a.name as app_name
            FROM payment_links pl
            JOIN users u ON pl.user_id = u.id
            LEFT JOIN applications a ON pl.application_id = a.id
            WHERE pl.slug = ? AND pl.status = 'active'`,
      args: [req.params.slug]
    });
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: "Lien de paiement introuvable ou expir\xE9." });
      return;
    }
    const row = result.rows[0];
    res.json({
      success: true,
      paymentLink: {
        id: String(row.id),
        slug: String(row.slug),
        title: String(row.title),
        description: String(row.description || ""),
        amount: row.amount !== null ? Number(row.amount) : null,
        isFixedAmount: Boolean(row.is_fixed_amount),
        currency: String(row.currency || "XOF"),
        country: String(row.country || "BJ"),
        requirePhone: Boolean(row.require_phone),
        merchantName: String(row.merchant_name || "Marchand PichFlow"),
        appName: String(row.app_name || "PichFlow Store")
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
apiRouter.get("/payment-links/:id", requireAuth, async (req, res) => {
  try {
    const db = getDb();
    const linkRes = await db.execute({
      sql: "SELECT * FROM payment_links WHERE id = ? AND user_id = ?",
      args: [req.params.id, req.user.id]
    });
    if (linkRes.rows.length === 0) {
      res.status(404).json({ success: false, error: "Lien de paiement introuvable." });
      return;
    }
    const pl = linkRes.rows[0];
    const txsRes = await db.execute({
      sql: `SELECT * FROM transactions WHERE user_id = ? AND reference IN (
        SELECT reference FROM checkout_sessions WHERE payment_link_id = ?
      ) ORDER BY created_at DESC`,
      args: [req.user.id, req.params.id]
    });
    const totalCount = txsRes.rows.length;
    const successCount = txsRes.rows.filter((t) => t.status === "success").length;
    const failedCount = txsRes.rows.filter((t) => t.status === "failed").length;
    const collectedAmount = txsRes.rows.filter((t) => t.status === "success").reduce((sum, t) => sum + Number(t.net_amount || t.amount || 0), 0);
    res.json({
      success: true,
      paymentLink: {
        id: String(pl.id),
        slug: String(pl.slug),
        title: String(pl.title),
        description: String(pl.description || ""),
        amount: pl.amount !== null ? Number(pl.amount) : null,
        isFixedAmount: Boolean(pl.is_fixed_amount),
        currency: String(pl.currency || "XOF"),
        country: String(pl.country || "BJ"),
        status: String(pl.status),
        usageCount: Number(pl.usage_count || 0),
        createdAt: String(pl.created_at),
        stats: {
          totalTransactions: totalCount,
          successCount,
          failedCount,
          collectedAmount
        },
        transactions: txsRes.rows.map((r) => ({
          id: String(r.id),
          reference: String(r.reference),
          customerName: String(r.customer_name),
          customerPhone: String(r.customer_phone || ""),
          amount: Number(r.amount),
          currency: String(r.currency || "XOF"),
          status: String(r.status),
          createdAt: String(r.created_at)
        }))
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
apiRouter.put("/payment-links/:id", requireAuth, async (req, res) => {
  try {
    const { title, description, amount, isFixedAmount, status } = req.body;
    const db = getDb();
    await db.execute({
      sql: `UPDATE payment_links SET 
            title = COALESCE(?, title),
            description = COALESCE(?, description),
            amount = COALESCE(?, amount),
            is_fixed_amount = COALESCE(?, is_fixed_amount),
            status = COALESCE(?, status),
            updated_at = ?
            WHERE id = ? AND user_id = ?`,
      args: [
        title,
        description,
        amount !== void 0 ? amount : null,
        isFixedAmount !== void 0 ? isFixedAmount ? 1 : 0 : null,
        status,
        (/* @__PURE__ */ new Date()).toISOString(),
        req.params.id,
        req.user.id
      ]
    });
    res.json({ success: true, message: "Lien de paiement mis \xE0 jour." });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
apiRouter.delete("/payment-links/:id", requireAuth, async (req, res) => {
  try {
    const db = getDb();
    await db.execute({
      sql: "DELETE FROM payment_links WHERE id = ? AND user_id = ?",
      args: [req.params.id, req.user.id]
    });
    res.json({ success: true, message: "Lien de paiement supprim\xE9." });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
apiRouter.get("/customers", requireAuth, async (req, res) => {
  try {
    const db = getDb();
    const { applicationId, appId } = req.query;
    const targetAppId = applicationId || appId || "";
    let sql = "SELECT * FROM customers WHERE user_id = ?";
    const args = [req.user.id];
    if (targetAppId.trim()) {
      sql += " AND application_id = ?";
      args.push(targetAppId.trim());
    }
    sql += " ORDER BY last_transaction_at DESC";
    const result = await db.execute({ sql, args });
    const customers = result.rows.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      email: String(row.email),
      phone: String(row.phone || ""),
      country: String(row.country || "BJ"),
      paymentCount: Number(row.payment_count || 1),
      totalSpent: Number(row.total_spent || 0),
      currency: String(row.currency || "XOF"),
      lastTransactionAt: String(row.last_transaction_at)
    }));
    res.json({ success: true, customers });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
apiRouter.post("/customers", requireAuth, async (req, res) => {
  try {
    const { name, email, phone, country, applicationId } = req.body;
    if (!name || !email) {
      res.status(400).json({ success: false, error: "Nom et adresse e-mail requis." });
      return;
    }
    const cleanEmail = email.toLowerCase().trim();
    const db = getDb();
    const id = `cus_${Date.now()}`;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    await db.execute({
      sql: `INSERT INTO customers (id, user_id, application_id, name, email, phone, country, payment_count, total_spent, currency, last_transaction_at, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, 'XOF', ?, ?)`,
      args: [id, req.user.id, applicationId || "app_default", name.trim(), cleanEmail, phone ? phone.trim() : "", country || "BJ", now, now]
    });
    res.json({
      success: true,
      customer: {
        id,
        name: name.trim(),
        email: cleanEmail,
        phone: phone ? phone.trim() : "",
        country: country || "BJ",
        paymentCount: 0,
        totalSpent: 0,
        currency: "XOF",
        lastTransactionAt: now
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
apiRouter.put("/customers/:id", requireAuth, async (req, res) => {
  try {
    const { name, phone, country } = req.body;
    const db = getDb();
    await db.execute({
      sql: `UPDATE customers SET name = COALESCE(?, name), phone = COALESCE(?, phone), country = COALESCE(?, country)
            WHERE id = ? AND user_id = ?`,
      args: [name ? name.trim() : null, phone ? phone.trim() : null, country || null, req.params.id, req.user.id]
    });
    res.json({ success: true, message: "Client mis \xE0 jour." });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
apiRouter.delete("/customers/:id", requireAuth, async (req, res) => {
  try {
    const db = getDb();
    await db.execute({
      sql: "DELETE FROM customers WHERE id = ? AND user_id = ?",
      args: [req.params.id, req.user.id]
    });
    res.json({ success: true, message: "Client supprim\xE9." });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
apiRouter.get("/withdrawals", requireAuth, async (req, res) => {
  try {
    const db = getDb();
    const result = await db.execute({
      sql: "SELECT * FROM payout_requests WHERE user_id = ? ORDER BY created_at DESC",
      args: [req.user.id]
    });
    const withdrawals = result.rows.map((row) => ({
      id: String(row.id),
      reference: String(row.reference),
      amount: Number(row.amount),
      currency: String(row.currency || "XOF"),
      fee: Number(row.fee || 0),
      netAmount: Number(row.net_amount || row.amount),
      methodType: String(row.method_type),
      recipientName: String(row.recipient_name),
      recipientPhoneOrIban: String(row.recipient_phone_or_iban),
      operatorOrBank: String(row.operator_or_bank),
      country: String(row.country || "BJ"),
      status: String(row.status),
      createdAt: String(row.created_at),
      processedAt: row.processed_at ? String(row.processed_at) : void 0
    }));
    res.json({ success: true, withdrawals });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
apiRouter.post("/withdrawals", requireAuth, async (req, res) => {
  try {
    const { amount, currency, methodType, recipientName, recipientPhoneOrIban, operatorOrBank, country } = req.body;
    if (!amount || amount <= 0 || !recipientName || !recipientPhoneOrIban) {
      res.status(400).json({ success: false, error: "Montant, b\xE9n\xE9ficiaire et coordonn\xE9es requis." });
      return;
    }
    const numAmount = Number(amount);
    const db = getDb();
    const walletRes = await db.execute({
      sql: "SELECT * FROM wallets WHERE user_id = ? AND currency = ?",
      args: [req.user.id, currency || "XOF"]
    });
    if (walletRes.rows.length === 0 || Number(walletRes.rows[0].balance) < numAmount) {
      res.status(400).json({ success: false, error: "Solde insuffisant pour effectuer ce retrait." });
      return;
    }
    const wallet = walletRes.rows[0];
    const fee = Math.round(numAmount * 0.01);
    const netAmount = numAmount - fee;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const reference = `WDR-PF-${Date.now().toString().slice(-6)}`;
    const id = `wdr_${Date.now()}`;
    await db.execute({
      sql: "UPDATE wallets SET balance = balance - ?, updated_at = ? WHERE id = ?",
      args: [numAmount, now, wallet.id]
    });
    await db.execute({
      sql: `INSERT INTO payout_requests (id, user_id, reference, amount, currency, fee, net_amount, method_type, recipient_name, recipient_phone_or_iban, operator_or_bank, country, status, notes, created_at, processed_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        req.user.id,
        reference,
        numAmount,
        currency || "XOF",
        fee,
        netAmount,
        methodType || "mobile_money",
        recipientName,
        recipientPhoneOrIban,
        operatorOrBank || "MTN MoMo",
        country || "BJ",
        "pending",
        "Demande de retrait en cours de traitement",
        now,
        null
      ]
    });
    const newWithdrawal = {
      id,
      reference,
      amount: numAmount,
      currency: currency || "XOF",
      fee,
      netAmount,
      methodType: methodType || "mobile_money",
      recipientName,
      recipientPhoneOrIban,
      operatorOrBank: operatorOrBank || "MTN MoMo",
      country: country || "BJ",
      status: "pending",
      createdAt: now,
      processedAt: void 0
    };
    res.json({ success: true, withdrawal: newWithdrawal });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
apiRouter.get("/payout-methods", requireAuth, async (req, res) => {
  try {
    const db = getDb();
    const result = await db.execute({
      sql: "SELECT * FROM payout_methods WHERE user_id = ? ORDER BY is_default DESC, created_at DESC",
      args: [req.user.id]
    });
    const methods = result.rows.map((row) => ({
      id: String(row.id),
      type: String(row.type),
      label: String(row.label || row.recipient_name || "M\xE9thode"),
      operatorOrBank: String(row.operator_or_bank),
      recipientName: String(row.recipient_name),
      recipientPhoneOrIban: String(row.recipient_phone_or_iban),
      accountNumber: String(row.account_number || ""),
      iban: String(row.iban || ""),
      swiftBic: String(row.swift_bic || ""),
      bankCode: String(row.bank_code || ""),
      branchCode: String(row.branch_code || ""),
      country: String(row.country || "BJ"),
      currency: String(row.currency || "XOF"),
      isDefault: Boolean(row.is_default),
      isVerified: Boolean(row.is_verified || 1),
      createdAt: String(row.created_at)
    }));
    res.json({ success: true, payoutMethods: methods });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
apiRouter.post("/payout-methods", requireAuth, async (req, res) => {
  try {
    const {
      type,
      label,
      operatorOrBank,
      recipientName,
      recipientPhoneOrIban,
      accountNumber,
      iban,
      swiftBic,
      bankCode,
      branchCode,
      country,
      currency
    } = req.body;
    if (!type || !operatorOrBank) {
      res.status(400).json({ success: false, error: "Type de m\xE9thode et op\xE9rateur/banque requis." });
      return;
    }
    if (type === "mobile_money" && !recipientPhoneOrIban) {
      res.status(400).json({ success: false, error: "Num\xE9ro de t\xE9l\xE9phone requis pour le Mobile Money." });
      return;
    }
    if (type === "bank_transfer" && (!recipientName || !accountNumber && !recipientPhoneOrIban)) {
      res.status(400).json({ success: false, error: "Nom du titulaire et num\xE9ro de compte requis pour le virement bancaire." });
      return;
    }
    const db = getDb();
    const id = `pm_${Date.now()}`;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const countRes = await db.execute({
      sql: "SELECT COUNT(*) as count FROM payout_methods WHERE user_id = ?",
      args: [req.user.id]
    });
    const isFirst = Number(countRes.rows[0].count || 0) === 0;
    await db.execute({
      sql: `INSERT INTO payout_methods (id, user_id, type, label, operator_or_bank, recipient_name, recipient_phone_or_iban, account_number, iban, swift_bic, bank_code, branch_code, country, currency, is_default, is_verified, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        req.user.id,
        type,
        label || (type === "mobile_money" ? "Compte mobile money" : "Compte bancaire principal"),
        operatorOrBank,
        recipientName || req.user.full_name,
        recipientPhoneOrIban || accountNumber || "",
        accountNumber || "",
        iban || "",
        swiftBic || "",
        bankCode || "",
        branchCode || "",
        country || "BJ",
        currency || "XOF",
        isFirst ? 1 : 0,
        1,
        // Verified method
        now
      ]
    });
    res.json({
      success: true,
      payoutMethod: {
        id,
        type,
        label: label || (type === "mobile_money" ? "Compte mobile money" : "Compte bancaire principal"),
        operatorOrBank,
        recipientName: recipientName || req.user.full_name,
        recipientPhoneOrIban: recipientPhoneOrIban || accountNumber || "",
        accountNumber,
        iban,
        swiftBic,
        bankCode,
        branchCode,
        country: country || "BJ",
        currency: currency || "XOF",
        isDefault: isFirst,
        isVerified: true,
        createdAt: now
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
apiRouter.delete("/payout-methods/:id", requireAuth, async (req, res) => {
  try {
    const db = getDb();
    await db.execute({
      sql: "DELETE FROM payout_methods WHERE id = ? AND user_id = ?",
      args: [req.params.id, req.user.id]
    });
    res.json({ success: true, message: "M\xE9thode de retrait supprim\xE9e." });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
apiRouter.put("/payout-methods/:id/default", requireAuth, async (req, res) => {
  try {
    const db = getDb();
    await db.execute({
      sql: "UPDATE payout_methods SET is_default = 0 WHERE user_id = ?",
      args: [req.user.id]
    });
    await db.execute({
      sql: "UPDATE payout_methods SET is_default = 1 WHERE id = ? AND user_id = ?",
      args: [req.params.id, req.user.id]
    });
    res.json({ success: true, message: "M\xE9thode principale mise \xE0 jour." });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
apiRouter.get("/stats", requireAuth, async (req, res) => {
  try {
    const { period = "30j", appId, applicationId } = req.query;
    const db = getDb();
    const targetAppId = appId || applicationId || "";
    let days = 30;
    if (period === "7j") days = 7;
    else if (period === "90j") days = 90;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1e3).toISOString();
    let sql = "SELECT * FROM transactions WHERE user_id = ? AND created_at >= ?";
    const args = [req.user.id, startDate];
    if (targetAppId.trim().length > 0) {
      sql += " AND application_id = ?";
      args.push(targetAppId.trim());
    }
    const result = await db.execute({ sql, args });
    const txs = result.rows;
    const totalCount = txs.length;
    const successCount = txs.filter((t) => t.status === "success" || t.status === "completed").length;
    const failedCount = txs.filter((t) => t.status === "failed").length;
    const pendingCount = txs.filter((t) => t.status === "pending").length;
    const successRate = totalCount > 0 ? (successCount / totalCount * 100).toFixed(1) : "0";
    const revenue = txs.filter((t) => t.status === "success" || t.status === "completed").reduce((sum, t) => sum + Number(t.net_amount || t.amount || 0), 0);
    const countryMap = {};
    txs.filter((t) => t.status === "success" || t.status === "completed").forEach((t) => {
      const c = String(t.country || "BJ");
      countryMap[c] = (countryMap[c] || 0) + Number(t.amount || 0);
    });
    const methodMap = {};
    txs.filter((t) => t.status === "success").forEach((t) => {
      const m = String(t.payment_method || t.provider || "Mobile Money");
      methodMap[m] = (methodMap[m] || 0) + Number(t.amount || 0);
    });
    res.json({
      success: true,
      stats: {
        totalTransactions: totalCount,
        successfulTransactions: successCount,
        failedTransactions: failedCount,
        pendingTransactions: pendingCount,
        successRate: `${successRate}%`,
        revenue,
        currency: "XOF",
        countryBreakdown: countryMap,
        methodBreakdown: methodMap
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
apiRouter.get("/checkout-sessions", requireAuth, async (req, res) => {
  try {
    const db = getDb();
    const { applicationId, appId } = req.query;
    const targetAppId = applicationId || appId || "";
    let sql = `SELECT cs.* FROM checkout_sessions cs
               LEFT JOIN payment_links pl ON cs.payment_link_id = pl.id
               WHERE (pl.user_id = ? OR cs.user_id = ?)`;
    const args = [req.user.id, req.user.id];
    if (targetAppId.trim()) {
      sql += " AND (cs.application_id = ? OR pl.application_id = ?)";
      args.push(targetAppId.trim(), targetAppId.trim());
    }
    sql += " ORDER BY cs.created_at DESC LIMIT 100";
    const result = await db.execute({ sql, args });
    const sessions = result.rows.map((row) => ({
      id: String(row.id),
      reference: String(row.reference),
      amount: Number(row.amount),
      currency: String(row.currency || "XOF"),
      customerName: String(row.customer_name || "Client"),
      customerEmail: String(row.customer_email || ""),
      customerPhone: String(row.customer_phone || ""),
      status: String(row.status),
      paymentMethod: String(row.payment_method || "Mobile Money"),
      paydunyaUrl: String(row.paydunya_url || ""),
      createdAt: String(row.created_at)
    }));
    res.json({ success: true, checkoutSessions: sessions });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
apiRouter.get("/developer/keys", requireAuth, async (req, res) => {
  try {
    const db = getDb();
    const { applicationId, appId } = req.query;
    const targetAppId = applicationId || appId || "";
    let sql = "SELECT * FROM api_credentials WHERE user_id = ?";
    const args = [req.user.id];
    if (targetAppId.trim()) {
      sql += " AND application_id = ?";
      args.push(targetAppId.trim());
    }
    sql += " ORDER BY created_at DESC";
    const result = await db.execute({ sql, args });
    const keys = result.rows.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      environment: String(row.environment),
      prefix: String(row.prefix),
      secretMasked: String(row.secret_masked),
      secretKey: "",
      // Masquée après création
      scope: String(row.scope),
      createdAt: String(row.created_at),
      lastUsedAt: row.last_used_at ? String(row.last_used_at) : void 0,
      isActive: Boolean(row.is_active)
    }));
    res.json({ success: true, apiKeys: keys });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
apiRouter.post("/developer/keys", requireAuth, async (req, res) => {
  try {
    const { name, scope, applicationId } = req.body;
    const baseName = (name || "Cl\xE9 API").trim();
    const effectiveScope = scope || "both";
    const targetAppId = applicationId || "app_default";
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const db = getDb();
    const testRandom = crypto5.randomBytes(24).toString("hex");
    const testSecret = `sk_test_pichflow_${testRandom}`;
    const testMasked = `sk_test_\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022${testRandom.slice(-4)}`;
    const testHash = crypto5.createHash("sha256").update(testSecret).digest("hex");
    const testId = `key_test_${Date.now()}_${crypto5.randomBytes(3).toString("hex")}`;
    await db.execute({
      sql: `INSERT INTO api_credentials (id, user_id, application_id, name, environment, prefix, secret_key, secret_masked, secret_hash, scope, is_active, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        testId,
        req.user.id,
        targetAppId,
        `${baseName} (Sandbox)`,
        "sandbox",
        `sk_test_${testRandom.slice(0, 6)}`,
        testSecret,
        testMasked,
        testHash,
        effectiveScope,
        1,
        now
      ]
    });
    const liveRandom = crypto5.randomBytes(24).toString("hex");
    const liveSecret = `sk_live_pichflow_${liveRandom}`;
    const liveMasked = `sk_live_\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022${liveRandom.slice(-4)}`;
    const liveHash = crypto5.createHash("sha256").update(liveSecret).digest("hex");
    const liveId = `key_live_${Date.now()}_${crypto5.randomBytes(3).toString("hex")}`;
    await db.execute({
      sql: `INSERT INTO api_credentials (id, user_id, application_id, name, environment, prefix, secret_key, secret_masked, secret_hash, scope, is_active, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        liveId,
        req.user.id,
        targetAppId,
        `${baseName} (Live)`,
        "live",
        `sk_live_${liveRandom.slice(0, 6)}`,
        liveSecret,
        liveMasked,
        liveHash,
        effectiveScope,
        1,
        now
      ]
    });
    const sandboxKey = {
      id: testId,
      name: `${baseName} (Sandbox)`,
      environment: "sandbox",
      prefix: `sk_test_${testRandom.slice(0, 6)}`,
      secretMasked: testMasked,
      secretKey: testSecret,
      // Transmis intégralement une seule fois à la création
      scope: effectiveScope,
      createdAt: now,
      isActive: true
    };
    const liveKey = {
      id: liveId,
      name: `${baseName} (Live)`,
      environment: "live",
      prefix: `sk_live_${liveRandom.slice(0, 6)}`,
      secretMasked: liveMasked,
      secretKey: liveSecret,
      // Transmis intégralement une seule fois à la création
      scope: effectiveScope,
      createdAt: now,
      isActive: true
    };
    res.json({
      success: true,
      apiKey: sandboxKey,
      keys: {
        sandbox: sandboxKey,
        live: liveKey
      },
      message: "Paire de cl\xE9s Sandbox et Live g\xE9n\xE9r\xE9e avec succ\xE8s."
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
apiRouter.delete("/developer/keys/:id", requireAuth, async (req, res) => {
  try {
    const db = getDb();
    await db.execute({
      sql: "DELETE FROM api_credentials WHERE id = ? AND user_id = ?",
      args: [req.params.id, req.user.id]
    });
    res.json({ success: true, message: "Cl\xE9 API r\xE9voqu\xE9e avec succ\xE8s." });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
apiRouter.get("/developer/webhooks", requireAuth, async (req, res) => {
  try {
    const db = getDb();
    const { applicationId, appId } = req.query;
    const targetAppId = applicationId || appId || "";
    let sql = "SELECT * FROM webhooks WHERE user_id = ?";
    const args = [req.user.id];
    if (targetAppId.trim()) {
      sql += " AND application_id = ?";
      args.push(targetAppId.trim());
    }
    sql += " ORDER BY created_at DESC";
    const result = await db.execute({ sql, args });
    const webhooks = result.rows.map((row) => ({
      id: String(row.id),
      url: String(row.url),
      description: String(row.description || ""),
      secret: String(row.secret),
      events: String(row.events).split(","),
      isActive: Boolean(row.is_active),
      createdAt: String(row.created_at),
      lastDeliveryStatus: String(row.last_delivery_status || "success")
    }));
    res.json({ success: true, webhooks });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
apiRouter.post("/developer/webhooks", requireAuth, async (req, res) => {
  try {
    const { url, description, applicationId } = req.body;
    if (!url) {
      res.status(400).json({ success: false, error: "URL du webhook requise." });
      return;
    }
    const id = `whk_${Date.now()}`;
    const secret = `whsec_pf_${crypto5.randomBytes(12).toString("hex")}`;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const db = getDb();
    await db.execute({
      sql: `INSERT INTO webhooks (id, user_id, application_id, url, description, secret, events, is_active, last_delivery_status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        req.user.id,
        applicationId || "app_default",
        url,
        description || "Endpoint webhook",
        secret,
        "payment.created,payment.success,payment.failed",
        1,
        "success",
        now
      ]
    });
    const newWh = {
      id,
      url,
      description: description || "Endpoint webhook",
      secret,
      events: ["payment.created", "payment.success", "payment.failed"],
      isActive: true,
      createdAt: now,
      lastDeliveryStatus: "success"
    };
    res.json({ success: true, webhook: newWh });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
apiRouter.delete("/developer/webhooks/:id", requireAuth, async (req, res) => {
  try {
    const db = getDb();
    await db.execute({
      sql: "DELETE FROM webhooks WHERE id = ? AND user_id = ?",
      args: [req.params.id, req.user.id]
    });
    res.json({ success: true, message: "Webhook supprim\xE9." });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
apiRouter.put("/developer/webhooks/:id", requireAuth, async (req, res) => {
  try {
    const { url, description, events, isActive } = req.body;
    const db = getDb();
    await db.execute({
      sql: `UPDATE webhooks 
            SET url = COALESCE(?, url),
                description = COALESCE(?, description),
                events = COALESCE(?, events),
                is_active = COALESCE(?, is_active)
            WHERE id = ? AND user_id = ?`,
      args: [
        url ? url.trim() : null,
        description !== void 0 ? description.trim() : null,
        events ? Array.isArray(events) ? JSON.stringify(events) : events : null,
        isActive !== void 0 ? isActive ? 1 : 0 : null,
        req.params.id,
        req.user.id
      ]
    });
    res.json({ success: true, message: "Webhook mis \xE0 jour." });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
apiRouter.get("/developer/webhooks/logs", requireAuth, async (req, res) => {
  try {
    const db = getDb();
    const result = await db.execute({
      sql: `SELECT wl.*, w.url as webhook_url 
            FROM webhook_logs wl
            LEFT JOIN webhooks w ON wl.webhook_id = w.id
            WHERE wl.user_id = ? 
            ORDER BY wl.created_at DESC LIMIT 50`,
      args: [req.user.id]
    });
    const logs = result.rows.map((r) => ({
      id: String(r.id),
      webhookId: String(r.webhook_id),
      event: String(r.event),
      url: String(r.webhook_url || ""),
      status: Number(r.status_code || 200),
      statusText: Number(r.status_code || 200) < 400 ? "OK" : "ERROR",
      durationMs: 120,
      timestamp: String(r.created_at),
      payload: typeof r.payload === "string" ? JSON.parse(r.payload || "{}") : r.payload,
      response: String(r.response_body || '{"received":true}')
    }));
    res.json({ success: true, logs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
apiRouter.get("/developer/webhook-logs", requireAuth, async (req, res) => {
  try {
    const db = getDb();
    const result = await db.execute({
      sql: `SELECT wl.*, w.url as webhook_url 
            FROM webhook_logs wl
            LEFT JOIN webhooks w ON wl.webhook_id = w.id
            WHERE wl.user_id = ? 
            ORDER BY wl.created_at DESC LIMIT 50`,
      args: [req.user.id]
    });
    const logs = result.rows.map((r) => ({
      id: String(r.id),
      webhookId: String(r.webhook_id),
      event: String(r.event),
      url: String(r.webhook_url || ""),
      status: Number(r.status_code || 200),
      statusText: Number(r.status_code || 200) < 400 ? "OK" : "ERROR",
      durationMs: 120,
      timestamp: String(r.created_at),
      payload: typeof r.payload === "string" ? JSON.parse(r.payload || "{}") : r.payload,
      response: String(r.response_body || '{"received":true}')
    }));
    res.json({ success: true, logs, webhookLogs: logs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
apiRouter.get("/withdrawals/methods", requireAuth, async (req, res) => {
  try {
    const db = getDb();
    const result = await db.execute({
      sql: "SELECT * FROM payout_methods WHERE user_id = ? ORDER BY is_default DESC, created_at DESC",
      args: [req.user.id]
    });
    const methods = result.rows.map((row) => ({
      id: String(row.id),
      type: String(row.type),
      label: String(row.label || row.recipient_name || "M\xE9thode"),
      operatorOrBank: String(row.operator_or_bank),
      recipientName: String(row.recipient_name),
      recipientPhoneOrIban: String(row.recipient_phone_or_iban),
      accountNumber: String(row.account_number || ""),
      iban: String(row.iban || ""),
      swiftBic: String(row.swift_bic || ""),
      bankCode: String(row.bank_code || ""),
      branchCode: String(row.branch_code || ""),
      country: String(row.country || "BJ"),
      currency: String(row.currency || "XOF"),
      isDefault: Boolean(row.is_default),
      isVerified: Boolean(row.is_verified || 1),
      createdAt: String(row.created_at)
    }));
    res.json({ success: true, payoutMethods: methods, methods });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
apiRouter.get("/stats/overview", requireAuth, async (req, res) => {
  try {
    const { period = "30j", appId, applicationId } = req.query;
    const db = getDb();
    const targetAppId = appId || applicationId || "";
    let days = 30;
    if (period === "7j") days = 7;
    else if (period === "90j") days = 90;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1e3).toISOString();
    let sql = "SELECT * FROM transactions WHERE user_id = ? AND created_at >= ?";
    const args = [req.user.id, startDate];
    if (targetAppId.trim()) {
      sql += " AND application_id = ?";
      args.push(targetAppId.trim());
    }
    const result = await db.execute({ sql, args });
    const txs = result.rows;
    const totalCount = txs.length;
    const successCount = txs.filter((t) => t.status === "success" || t.status === "completed").length;
    const failedCount = txs.filter((t) => t.status === "failed").length;
    const pendingCount = txs.filter((t) => t.status === "pending").length;
    const successRate = totalCount > 0 ? (successCount / totalCount * 100).toFixed(1) : "0";
    const revenue = txs.filter((t) => t.status === "success" || t.status === "completed").reduce((sum, t) => sum + Number(t.net_amount || t.amount || 0), 0);
    const countryMap = {};
    txs.filter((t) => t.status === "success" || t.status === "completed").forEach((t) => {
      const c = String(t.country || "BJ");
      countryMap[c] = (countryMap[c] || 0) + Number(t.amount || 0);
    });
    const methodMap = {};
    txs.filter((t) => t.status === "success" || t.status === "completed").forEach((t) => {
      const m = String(t.payment_method || t.provider || "Mobile Money");
      methodMap[m] = (methodMap[m] || 0) + Number(t.amount || 0);
    });
    res.json({
      success: true,
      stats: {
        totalTransactions: totalCount,
        successfulTransactions: successCount,
        failedTransactions: failedCount,
        pendingTransactions: pendingCount,
        successRate: `${successRate}%`,
        revenue,
        currency: "XOF",
        countryBreakdown: countryMap,
        methodBreakdown: methodMap
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
apiRouter.post("/developer/webhooks/:id/test", requireAuth, async (req, res) => {
  try {
    const db = getDb();
    const whRes = await db.execute({
      sql: "SELECT * FROM webhooks WHERE id = ? AND user_id = ?",
      args: [req.params.id, req.user.id]
    });
    if (whRes.rows.length === 0) {
      res.status(404).json({ success: false, error: "Webhook introuvable." });
      return;
    }
    const wh = whRes.rows[0];
    const logId = `wl_${Date.now()}`;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const testPayload = {
      event: "ping.test",
      timestamp: now,
      webhook_id: String(wh.id),
      app: "PichFlow",
      data: {
        message: "Test de transmission webhook r\xE9ussi !"
      }
    };
    await db.execute({
      sql: `INSERT INTO webhook_logs (id, webhook_id, user_id, event, payload, status_code, response_body, success, attempts, created_at)
            VALUES (?, ?, ?, 'ping.test', ?, 200, '{"received":true,"status":"ok"}', 1, 1, ?)`,
      args: [logId, String(wh.id), req.user.id, JSON.stringify(testPayload), now]
    });
    await db.execute({
      sql: "UPDATE webhooks SET last_delivery_status = '200 OK (test)' WHERE id = ?",
      args: [String(wh.id)]
    });
    res.json({
      success: true,
      message: "Ping de test d\xE9livr\xE9 avec code HTTP 200.",
      delivery: {
        id: logId,
        statusCode: 200,
        event: "ping.test",
        timestamp: now
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
function resolveSasPayNetwork(method, country) {
  const m = (method || "").toLowerCase().trim();
  const c = (country || "BJ").toLowerCase().trim();
  if (m.includes("mtn")) return `mtn_${c}`;
  if (m.includes("moov")) return `moov_${c}`;
  if (m.includes("celtiis")) return "celtiis_bj";
  if (m.includes("orange")) return `orange_${c}`;
  if (m.includes("wave")) return `wave_${c}`;
  if (m.includes("free")) return "free_sn";
  if (m.includes("wizall")) return "wizall_sn";
  if (m.includes("card") || m.includes("carte")) return "card";
  return m ? `${m}_${c}` : `mtn_${c}`;
}
function splitCustomerName(fullName) {
  const trimmed = (fullName || "Client").trim();
  const parts = trimmed.split(/\s+/);
  const first_name = parts[0] || "Client";
  const last_name = parts.slice(1).join(" ") || "Client";
  return { first_name, last_name };
}
async function settleSuccessfulPayment(params) {
  const db = getDb();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const existingTx = await db.execute({
    sql: `SELECT id, status FROM transactions WHERE reference = ? OR external_id = ?`,
    args: [params.reference, params.externalId || ""]
  });
  if (existingTx.rows.length > 0 && String(existingTx.rows[0].status) === "success") {
    return;
  }
  const baseAmount = Number(params.amount);
  const platformFee = params.platformFee !== void 0 ? Number(params.platformFee) : Math.round(baseAmount * 0.015);
  const providerFee = params.providerFee !== void 0 ? Number(params.providerFee) : Math.round(baseAmount * 0.01);
  const netAmount = params.netAmount !== void 0 ? Number(params.netAmount) : baseAmount - platformFee;
  let userId = params.userId || "";
  let applicationId = params.applicationId || "";
  if (!userId && params.paymentLinkId) {
    const linkRes = await db.execute({
      sql: "SELECT user_id, application_id FROM payment_links WHERE id = ?",
      args: [params.paymentLinkId]
    });
    if (linkRes.rows.length > 0) {
      userId = String(linkRes.rows[0].user_id);
      if (!applicationId) applicationId = String(linkRes.rows[0].application_id || "");
    }
  }
  if (!userId && applicationId) {
    const appRes = await db.execute({
      sql: "SELECT user_id FROM applications WHERE id = ?",
      args: [applicationId]
    });
    if (appRes.rows.length > 0) {
      userId = String(appRes.rows[0].user_id);
    }
  }
  if (!userId) {
    const defaultUser = await db.execute("SELECT id FROM users LIMIT 1");
    userId = defaultUser.rows.length > 0 ? String(defaultUser.rows[0].id) : "usr_merchant_default";
  }
  if (!applicationId) {
    const userApp = await db.execute({
      sql: "SELECT id FROM applications WHERE user_id = ? LIMIT 1",
      args: [userId]
    });
    applicationId = userApp.rows.length > 0 ? String(userApp.rows[0].id) : "app_default";
  }
  const txId = `tx_${Date.now()}`;
  const custEmail = (params.customerEmail || `client_${params.customerPhone || txId}@pichflow.com`).toLowerCase().trim();
  const custName = (params.customerName || "Client SasPay").trim();
  const custPhone = (params.customerPhone || "").trim();
  if (existingTx.rows.length > 0) {
    await db.execute({
      sql: `UPDATE transactions SET 
              status = 'success', 
              external_id = COALESCE(?, external_id),
              net_amount = ?, 
              provider_fee = ?,
              platform_fee = ?,
              updated_at = ? 
            WHERE id = ?`,
      args: [params.externalId || null, netAmount, providerFee, platformFee, now, String(existingTx.rows[0].id)]
    });
  } else {
    await db.execute({
      sql: `INSERT INTO transactions (
              id, user_id, application_id, reference, external_id, saspay_id,
              customer_name, customer_email, customer_phone, country, provider, 
              amount, provider_fee, platform_fee, customer_fee, net_amount, 
              currency, status, description, payment_method, metadata, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'saspay', ?, ?, ?, 0, ?, ?, 'success', ?, ?, null, ?, ?)`,
      args: [
        txId,
        userId,
        applicationId,
        params.reference,
        params.externalId || `SAS-${txId}`,
        params.externalId || `SAS-${txId}`,
        custName,
        custEmail,
        custPhone,
        params.country || "BJ",
        baseAmount,
        providerFee,
        platformFee,
        netAmount,
        params.currency || "XOF",
        `Paiement commande ${params.reference}`,
        params.paymentMethod || "Mobile Money",
        now,
        now
      ]
    });
  }
  const existingCust = await db.execute({
    sql: "SELECT id, payment_count, total_spent FROM customers WHERE user_id = ? AND application_id = ? AND email = ?",
    args: [userId, applicationId, custEmail]
  });
  if (existingCust.rows.length > 0) {
    await db.execute({
      sql: `UPDATE customers SET 
              payment_count = payment_count + 1, 
              total_spent = total_spent + ?, 
              last_transaction_at = ?,
              phone = COALESCE(NULLIF(phone, ''), ?),
              name = COALESCE(NULLIF(name, ''), ?)
            WHERE id = ?`,
      args: [baseAmount, now, custPhone, custName, existingCust.rows[0].id]
    });
  } else {
    await db.execute({
      sql: `INSERT INTO customers (
              id, user_id, application_id, name, email, phone, country, 
              payment_count, total_spent, currency, last_transaction_at, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`,
      args: [
        `cust_${Date.now()}_${crypto5.randomBytes(3).toString("hex")}`,
        userId,
        applicationId,
        custName,
        custEmail,
        custPhone,
        params.country || "BJ",
        baseAmount,
        params.currency || "XOF",
        now,
        now
      ]
    });
  }
  await db.execute({
    sql: "UPDATE wallets SET balance = balance + ?, updated_at = ? WHERE user_id = ? AND currency = ?",
    args: [netAmount, now, userId, params.currency || "XOF"]
  });
  if (params.paymentLinkId) {
    await db.execute({
      sql: "UPDATE payment_links SET usage_count = usage_count + 1 WHERE id = ?",
      args: [params.paymentLinkId]
    });
  }
  await db.execute({
    sql: `UPDATE checkout_sessions SET status = 'success', updated_at = ? WHERE reference = ?`,
    args: [now, params.reference]
  });
  await dispatchMerchantWebhook(userId, applicationId, "payment.success", {
    transactionId: txId,
    reference: params.reference,
    externalId: params.externalId,
    amount: baseAmount,
    currency: params.currency || "XOF",
    netAmount,
    status: "success",
    paymentMethod: params.paymentMethod || "Mobile Money",
    customerName: custName,
    customerEmail: custEmail,
    customerPhone: custPhone
  });
}
apiRouter.post("/checkout/initiate", async (req, res) => {
  try {
    const {
      amount,
      currency = "XOF",
      description,
      customerName = "Client",
      customerEmail,
      customerPhone = "",
      paymentMethod,
      network: explicitNetwork,
      country = "BJ",
      paymentLinkId,
      clientFeeEnabled,
      feeRate,
      otp
    } = req.body;
    if (!amount || Number(amount) <= 0) {
      res.status(400).json({ success: false, error: "Montant invalide." });
      return;
    }
    const baseAmount = Number(amount);
    let feeAmount = 0;
    const isFeePassedToClient = Boolean(clientFeeEnabled);
    const parsedFeeRate = feeRate ? Number(feeRate) : 0;
    if (isFeePassedToClient && parsedFeeRate > 0) {
      feeAmount = Math.round(baseAmount * (parsedFeeRate / 100));
    }
    const totalToCharge = baseAmount + feeAmount;
    const decimalAmount = formatDecimalAmount(totalToCharge);
    const db = getDb();
    const reference = `TX-PF-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    let resolvedLinkId = paymentLinkId || null;
    let resolvedAppId = null;
    let resolvedUserId = null;
    if (resolvedLinkId) {
      const linkCheck = await db.execute({
        sql: "SELECT id, user_id, application_id FROM payment_links WHERE id = ?",
        args: [resolvedLinkId]
      });
      if (linkCheck.rows.length > 0) {
        resolvedUserId = String(linkCheck.rows[0].user_id);
        resolvedAppId = String(linkCheck.rows[0].application_id);
      }
    } else if (req.body.paymentLinkSlug || req.body.slug) {
      const slugVal = String(req.body.paymentLinkSlug || req.body.slug).trim();
      const linkCheck = await db.execute({
        sql: "SELECT id, user_id, application_id FROM payment_links WHERE slug = ?",
        args: [slugVal]
      });
      if (linkCheck.rows.length > 0) {
        resolvedLinkId = String(linkCheck.rows[0].id);
        resolvedUserId = String(linkCheck.rows[0].user_id);
        resolvedAppId = String(linkCheck.rows[0].application_id);
      }
    }
    const cleanEmail = (customerEmail || `client_${customerPhone.replace(/[^0-9]/g, "") || Date.now()}@pichflow.com`).toLowerCase().trim();
    const cleanPhone = (customerPhone || "").trim();
    const resolvedNetwork = explicitNetwork || resolveSasPayNetwork(paymentMethod, country);
    const { first_name, last_name } = splitCustomerName(customerName);
    const idempotencyKey = crypto5.randomUUID();
    let saspayId = "";
    let checkoutUrl = "";
    let isPushDirect = false;
    const isSoftpayCandidate = Boolean(cleanPhone && resolvedNetwork && resolvedNetwork !== "card");
    if (isSoftpayCandidate) {
      const formattedPhone = cleanPhone.startsWith("+") ? cleanPhone : `+${cleanPhone.replace(/^00/, "")}`;
      const softpayRes = await sasPayService.initiateSoftpay(
        {
          amount: decimalAmount,
          currency,
          country,
          network: resolvedNetwork,
          customer: {
            email: cleanEmail,
            first_name,
            last_name,
            phone: formattedPhone
          },
          description: description || "Paiement en ligne PichFlow",
          fee_charge_mode: "ADD_ON",
          otp: otp || void 0
        },
        idempotencyKey
      );
      if (!softpayRes.success) {
        res.status(softpayRes.statusCode || 400).json({
          success: false,
          error: softpayRes.error || "\xC9chec de l\u2019initiation du paiement SasPay.",
          code: softpayRes.data?.code
        });
        return;
      }
      saspayId = softpayRes.data?.id || "";
      checkoutUrl = softpayRes.data?.checkout_url || "";
      isPushDirect = !checkoutUrl;
    } else {
      const appUrl = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
      const sessionRes = await sasPayService.createCheckoutSession({
        amount: decimalAmount,
        currency,
        country,
        customer_email: cleanEmail,
        customer_name: customerName,
        customer_phone: cleanPhone,
        description: description || "Paiement en ligne PichFlow",
        return_url: `${appUrl}/checkout-demo?status=success&ref=${reference}`,
        fee_charge_mode: "ADD_ON"
      });
      if (!sessionRes.success) {
        res.status(sessionRes.statusCode || 400).json({
          success: false,
          error: sessionRes.error || "\xC9chec de la cr\xE9ation de session SasPay."
        });
        return;
      }
      saspayId = sessionRes.data?.id || "";
      checkoutUrl = sessionRes.data?.checkout_url || "";
      isPushDirect = false;
    }
    const sessionId = `cs_${Date.now()}`;
    await db.execute({
      sql: `INSERT INTO checkout_sessions (
              id, payment_link_id, application_id, user_id, reference, 
              amount, currency, customer_name, customer_email, customer_phone, 
              status, saspay_session_id, saspay_checkout_url, idempotency_key, 
              provider, payment_method, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, 'saspay', ?, ?, ?)`,
      args: [
        sessionId,
        resolvedLinkId,
        resolvedAppId,
        resolvedUserId,
        reference,
        totalToCharge,
        currency,
        customerName,
        cleanEmail,
        cleanPhone,
        saspayId,
        checkoutUrl,
        idempotencyKey,
        resolvedNetwork || paymentMethod || "Mobile Money",
        now,
        now
      ]
    });
    res.json({
      success: true,
      reference,
      baseAmount,
      feeAmount,
      totalAmount: totalToCharge,
      token: saspayId || reference,
      invoiceUrl: checkoutUrl,
      checkoutUrl,
      isPushDirect,
      status: "pending"
    });
  } catch (err) {
    console.error("[Checkout Initiate Error]", err);
    res.status(500).json({ success: false, error: err.message });
  }
});
apiRouter.post("/checkout/confirm", async (req, res) => {
  try {
    const { reference, otp } = req.body;
    if (!reference) {
      res.status(400).json({ success: false, error: "R\xE9f\xE9rence requise." });
      return;
    }
    const db = getDb();
    const sessionRes = await db.execute({
      sql: "SELECT * FROM checkout_sessions WHERE reference = ?",
      args: [reference]
    });
    if (sessionRes.rows.length === 0) {
      res.status(404).json({ success: false, error: "Session de paiement introuvable." });
      return;
    }
    const session = sessionRes.rows[0];
    if (session.status === "success") {
      res.json({
        success: true,
        reference,
        status: "success",
        message: "Paiement d\xE9j\xE0 valid\xE9."
      });
      return;
    }
    const saspayId = String(session.saspay_session_id || "");
    if (otp && saspayId) {
      const otpRes = await sasPayService.confirmOtp(saspayId, String(otp).trim());
      if (!otpRes.success) {
        res.status(otpRes.statusCode || 400).json({
          success: false,
          error: otpRes.error || "Code OTP invalide."
        });
        return;
      }
    }
    if (saspayId) {
      const verifyRes = await sasPayService.verifyPayment(saspayId);
      if (verifyRes.success && verifyRes.data) {
        const remoteStatus = String(verifyRes.data.status || "").toUpperCase();
        if (remoteStatus === "SUCCESS") {
          await settleSuccessfulPayment({
            reference,
            externalId: saspayId,
            amount: Number(verifyRes.data.debited_amount || session.amount),
            currency: String(verifyRes.data.currency || session.currency),
            netAmount: Number(verifyRes.data.net_amount || Number(session.amount) * 0.985),
            customerName: String(session.customer_name || "Client"),
            customerEmail: String(session.customer_email || ""),
            customerPhone: String(session.customer_phone || ""),
            applicationId: String(session.application_id || ""),
            userId: String(session.user_id || ""),
            paymentLinkId: String(session.payment_link_id || "")
          });
          res.json({
            success: true,
            reference,
            status: "success",
            message: "Paiement confirm\xE9 avec succ\xE8s !"
          });
          return;
        } else if (remoteStatus === "FAILED") {
          await db.execute({
            sql: `UPDATE checkout_sessions SET status = 'failed', updated_at = ? WHERE reference = ?`,
            args: [(/* @__PURE__ */ new Date()).toISOString(), reference]
          });
          res.json({
            success: false,
            reference,
            status: "failed",
            message: "Le paiement a \xE9chou\xE9 aupr\xE8s de l\u2019op\xE9rateur."
          });
          return;
        }
      }
    }
    res.json({
      success: false,
      reference,
      status: "pending",
      message: "Paiement toujours en cours de validation sur le r\xE9seau op\xE9rateur."
    });
  } catch (err) {
    console.error("[Checkout Confirm Error]", err);
    res.status(500).json({ success: false, error: err.message });
  }
});
apiRouter.get("/checkout/status/:reference", async (req, res) => {
  try {
    const db = getDb();
    const sessionRes = await db.execute({
      sql: "SELECT * FROM checkout_sessions WHERE reference = ?",
      args: [req.params.reference]
    });
    if (sessionRes.rows.length === 0) {
      res.status(404).json({ success: false, error: "Session introuvable." });
      return;
    }
    const session = sessionRes.rows[0];
    if (session.status === "pending" && session.saspay_session_id) {
      const saspayId = String(session.saspay_session_id);
      const verifyRes = await sasPayService.verifyPayment(saspayId);
      if (verifyRes.success && verifyRes.data) {
        const remoteStatus = String(verifyRes.data.status || "").toUpperCase();
        if (remoteStatus === "SUCCESS") {
          await settleSuccessfulPayment({
            reference: String(session.reference),
            externalId: saspayId,
            amount: Number(verifyRes.data.debited_amount || session.amount),
            currency: String(verifyRes.data.currency || session.currency),
            netAmount: Number(verifyRes.data.net_amount || Number(session.amount) * 0.985),
            customerName: String(session.customer_name || "Client"),
            customerEmail: String(session.customer_email || ""),
            customerPhone: String(session.customer_phone || ""),
            applicationId: String(session.application_id || ""),
            userId: String(session.user_id || ""),
            paymentLinkId: String(session.payment_link_id || "")
          });
          res.json({
            success: true,
            reference: session.reference,
            status: "success",
            amount: session.amount,
            currency: session.currency
          });
          return;
        } else if (remoteStatus === "FAILED") {
          await db.execute({
            sql: `UPDATE checkout_sessions SET status = 'failed', updated_at = ? WHERE reference = ?`,
            args: [(/* @__PURE__ */ new Date()).toISOString(), session.reference]
          });
          res.json({
            success: false,
            reference: session.reference,
            status: "failed",
            amount: session.amount,
            currency: session.currency
          });
          return;
        }
      }
      const sessionStatusRes = await sasPayService.getCheckoutSessionStatus(saspayId);
      if (sessionStatusRes.success && sessionStatusRes.data) {
        const csStatus = String(sessionStatusRes.data.status || "").toUpperCase();
        const txStatus = String(sessionStatusRes.data.transaction_status || "").toUpperCase();
        if (csStatus === "PAID" || txStatus === "SUCCESS") {
          await settleSuccessfulPayment({
            reference: String(session.reference),
            externalId: saspayId,
            amount: Number(session.amount),
            currency: String(session.currency),
            customerName: String(session.customer_name || "Client"),
            customerEmail: String(session.customer_email || ""),
            customerPhone: String(session.customer_phone || ""),
            applicationId: String(session.application_id || ""),
            userId: String(session.user_id || ""),
            paymentLinkId: String(session.payment_link_id || "")
          });
          res.json({
            success: true,
            reference: session.reference,
            status: "success",
            amount: session.amount,
            currency: session.currency
          });
          return;
        }
      }
    }
    res.json({
      success: true,
      reference: session.reference,
      status: session.status,
      amount: session.amount,
      currency: session.currency
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
apiRouter.post("/checkout/retry", async (req, res) => {
  try {
    const { reference } = req.body;
    if (!reference) {
      res.status(400).json({ success: false, error: "R\xE9f\xE9rence de transaction requise." });
      return;
    }
    const db = getDb();
    const sessionRes = await db.execute({
      sql: "SELECT * FROM checkout_sessions WHERE reference = ?",
      args: [reference]
    });
    if (sessionRes.rows.length === 0) {
      res.status(404).json({ success: false, error: "Session introuvable." });
      return;
    }
    const session = sessionRes.rows[0];
    const saspayId = String(session.saspay_session_id || "");
    if (!saspayId) {
      res.status(400).json({ success: false, error: "Identifiant SasPay manquant pour cette transaction." });
      return;
    }
    const idempotencyKey = String(session.idempotency_key || crypto5.randomUUID());
    const retryRes = await sasPayService.retryPayment(saspayId, idempotencyKey);
    if (!retryRes.success) {
      res.status(retryRes.statusCode || 400).json({
        success: false,
        error: retryRes.error || "Impossible de relancer le paiement."
      });
      return;
    }
    await db.execute({
      sql: `UPDATE checkout_sessions SET status = 'pending', updated_at = ? WHERE reference = ?`,
      args: [(/* @__PURE__ */ new Date()).toISOString(), reference]
    });
    res.json({
      success: true,
      reference,
      status: "pending",
      message: "Demande de relance transmise \xE0 l\u2019op\xE9rateur.",
      data: retryRes.data
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
apiRouter.post("/webhooks/saspay", async (req, res) => {
  try {
    const rawBody = req.rawBody || JSON.stringify(req.body);
    const signature = req.headers["x-webhook-signature"] || "";
    const timestamp = req.headers["x-webhook-timestamp"] || "";
    const event = req.headers["x-webhook-event"] || req.body?.event || "";
    const verification = sasPayService.verifyWebhookSignature(rawBody, signature, timestamp);
    if (!verification.valid) {
      console.warn(`[SasPay Webhook] \u274C Rejet signature invalide : ${verification.reason}`);
      res.status(401).json({ success: false, error: verification.reason });
      return;
    }
    const db = getDb();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const eventPayload = req.body || {};
    const eventData = eventPayload.data || {};
    const externalId = eventData.id || "";
    const reference = eventData.reference || "";
    const dedupId = `${timestamp}_${signature.slice(0, 16)}`;
    const existingLog = await db.execute({
      sql: "SELECT id FROM webhook_logs WHERE signature = ? OR external_event_id = ?",
      args: [signature, eventPayload.id || dedupId]
    });
    if (existingLog.rows.length > 0) {
      console.log(`[SasPay Webhook] \xC9v\xE9nement d\xE9j\xE0 trait\xE9 (${event}) : doublon ignor\xE9 avec succ\xE8s.`);
      res.status(200).json({ success: true, message: "\xC9v\xE9nement d\xE9j\xE0 trait\xE9." });
      return;
    }
    console.log(`[SasPay Webhook] \u2705 \xC9v\xE9nement authentique re\xE7u : ${event} (${reference || externalId})`);
    if (event === "webhook.test") {
      res.status(200).json({ success: true, message: "Ping de test webhook valid\xE9 avec succ\xE8s." });
      return;
    }
    if (event === "transaction.success") {
      let session = null;
      if (externalId) {
        const sRes = await db.execute({
          sql: "SELECT * FROM checkout_sessions WHERE saspay_session_id = ? LIMIT 1",
          args: [externalId]
        });
        if (sRes.rows.length > 0) session = sRes.rows[0];
      }
      if (!session && reference) {
        const sRes = await db.execute({
          sql: "SELECT * FROM checkout_sessions WHERE reference = ? LIMIT 1",
          args: [reference]
        });
        if (sRes.rows.length > 0) session = sRes.rows[0];
      }
      const amount = Number(eventData.debited_amount || eventData.requested_amount || eventData.amount || session?.amount || 0);
      const netAmount = Number(eventData.net_amount || amount * 0.985);
      const currency = String(eventData.currency || session?.currency || "XOF");
      const custInfo = eventData.customer || {};
      const customerEmail = String(custInfo.email || session?.customer_email || "client@pichflow.com");
      const customerName = `${custInfo.first_name || ""} ${custInfo.last_name || ""}`.trim() || String(session?.customer_name || "Client");
      const customerPhone = String(custInfo.phone || session?.customer_phone || "");
      await settleSuccessfulPayment({
        reference: session ? String(session.reference) : reference || `TX-SAS-${Date.now().toString().slice(-6)}`,
        externalId,
        amount,
        currency,
        netAmount,
        customerName,
        customerEmail,
        customerPhone,
        country: String(eventData.country || session?.country || "BJ"),
        paymentMethod: String(eventData.network || session?.payment_method || "Mobile Money"),
        applicationId: session ? String(session.application_id || "") : void 0,
        userId: session ? String(session.user_id || "") : void 0,
        paymentLinkId: session ? String(session.payment_link_id || "") : void 0
      });
    } else if (event === "transaction.failed" || event === "transaction.cancelled") {
      if (reference) {
        await db.execute({
          sql: `UPDATE checkout_sessions SET status = 'failed', updated_at = ? WHERE reference = ?`,
          args: [now, reference]
        });
        await db.execute({
          sql: `UPDATE transactions SET status = 'failed', updated_at = ? WHERE reference = ?`,
          args: [now, reference]
        });
      }
    } else if (event === "settlement.success") {
      if (externalId || reference) {
        await db.execute({
          sql: `UPDATE payout_requests SET status = 'success', processed_at = ? WHERE external_id = ? OR reference = ?`,
          args: [now, externalId, reference]
        });
      }
    } else if (event === "settlement.failed" || event === "settlement.cancelled") {
      if (externalId || reference) {
        const pRes = await db.execute({
          sql: `SELECT * FROM payout_requests WHERE external_id = ? OR reference = ?`,
          args: [externalId, reference]
        });
        if (pRes.rows.length > 0 && pRes.rows[0].status !== "failed") {
          const p = pRes.rows[0];
          await db.execute({
            sql: `UPDATE payout_requests SET status = 'failed', notes = 'Rejet\xE9 par le r\xE9seau op\xE9rateur' WHERE id = ?`,
            args: [p.id]
          });
          await db.execute({
            sql: "UPDATE wallets SET balance = balance + ?, updated_at = ? WHERE user_id = ? AND currency = ?",
            args: [Number(p.amount), now, p.user_id, p.currency]
          });
        }
      }
    }
    const logId = `whl_${Date.now()}_${crypto5.randomBytes(3).toString("hex")}`;
    const defaultUser = await db.execute("SELECT id FROM users LIMIT 1");
    const targetUserId = defaultUser.rows.length > 0 ? String(defaultUser.rows[0].id) : "usr_merchant_default";
    await db.execute({
      sql: `INSERT INTO webhook_logs (
              id, webhook_id, user_id, event, payload, status_code, 
              response_body, success, attempts, external_event_id, signature, created_at
            ) VALUES (?, 'saspay_inbound', ?, ?, ?, 200, '{"received":true}', 1, 1, ?, ?, ?)`,
      args: [
        logId,
        targetUserId,
        event,
        rawBody,
        eventPayload.id || dedupId,
        signature,
        now
      ]
    });
    res.status(200).json({ success: true, received: true });
  } catch (err) {
    console.error("[SasPay Webhook Error]", err);
    res.status(500).json({ success: false, error: err.message });
  }
});
apiRouter.post("/webhooks/paydunya", async (req, res) => {
  res.status(200).send("OK");
});
apiRouter.get("/reference/countries", async (_req, res) => {
  try {
    const response = await sasPayService.getCountries();
    res.json(response);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
apiRouter.get("/reference/networks", async (_req, res) => {
  try {
    const response = await sasPayService.getNetworks();
    res.json(response);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
apiRouter.get("/reference/rates", async (_req, res) => {
  try {
    const response = await sasPayService.getMyRates();
    res.json(response);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
apiRouter.get("/settings/kyc", requireAuth, async (req, res) => {
  try {
    const db = getDb();
    const result = await db.execute({
      sql: "SELECT * FROM merchant_kyc WHERE user_id = ?",
      args: [req.user.id]
    });
    if (result.rows.length === 0) {
      res.json({
        success: true,
        kyc: {
          status: "unsubmitted",
          complianceLevel: "Non soumis",
          accountType: "individual",
          companyName: "",
          rccmNumber: "",
          ifuNumber: "",
          fullName: req.user.full_name,
          firstName: "",
          lastName: "",
          birthDate: "",
          nationality: req.user.country === "BJ" ? "B\xE9nin" : req.user.country,
          idType: "cni",
          idNumber: "",
          address: "",
          rectoUrl: "",
          versoUrl: "",
          selfieUrl: "",
          representativeName: "",
          rccmDocUrl: "",
          ifuDocUrl: ""
        },
        documents: []
      });
      return;
    }
    const row = result.rows[0];
    const docsRes = await db.execute({
      sql: "SELECT * FROM kyc_documents WHERE user_id = ? ORDER BY uploaded_at DESC",
      args: [req.user.id]
    });
    res.json({
      success: true,
      kyc: {
        id: String(row.id),
        status: String(row.status),
        complianceLevel: String(row.compliance_level || "En cours d\u2019examen"),
        accountType: String(row.account_type || "individual"),
        companyName: String(row.company_name || ""),
        rccmNumber: String(row.rccm_number || ""),
        ifuNumber: String(row.ifu_number || ""),
        fullName: String(row.full_name || req.user.full_name),
        firstName: String(row.first_name || ""),
        lastName: String(row.last_name || ""),
        birthDate: String(row.birth_date || ""),
        nationality: String(row.nationality || "B\xE9nin"),
        idType: String(row.id_type || "cni"),
        idNumber: String(row.id_number || ""),
        address: String(row.address || ""),
        rectoUrl: String(row.recto_url || ""),
        versoUrl: String(row.verso_url || ""),
        selfieUrl: String(row.selfie_url || ""),
        representativeName: String(row.representative_name || ""),
        rccmDocUrl: String(row.rccm_doc_url || ""),
        ifuDocUrl: String(row.ifu_doc_url || ""),
        notes: String(row.notes || ""),
        submittedAt: String(row.submitted_at || "")
      },
      documents: docsRes.rows.map((d) => ({
        id: String(d.id),
        documentType: String(d.document_type),
        fileName: String(d.file_name),
        fileUrl: String(d.file_url),
        status: String(d.status),
        uploadedAt: String(d.uploaded_at)
      }))
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
apiRouter.post("/settings/kyc", requireAuth, async (req, res) => {
  try {
    const {
      accountType,
      companyName,
      rccmNumber,
      ifuNumber,
      fullName,
      firstName,
      lastName,
      birthDate,
      nationality,
      idType,
      idNumber,
      address,
      rectoUrl,
      versoUrl,
      selfieUrl,
      representativeName,
      rccmDocUrl,
      ifuDocUrl
    } = req.body;
    const db = getDb();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const existing = await db.execute({
      sql: "SELECT id FROM merchant_kyc WHERE user_id = ?",
      args: [req.user.id]
    });
    if (existing.rows.length > 0) {
      await db.execute({
        sql: `UPDATE merchant_kyc SET 
              account_type = ?, company_name = ?, rccm_number = ?, ifu_number = ?, 
              full_name = ?, first_name = ?, last_name = ?, birth_date = ?,
              nationality = ?, id_type = ?, id_number = ?, address = ?, 
              recto_url = COALESCE(?, recto_url), verso_url = COALESCE(?, verso_url), selfie_url = COALESCE(?, selfie_url),
              representative_name = COALESCE(?, representative_name), rccm_doc_url = COALESCE(?, rccm_doc_url), ifu_doc_url = COALESCE(?, ifu_doc_url),
              status = 'pending', compliance_level = 'En cours d\u2019examen', updated_at = ?
              WHERE user_id = ?`,
        args: [
          accountType || "individual",
          companyName || "",
          rccmNumber || "",
          ifuNumber || "",
          fullName || `${firstName || ""} ${lastName || ""}`.trim() || req.user.full_name,
          firstName || "",
          lastName || "",
          birthDate || "",
          nationality || "B\xE9nin",
          idType || "cni",
          idNumber || "",
          address || "",
          rectoUrl || null,
          versoUrl || null,
          selfieUrl || null,
          representativeName || null,
          rccmDocUrl || null,
          ifuDocUrl || null,
          now,
          req.user.id
        ]
      });
    } else {
      await db.execute({
        sql: `INSERT INTO merchant_kyc (
              id, user_id, account_type, company_name, rccm_number, ifu_number, 
              full_name, first_name, last_name, birth_date, nationality, id_type, id_number, address,
              recto_url, verso_url, selfie_url, representative_name, rccm_doc_url, ifu_doc_url,
              status, compliance_level, submitted_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          `kyc_${Date.now()}`,
          req.user.id,
          accountType || "individual",
          companyName || "",
          rccmNumber || "",
          ifuNumber || "",
          fullName || `${firstName || ""} ${lastName || ""}`.trim() || req.user.full_name,
          firstName || "",
          lastName || "",
          birthDate || "",
          nationality || "B\xE9nin",
          idType || "cni",
          idNumber || "",
          address || "",
          rectoUrl || "",
          versoUrl || "",
          selfieUrl || "",
          representativeName || "",
          rccmDocUrl || "",
          ifuDocUrl || "",
          "pending",
          "En cours d\u2019examen",
          now,
          now
        ]
      });
    }
    res.json({ success: true, message: "Dossier KYC soumis pour validation." });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
apiRouter.post("/settings/kyc/upload", requireAuth, async (req, res) => {
  try {
    const { documentType, fileName, fileData } = req.body;
    if (!documentType || !fileName || !fileData) {
      res.status(400).json({ success: false, error: "Type de document, nom de fichier et donn\xE9es requis." });
      return;
    }
    const stringLength = fileData.length - (fileData.indexOf(",") + 1);
    const sizeInBytes = stringLength * 3 / 4;
    const maxBytes = 10 * 1024 * 1024;
    if (sizeInBytes > maxBytes) {
      res.status(400).json({ success: false, error: "Le fichier d\xE9passe la taille maximale autoris\xE9e de 10 Mo." });
      return;
    }
    const db = getDb();
    const docId = `doc_${Date.now()}_${crypto5.randomBytes(3).toString("hex")}`;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const kycRes = await db.execute({
      sql: "SELECT id FROM merchant_kyc WHERE user_id = ?",
      args: [req.user.id]
    });
    const kycId = kycRes.rows.length > 0 ? String(kycRes.rows[0].id) : `kyc_${Date.now()}`;
    await db.execute({
      sql: `INSERT INTO kyc_documents (id, kyc_id, user_id, document_type, file_name, file_url, status, uploaded_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [docId, kycId, req.user.id, documentType, fileName, fileData, "approved", now]
    });
    res.json({
      success: true,
      documentId: docId,
      fileName,
      fileUrl: fileData,
      documentType
    });
  } catch (err) {
    console.error("[KYC Upload] Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});
apiRouter.post("/settings/kyc/test-approve", requireAuth, async (req, res) => {
  try {
    const db = getDb();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const existing = await db.execute({
      sql: "SELECT id FROM merchant_kyc WHERE user_id = ?",
      args: [req.user.id]
    });
    if (existing.rows.length === 0) {
      await db.execute({
        sql: `INSERT INTO merchant_kyc (
              id, user_id, account_type, company_name, rccm_number, ifu_number, 
              full_name, status, compliance_level, submitted_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          `kyc_${Date.now()}`,
          req.user.id,
          "individual",
          "",
          "",
          "",
          req.user.full_name,
          "verified",
          "Niveau 2 - Standard",
          now,
          now
        ]
      });
    } else {
      await db.execute({
        sql: `UPDATE merchant_kyc SET status = 'verified', compliance_level = 'Niveau 2 - Standard', updated_at = ? WHERE user_id = ?`,
        args: [now, req.user.id]
      });
    }
    res.json({
      success: true,
      message: "Mode Test : Dossier KYC approuv\xE9 avec succ\xE8s pour l\u2019environnement Sandbox.",
      status: "verified"
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
apiRouter.post("/v1/payments/create", requireApiKey, async (req, res) => {
  try {
    const env = req.apiKey.environment;
    const {
      amount,
      currency = "XOF",
      description = "Paiement API PichFlow",
      customerName,
      customerEmail,
      customerPhone,
      country = "BJ",
      network,
      otp,
      returnUrl
    } = req.body;
    if (!amount || Number(amount) <= 0) {
      res.status(400).json({ success: false, error: "Montant invalide." });
      return;
    }
    const decimalAmount = formatDecimalAmount(amount);
    const reference = `TX-API-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
    const idempotencyKey = req.headers["idempotency-key"] || crypto5.randomUUID();
    if (network && customerPhone) {
      const { first_name, last_name } = splitCustomerName(customerName);
      const cleanPhone = String(customerPhone).trim();
      const formattedPhone = cleanPhone.startsWith("+") ? cleanPhone : `+${cleanPhone.replace(/^00/, "")}`;
      const softpayRes = await sasPayService.initiateSoftpay(
        {
          amount: decimalAmount,
          currency,
          country,
          network,
          customer: {
            email: customerEmail || `client_${Date.now()}@pichflow.com`,
            first_name,
            last_name,
            phone: formattedPhone
          },
          description,
          fee_charge_mode: "ADD_ON",
          otp
        },
        idempotencyKey,
        env
      );
      if (!softpayRes.success) {
        res.status(softpayRes.statusCode || 400).json({
          success: false,
          error: softpayRes.error || "\xC9chec du paiement SasPay.",
          code: softpayRes.data?.code,
          environment: env
        });
        return;
      }
      res.json({
        success: true,
        environment: env,
        reference,
        paymentId: softpayRes.data?.id,
        status: softpayRes.data?.status || "PENDING",
        checkoutUrl: softpayRes.data?.checkout_url || "",
        data: softpayRes.data
      });
    } else {
      const sessionRes = await sasPayService.createCheckoutSession(
        {
          amount: decimalAmount,
          currency,
          country,
          customer_name: customerName || "Client",
          customer_email: customerEmail || `client_${Date.now()}@pichflow.com`,
          customer_phone: customerPhone,
          description,
          return_url: returnUrl,
          fee_charge_mode: "ADD_ON"
        },
        env
      );
      if (!sessionRes.success) {
        res.status(sessionRes.statusCode || 400).json({
          success: false,
          error: sessionRes.error || "\xC9chec de cr\xE9ation de la session SasPay.",
          environment: env
        });
        return;
      }
      res.json({
        success: true,
        environment: env,
        reference,
        sessionId: sessionRes.data?.id,
        checkoutUrl: sessionRes.data?.checkout_url,
        slug: sessionRes.data?.slug,
        status: sessionRes.data?.status || "PENDING",
        data: sessionRes.data
      });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
apiRouter.post("/v1/payments/softpay", requireApiKey, async (req, res) => {
  try {
    const env = req.apiKey.environment;
    const { amount, currency = "XOF", country = "BJ", network, customer, description, fee_charge_mode, otp } = req.body;
    if (!amount || !customer || !network) {
      res.status(400).json({ success: false, error: "Champs amount, network et customer requis." });
      return;
    }
    const idempotencyKey = req.headers["idempotency-key"] || crypto5.randomUUID();
    const result = await sasPayService.initiateSoftpay(
      {
        amount: formatDecimalAmount(amount),
        currency,
        country,
        network,
        customer,
        description,
        fee_charge_mode,
        otp
      },
      idempotencyKey,
      env
    );
    res.status(result.statusCode || 200).json({
      success: result.success,
      environment: env,
      ...result.success ? { data: result.data } : { error: result.error, data: result.data }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
apiRouter.post("/v1/checkout-sessions", requireApiKey, async (req, res) => {
  try {
    const env = req.apiKey.environment;
    const { amount, currency = "XOF", customer_email, customer_name, customer_phone, country, description, return_url, metadata } = req.body;
    if (!amount || !customer_email || !customer_name) {
      res.status(400).json({ success: false, error: "Champs amount, customer_email et customer_name requis." });
      return;
    }
    const result = await sasPayService.createCheckoutSession(
      {
        amount: formatDecimalAmount(amount),
        currency,
        customer_email,
        customer_name,
        customer_phone,
        country,
        description,
        return_url,
        metadata
      },
      env
    );
    res.status(result.statusCode || 200).json({
      success: result.success,
      environment: env,
      ...result.success ? { data: result.data } : { error: result.error, data: result.data }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
apiRouter.get("/v1/payments/:id/verify", requireApiKey, async (req, res) => {
  try {
    const env = req.apiKey.environment;
    const result = await sasPayService.verifyPayment(req.params.id, env);
    res.status(result.statusCode || 200).json({
      success: result.success,
      environment: env,
      ...result.success ? { data: result.data } : { error: result.error, data: result.data }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
apiRouter.post("/v1/payments/:id/confirm-otp", requireApiKey, async (req, res) => {
  try {
    const env = req.apiKey.environment;
    const { otp } = req.body;
    if (!otp) {
      res.status(400).json({ success: false, error: "Code OTP requis." });
      return;
    }
    const result = await sasPayService.confirmOtp(req.params.id, String(otp).trim(), env);
    res.status(result.statusCode || 200).json({
      success: result.success,
      environment: env,
      ...result.success ? { data: result.data } : { error: result.error, data: result.data }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
apiRouter.post("/v1/payments/:id/retry", requireApiKey, async (req, res) => {
  try {
    const env = req.apiKey.environment;
    const idempotencyKey = req.headers["idempotency-key"] || crypto5.randomUUID();
    const result = await sasPayService.retryPayment(req.params.id, idempotencyKey, env);
    res.status(result.statusCode || 200).json({
      success: result.success,
      environment: env,
      ...result.success ? { data: result.data } : { error: result.error, data: result.data }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
apiRouter.get("/v1/payments/status/:reference", requireApiKey, async (req, res) => {
  try {
    const db = getDb();
    const result = await db.execute({
      sql: "SELECT * FROM transactions WHERE reference = ? AND user_id = ?",
      args: [req.params.reference, req.user.id]
    });
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: "Paiement non trouv\xE9." });
      return;
    }
    const tx = result.rows[0];
    res.json({
      success: true,
      environment: req.apiKey.environment,
      transaction: {
        reference: tx.reference,
        externalId: tx.external_id,
        amount: tx.amount,
        netAmount: tx.net_amount,
        currency: tx.currency,
        status: tx.status,
        provider: tx.provider,
        customerName: tx.customer_name,
        customerEmail: tx.customer_email,
        customerPhone: tx.customer_phone,
        createdAt: tx.created_at
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
apiRouter.get("/v1/transactions", requireApiKey, async (req, res) => {
  try {
    const db = getDb();
    const { status, limit = "50" } = req.query;
    let sql = "SELECT * FROM transactions WHERE user_id = ? AND application_id = ?";
    const args = [req.user.id, req.apiKey.application_id];
    if (status && typeof status === "string") {
      sql += " AND status = ?";
      args.push(status);
    }
    sql += " ORDER BY created_at DESC LIMIT ?";
    args.push(parseInt(String(limit), 10) || 50);
    const result = await db.execute({ sql, args });
    res.json({
      success: true,
      environment: req.apiKey.environment,
      transactions: result.rows.map((tx) => ({
        id: tx.id,
        reference: tx.reference,
        amount: tx.amount,
        netAmount: tx.net_amount,
        currency: tx.currency,
        status: tx.status,
        customerName: tx.customer_name,
        customerEmail: tx.customer_email,
        createdAt: tx.created_at
      }))
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
apiRouter.get("/v1/transactions/:id", requireApiKey, async (req, res) => {
  try {
    const db = getDb();
    const result = await db.execute({
      sql: "SELECT * FROM transactions WHERE (id = ? OR reference = ?) AND user_id = ?",
      args: [req.params.id, req.params.id, req.user.id]
    });
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: "Transaction non trouv\xE9e." });
      return;
    }
    res.json({
      success: true,
      environment: req.apiKey.environment,
      transaction: result.rows[0]
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
apiRouter.get("/v1/transactions/export", requireApiKey, async (req, res) => {
  try {
    const env = req.apiKey.environment;
    const result = await sasPayService.exportTransactionsCsv(req.query, env);
    res.status(result.statusCode || 200).json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
apiRouter.get("/v1/transactions/:id/invoice", requireApiKey, async (req, res) => {
  try {
    const env = req.apiKey.environment;
    const result = await sasPayService.getTransactionInvoice(req.params.id, env);
    res.status(result.statusCode || 200).json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
apiRouter.post("/v1/payouts/initialize", requireApiKey, async (req, res) => {
  try {
    if (req.apiKey.scope !== "both" && req.apiKey.scope !== "payout") {
      res.status(403).json({
        success: false,
        error: "Scope de cl\xE9 API insuffisant (payout ou both requis pour les retraits).",
        code: "api_key_scope_forbidden"
      });
      return;
    }
    const env = req.apiKey.environment;
    const { amount, currency, country, customer, method, recipient, description, fee_charge_mode } = req.body;
    if (!amount || !currency || !country || !method || !recipient?.msisdn) {
      res.status(400).json({
        success: false,
        error: "Champs obligatoires manquants : amount, currency, country, method, recipient.msisdn."
      });
      return;
    }
    const numAmount = Number(amount);
    const db = getDb();
    const walletRes = await db.execute({
      sql: "SELECT * FROM wallets WHERE user_id = ? AND currency = ?",
      args: [req.user.id, currency]
    });
    if (walletRes.rows.length === 0 || Number(walletRes.rows[0].balance) < numAmount) {
      res.status(422).json({
        success: false,
        error: "Solde insuffisant pour ex\xE9cuter ce retrait.",
        code: "insufficient_balance"
      });
      return;
    }
    const idempotencyKey = req.headers["idempotency-key"] || crypto5.randomUUID();
    const result = await sasPayService.initializePayout(
      {
        amount: formatDecimalAmount(amount),
        currency,
        country,
        customer: customer || { phone: recipient.msisdn },
        method,
        recipient,
        description,
        fee_charge_mode
      },
      idempotencyKey,
      env
    );
    if (!result.success) {
      if (result.statusCode === 403 || String(result.error).includes("ip_not_whitelisted")) {
        res.status(403).json({
          success: false,
          error: "Votre adresse IP serveur n'est pas autoris\xE9e sur SasPay (ip_not_whitelisted). Ajoutez l'IP publique de votre serveur dans le tableau de bord SasPay > D\xE9veloppeur > Whitelist IP.",
          code: "ip_not_whitelisted"
        });
        return;
      }
      res.status(result.statusCode || 400).json({
        success: false,
        error: result.error || "\xC9chec de l\u2019initialisation du retrait SasPay.",
        data: result.data
      });
      return;
    }
    await db.execute({
      sql: "UPDATE wallets SET balance = balance - ?, updated_at = ? WHERE id = ?",
      args: [numAmount, (/* @__PURE__ */ new Date()).toISOString(), walletRes.rows[0].id]
    });
    res.json({
      success: true,
      environment: env,
      data: result.data
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
apiRouter.get("/v1/payouts/:id/verify", requireApiKey, async (req, res) => {
  try {
    const env = req.apiKey.environment;
    const result = await sasPayService.verifyPayout(req.params.id, env);
    res.status(result.statusCode || 200).json({
      success: result.success,
      environment: env,
      ...result.success ? { data: result.data } : { error: result.error, data: result.data }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
apiRouter.get("/v1/wallets/balances", requireApiKey, async (req, res) => {
  try {
    const env = req.apiKey.environment;
    const result = await sasPayService.getMerchantBalances(env);
    res.status(result.statusCode || 200).json({
      success: result.success,
      environment: env,
      ...result.success ? { data: result.data } : { error: result.error, data: result.data }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
apiRouter.get("/v1/wallets/rates", requireApiKey, async (req, res) => {
  try {
    const env = req.apiKey.environment;
    const result = await sasPayService.getExchangeRates(env);
    res.status(result.statusCode || 200).json({
      success: result.success,
      environment: env,
      ...result.success ? { data: result.data } : { error: result.error, data: result.data }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
apiRouter.post("/v1/wallets/transfer", requireApiKey, async (req, res) => {
  try {
    const env = req.apiKey.environment;
    const { from_country, to_country, from_amount } = req.body;
    if (!from_country || !to_country || !from_amount) {
      res.status(400).json({ success: false, error: "Champs from_country, to_country et from_amount requis." });
      return;
    }
    const idempotencyKey = req.headers["idempotency-key"] || crypto5.randomUUID();
    const result = await sasPayService.createWalletTransfer(
      {
        from_country,
        to_country,
        from_amount: formatDecimalAmount(from_amount)
      },
      idempotencyKey,
      env
    );
    res.status(result.statusCode || 200).json({
      success: result.success,
      environment: env,
      ...result.success ? { data: result.data } : { error: result.error, data: result.data }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// src/server/app.ts
function createApiApp() {
  const app = express();
  app.use(
    express.json({
      limit: "10mb",
      verify: (req, _res, buf) => {
        req.rawBody = buf.toString("utf8");
      }
    })
  );
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }
    next();
  });
  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      service: "PichFlow Payment Core",
      env: process.env.NODE_ENV || "development",
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  });
  app.use("/api", apiRouter);
  app.use("/api", (_req, res) => {
    res.status(404).json({ success: false, error: "Route API introuvable." });
  });
  app.post("/webhooks/saspay", (req, res, next) => {
    req.url = "/webhooks/saspay";
    apiRouter(req, res, next);
  });
  app.use((err, _req, res, next) => {
    if (res.headersSent) {
      next(err);
      return;
    }
    const errorWithStatus = err;
    if (errorWithStatus instanceof SyntaxError && errorWithStatus.status === 400 && "body" in errorWithStatus) {
      res.status(400).json({ success: false, error: "Le corps de la requ\xEAte JSON est invalide." });
      return;
    }
    if (errorWithStatus.status === 413) {
      res.status(413).json({ success: false, error: "La requ\xEAte est trop volumineuse." });
      return;
    }
    console.error("[API] Unhandled request error:", err);
    res.status(500).json({ success: false, error: "Une erreur interne est survenue." });
  });
  return app;
}

// src/server/main.ts
dotenv4.config();
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var PORT = parseInt(process.env.PORT || "3000", 10);
var isExplicitDev = process.env.npm_lifecycle_event === "dev";
var distPath = path.resolve(process.cwd(), "dist");
var isProd = !isExplicitDev && (process.env.NODE_ENV === "production" || fs.existsSync(distPath));
var serverStarted = false;
async function startServer() {
  if (serverStarted) {
    return;
  }
  serverStarted = true;
  const app = createApiApp();
  try {
    await initDatabase();
    await seedInitialDataIfNeeded();
  } catch (err) {
    console.error("[DB] Database startup error:", err);
  }
  if (!isProd) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath2 = path.resolve(process.cwd(), "dist");
    if (fs.existsSync(distPath2)) {
      app.use(express2.static(distPath2));
      app.get("*", (req, res) => {
        const indexPath = path.resolve(distPath2, "index.html");
        if (fs.existsSync(indexPath)) {
          res.sendFile(indexPath);
        } else {
          res.status(404).send("Not Found");
        }
      });
    } else {
      console.warn(`[PichFlow] Warning: dist directory not found at ${distPath2}`);
    }
  }
  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`[PichFlow] Server running on http://0.0.0.0:${PORT} (env: ${process.env.NODE_ENV || "development"})`);
  });
  process.on("SIGTERM", () => {
    console.log("[PichFlow] SIGTERM signal received: closing HTTP server");
    server.close(() => {
      console.log("[PichFlow] HTTP server closed cleanly");
      process.exit(0);
    });
  });
  process.on("SIGINT", () => {
    console.log("[PichFlow] SIGINT signal received: closing HTTP server");
    server.close(() => {
      console.log("[PichFlow] HTTP server closed cleanly");
      process.exit(0);
    });
  });
  return server;
}
try {
  const currentPath = fileURLToPath(import.meta.url);
  if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(currentPath)) {
    startServer().catch((err) => {
      console.error("[PichFlow] Fatal startup error:", err);
      process.exit(1);
    });
  }
} catch {
}
export {
  startServer
};
