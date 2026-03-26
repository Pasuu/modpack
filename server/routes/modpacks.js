const express = require('express');
const router = express.Router();
const { supabase } = require('../db');

// 获取所有整合包（支持分页和筛选）
router.get('/', async (req, res) => {
    try {
        const { page = 1, limit = 20, search, version, loader, tags, download } = req.query;
        const start = (page - 1) * limit;
        const end = start + limit - 1;
        
        let query = supabase
            .from('modpacks')
            .select('id, name, img, gversion, i18version, i18team, isdownload, link, tags', { count: 'exact' });
        
        // 搜索筛选
        if (search) {
            query = query.or(`name.ilike.%${search}%,tags.ilike.%${search}%,gversion.ilike.%${search}%`);
        }
        
        // 版本筛选：匹配数字版本前缀
        if (version) {
            query = query.ilike('gversion', `${version}-%`);
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
        
        const { data, error, count } = await query.range(start, end).order('name');
        
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
        const { count: total } = await supabase
            .from('modpacks')
            .select('*', { count: 'exact', head: true });
        
        const { count: downloadable } = await supabase
            .from('modpacks')
            .select('*', { count: 'exact', head: true })
            .eq('isdownload', true);
        
        const { data: versions } = await supabase
            .from('modpacks')
            .select('gversion');
        
        const uniqueVersions = new Set();
        versions?.forEach(v => {
            const version = v.gversion?.split('-')[0];
            if (version) uniqueVersions.add(version);
        });
        
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
        
        // 提取数字版本（去掉加载器后缀）并去重
        const versionSet = new Set();
        versions?.forEach(v => {
            if (v.gversion) {
                const numericVersion = v.gversion.split('-')[0];
                if (numericVersion) versionSet.add(numericVersion);
            }
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
        
        // 版本排序（数字排序，从高到低）
        const uniqueVersions = Array.from(versionSet).sort((a, b) => {
            const aParts = a.split('.').map(Number);
            const bParts = b.split('.').map(Number);
            for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
                const aVal = aParts[i] || 0;
                const bVal = bParts[i] || 0;
                if (aVal !== bVal) return bVal - aVal;
            }
            return 0;
        });
        
        res.json({
            versions: uniqueVersions,
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
        
        // 插入数据
        const { data, error } = await supabase
            .from('modpack_submissions')
            .insert([{
                name: submissionData.name,
                original_name: submissionData.original_name || '',
                description: submissionData.description || '',
                game_version: submissionData.game_version,
                i18n_version: submissionData.i18n_version,
                i18n_team: submissionData.i18n_team,
                author_name: submissionData.author_name,
                author_email: submissionData.author_email || '',
                author_discord: submissionData.author_discord || '',
                curseforge_url: submissionData.curseforge_url || '',
                modrinth_url: submissionData.modrinth_url || '',
                mcmod_url: submissionData.mcmod_url || '',
                github_url: submissionData.github_url || '',
                bilibili_url: submissionData.bilibili_url || '',
                other_url: submissionData.other_url || '',
                image_url: submissionData.image_url || '',
                download_url: submissionData.download_url || '',
                file_name: submissionData.file_name || '',
                file_size: submissionData.file_size || 0,
                tags: tagsString,
                status: 'pending'
            }])
            .select();
        
        if (error) {
            console.error('Supabase 插入错误:', error);
            throw error;
        }
        
        console.log('提交成功:', data[0].id);
        
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