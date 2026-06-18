import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import Admin from './models/Admin.js';
import User from './models/User.js';

(async () => {
  const db = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/acgc_db';
  await mongoose.connect(db, { useNewUrlParser: true, useUnifiedTopology: true });
  const admins = await Admin.find({}).lean();
  const legacyAdmins = await User.find({ role: 'admin' }).lean();
  const customers = await User.find({ role: 'customer' }).limit(5).lean();
  console.log('ADMIN_COUNT', admins.length);
  console.log('LEGACY_ADMIN_COUNT', legacyAdmins.length);
  console.log('ADMINS', JSON.stringify(admins.map(a => ({ email: a.email, username: a.username, role: a.role })), null, 2));
  console.log('LEGACY_ADMINS', JSON.stringify(legacyAdmins.map(u => ({ email: u.email, username: u.username, role: u.role })), null, 2));
  console.log('CUSTOMERS_SAMPLE', JSON.stringify(customers.map(u => ({ email: u.email, username: u.username, role: u.role })), null, 2));
  await mongoose.disconnect();
  process.exit(0);
})();
