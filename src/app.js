const express = require('express');
const cors = require('cors');
const rateLimiter = require('./services/rateLimiter');
const browserRoutes = require('./api/browser');

const app = express();
app.use(express.json());
app.use(cors());
app.use(rateLimiter);

app.use('/api/browser', browserRoutes);

module.exports = app;
