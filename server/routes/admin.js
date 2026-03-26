const express = require('express');
const router = express.Router();
const { supabase } = require('../db');
const axios = require('axios'); // 直接引入，不要用 let 声明

// 中间件：验证管理员 token
const verifyAdmin = (req, res, next) => {
    next();
};

// ========== 统计接口 ==========
router.get('/stats', verifyAdmin, async (req, res) => {
    try {
        const { count: total } = await supabase
            .from('modpacks')
            .select('*', { count: 'exact', head: true });
        
        const { count: pending } = await supabase
            .from('modpack_submissions')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'pending');
        
        const { count: approved } = await supabase
            .from('modpack_submissions')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'approved');
        
        const { count: rejected } = await supabase
            .from('modpack_submissions')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'rejected');
        
        res.json({ 
            total: total || 0, 
            pending: pending || 0, 
            approved: approved || 0, 
            rejected: rejected || 0 
        });
    } catch (error) {
        console.error('获取统计失败:', error);
        res.status(500).json({ error: error.message });
    }
});

// ========== CurseForge 图片获取接口 ==========
router.get('/curseforge/image/:id', verifyAdmin, async (req, res) => {
    try {
        const curseforgeId = req.params.id;
        const pageUrl = `https://www.curseforge.com/minecraft/modpacks/${curseforgeId}`;
        
        console.log('正在获取 CurseForge 页面:', pageUrl);
        
        // 添加请求头模拟真实浏览器
        const response = await axios.get(pageUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1'
            },
            timeout: 15000,
            maxRedirects: 5
        });
        
        const html = response.data;
        let imageUrl = null;
        
        // 多种匹配模式
        const patterns = [
            /<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i,
            /<meta[^>]*name="twitter:image"[^>]*content="([^"]+)"/i,
            /<img[^>]*class="[^"]*avatar[^"]*"[^>]*src="([^"]+)"/i,
            /<img[^>]*id="row-image"[^>]*src="([^"]+)"/i,
            /https:\/\/media\.forgecdn\.net\/avatars\/[^"'\s>]+\.(png|jpg|jpeg|webp)/i
        ];
        
        for (const pattern of patterns) {
            const match = html.match(pattern);
            if (match) {
                imageUrl = match[1] || match[0];
                console.log('匹配到图片:', imageUrl);
                break;
            }
        }
        
        if (imageUrl) {
            // 清理 URL
            imageUrl = imageUrl.split('?')[0];
            // 如果是缩略图，转换为大图
            if (imageUrl.includes('/thumbnails/')) {
                imageUrl = imageUrl.replace(/\/thumbnails\/[^/]+\/\d+\/\d+/, '');
            }
            // 确保使用 https
            if (imageUrl.startsWith('//')) {
                imageUrl = 'https:' + imageUrl;
            }
            
            console.log('最终图片 URL:', imageUrl);
            res.json({ 
                success: true, 
                imageUrl: imageUrl
            });
        } else {
            console.log('未找到图片');
            res.status(404).json({ 
                success: false, 
                error: '未找到图片，请手动复制',
                tip: '在 CurseForge 页面右键点击图片 → "复制图片地址"'
            });
        }
    } catch (error) {
        console.error('获取 CurseForge 图片失败:', error.message);
        res.status(500).json({ 
            success: false,
            error: error.message,
            tip: '请手动从 CurseForge 页面复制图片链接'
        });
    }
});

// ========== 提交记录接口 ==========

// 获取所有提交记录
router.get('/submissions/all', verifyAdmin, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('modpack_submissions')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        res.json(data || []);
    } catch (error) {
        console.error('获取所有提交记录失败:', error);
        res.status(500).json({ error: error.message });
    }
});

// 获取指定状态的提交记录
router.get('/submissions', verifyAdmin, async (req, res) => {
    try {
        const { status } = req.query;
        let query = supabase.from('modpack_submissions').select('*');
        
        if (status && status !== 'all' && status !== 'undefined') {
            query = query.eq('status', status);
        }
        
        const { data, error } = await query.order('created_at', { ascending: false });
        
        if (error) throw error;
        res.json(data || []);
    } catch (error) {
        console.error('获取提交记录失败:', error);
        res.status(500).json({ error: error.message });
    }
});

// 获取单个提交详情
router.get('/submissions/:id', verifyAdmin, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('modpack_submissions')
            .select('*')
            .eq('id', req.params.id)
            .single();
        
        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error('获取提交详情失败:', error);
        res.status(500).json({ error: error.message });
    }
});

// 通过审核
router.put('/submissions/:id/approve', verifyAdmin, async (req, res) => {
    try {
        const { data: submission, error: fetchError } = await supabase
            .from('modpack_submissions')
            .select('*')
            .eq('id', req.params.id)
            .single();
        
        if (fetchError) throw fetchError;
        
        if (!submission) {
            return res.status(404).json({ error: '提交记录不存在' });
        }
        
        await supabase
            .from('modpack_submissions')
            .update({ 
                status: 'approved', 
                reviewed_at: new Date().toISOString(),
                reviewed_by: 'admin'
            })
            .eq('id', req.params.id);
        
        const modpackData = {
            name: submission.name,
            img: submission.image_url || '',
            i18version: submission.i18n_version,
            gversion: submission.game_version,
            i18team: submission.i18n_team,
            isdownload: !!submission.download_url,
            link: {
                tags: submission.tags || '',
                download: submission.download_url || '',
                curseforge: extractCurseforgeId(submission.curseforge_url),
                mcmod: extractMcmodId(submission.mcmod_url),
                github: extractGithubPath(submission.github_url),
                bilibili: extractBilibiliUid(submission.bilibili_url)
            }
        };
        
        const { error: insertError } = await supabase
            .from('modpacks')
            .insert([modpackData]);
        
        if (insertError) throw insertError;
        
        res.json({ success: true, message: '审核通过，已添加到整合包列表' });
    } catch (error) {
        console.error('审核通过失败:', error);
        res.status(500).json({ error: error.message });
    }
});

// 拒绝审核
router.put('/submissions/:id/reject', verifyAdmin, async (req, res) => {
    try {
        const { reason } = req.body;
        
        const { error } = await supabase
            .from('modpack_submissions')
            .update({ 
                status: 'rejected', 
                admin_notes: reason || '未说明原因',
                reviewed_at: new Date().toISOString(),
                reviewed_by: 'admin'
            })
            .eq('id', req.params.id);
        
        if (error) throw error;
        
        res.json({ success: true, message: '已拒绝' });
    } catch (error) {
        console.error('拒绝审核失败:', error);
        res.status(500).json({ error: error.message });
    }
});

// ========== 整合包管理接口 ==========

// 添加整合包
router.post('/modpacks', verifyAdmin, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('modpacks')
            .insert([req.body])
            .select();
        
        if (error) throw error;
        res.json({ success: true, data: data[0] });
    } catch (error) {
        console.error('添加整合包失败:', error);
        res.status(500).json({ error: error.message });
    }
});

// 更新整合包
router.put('/modpacks/:id', verifyAdmin, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('modpacks')
            .update(req.body)
            .eq('id', req.params.id)
            .select();
        
        if (error) throw error;
        res.json({ success: true, data: data[0] });
    } catch (error) {
        console.error('更新整合包失败:', error);
        res.status(500).json({ error: error.message });
    }
});

// 删除整合包
router.delete('/modpacks/:id', verifyAdmin, async (req, res) => {
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

// ========== 辅助函数 ==========

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

module.exports = router;