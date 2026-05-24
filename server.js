const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api/gcr', require('./routes/gcr'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/businesses', require('./routes/admin'));
app.use('/api/gcr/menu-editor-data', require('./routes/admin'));
app.use('/api/gcr/menu-editor-save', require('./routes/admin'));

app.get('/', (req, res) => res.json({ status: 'gcr-front-end-data running' }));

app.listen(PORT, () => console.log(`gcr-front-end-data running on port ${PORT}`));
module.exports = app;
