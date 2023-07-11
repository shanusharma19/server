const mongoose = require('mongoose');

const url = `mongodb+srv://shanu04012003:123321@cluster.hxmxm7p.mongodb.net/?retryWrites=true&w=majority`

mongoose.connect(url, {
    useNewUrlParser: true, 
    useUnifiedTopology: true
}).then(() => console.log('Connected to DB')).catch((e)=> console.log('Error', e))
