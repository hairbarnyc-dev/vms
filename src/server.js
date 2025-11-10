import 'dotenv/config'
import app from './app.js'
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => console.log(`VMS on http://${HOST}:${PORT}`));
