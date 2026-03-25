const express = require('express');
const router = express.Router();
const { supabase } = require('../db');

// 获取所有整合包（支持分页和筛选）
router.get('/', async (req, res) => {
    try {
        const { page = 1, limit = 50, search, version, tag, download } = req.query;
        const start = (page - 1) * limit;
        const end = start + limit - 1;
        
        let query = supabase
            .from('modpacks')
            .select('*', { count: 'exact' });
        
        // 搜索筛选
        if (search) {
            query = query.or(`name.ilike.%${search}%,tags.ilike.%${search}%,gversion.ilike.%${search}%`);
        }
        
        // 版本筛选
        if (version) {
            query = query.eq('gversion', version);
        }
        
        // 标签筛选
        if (tag) {
            query = query.contains('tags_array', [tag]);
        }
        
        // 可下载筛选
        if (download === 'true') {
            query = query.eq('isdownload', true);
        }
        
        // 分页
        query = query.range(start, end).order('name');
        
        const { data, error, count } = await query;
        
        if (error) throw error;
        
        // 处理标签字符串为数组
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
            const version = v.gversion.split('-')[0];
            uniqueVersions.add(version);
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
            total,
            downloadable,
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
        versions?.forEach(v => versionSet.add(v.gversion));
        
        // 获取所有标签
        const { data: tags } = await supabase
            .from('modpacks')
            .select('tags');
        
        const tagSet = new Set();
        tags?.forEach(t => {
            if (t.tags) {
                t.tags.split(',').forEach(tag => tagSet.add(tag.trim()));
            }
        });
        
        res.json({
            versions: Array.from(versionSet).sort((a, b) => b.localeCompare(a, undefined, { numeric: true })),
            tags: Array.from(tagSet).sort()
        });
    } catch (error) {
        console.error('获取筛选选项失败:', error);
        res.status(500).json({ error: error.message });
    }
});

// 创建整合包（管理员功能）
router.post('/', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('modpacks')
            .insert([req.body])
            .select();
        
        if (error) throw error;
        
        res.status(201).json(data[0]);
    } catch (error) {
        console.error('创建整合包失败:', error);
        res.status(500).json({ error: error.message });
    }
});

// 更新整合包（管理员功能）
router.put('/:id', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('modpacks')
            .update(req.body)
            .eq('id', req.params.id)
            .select();
        
        if (error) throw error;
        
        res.json(data[0]);
    } catch (error) {
        console.error('更新整合包失败:', error);
        res.status(500).json({ error: error.message });
    }
});

// 删除整合包（管理员功能）
router.delete('/:id', async (req, res) => {
    try {
        const { error } = await supabase
            .from('modpacks')
            .delete()
            .eq('id', req.params.id);
        
        if (error) throw error;
        
        res.json({ success: true });
    } catch (error) {
        console.error('删除整合包失败:', error);
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
            query = query.eq('author_name', author_name);
        }
        
        const { data, error } = await query;
        
        if (error) throw error;
        
        res.json(data);
    } catch (error) {
        console.error('获取提交记录失败:', error);
        res.status(500).json({ error: error.message });
    }
});

// 获取待审核列表（管理员）
router.get('/submissions/pending', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('modpack_submissions')
            .select('*')
            .eq('status', 'pending')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        res.json(data);
    } catch (error) {
        console.error('获取待审核列表失败:', error);
        res.status(500).json({ error: error.message });
    }
});

// 审核提交（管理员）
router.put('/submissions/:id/review', async (req, res) => {
    try {
        const { id } = req.params;
        const { status, admin_notes, reviewed_by } = req.body;
        
        if (!['approved', 'rejected'].includes(status)) {
            return res.status(400).json({ error: '无效的审核状态' });
        }
        
        const { data, error } = await supabase
            .from('modpack_submissions')
            .update({
                status,
                admin_notes,
                reviewed_by,
                reviewed_at: new Date().toISOString()
            })
            .eq('id', id)
            .select();
        
        if (error) throw error;
        
        // 如果审核通过，可以选择自动添加到主表
        if (status === 'approved') {
            const submission = data[0];
            
            // 构建整合包数据
            const modpackData = {
                name: submission.name,
                img: submission.image_url || '',
                i18version: submission.i18n_version,
                gversion: submission.game_version,
                i18team: submission.i18n_team,
                isdownload: !!submission.download_url,
                link: {
                    curseforge: extractCurseforgeId(submission.curseforge_url),
                    mcmod: extractMcmodId(submission.mcmod_url),
                    github: extractGithubPath(submission.github_url),
                    bilibili: extractBilibiliUid(submission.bilibili_url),
                    download: submission.download_url,
                    tags: submission.tags
                }
            };
            
            // 检查是否已存在
            const { data: existing } = await supabase
                .from('modpacks')
                .select('id')
                .eq('name', submission.name)
                .maybeSingle();
            
            if (existing) {
                // 更新现有记录
                await supabase
                    .from('modpacks')
                    .update(modpackData)
                    .eq('id', existing.id);
            } else {
                // 插入新记录
                await supabase
                    .from('modpacks')
                    .insert([modpackData]);
            }
        }
        
        res.json({
            success: true,
            message: `已${status === 'approved' ? '通过' : '拒绝'}审核`,
            submission: data[0]
        });
    } catch (error) {
        console.error('审核失败:', error);
        res.status(500).json({ error: error.message });
    }
});

// 添加评论
router.post('/submissions/:id/comments', async (req, res) => {
    try {
        const { id } = req.params;
        const { user_name, user_email, content } = req.body;
        
        if (!content) {
            return res.status(400).json({ error: '评论内容不能为空' });
        }
        
        const { data, error } = await supabase
            .from('submission_comments')
            .insert([{
                submission_id: id,
                user_name: user_name || '匿名用户',
                user_email,
                content
            }])
            .select();
        
        if (error) throw error;
        
        res.status(201).json({
            success: true,
            comment: data[0]
        });
    } catch (error) {
        console.error('添加评论失败:', error);
        res.status(500).json({ error: error.message });
    }
});

// 获取提交的评论
router.get('/submissions/:id/comments', async (req, res) => {
    try {
        const { id } = req.params;
        
        const { data, error } = await supabase
            .from('submission_comments')
            .select('*')
            .eq('submission_id', id)
            .order('created_at', { ascending: true });
        
        if (error) throw error;
        
        res.json(data);
    } catch (error) {
        console.error('获取评论失败:', error);
        res.status(500).json({ error: error.message });
    }
});

// 辅助函数
function extractCurseforgeId(url) {
    if (!url) return null;
    const match = url.match(/modpacks\/([^\/]+)/);
    return match ? match[1] : null;
}

function extractMcmodId(url) {
    if (!url) return null;
    const match = url.match(/modpack\/(\d+)/);
    return match ? match[1] : null;
}

function extractGithubPath(url) {
    if (!url) return null;
    const match = url.match(/github\.com\/([^\/]+\/[^\/]+)/);
    return match ? match[1] : null;
}

function extractBilibiliUid(url) {
    if (!url) return null;
    const match = url.match(/(?:space\.bilibili\.com\/|uid=)(\d+)/);
    return match ? match[1] : null;
}

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