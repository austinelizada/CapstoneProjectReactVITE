import mongoose from 'mongoose';
import Order from './models/Order.js';

const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/reactvite';

(async () => {
  try {
    await mongoose.connect(uri, { autoIndex: false });
    const order = await Order.findById('6a22d8be39c26965eeb9fe32').lean();
    console.log(JSON.stringify(order, null, 2));
    process.exit(0);
  } catch (err) {
    console.error('DB query failed', err);
    process.exit(1);
  }
})();
