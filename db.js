require("dotenv").config();

const { MongoClient } = require("mongodb");

const globalForMongo = globalThis;

function getClientPromise() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("Missing MONGODB_URI environment variable");
  }

  if (!globalForMongo._mongoClientPromise) {
    const client = new MongoClient(uri);
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
