const express = require('express');
const cors = require('cors');
const path = require('path');
const axios = require('axios');
const multer = require('multer');
require('dotenv').config();

// 先创建 app
const app = express();
const PORT = process.env.PORT || 3000;

// 引入路由（在 app 创建之后）
const modpacksRoutes = require('./routes/modpacks');
const adminRoutes = require('./routes/admin');
const adminAuthRoutes = require('./routes/admin-auth');

// 配置 multer
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['.zip', '.rar', '.7z'];
        const ext = '.' + file.originalname.split('.').pop().toLowerCase();
        if (allowedTypes.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('不支持的文件类型'));
        }
    }
});

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client')));

// API 路由（在 app 创建之后使用）
app.use('/api/modpacks', modpacksRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin-auth', adminAuthRoutes);

// 图片代理
app.get('/api/image-proxy', async (req, res) => {
    const imageUrl = req.query.url;
    if (!imageUrl) {
        return res.status(400).json({ error: '缺少图片URL参数' });
    }
    try {
        const response = await axios({
            method: 'get',
            url: imageUrl,
            responseType: 'stream',
            headers: {
                'User-Agent': 'Mozilla/5.0',
                'Referer': 'https://www.curseforge.com/',
                'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8'
            },
            timeout: 10000
        });
        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.setHeader('Content-Type', response.headers['content-type']);
        response.data.pipe(res);
    } catch (error) {
        console.error('图片代理失败:', imageUrl, error.message);
        res.redirect('/img/default-modpack.png');
    }
});

// 文件上传接口
app.post('/api/upload', upload.single('file'), async (req, res) => {
    try {
        const { supabaseAdmin, storageBucket } = require('./db');
        
        if (!req.file) {
            return res.status(400).json({ error: '没有上传文件' });
        }
        
        const file = req.file;
        const fileName = file.originalname;
        
        let mimeType = 'application/octet-stream';
        const ext = fileName.split('.').pop().toLowerCase();
        switch (ext) {
            case 'zip': mimeType = 'application/zip'; break;
            case 'rar': mimeType = 'application/vnd.rar'; break;
            case '7z': mimeType = 'application/x-7z-compressed'; break;
        }
        
        console.log(`上传文件: ${fileName}, 类型: ${mimeType}, 大小: ${file.size} bytes`);
        
        const timestamp = Date.now();
        const safeFileName = `${timestamp}_${fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        const filePath = `uploads/${safeFileName}`;
        
        const { data, error } = await supabaseAdmin.storage
            .from(storageBucket || 'modpacks')
            .upload(filePath, file.buffer, {
                contentType: mimeType,
                cacheControl: '3600',
                upsert: false
            });
        
        if (error) throw error;
        
        const { data: urlData } = supabaseAdmin.storage
            .from(storageBucket || 'modpacks')
            .getPublicUrl(data.path);
        
        console.log(`文件上传成功: ${urlData.publicUrl}`);
        
        res.json({
            success: true,
            url: urlData.publicUrl,
            path: data.path,
            fileName: fileName,
            fileSize: file.size
        });
    } catch (error) {
        console.error('上传失败:', error);
        res.status(500).json({ error: error.message });
    }
});

// SPA 回退路由
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/index.html'));
});

app.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
});