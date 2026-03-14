const mongoose = require("mongoose");
const bcrypt   = require("bcryptjs");

const UserSchema = new mongoose.Schema({
  username: {
    type:     String,
    required: true,
    unique:   true,
    trim:     true
  },
  email: {
    type:     String,
    required: true,
    unique:   true,
    lowercase: true
  },
  password: {
    type:     String,
    required: true
  },
  role: {
    type:    String,
    enum:    ["hacker", "organization", "admin"],
    default: "hacker"
  },
  walletAddress: {
    type: String,
    default: ""
  },
  createdAt: {
    type:    Date,
    default: Date.now
  }
});

// Hash password before saving
UserSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  const salt    = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Compare password
UserSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model("User", UserSchema);