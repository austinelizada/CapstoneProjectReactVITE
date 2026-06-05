import mongoose from "mongoose";

mongoose.set("strictQuery", true);

const getCleanMongoUri = (uri) =>
  uri
    .trim()
    .replace(/^"(.*)"$/, "$1")
    .replace(/^'(.*)'$/, "$1");

const validateMongoUri = (uri) => {
  if (!uri) {
    throw new Error("Missing MONGO_URI in .env");
  }

  if (!uri.startsWith("mongodb://") && !uri.startsWith("mongodb+srv://")) {
    throw new Error(
      `Invalid MONGO_URI scheme. Expected mongodb:// or mongodb+srv://. Loaded: ${uri}`
    );
  }

  return uri;
};

export async function connectMongo() {
  const rawUri = process.env.MONGO_URI;
  const uri = getCleanMongoUri(rawUri || "");
  const validUri = validateMongoUri(uri);
  console.info("[db] Connecting to MongoDB using URI:", validUri.replace(/(mongodb\+srv:\/\/[^@]+@)/, "mongodb+srv://***@"));
  return mongoose.connect(validUri, {
    autoIndex: true,
  });
}
