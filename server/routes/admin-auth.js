const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const router = express.Router();
const { supabase } = require('../db');

const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;

function getTokenSecret() {
    return process.env.ADMIN_TOKEN_SECRET || null;
}

function createToken(userId) {
    const secret = getTokenSecret();
    if (!secret) throw new Error('管理员登录尚未配置 ADMIN_TOKEN_SECRET');

    const expiresAt = Date.now() + TOKEN_TTL_MS;
    const payload = `${userId}.${expiresAt}`;
    const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    return Buffer.from(`${payload}.${signature}`).toString('base64url');
}

function readBearerToken(req) {
    const authorization = req.get('authorization') || '';
    if (authorization.startsWith('Bearer ')) return authorization.slice(7);
    return req.body?.token || null;
}

async function requireAdmin(req, res, next) {
    try {
        const secret = getTokenSecret();
        const token = readBearerToken(req);
        if (!secret) return res.status(503).json({ error: '后台尚未完成安全配置' });
        if (!token) return res.status(401).json({ error: '未登录' });

        const decoded = Buffer.from(token, 'base64url').toString('utf8');
        const [userId, expiresAt, signature] = decoded.split('.');
        const payload = `${userId}.${expiresAt}`;
        const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');

        if (!userId || !expiresAt || !signature || decoded.split('.').length !== 3 ||
            signature.length !== expected.length ||
            !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected)) ||
            !Number.isSafeInteger(Number(userId)) || !Number.isSafeInteger(Number(expiresAt)) || Number(expiresAt) < Date.now()) {
            return res.status(401).json({ error: '登录已失效，请重新登录' });
        }

        const { data: user, error } = await supabase
            .from('admin_users')
            .select('id, username, role')
            .eq('id', Number(userId))
            .single();

        if (error || !user) return res.status(401).json({ error: '用户不存在' });
        req.adminUser = user;
        next();
    } catch (error) {
        console.error('管理员验证失败:', error.message);
        res.status(401).json({ error: '无效的登录凭据' });
    }
}

function requireSuperAdmin(req, res, next) {
    if (req.adminUser?.role !== 'super') {
        return res.status(403).json({ error: '权限不足，只有超级管理员可以执行此操作' });
    }
    next();
}

// 登录验证
router.post('/login', async (req, res) => {
    try {
        if (!getTokenSecret()) {
            return res.status(503).json({ error: '后台尚未完成安全配置' });
        }
        const { username, password } = req.body;
        
        if (!username || !password || username.length > 64 || password.length > 1024) {
            return res.status(400).json({ error: '用户名和密码不能为空' });
        }
        
        const { data: user, error } = await supabase
            .from('admin_users')
            .select('*')
            .eq('username', username)
            .single();
        
        if (error || !user) {
            return res.status(401).json({ error: '用户名或密码错误' });
        }
        
        const isBcryptHash = /^\$2[aby]\$\d{2}\$/.test(user.password || '');
        const passwordMatches = isBcryptHash
            ? await bcrypt.compare(password, user.password)
            : Boolean(user.password) && password.length === user.password.length &&
                crypto.timingSafeEqual(Buffer.from(password), Buffer.from(user.password));

        if (!passwordMatches) {
            return res.status(401).json({ error: '用户名或密码错误' });
        }

        // 兼容旧数据库中的明文密码，并在该管理员成功登录后自动升级为哈希。
        if (!isBcryptHash) {
            const passwordHash = await bcrypt.hash(password, 12);
            const { error: updateError } = await supabase
                .from('admin_users')
                .update({ password: passwordHash })
                .eq('id', user.id);
            if (updateError) throw updateError;
        }

        const token = createToken(user.id);
        
        res.json({
            success: true,
            token: token,
            user: {
                id: user.id,
                username: user.username,
                role: user.role || 'admin'
            }
        });
    } catch (error) {
        console.error('登录失败:', error);
        res.status(500).json({ error: error.message });
    }
});

// 验证 token
router.post('/verify', requireAdmin, (req, res) => {
    res.json({ valid: true, user: req.adminUser });
});

// 添加管理员（仅超级管理员可操作）
router.post('/users', requireAdmin, requireSuperAdmin, async (req, res) => {
    try {
        const { username, password, role } = req.body;
        
        if (!username || !password || username.length > 64 || password.length > 1024) {
            return res.status(400).json({ error: '用户名和密码不能为空' });
        }
        
        // 检查用户名是否已存在
        const { data: existing } = await supabase
            .from('admin_users')
            .select('id')
            .eq('username', username)
            .single();
        
        if (existing) {
            return res.status(400).json({ error: '用户名已存在' });
        }
        
        if (!['admin', 'super'].includes(role || 'admin')) {
            return res.status(400).json({ error: '无效的管理员角色' });
        }
        const passwordHash = await bcrypt.hash(password, 12);
        const { data, error } = await supabase
            .from('admin_users')
            .insert([{ username, password: passwordHash, role: role || 'admin' }])
            .select();
        
        if (error) throw error;
        
        res.json({ success: true, user: data[0] });
    } catch (error) {
        console.error('添加管理员失败:', error);
        res.status(500).json({ error: error.message });
    }
});

// 删除管理员（仅超级管理员可操作，且不能删除自己）
// 获取管理员列表（普通管理员只能查看，超级管理员可以管理）
router.get('/users', requireAdmin, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('admin_users')
            .select('id, username, role, created_at')
            .order('id');
        
        if (error) throw error;
        
        res.json(data || []);
    } catch (error) {
        console.error('获取管理员列表失败:', error);
        res.status(500).json({ error: error.message });
    }
});

// 删除管理员（仅超级管理员可操作，且不能删除自己，也不能删除 pasuu）
router.delete('/users/:id', requireAdmin, requireSuperAdmin, async (req, res) => {
    try {
        const userId = Number(req.params.id);
        if (!Number.isSafeInteger(userId)) return res.status(400).json({ error: '无效的用户 ID' });
        
        // 不能删除自己
        if (userId === req.adminUser.id) {
            return res.status(400).json({ error: '不能删除自己的账号' });
        }
        
        // 获取要删除的用户信息
        const { data: targetUser, error: fetchError } = await supabase
            .from('admin_users')
            .select('username, role')
            .eq('id', userId)
            .single();
        
        if (fetchError) {
            return res.status(404).json({ error: '用户不存在' });
        }
        
        // 禁止删除超级管理员 pasuu（保护账号）
        if (targetUser.username === 'pasuu') {
            return res.status(403).json({ error: '不能删除超级管理员 pasuu' });
        }
        
        const { error } = await supabase
            .from('admin_users')
            .delete()
            .eq('id', userId);
        
        if (error) throw error;
        
        res.json({ success: true });
    } catch (error) {
        console.error('删除管理员失败:', error);
        res.status(500).json({ error: error.message });
    }
});


module.exports = router;
module.exports.requireAdmin = requireAdmin;
module.exports.requireSuperAdmin = requireSuperAdmin;
