const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  nonce: {
    type: Number,
    required: false,
    default: Math.floor(Math.random() * 1000000),
  },
  publicAddress: {
    type: String,
    required: false,
    unique: true,
  },
});

const User = mongoose.model("User", UserSchema);

module.exports = User;
