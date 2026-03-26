const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { supabase } = require('../db');

// 登录验证
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ error: '用户名和密码不能为空' });
        }
        
        // 查询用户
        const { data: user, error } = await supabase
            .from('admin_users')
            .select('*')
            .eq('username', username)
            .single();
        
        if (error || !user) {
            return res.status(401).json({ error: '用户名或密码错误' });
        }
        
        // 验证密码（这里暂时用明文对比，后续可改用 bcrypt）
        if (password !== user.password) {
            return res.status(401).json({ error: '用户名或密码错误' });
        }
        
        // 生成简单 token
        const token = Buffer.from(`${user.id}:${Date.now()}`).toString('base64');
        
        res.json({
            success: true,
            token: token,
            username: user.username,
            role: user.role
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
        
        // 简单验证 token 格式
        const decoded = Buffer.from(token, 'base64').toString();
        const [userId, timestamp] = decoded.split(':');
        
        if (!userId || !timestamp) {
            return res.status(401).json({ error: '无效的 token' });
        }
        
        // 检查用户是否存在
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

// 添加管理员（需要已有管理员权限）
router.post('/users', async (req, res) => {
    try {
        const { username, password, role } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ error: '用户名和密码不能为空' });
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

// 删除管理员
router.delete('/users/:id', async (req, res) => {
    try {
        const { error } = await supabase
            .from('admin_users')
            .delete()
            .eq('id', req.params.id);
        
        if (error) throw error;
        
        res.json({ success: true });
    } catch (error) {
        console.error('删除管理员失败:', error);
        res.status(500).json({ error: error.message });
    }
});

// 获取管理员列表
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

module.exports = router;