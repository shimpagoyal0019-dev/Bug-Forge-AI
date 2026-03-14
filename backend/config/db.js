const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    // Support both MONGO_URI and MONGODB_URI env var names
    const uri = process.env.MONGODB_URI || process.env.MONGO_URI;

    if (!uri) {
      console.error("❌ No MongoDB URI found. Set MONGODB_URI in your .env");
      process.exit(1);
    }

    const conn = await mongoose.connect(uri);
    console.log(`✅ MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB connection error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;