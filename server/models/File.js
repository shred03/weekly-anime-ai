const mongoose = require('mongoose');

const FileSchema = new mongoose.Schema({
    file_name: String,
    file_id: String,
    file_link: String,
    channel_id: String,
    file_type: String,  
    timestamp: { type: Date, default: Date.now },
    is_multiple: { type: Boolean, default: false },
    unique_id: String,
    message_id: Number,
    stored_by: { type: Number, required: true },
    original_caption: { type: String, default: 'NA' }
});

const File = mongoose.model('File', FileSchema);
module.exports = File