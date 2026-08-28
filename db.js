require("dotenv").config();

const { MongoClient } = require("mongodb");

const globalForMongo = globalThis;

function buildMongoUri(uri) {
  const directHosts = process.env.MONGODB_DIRECT_HOSTS;
  const replicaSet = process.env.MONGODB_REPLICA_SET;
  const dbName = process.env.MONGODB_DB || "";

  if (!uri.startsWith("mongodb+srv://") || !directHosts || !replicaSet) {
    return uri;
  }

  const parsedUri = new URL(uri);
  const credentials = parsedUri.username
    ? `${encodeURIComponent(decodeURIComponent(parsedUri.username))}:${encodeURIComponent(decodeURIComponent(parsedUri.password))}@`
    : "";
  const databasePath = dbName ? `/${encodeURIComponent(dbName)}` : "";

  return `mongodb://${credentials}${directHosts}${databasePath}?ssl=true&authSource=admin&replicaSet=${encodeURIComponent(replicaSet)}&retryWrites=true&w=majority`;
}

function getClientPromise() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("Missing MONGODB_URI environment variable");
  }

  if (!globalForMongo._mongoClientPromise) {
    const client = new MongoClient(buildMongoUri(uri), {
      serverSelectionTimeoutMS: Number(process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS || 15000),
    });
    globalForMongo._mongoClientPromise = client.connect();
  }

  return globalForMongo._mongoClientPromise;
}

async function getDb(name = process.env.MONGODB_DB) {
  if (!name) {
    throw new Error("Missing MONGODB_DB environment variable");
  }

  const client = await getClientPromise();
  return client.db(name);
}

module.exports = {
  getClientPromise,
  getDb,
};
