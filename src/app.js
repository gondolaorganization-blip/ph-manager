const express    = require('express');
const helmet     = require('helmet');
const morgan     = require('morgan');
const compression = require('compression');
const rateLimit  = require('express-rate-limit');
const cors       = require('cors');
const path       = require('path');

const app = express();

const CORS_ORIGINS = [
  process.env.FRONTEND_URL,
  'https://ph.gestarsoft.com',
  'https://ph-manager-frontend.onrender.com',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:5176',
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => cb(null, !origin || CORS_ORIGINS.includes(origin)),
  credentials: true,
}));
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(compression());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

app.use('/uploads', express.static(path.join(__dirname, '..', process.env.UPLOADS_DIR || 'uploads')));

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false });
app.use('/api', limiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Demasiados intentos. Intente en 15 minutos.' },
});

const registroLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Límite de registros alcanzado. Intente en 1 hora.' },
});

// Rutas
const authRoutes      = require('./routes/auth.routes');
const edificiosRoutes = require('./routes/edificios.routes');
const uploadRoutes    = require('./routes/upload.routes');
const portalRoutes    = require('./routes/portal.routes');
const garitaRoutes    = require('./routes/garita.routes');
const usuariosRoutes  = require('./routes/usuarios.routes');

app.use('/api/auth/registro', registroLimiter);
app.use('/api/auth',          authLimiter, authRoutes);
app.use('/api/edificios', edificiosRoutes);
app.use('/api/usuarios',  usuariosRoutes);
app.use('/api/upload',    uploadRoutes);
app.use('/api/portal',    authLimiter, portalRoutes);
app.use('/api/garita',    garitaRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', app: 'PH Manager', timestamp: new Date().toISOString() });
});

// Producción: servir frontend bajo /ph-manager
const DIST = path.join(__dirname, '..', 'frontend', 'dist');
if (process.env.NODE_ENV === 'production') {
  app.use('/ph-manager', express.static(DIST));
  app.get(['/ph-manager', '/ph-manager/*'], (_req, res) => {
    res.sendFile(path.join(DIST, 'index.html'));
  });
}

app.use((req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Error interno del servidor' });
});

module.exports = app;
