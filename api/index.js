import "dotenv/config";
import mongoose from "mongoose";

let connectionPromise;
let serverModulesPromise;

async function loadServerModules() {
  if (!serverModulesPromise) {
    serverModulesPromise = Promise.all([
      import("../server/src/app.js"),
      import("../server/src/config/db.js"),
    ]).then(([appModule, dbModule]) => ({
      app: appModule.default,
      connectDB: dbModule.connectDB,
    }));
  }

  return serverModulesPromise;
}

function ensureDatabaseConnection(connectDB) {
  if (mongoose.connection.readyState === 1) {
    return Promise.resolve();
  }

  if (!connectionPromise) {
    connectionPromise = connectDB(process.env.MONGODB_URI);
  }

  return connectionPromise;
}

function rewriteRequestUrl(req) {
  const originalUrl = new URL(req.url, "https://vercel.local");
  const path = originalUrl.searchParams.get("path");

  if (!path) {
    req.url = req.url.startsWith("/api") ? req.url : `/api${req.url}`;
    return;
  }

  originalUrl.searchParams.delete("path");
  const query = originalUrl.searchParams.toString();
  req.url = `/api/${path}${query ? `?${query}` : ""}`;
}

export default async function handler(req, res) {
  try {
    rewriteRequestUrl(req);
    const { app, connectDB } = await loadServerModules();
    await ensureDatabaseConnection(connectDB);
    return app(req, res);
  } catch (error) {
    console.error(error);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        message: "API initialization failed",
        detail:
          error.message === "MONGODB_URI is required"
            ? error.message
            : "Check Vercel function logs",
      })
    );
  }
}
