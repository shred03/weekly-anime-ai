const mongoose = require('mongoose');
const AdminSchema = new mongoose.Schema({
    admin_id: Number,
});

const Admin = mongoose.model('Admin', AdminSchema);
module.exports = Admin;