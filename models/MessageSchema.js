const mongoose = require('mongoose');

const messageSchema = mongoose.Schema({
    senderId: {
        type: mongoose.Types.ObjectId,
        required: true,
        ref: "User",
    },
    receiverId: {
        type: mongoose.Types.ObjectId,
        required: true,
        ref: "User",
    },
    message: {
        type: String,
        required: true
    }
});

const Message = mongoose.model('Message', messageSchema);

module.exports = Message;