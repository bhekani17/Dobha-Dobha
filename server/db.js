const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    throw new Error('MONGODB_URI must be configured before the server starts');
}

mongoose.connect(MONGODB_URI)
    .then(() => console.log('MongoDB connected'))
    .catch(err => { console.error('MongoDB connection error:', err); process.exit(1); });

module.exports = mongoose;
