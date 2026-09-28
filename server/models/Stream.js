const mongoose = require('mongoose');
const { Schema } = mongoose;

const StreamSchema = new Schema({
  seller: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true, trim: true },
  location: { type: String, default: 'Bree Taxi Rank, Joburg CBD' },
  status: { type: String, default: 'live' },
  viewerCount: { type: Number, default: 1 },
  playbackUrl: { type: String, default: null },
  posterUrl: { type: String, default: null },
  featuredItem: { type: Schema.Types.Mixed, default: null },
  muxStreamId: { type: String, default: null },
  startedAt: { type: Date, default: Date.now },
  endedAt: { type: Date, default: null }
}, { timestamps: true });

module.exports = mongoose.model('Stream', StreamSchema);
