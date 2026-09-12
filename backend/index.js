import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import sharedRoutes from './routes/sharedRoutes.js';
import buyerRoutes from './routes/buyerRoutes.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Routes
app.use('/api', sharedRoutes);
app.use('/api', buyerRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', domain: 'buyer' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Buyer backend running on port ${PORT}`);
});
