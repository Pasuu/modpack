const express = require('express');
const router = express.Router();
const { supabase } = require('../db');

// 获取所有整合包（优化版）
router.get('/', async (req, res) => {
    try {
        const { page = 1, limit = 20, search, version, loader, tags, download } = req.query;
        const start = (page - 1) * limit;
        const end = start + limit - 1;
        
        let query = supabase
            .from('modpacks')
            .select('id, name, img, gversion, i18version, i18team, isdownload, link, tags', { count: 'exact' }); // 只选需要的字段
        
        // 搜索筛选 - 使用索引优化
        if (search) {
            query = query.or(`name.ilike.%${search}%,tags.ilike.%${search}%,gversion.ilike.%${search}%`);
        }
        
        // 版本筛选
        if (version) {
            query = query.eq('gversion', version);
        }
        
        // 加载器筛选
        if (loader) {
            query = query.ilike('gversion', `%-${loader}`);
        }
        
        // 可下载筛选
        if (download === 'true') {
            query = query.eq('isdownload', true);
        }
        
        // 标签筛选 - AND 逻辑
        if (tags) {
            const tagList = tags.split(',').map(t => t.trim());
            for (const tag of tagList) {
                query = query.ilike('tags', `%${tag}%`);
            }
        }
        
        // 分页
        query = query.range(start, end).order('name');
        
        const { data, error, count } = await query;
        
        if (error) throw error;
        
        const processedData = data.map(item => ({
            ...item,
            tags_list: item.tags ? item.tags.split(',').map(t => t.trim()) : []
        }));
        
        res.json({
            data: processedData,
            total: count,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(count / limit)
        });
    } catch (error) {
        console.error('获取整合包失败:', error);
        res.status(500).json({ error: error.message });
    }
});
// 获取单个整合包
router.get('/:id', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('modpacks')
            .select('*')
            .eq('id', req.params.id)
            .single();
        
        if (error) throw error;
        
        res.json(data);
    } catch (error) {
        console.error('获取整合包失败:', error);
        res.status(500).json({ error: error.message });
    }
});

// 获取统计数据
router.get('/stats/summary', async (req, res) => {
    try {
        // 总数
        const { count: total } = await supabase
            .from('modpacks')
            .select('*', { count: 'exact', head: true });
        
        // 可下载数
        const { count: downloadable } = await supabase
            .from('modpacks')
            .select('*', { count: 'exact', head: true })
            .eq('isdownload', true);
        
        // 版本数
        const { data: versions } = await supabase
            .from('modpacks')
            .select('gversion');
        
        const uniqueVersions = new Set();
        versions?.forEach(v => {
            const version = v.gversion?.split('-')[0];
            if (version) uniqueVersions.add(version);
        });
        
        // 汉化组数
        const { data: teams } = await supabase
            .from('modpacks')
            .select('i18team');
        
        const uniqueTeams = new Set();
        teams?.forEach(t => {
            if (t.i18team) uniqueTeams.add(t.i18team);
        });
        
        res.json({
            total: total || 0,
            downloadable: downloadable || 0,
            versions: uniqueVersions.size,
            teams: uniqueTeams.size
        });
    } catch (error) {
        console.error('获取统计失败:', error);
        res.status(500).json({ error: error.message });
    }
});

// 获取所有可用的筛选选项
router.get('/filters/options', async (req, res) => {
    try {
        // 获取所有版本
        const { data: versions } = await supabase
            .from('modpacks')
            .select('gversion');
        
        const versionSet = new Set();
        versions?.forEach(v => {
            if (v.gversion) versionSet.add(v.gversion);
        });
        
        // 获取所有标签
        const { data: tags } = await supabase
            .from('modpacks')
            .select('tags');
        
        const tagSet = new Set();
        tags?.forEach(t => {
            if (t.tags) {
                t.tags.split(',').forEach(tag => {
                    const cleanTag = tag.trim();
                    if (cleanTag) tagSet.add(cleanTag);
                });
            }
        });
        
        // 过滤掉版本相关的标签
        const versionKeywords = [
            'Forge', 'Fabric', 'NeoForge',
            '1.7', '1.8', '1.9', '1.10', '1.11', '1.12', '1.13', '1.14', '1.15',
            '1.16', '1.17', '1.18', '1.19', '1.20', '1.21'
        ];
        
        const filteredTags = Array.from(tagSet).filter(tag => {
            if (!tag) return false;
            const isVersion = versionKeywords.some(keyword => tag.includes(keyword));
            const isNumeric = /^[\d.-]+$/.test(tag);
            return !isVersion && !isNumeric && tag.length > 0;
        }).sort();
        
        res.json({
            versions: Array.from(versionSet).sort((a, b) => b.localeCompare(a, undefined, { numeric: true })),
            tags: filteredTags
        });
    } catch (error) {
        console.error('获取筛选选项失败:', error);
        res.status(500).json({ error: error.message });
    }
});

// 提交汉化包
router.post('/submit', async (req, res) => {
    try {
        const submissionData = req.body;
        
        // 验证必填字段
        const requiredFields = ['name', 'game_version', 'i18n_version', 'i18n_team', 'author_name'];
        for (const field of requiredFields) {
            if (!submissionData[field]) {
                return res.status(400).json({ error: `缺少必填字段: ${field}` });
            }
        }
        
        // 处理标签
        let tagsString = '';
        if (submissionData.tags && Array.isArray(submissionData.tags)) {
            tagsString = submissionData.tags.join(',');
        } else if (typeof submissionData.tags === 'string') {
            tagsString = submissionData.tags;
        }
        
        const { data, error } = await supabase
            .from('modpack_submissions')
            .insert([{
                ...submissionData,
                tags: tagsString,
                status: 'pending'
            }])
            .select();
        
        if (error) throw error;
        
        res.status(201).json({
            success: true,
            message: '提交成功！我们会尽快审核您的汉化包',
            submission: data[0]
        });
    } catch (error) {
        console.error('提交失败:', error);
        res.status(500).json({ error: error.message });
    }
});

// 获取我的提交记录
router.get('/submissions/my', async (req, res) => {
    try {
        const { author_email, author_name } = req.query;
        
        if (!author_email && !author_name) {
            return res.status(400).json({ error: '需要提供邮箱或作者名' });
        }
        
        let query = supabase
            .from('modpack_submissions')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (author_email) {
            query = query.eq('author_email', author_email);
        }
        if (author_name) {
            query = query.ilike('author_name', `%${author_name}%`);
        }
        
        const { data, error } = await query;
        
        if (error) throw error;
        
        res.json(data);
    } catch (error) {
        console.error('获取提交记录失败:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;