const express = require('express');
const router = express.Router();
const { supabase } = require('../db');

// 登录验证
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
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
        
        if (password !== user.password) {
            return res.status(401).json({ error: '用户名或密码错误' });
        }
        
        const token = Buffer.from(`${user.id}:${Date.now()}`).toString('base64');
        
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
router.post('/verify', async (req, res) => {
    try {
        const { token } = req.body;
        
        if (!token) {
            return res.status(401).json({ error: '未登录' });
        }
        
        const decoded = Buffer.from(token, 'base64').toString();
        const [userId, timestamp] = decoded.split(':');
        
        if (!userId || !timestamp) {
            return res.status(401).json({ error: '无效的 token' });
        }
        
        const { data: user, error } = await supabase
            .from('admin_users')
            .select('id, username, role')
            .eq('id', parseInt(userId))
            .single();
        
        if (error || !user) {
            return res.status(401).json({ error: '用户不存在' });
        }
        
        res.json({
            valid: true,
            user: user
        });
    } catch (error) {
        console.error('验证失败:', error);
        res.status(500).json({ error: error.message });
    }
});

// 添加管理员（仅超级管理员可操作）
router.post('/users', async (req, res) => {
    try {
        const { username, password, role, currentUserRole } = req.body;
        
        // 检查当前用户是否是超级管理员
        if (currentUserRole !== 'super') {
            return res.status(403).json({ error: '权限不足，只有超级管理员可以添加管理员' });
        }
        
        if (!username || !password) {
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
        
        const { data, error } = await supabase
            .from('admin_users')
            .insert([{ username, password, role: role || 'admin' }])
            .select();
        
        if (error) throw error;
        
        res.json({ success: true, user: data[0] });
    } catch (error) {
        console.error('添加管理员失败:', error);
        res.status(500).json({ error: error.message });
    }
});

// 删除管理员（仅超级管理员可操作，且不能删除自己）
router.delete('/users/:id', async (req, res) => {
    try {
        const { currentUserId, currentUserRole } = req.body;
        
        // 检查当前用户是否是超级管理员
        if (currentUserRole !== 'super') {
            return res.status(403).json({ error: '权限不足，只有超级管理员可以删除管理员' });
        }
        
        const userId = parseInt(req.params.id);
        
        // 不能删除自己
        if (userId === currentUserId) {
            return res.status(400).json({ error: '不能删除自己的账号' });
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

// 获取管理员列表（普通管理员只能查看，超级管理员可以管理）
router.get('/users', async (req, res) => {
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
router.delete('/users/:id', async (req, res) => {
    try {
        const { currentUserId, currentUserRole } = req.body;
        const userId = parseInt(req.params.id);
        
        // 检查当前用户是否是超级管理员
        if (currentUserRole !== 'super') {
            return res.status(403).json({ error: '权限不足，只有超级管理员可以删除管理员' });
        }
        
        // 不能删除自己
        if (userId === currentUserId) {
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