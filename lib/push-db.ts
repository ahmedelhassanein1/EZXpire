import { MongoClient, type Db } from "mongodb";

const globalForMongo = globalThis as unknown as {
  _ezxpireMongo?: { client: MongoClient; promise: Promise<MongoClient> };
};

async function getClient(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not set");
  }

  if (!globalForMongo._ezxpireMongo) {
    const client = new MongoClient(uri);
    globalForMongo._ezxpireMongo = {
      client,
      promise: client.connect(),
    };
  }

  await globalForMongo._ezxpireMongo.promise;
  return globalForMongo._ezxpireMongo.client;
}

/** Temporary DB helper for Person 4 push/cron until Person 1 owns `lib/mongodb.ts`. */
export async function getPushDb(): Promise<Db> {
  const client = await getClient();
  return client.db(process.env.MONGODB_DB || "ezxpire");
}
