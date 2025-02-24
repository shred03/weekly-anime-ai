const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    user_id: { type: Number, required: true, unique: true },
    username: {type: String, default: 'NA'},
    first_name: {type: String, default: 'NA'},
    last_name: {type: String, default: 'NA'},
    created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);