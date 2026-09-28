const mongoose = require('mongoose');
const { Schema } = mongoose;

const EscrowOrderSchema = new Schema({
  _id: { type: String },
  itemId: { type: String, required: true },
  itemTitle: String,
  itemPrice: { type: Number, required: true },
  deliveryFee: { type: Number, default: 0 },
  totalAmount: Number,
  seller: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  buyer: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  fulfillmentType: { type: String, default: 'click_collect' },
  pickupLocation: String,
  deliveryAddress: { type: String, default: '' },
  paymentMethod: String,
  status: { type: String, default: 'HELD_IN_ESCROW' },
  pickupToken: String,
  qrPayload: String,
  completedAt: { type: Date, default: null }
}, { timestamps: true, _id: false });

// Keep the string _id as the id field in responses
EscrowOrderSchema.virtual('id').get(function () { return this._id; });
EscrowOrderSchema.set('toJSON', { virtuals: true });
EscrowOrderSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('EscrowOrder', EscrowOrderSchema);
