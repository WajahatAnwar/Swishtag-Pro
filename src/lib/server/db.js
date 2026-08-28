import "dotenv/config";
import { MongoClient } from "mongodb";

const globalForMongo = globalThis;

function maskHostList(hosts) {
  return hosts
    ? hosts.split(",").map(host => host.trim().replace(/^[^.]+/, "***")).join(",")
    : "";
}

function buildMongoUri(uri) {
  const directHosts = process.env.MONGODB_DIRECT_HOSTS;
  const replicaSet = process.env.MONGODB_REPLICA_SET;
  const dbName = process.env.MONGODB_DB || "";

  if (!uri.startsWith("mongodb+srv://") || !directHosts || !replicaSet) {
    return {
      mode: uri.startsWith("mongodb+srv://") ? "srv" : "standard",
      uri,
    };
  }

  const parsedUri = new URL(uri);
  const credentials = parsedUri.username
    ? `${encodeURIComponent(decodeURIComponent(parsedUri.username))}:${encodeURIComponent(decodeURIComponent(parsedUri.password))}@`
    : "";
  const databasePath = dbName ? `/${encodeURIComponent(dbName)}` : "";

  return {
    mode: "direct-hosts",
    uri: `mongodb://${credentials}${directHosts}${databasePath}?ssl=true&authSource=admin&replicaSet=${encodeURIComponent(replicaSet)}&retryWrites=true&w=majority`,
  };
}

export function getMongoDebugInfo() {
  return {
    hasMongoUri: Boolean(process.env.MONGODB_URI),
    mongoUriType: process.env.MONGODB_URI?.startsWith("mongodb+srv://") ? "srv" : "standard-or-missing",
    database: process.env.MONGODB_DB || "",
    collection: process.env.FORM_SUBMISSIONS_COLLECTION || "form_submissions",
    hasDirectHosts: Boolean(process.env.MONGODB_DIRECT_HOSTS),
    directHosts: maskHostList(process.env.MONGODB_DIRECT_HOSTS || ""),
    replicaSet: process.env.MONGODB_REPLICA_SET || "",
    timeoutMs: Number(process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS || 15000),
    nodeVersion: process.version,
  };
}

export function getClientPromise() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("Missing MONGODB_URI environment variable");
  }

  if (!globalForMongo._mongoClientPromise) {
    const resolved = buildMongoUri(uri);

    console.info("[Swishtag Mongo] creating client", {
      mode: resolved.mode,
      ...getMongoDebugInfo(),
    });

    const client = new MongoClient(resolved.uri, {
      serverSelectionTimeoutMS: Number(process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS || 15000),
    });

    globalForMongo._mongoClientPromise = client.connect().catch(error => {
      delete globalForMongo._mongoClientPromise;
      console.error("[Swishtag Mongo] connection failed", {
        name: error?.name,
        code: error?.code,
        errno: error?.errno,
        syscall: error?.syscall,
        hostname: error?.hostname,
        message: error?.message,
      });
      throw error;
    });
  }

  return globalForMongo._mongoClientPromise;
}

export async function getDb(name = process.env.MONGODB_DB) {
  if (!name) {
    throw new Error("Missing MONGODB_DB environment variable");
  }

  const client = await getClientPromise();
  return client.db(name);
}
