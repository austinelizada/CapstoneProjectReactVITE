import { connectMongo } from "../config/db.js";
import User from "../models/User.js";
import Admin from "../models/Admin.js";

async function migrateAdmins() {
  await connectMongo();

  const legacyAdmins = await User.find({ role: "admin" });
  if (legacyAdmins.length === 0) {
    console.log("No legacy admin users found in users collection.");
    process.exit(0);
  }

  console.log(`Found ${legacyAdmins.length} legacy admin(s) in users collection.`);

  for (const legacy of legacyAdmins) {
    const existingAdmin = await Admin.findOne({
      $or: [
        { email: legacy.email.toLowerCase().trim() },
        { username: legacy.username.toLowerCase().trim() },
      ],
    });

    if (existingAdmin) {
      console.log(`Skipping ${legacy.email}: already exists in admin collection.`);
      continue;
    }

    const adminData = {
      email: legacy.email,
      username: legacy.username,
      password: legacy.password,
      first_name: legacy.first_name,
      last_name: legacy.last_name,
      phone: legacy.phone || "",
      street_address: legacy.street_address || "",
      city: legacy.city || "",
      province: legacy.province || "",
      zip_code: legacy.zip_code || "",
      is_active: legacy.is_active,
      createdAt: legacy.createdAt,
      updatedAt: legacy.updatedAt,
    };

    await Admin.collection.insertOne(adminData);
    console.log(`Migrated admin ${legacy.email} into admins collection.`);
  }

  console.log("Migration complete. Review and remove legacy admin users manually if needed.");
  process.exit(0);
}

migrateAdmins().catch((error) => {
  console.error("Migration error:", error);
  process.exit(1);
});
