const mongoose = require('mongoose'); 

// 2. DEFINE A SCHEMA & MODEL (This structures your database data)
const logSchema = new mongoose.Schema({
    text: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});
module.exports = mongoose.model('Log', logSchema);