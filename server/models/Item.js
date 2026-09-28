const mongoose = require('mongoose');
const { Schema } = mongoose;

const ItemSchema = new Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  category: { type: String, lowercase: true, trim: true },
  condition: { type: String, trim: true },
  price: { type: Number, required: true },
  originalPrice: { type: Number, default: null },
  location: { type: String, default: null },
  status: { type: String, default: 'active' },
  isVerified: { type: Boolean, default: false },
  seller: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  images: [{ imageUrl: String, isPrimary: { type: Boolean, default: false } }]
}, { timestamps: true });

module.exports = mongoose.model('Item', ItemSchema);
