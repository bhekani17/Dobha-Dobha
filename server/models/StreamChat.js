const mongoose = require('mongoose');
const { Schema } = mongoose;

const StreamChatSchema = new Schema({
  stream: { type: Schema.Types.ObjectId, ref: 'Stream', required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  userName: { type: String, required: true },
  text: { type: String, default: '' },
  reaction: { type: String, default: null }
}, { timestamps: true });

module.exports = mongoose.model('StreamChat', StreamChatSchema);
