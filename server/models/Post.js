const mongoose = require('mongoose');

const PostSchema = new mongoose.Schema({
    channelId: {
        type: String,
        required: true
    },
    channelUsername: {
        type: String,
        required: false
    },
    stickerId: {
        type: String,
        required: false,
        default: null
    },
    adminId: {
        type: Number,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

PostSchema.statics.getLatestForAdmin = function(adminId) {
    return this.findOne({ adminId }).sort({ updatedAt: -1 }).exec();
};

module.exports = mongoose.model('Post', PostSchema);