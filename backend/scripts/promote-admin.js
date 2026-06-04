import dotenv from "dotenv";
import { connectMongo } from "../config/db.js";
import User from "../models/User.js";

const envPath = new URL("../.env", import.meta.url).pathname;
dotenv.config({ path: envPath });

const getArg = (name) => {
  const index = process.argv.indexOf(name);
  if (index === -1 || index === process.argv.length - 1) return null;
  return process.argv[index + 1];
};

const email = getArg("--email") || getArg("-e");
const role = getArg("--role") || "admin";
const mongoArg = getArg("--mongo") || getArg("-m");

if (!email) {
  console.error(
    "Usage: node scripts/promote-admin.js --email user@example.com [--role admin] [--mongo <MONGO_URI>]"
  );
  process.exit(1);
}

// Allow passing Mongo URI directly via CLI to avoid requiring a .env file
if (mongoArg) {
  process.env.MONGO_URI = mongoArg;
}

const run = async () => {
  try {
    await connectMongo();
    console.log("Connected to MongoDB");

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      console.error(`No user found with email: ${normalizedEmail}`);
      process.exit(1);
    }

    user.role = role;
    await user.save();

    console.log(`Successfully promoted ${normalizedEmail} to role: ${role}`);
    console.log("If this user logs in, they will be treated as an admin in the system.");
    process.exit(0);
  } catch (error) {
    console.error("Failed to promote user:", error.message || error);
    process.exit(1);
  }
};

run();
