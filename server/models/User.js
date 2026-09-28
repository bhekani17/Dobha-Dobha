const mongoose = require('mongoose');
const { Schema } = mongoose;

const UserSchema = new Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, default: '' },
  name: { type: String, trim: true },
  role: { type: String, default: 'buyer' },
  phone: { type: String, default: null },
  location: { type: String, default: 'South Africa' },
  bio: { type: String, default: null },
  avatarUrl: { type: String, default: null },
  verificationStatus: { type: String, default: 'pending' },
  wallet: {
    balance: { type: Number, default: 0 }
  },
  verification: {
    idNumber: String,
    documentType: String,
    documentUrl: String,
    status: { type: String, default: 'pending' },
    submittedAt: Date
  }
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);
