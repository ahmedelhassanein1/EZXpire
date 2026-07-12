import { MongoClient, type Db } from "mongodb";

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

function getClientPromise(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error(
      "MONGODB_URI is not set. Add your MongoDB Atlas connection string to .env."
    );
  }

  if (process.env.NODE_ENV === "development") {
    if (!global._mongoClientPromise) {
      const client = new MongoClient(uri);
      global._mongoClientPromise = client.connect();
    }
    return global._mongoClientPromise;
  }

  const client = new MongoClient(uri);
  return client.connect();
}

/**
 * Returns the connected MongoDB database.
 * Uses a cached client in development to avoid exhausting connections on hot reload.
 */
export async function connectToDatabase(): Promise<Db> {
  const client = await getClientPromise();
  const dbName = process.env.MONGODB_DB;
  const db = dbName ? client.db(dbName) : client.db();
  console.log("Connected");
  return db;
}
