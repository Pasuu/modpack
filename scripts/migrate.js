const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

async function migrate() {
    console.log('开始数据迁移...');
    console.log('Supabase URL:', process.env.SUPABASE_URL);
    
    // 读取原始 JSON 数据
    const dataPath = path.join(__dirname, '../client/modpacks.json');
    
    if (!fs.existsSync(dataPath)) {
        console.error('错误: 找不到 modpacks.json 文件，请确保文件在 client/ 目录下');
        process.exit(1);
    }
    
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    const modpacksList = Object.entries(data);
    
    console.log(`找到 ${modpacksList.length} 个整合包待迁移`);
    
    let success = 0;
    let failed = 0;
    const failedItems = [];
    
    for (const [name, pack] of modpacksList) {
        // 构建要插入的数据
        const modpackData = {
            name: name,
            img: pack.img || null,
            i18version: pack.i18version || null,
            gversion: pack.gversion || null,
            i18team: pack.i18team || null,
            isdownload: pack.isdownload || false,
            link: pack.link || {},
            tags: pack.link?.tags || ''
        };
        
        console.log(`正在迁移: ${name}...`);
        
        try {
            const { data: inserted, error } = await supabase
                .from('modpacks')
                .insert([modpackData])
                .select();
            
            if (error) {
                console.error(`  ❌ 失败: ${error.message}`);
                failed++;
                failedItems.push({ name, error: error.message });
            } else {
                console.log(`  ✅ 成功 (ID: ${inserted[0].id})`);
                success++;
            }
        } catch (err) {
            console.error(`  ❌ 异常: ${err.message}`);
            failed++;
            failedItems.push({ name, error: err.message });
        }
        
        // 避免请求过快，添加延迟
        await new Promise(r => setTimeout(r, 100));
    }
    
    // 输出迁移结果
    console.log('\n========== 迁移完成 ==========');
    console.log(`✅ 成功: ${success}`);
    console.log(`❌ 失败: ${failed}`);
    console.log(`📊 总计: ${modpacksList.length}`);
    
    if (failedItems.length > 0) {
        console.log('\n失败列表:');
        failedItems.forEach(item => {
            console.log(`  - ${item.name}: ${item.error}`);
        });
    }
    
    // 验证数据库中的数据
    console.log('\n验证数据库...');
    const { count, error: countError } = await supabase
        .from('modpacks')
        .select('*', { count: 'exact', head: true });
    
    if (!countError) {
        console.log(`数据库当前共有 ${count} 条记录`);
    }
    
    console.log('\n迁移脚本执行完毕！');
}

// 执行迁移
migrate().catch(err => {
    console.error('迁移脚本执行失败:', err);
    process.exit(1);
});