const express = require('express');
const cors = require('cors');
const path = require('path');
const axios = require('axios');
const multer = require('multer');
require('dotenv').config();

const modpacksRoutes = require('./routes/modpacks');

const app = express();
const PORT = process.env.PORT || 3000;

// 配置 multer 用于文件上传
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 50 * 1024 * 1024
    },
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

// 静态文件服务 - 根据环境不同调整路径
const isVercel = process.env.VERCEL === '1';
const staticPath = isVercel ? path.join(__dirname, '../client') : path.join(__dirname, '../client');

app.use(express.static(staticPath));

// API 路由
app.use('/api/modpacks', modpacksRoutes);

// 图片代理 - 修复 URL 解析问题
app.get('/api/image-proxy', async (req, res) => {
    // 获取原始 URL 参数，不要重复解码
    let imageUrl = req.query.url;
    
    if (!imageUrl) {
        return res.status(400).json({ error: '缺少图片URL参数' });
    }
    
    // 确保 URL 是字符串，不要再次解码（因为前端已经编码过了）
    // 如果 URL 看起来没有被编码，才进行编码
    if (!imageUrl.includes('%')) {
        imageUrl = decodeURIComponent(imageUrl);
    }
    
    // 修复常见的 URL 错误
    imageUrl = imageUrl
        .replace(/forgedcdn/g, 'forgecdn')  // 修复拼写错误
        .replace(/\/93\/42\/6\//g, '/93/426/')  // 修复路径
        .replace(/263262895770502676/g, '636262895770502676');  // 修复数字
    
    console.log('代理请求图片:', imageUrl);
    
    try {
        const response = await axios({
            method: 'get',
            url: imageUrl,
            responseType: 'stream',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
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
        // 返回一个默认图片
        res.redirect('/img/default-modpack.png');
    }
});
// 文件上传接口
app.post('/api/upload', upload.single('file'), async (req, res) => {
    try {
        const { supabaseAdmin } = require('./db');
        
        if (!req.file) {
            return res.status(400).json({ error: '没有上传文件' });
        }
        
        const file = req.file;
        const fileName = file.originalname;
        
        let mimeType = 'application/octet-stream';
        const ext = fileName.split('.').pop().toLowerCase();
        
        switch (ext) {
            case 'zip':
                mimeType = 'application/zip';
                break;
            case 'rar':
                mimeType = 'application/vnd.rar';
                break;
            case '7z':
                mimeType = 'application/x-7z-compressed';
                break;
        }
        
        console.log(`上传文件: ${fileName}, 类型: ${mimeType}, 大小: ${file.size} bytes`);
        
        const timestamp = Date.now();
        const safeFileName = `${timestamp}_${fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        const filePath = `uploads/${safeFileName}`;
        
        const { data, error } = await supabaseAdmin.storage
            .from('modpacks')
            .upload(filePath, file.buffer, {
                contentType: mimeType,
                cacheControl: '3600',
                upsert: false
            });
        
        if (error) {
            console.error('Supabase 上传错误:', error);
            throw error;
        }
        
        const { data: urlData } = supabaseAdmin.storage
            .from('modpacks')
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
        res.status(500).json({ 
            error: error.message,
            details: error.message.includes('row-level security') 
                ? '存储桶权限配置错误，请联系管理员' 
                : error.message
        });
    }
});

// SPA 回退路由
app.get('*', (req, res) => {
    res.sendFile(path.join(staticPath, 'index.html'));
});

// Vercel 需要导出 app
if (isVercel) {
    module.exports = app;
} else {
    app.listen(PORT, () => {
        console.log(`服务器运行在 http://localhost:${PORT}`);
    });
}