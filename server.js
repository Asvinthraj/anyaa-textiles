const jsonServer = require('json-server');
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const router = jsonServer.router('db.json');
const middlewares = jsonServer.defaults();

// Enable CORS
app.use(cors());

// Setup file upload storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dateStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const dir = path.join(__dirname, 'invoices', dateStr);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  }
});
const upload = multer({ storage });

const os = require('os');

function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

// API endpoint for uploading files
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).send('No file uploaded.');
  }
  const dateStr = new Date().toISOString().split('T')[0];
  const localIp = getLocalIpAddress();
  const publicPath = `http://${localIp}:3001/invoices/${dateStr}/${req.file.filename}`;
  res.json({ link: publicPath });
});

// Serve invoices directory statically
app.use('/invoices', express.static(path.join(__dirname, 'invoices')));

// Standard json-server routes
app.use(middlewares);
app.use(router);

app.listen(3001, () => {
  console.log('JSON Server with Upload is running on port 3001');
});
