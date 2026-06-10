import mongoose from "mongoose";

mongoose.set("strictQuery", true);

const getCleanMongoUri = (uri) =>
  uri
    .trim()
    .replace(/^"(.*)"$/, "$1")
    .replace(/^'(.*)'$/, "$1");

const validateMongoUri = (uri) => {
  if (!uri) {
    throw new Error("Missing MongoDB URI. Provide MONGO_URI in .env or run local MongoDB on 127.0.0.1:27017.");
  }

  if (!uri.startsWith("mongodb://") && !uri.startsWith("mongodb+srv://")) {
    throw new Error(
      `Invalid MONGO_URI scheme. Expected mongodb:// or mongodb+srv://. Loaded: ${uri}`
    );
  }

  return uri;
};

const getMongoUri = () => {
  const rawUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/reactvite";
  if (!process.env.MONGO_URI) {
    console.warn(
      "[db] MONGO_URI not set. Falling back to local MongoDB at mongodb://127.0.0.1:27017/reactvite"
    );
  }
  return getCleanMongoUri(rawUri);
};

export async function connectMongo() {
  const uri = getMongoUri();
  const validUri = validateMongoUri(uri);
  if (process.env.DEBUG_DB === "true") {
    console.info("[db] Connecting to MongoDB using URI:", validUri.replace(/(mongodb\+srv:\/\/[^@]+@)/, "mongodb+srv://***@"));
  }
  return mongoose.connect(validUri, {
    autoIndex: true,
  });
}
