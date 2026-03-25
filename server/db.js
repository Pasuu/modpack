const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('请设置 SUPABASE_URL 和 SUPABASE_ANON_KEY 环境变量');
    // 在 Vercel 上，如果没有环境变量，使用空值但不会崩溃
    if (process.env.VERCEL !== '1') {
        process.exit(1);
    }
}

// 创建两个客户端
const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');
const supabaseAdmin = supabaseServiceKey 
    ? createClient(supabaseUrl || '', supabaseServiceKey)
    : supabase;

module.exports = { supabase, supabaseAdmin };