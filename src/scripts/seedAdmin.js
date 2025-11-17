import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../models/user.model.js";

dotenv.config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected");
  } catch (error) {
    console.error("MongoDB connection error:", error);
    process.exit(1);
  }
};

const seedAdmin = async () => {
  try {
    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: "admin@leafsmiths.com" });
    if (existingAdmin) {
      console.log("Admin user already exists");
      return;
    }

    // Create admin user
    const adminUser = new User({
      name: "LeafSmiths Admin",
      email: "admin@leafsmiths.com",
      password: "Admin123!", // This will be hashed by the pre-save middleware
      role: "admin",
    });

    await adminUser.save();
    console.log("Admin user created successfully");
    console.log("Email: admin@leafsmiths.com");
    console.log("Password: Admin123!");
  } catch (error) {
    console.error("Error seeding admin:", error);
  }
};

const runSeed = async () => {
  await connectDB();
  await seedAdmin();
  process.exit(0);
};

runSeed();
