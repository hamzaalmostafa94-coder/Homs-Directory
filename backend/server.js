require('dotenv').config();
const express = require('express');
const { Pool } = require('pg'); // استدعاء مكتبة قاعدة بيانات Neon
const cors = require('cors');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(express.json());

// جلب المعلومات السرية
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '12345';
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key';

// 🚀 الاتصال بقاعدة بيانات Neon السحابية
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // مطلوب للاتصال الآمن بالاستضافات السحابية
});

// 🛠️ إنشاء الجدول تلقائياً في Neon إذا لم يكن موجوداً
const createTableQuery = `
  CREATE TABLE IF NOT EXISTS listings (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    region VARCHAR(100) NOT NULL,
    detailed_address TEXT,
    phone_number VARCHAR(50) NOT NULL,
    contact_method VARCHAR(100),
    map_url TEXT
  );
`;

pool.query(createTableQuery)
  .then(() => console.log('🎉 تم الاتصال بقاعدة بيانات Neon والجدول جاهز!'))
  .catch(err => console.error('❌ خطأ في إنشاء الجدول:', err));

// 🛡️ حارس البوابة
const verifyToken = (req, res, next) => {
  const token = req.headers['authorization'];
  if (!token) return res.status(403).json({ error: 'غير مصرح لك بإجراء هذا التعديل' });
  
  try {
    const decoded = jwt.verify(token.split(' ')[1], JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'الجلسة منتهية أو المفتاح غير صالح' });
  }
};

// 🔑 تسجيل الدخول
app.post('/api/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token });
  } else {
    res.status(401).json({ error: 'كلمة المرور خاطئة' });
  }
});

// مسارات جلب البيانات (مفتوحة)
app.get('/api/options', async (req, res) => {
  try {
    const result = await pool.query('SELECT DISTINCT category, region FROM listings');
    const categories = [...new Set(result.rows.map(r => r.category).filter(Boolean))];
    const regions = [...new Set(result.rows.map(r => r.region).filter(Boolean))];
    res.json({ categories, regions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/listings', async (req, res) => {
  const { name, category, region } = req.query;
  let query = 'SELECT * FROM listings WHERE 1=1';
  const params = [];
  let paramIndex = 1;

  if (name) { 
    query += ` AND full_name LIKE $${paramIndex}`; 
    params.push(`%${name}%`); 
    paramIndex++;
  }
  if (category) { 
    query += ` AND category = $${paramIndex}`; 
    params.push(category); 
    paramIndex++;
  }
  if (region) { 
    query += ` AND region = $${paramIndex}`; 
    params.push(region); 
    paramIndex++;
  }
  
  query += ' ORDER BY id DESC';

  try {
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🔒 مسارات التعديل (محمية)
app.post('/api/listings', verifyToken, async (req, res) => {
  const { full_name, category, region, detailed_address, phone_number, contact_method, map_url } = req.body;
  const query = `INSERT INTO listings (full_name, category, region, detailed_address, phone_number, contact_method, map_url) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`;
  const params = [full_name, category, region, detailed_address, phone_number, contact_method || 'عبر واتساب/مكالمة هاتفية', map_url || null];

  try {
    const result = await pool.query(query, params);
    res.status(201).json({ id: result.rows[0].id, message: 'تم الإضافة بنجاح' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/listings/:id', verifyToken, async (req, res) => {
  const { full_name, category, region, detailed_address, phone_number, map_url } = req.body;
  const query = `UPDATE listings SET full_name = $1, category = $2, region = $3, detailed_address = $4, phone_number = $5, map_url = $6 WHERE id = $7`;
  const params = [full_name, category, region, detailed_address, phone_number, map_url || null, req.params.id];

  try {
    await pool.query(query, params);
    res.json({ message: 'تم التعديل بنجاح' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/listings/:id', verifyToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM listings WHERE id = $1', [req.params.id]);
    res.json({ message: 'تم الحذف بنجاح' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// نستخدم process.env.PORT لأن الاستضافة ستحدد البورت بنفسها لاحقاً
const PORT = process.env.PORT || 5000;
// Endpoint لاستيراد مجموعة من العملاء (من ملف إكسل) دفعة واحدة
// Endpoint لاستيراد مجموعة من العملاء دفعة واحدة (نسخة مرنة تقبل البيانات الناقصة)
app.post('/api/listings/bulk', async (req, res) => {
  try {
    const items = req.body; 
    let successCount = 0;

    for (let item of items) {
      // الشرط الوحيد الآن هو أن يكون هناك "اسم" للعميل على الأقل!
      if (item.full_name && item.full_name.trim() !== "") {
        await pool.query(
          `INSERT INTO listings (full_name, category, region, detailed_address, phone_number, contact_method, map_url) 
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            item.full_name, 
            item.category || 'غير محدد',         // إذا كانت الفئة فارغة
            item.region || 'غير محدد',           // إذا كانت المنطقة فارغة
            item.detailed_address || '',         // إذا كان العنوان فارغاً
            item.phone_number || 'غير متوفر',    // إذا كان الرقم فارغاً
            item.contact_method || '', 
            item.map_url || ''
          ]
        );
        successCount++;
      }
    }
    res.status(201).json({ message: `تم استيراد ${successCount} عميل بنجاح!` });
  } catch (err) {
    console.error("خطأ في الاستيراد:", err.message);
    res.status(500).json({ error: 'حدث خطأ أثناء الاستيراد' });
  }
});
app.listen(PORT, () => {
  console.log(`🛡️ Server running securely on port ${PORT}`);
});