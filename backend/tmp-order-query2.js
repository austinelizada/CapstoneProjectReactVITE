import mongoose from 'mongoose';
import Order from './models/Order.js';

const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/reactvite';

(async () => {
  try {
    await mongoose.connect(uri, { autoIndex: false });
    const orders = await Order.find().limit(5).lean();
    console.log(JSON.stringify(orders, null, 2));
    process.exit(0);
  } catch (err) {
    console.error('DB query failed', err);
    process.exit(1);
  }
})();
