import initSqlJs from 'sql.js';
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import { provinces, collegesByProvince } from './components/regionData';
import { COLLEGE_MAJORS, DEFAULT_DEPARTMENTS } from './data/collegeMajors';
import { OIL_GAS_PLAN } from './components/professionalDemoData';
import { getEnterpriseProfile } from './components/enterpriseProfiles';

let db: any = null;
let dbPromise: Promise<any> | null = null;

const DB_STORAGE_KEY = 'zyznjc_sqljs_db_v1';
let isSeeding = false;

// 将内存 sql.js 数据库持久化到 localStorage，使数据跨页面刷新 / 重新登录保留
function loadDBFromStorage(): Uint8Array | null {
  try {
    const b64 = localStorage.getItem(DB_STORAGE_KEY);
    if (!b64) return null;
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  } catch (e) {
    return null;
  }
}

function persistDB() {
  if (!db) return;
  try {
    const bytes = db.export();
    let bin = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
    }
    localStorage.setItem(DB_STORAGE_KEY, btoa(bin));
  } catch (e) {
    /* 忽略配额或序列化错误 */
  }
}

// 兼容旧库：补充人培方案研制新增字段（已存在则跳过，避免重复列报错）
function migrate() {
  const cols = (query("PRAGMA table_info(major_plan_developments)") || []).map((c: any) => c.name);
  if (!cols.includes('completed_steps')) {
    try { run(`ALTER TABLE major_plan_developments ADD COLUMN completed_steps TEXT`); } catch (e) {}
  }
  if (!cols.includes('teaching_schedule')) {
    try { run(`ALTER TABLE major_plan_developments ADD COLUMN teaching_schedule TEXT`); } catch (e) {}
  }
}

export async function getDB() {
  if (db) return db;
  // 缓存 promise，防止并发调用导致重复初始化覆盖 db 变量
  if (dbPromise) return dbPromise;
  dbPromise = getDBInner();
  return dbPromise;
}

async function getDBInner() {

  try {
    const SQL = await initSqlJs({
      locateFile: () => sqlWasmUrl
    });

    const savedBytes = loadDBFromStorage();
    if (savedBytes) {
      try {
        db = new SQL.Database(savedBytes);
        migrate();
        return db;
      } catch (e) {
        db = null;
      }
    }

    db = new SQL.Database();
    isSeeding = true;

    const tables = [
      'users', 'enterprises', 'industries', 'majors', 'occupations', 
      'warehouse_jobs', 'job_tasks', 'chain_nodes', 'enterprise_nodes', 
      'node_occupations', 'jobs', 'job_majors', 'projects', 
      'internship_records', 'resume_submissions', 'patents', 
      'collected_enterprises', 'notices', 'recruitments', 
      'enterprise_registrations', 'departments', 'sys_majors', 
      'sys_grades', 'sys_classes', 'project_applications',
      'enterprise_posted_jobs', 'enterprise_interviews',
      'talent_pool_teachers', 'talent_pool_students',
      'enterprise_experts', 'major_introductions',
      'project_claims', 'internship_logs', 'internship_signins',
      'major_training_plans', 'major_plan_developments', 'major_plan_versions',
      'student_manual_projects',
      'student_career_reports', 'college_departments', 'college_majors',
      'professional_lead_majors', 'roles'
    ];
    
    tables.forEach(table => db.run(`DROP TABLE IF EXISTS ${table}`));

    // 1. 基础组织架构表
    db.run(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE, password TEXT, role TEXT, real_name TEXT, avatar TEXT, status TEXT DEFAULT 'active',
        dept_id INTEGER, enterprise_id INTEGER, major_id INTEGER, grade_id INTEGER, class_id INTEGER, student_code TEXT, phone TEXT, email TEXT, gender TEXT, title TEXT,
        region_id TEXT, college_id TEXT, training_level TEXT, training_levels TEXT, major_ids TEXT, industry_ids TEXT, region_ids TEXT, org_name TEXT
      );
      CREATE TABLE provinces (id TEXT PRIMARY KEY, name TEXT);
      CREATE TABLE colleges (id TEXT PRIMARY KEY, name TEXT, province_id TEXT);
      CREATE TABLE departments (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT);
      CREATE TABLE sys_majors (id INTEGER PRIMARY KEY AUTOINCREMENT, dept_id INTEGER, name TEXT);
      CREATE TABLE sys_grades (id INTEGER PRIMARY KEY AUTOINCREMENT, dept_id INTEGER, major_id INTEGER, name TEXT);
      CREATE TABLE sys_classes (id INTEGER PRIMARY KEY AUTOINCREMENT, dept_id INTEGER, major_id INTEGER, grade_id INTEGER, name TEXT);
      CREATE TABLE majors (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT);
      CREATE TABLE college_departments (
        id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE NOT NULL, short_name TEXT,
        description TEXT, status TEXT DEFAULT 'active', create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE college_majors (
        code TEXT PRIMARY KEY, name TEXT NOT NULL, durations TEXT, department_id INTEGER,
        source TEXT DEFAULT '克拉玛依职业技术学院专业设置.xlsx', status TEXT DEFAULT 'active'
      );
      CREATE TABLE professional_lead_majors (
        user_id INTEGER NOT NULL, major_code TEXT NOT NULL,
        PRIMARY KEY (user_id, major_code)
      );
    `);

    DEFAULT_DEPARTMENTS.forEach(item => {
      db.run(
        'INSERT INTO college_departments (id, name, short_name, description) VALUES (?, ?, ?, ?)',
        [item.id, item.name, item.shortName, item.description]
      );
    });
    COLLEGE_MAJORS.forEach(item => {
      db.run(
        'INSERT INTO college_majors (code, name, durations, department_id) VALUES (?, ?, ?, ?)',
        [item.code, item.name, item.durations, item.departmentId]
      );
    });

    // 2. 产业与企业
    db.run(`
      CREATE TABLE industries (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, scale_index INTEGER, importance_index INTEGER, investment_index INTEGER, depth_index INTEGER);
      CREATE TABLE enterprises (
        id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, org_code TEXT, industry_id INTEGER, region TEXT, tags TEXT, 
        basic_info TEXT, business_direction TEXT, business_scope TEXT, tech_direction TEXT, tech_path TEXT, 
        major_info TEXT, copyrights TEXT, qualifications TEXT, total_employees INTEGER, active_employees INTEGER, 
        registration_date TEXT, is_leading INTEGER DEFAULT 0, score_scale REAL, score_economic REAL, score_personnel REAL, 
        status TEXT DEFAULT 'published', update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE chain_nodes (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        chain_id INTEGER, 
        name TEXT, 
        stage TEXT, 
        total_count INTEGER, 
        above_scale INTEGER, 
        high_tech INTEGER, 
        tech_sme_count INTEGER,
        tech_index INTEGER
      );
      CREATE TABLE enterprise_nodes (enterprise_id INTEGER, node_id INTEGER);
      CREATE TABLE patents (id INTEGER PRIMARY KEY AUTOINCREMENT, enterprise_id INTEGER, title TEXT, type TEXT, class_no TEXT, applicant TEXT, abstract TEXT, apply_date TEXT, grant_no TEXT, grant_date TEXT, applicant_address TEXT, inventor TEXT);
      CREATE TABLE collected_enterprises (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, enterprise_id INTEGER, collect_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE(user_id, enterprise_id));
      CREATE TABLE enterprise_experts (
        id INTEGER PRIMARY KEY AUTOINCREMENT, enterprise_id INTEGER, name TEXT, username TEXT, contact TEXT, enterprise_name TEXT, tech_direction TEXT, patents_ip TEXT, status TEXT, create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 3. 职业与岗位标准
    db.run(`
      CREATE TABLE occupations (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT, name TEXT, definition TEXT, tasks TEXT, typical_jobs TEXT, majors TEXT, major_codes TEXT);
      CREATE TABLE warehouse_jobs (id INTEGER PRIMARY KEY AUTOINCREMENT, occupation_id INTEGER, title TEXT, category TEXT, level_name TEXT, level_rank INTEGER, knowledge TEXT, skills TEXT, career_path TEXT, radar_json TEXT);
      CREATE TABLE job_tasks (id INTEGER PRIMARY KEY AUTOINCREMENT, job_id INTEGER, type TEXT, name TEXT, description TEXT, ability TEXT, knowledge_skills TEXT, tools TEXT, ai_solution TEXT);
      CREATE TABLE node_occupations (node_id INTEGER, occupation_id INTEGER);
    `);

    // 4. 业务协同
    db.run(`
      CREATE TABLE projects (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, enterprise_id INTEGER, enterprise_full_name TEXT, dept TEXT, description TEXT, leader TEXT, contact TEXT, tech_field TEXT, target_date TEXT, budget TEXT, status TEXT DEFAULT 'pending_audit', create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE project_applications (id INTEGER PRIMARY KEY AUTOINCREMENT, project_id INTEGER, applicant_id INTEGER, status TEXT, apply_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE internship_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        student_id INTEGER, 
        enterprise_id INTEGER, 
        job_title TEXT, 
        dept TEXT, 
        start_date TEXT, 
        end_date TEXT, -- 新增
        status TEXT, 
        mentor_name TEXT, 
        school_mentor TEXT, -- 新增
        responsibilities TEXT, 
        evaluation_json TEXT, -- 企业评价
        school_evaluation TEXT -- 新增：学校评价
      );
      CREATE TABLE enterprise_posted_jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT, enterprise_id INTEGER, title TEXT, enterprise_full_name TEXT, 
        major_direction TEXT, salary_range TEXT, edu_requirement TEXT, location TEXT, openings INTEGER DEFAULT 1,
        dept_name TEXT, benefits TEXT, responsibilities TEXT, qualifications TEXT, exp_requirement TEXT, 
        resume_count INTEGER DEFAULT 0, status TEXT DEFAULT 'online', create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE enterprise_interviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        enterprise_id INTEGER, 
        student_id INTEGER, 
        job_id INTEGER, 
        interview_time TEXT, 
        location TEXT, -- 新增
        status TEXT DEFAULT 'pending'
      );
      CREATE TABLE resume_submissions (id INTEGER PRIMARY KEY AUTOINCREMENT, job_id INTEGER, student_id INTEGER, submit_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP, status TEXT DEFAULT 'pending');
      CREATE TABLE recruitments (id INTEGER PRIMARY KEY AUTOINCREMENT, openings INTEGER);
      CREATE TABLE jobs (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, enterprise_id INTEGER, occupation_id INTEGER, salary_range TEXT, skills TEXT, publish_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP, status TEXT DEFAULT 'open');
      CREATE TABLE job_majors (job_id INTEGER, major_id INTEGER);
      CREATE TABLE project_claims (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER,
        claimer_id INTEGER,
        status TEXT DEFAULT 'claimed',
        claim_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE internship_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        record_id INTEGER,
        type TEXT, -- 日报/周报
        content TEXT,
        log_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE internship_signins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        record_id INTEGER,
        location TEXT,
        status TEXT, -- 正常/异常
        sign_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 5. 专业管理核心表
    db.run(`
      CREATE TABLE major_introductions (
        major_id INTEGER PRIMARY KEY,
        basic_info TEXT NOT NULL,
        training_goals TEXT,
        curriculum TEXT,
        advantages TEXT,
        faculty TEXT,
        resources TEXT,
        practice_base TEXT,
        status TEXT DEFAULT 'draft',
        update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE major_training_plans (
        major_id INTEGER PRIMARY KEY,
        basic_info TEXT,
        career_orientation TEXT,
        job_category TEXT,
        training_goals TEXT,
        specifications TEXT,
        curriculum TEXT,
        faculty TEXT,
        resources TEXT,
        implementation_path TEXT,
        evaluation TEXT,
        graduation_req TEXT,
        diagnosis_result TEXT, -- JSON storage for last diagnosis
        update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE major_plan_developments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        major_id INTEGER,
        status TEXT DEFAULT 'draft', -- draft, submitted
        basic_info TEXT, -- JSON
        career_orientation TEXT, -- JSON
        training_objectives TEXT,
        training_specs TEXT, -- JSON Array
        curriculum TEXT, -- JSON Array
        assurance TEXT, -- JSON
        completed_steps TEXT, -- JSON 各子栏目确认(保存)状态
        teaching_schedule TEXT, -- JSON 教学进程安排排课结果
        update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE major_plan_versions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        major_id INTEGER,
        major_name TEXT,
        version_name TEXT,
        submitted_by TEXT,
        submitted_by_name TEXT,
        submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'submitted', -- submitted 已提交 / published 已发布 / archived 已归档
        snapshot TEXT, -- JSON 快照：basic_info / career_orientation / training_objectives / training_specs / curriculum / assurance
        update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE major_plan_suggestions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        major_code TEXT NOT NULL,
        major_name TEXT,
        from_user TEXT,
        from_role TEXT,
        to_user TEXT,
        suggestion TEXT,
        status TEXT DEFAULT 'pending', -- pending 待处理 / replied 已回复 / done 已整改
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        reply TEXT,
        reply_at TIMESTAMP
      );
    `);

    // 6. 人才库专用表 & 个人成长
    db.run(`
      CREATE TABLE talent_pool_teachers (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        user_id INTEGER, 
        real_name TEXT, 
        title TEXT, 
        research_direction TEXT, 
        expertise TEXT, 
        achievements TEXT, -- 研究成果
        honors TEXT, -- 荣誉成就
        email TEXT, -- 邮箱
        resume_content TEXT, 
        status TEXT DEFAULT 'private', -- private/published
        create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE talent_pool_students (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        user_id INTEGER, 
        real_name TEXT, 
        grade TEXT, 
        major TEXT, 
        phone TEXT, -- 新增
        job_intention TEXT, -- 新增: 求职意向
        skills TEXT, -- 新增: 技能优势
        certificates TEXT, 
        works TEXT, -- 新增: 作品
        internship_eval TEXT, -- 新增: 实习评价快照
        status TEXT DEFAULT 'private', -- 新增: private/published
        specialties TEXT, 
        resume_content TEXT, 
        create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE student_manual_projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER,
        name TEXT,
        enterprise_name TEXT,
        dept_name TEXT,
        background TEXT,
        role TEXT,
        achievements TEXT,
        evaluation TEXT,
        create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE student_career_reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER,
        scores_json TEXT, -- JSON { personality: 80, interest: 70, ability: 90 }
        report_content TEXT, -- AI Generated text
        create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 7. 系统辅助
    db.run(`
      CREATE TABLE notices (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, content TEXT, is_pinned INTEGER DEFAULT 0, publish_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE enterprise_registrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        username TEXT, password TEXT, enterprise_name TEXT, enterprise_type TEXT, 
        business_status TEXT, tax_rating TEXT, employee_count INTEGER, 
        business_scope TEXT, industry_chain TEXT,
        status TEXT DEFAULT 'pending', apply_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      -- 用户登录统计表
      CREATE TABLE user_login_stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        login_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        logout_time TIMESTAMP,
        online_duration INTEGER DEFAULT 0, -- 在线时长（秒）
        ip_address TEXT,
        device_info TEXT
      );
    `);

    // --- 注入基础架构数据 ---
    const provinceInsertSql = provinces
      .map((province) => `('${province.id}', '${province.name}')`)
      .join(', ');
    db.run(`INSERT INTO provinces (id, name) VALUES ${provinceInsertSql}`);

    const collegeRows = Object.entries(collegesByProvince).flatMap(([provinceId, colleges]) =>
      colleges.map((college) => `('${college.id}', '${college.name}', '${provinceId}')`)
    );
    if (collegeRows.length > 0) {
      db.run(`INSERT INTO colleges (id, name, province_id) VALUES ${collegeRows.join(', ')}`);
    }

    // 1. 院系
    db.run("INSERT INTO departments (id, name) VALUES (1, '文旅学院'), (2, '信息工程学院')");
    // 2. 专业 (ID 3 为新增的 旅游管理)
    db.run("INSERT INTO sys_majors (id, dept_id, name) VALUES (1, 1, '虚拟现实技术应用'), (2, 2, '软件技术'), (3, 1, '旅游管理')");
    // 3. 年级 (ID 3 为新增的 2025级)
    db.run("INSERT INTO sys_grades (id, dept_id, major_id, name) VALUES (1, 1, 1, '2022级'), (2, 1, 1, '2023级'), (3, 1, 3, '2025级')");
    // 4. 班级 (ID 2 为新增的 导游1班)
    db.run("INSERT INTO sys_classes (id, dept_id, major_id, grade_id, name) VALUES (1, 1, 1, 1, 'VR1班'), (2, 1, 3, 3, '导游1班')");
    
    // 扩充产业数据 (从 2 个增加到 8 个，丰富图表展示)
    db.run(`INSERT INTO industries (id, name, scale_index, importance_index, investment_index, depth_index) VALUES 
      (1, '文化旅游', 95, 98, 90, 96), 
      (2, '信息技术', 88, 92, 85, 90),
      (3, '智能制造', 94, 96, 92, 89),
      (4, '生物医药', 86, 90, 95, 94),
      (5, '海洋经济', 91, 94, 88, 87),
      (6, '绿色能源', 83, 91, 96, 88),
      (7, '现代服务', 89, 85, 80, 82),
      (8, '数字创意', 80, 88, 84, 91)
    `);
    
    // 企业数据 (增加更多虚拟企业以匹配产业)
    db.run(`INSERT INTO enterprises (id, name, org_code, industry_id, region, tags, is_leading, status, score_scale, basic_info, business_direction, business_scope, tech_direction, tech_path, major_info) VALUES 
      (1, '山东文旅集团', '91370100MA3C5W001', 1, '济南', '虚拟现实, 智慧旅游, 数字孪生', 1, 'published', 98.5, '山东省属大型文旅企业', '全域数字化文旅升级', '旅游资源开发, 数字化导览服务, 酒店管理, 文创产品研发', 'VR/AR渲染引擎, 文旅大数据', '自研云渲染引擎 -> 适配混合现实终端 -> 接入国产元宇宙平台', '虚拟现实技术应用, 酒店管理, 旅游管理'),
      (2, '歌尔创客', '91370700MA3C5W002', 1, '潍坊', 'VR硬件, 智能终端', 1, 'published', 95.0, '全球领先的虚拟现实硬件研发中心', 'VR/AR设备制造', '虚拟现实整机研发, 触觉反馈系统, 光学透镜组件生产', '微型投影技术, 交互传感算法', '光波导技术 -> 轻量化穿戴设计', '软件技术, 机械设计制造及其自动化'),
      (3, '浪潮云数据', '91370100MA3C5W003', 2, '济南', '云计算, 大数据, AI', 1, 'published', 97.2, '国内领先的云计算与大数据服务商', '政务云与企业数字化', '服务器制造, 云计算服务, 智慧城市解决方案', '分布式存储, AI算力调度', '开放计算架构 -> 边缘计算节点', '计算机科学, 数据科学'),
      (4, '潍柴智能动力', '91370700MA3C5W004', 3, '潍坊', '高端装备, 新能源, 智能制造', 1, 'published', 96.8, '国际化内燃机研发制造集团', '动力总成与智能物流', '柴油机研发, 氢燃料电池, 智能液压', '热效率优化, 氢能应用', '传统动力 -> 混合动力 -> 氢燃料电池', '机械工程, 能源动力'),
      (5, '华熙生物科技', '91370100MA3C5W005', 4, '济南', '生物科技, 医美, 玻尿酸', 1, 'published', 94.5, '全球知名的生物科技公司', '生物活性材料研发', '透明质酸原料, 医疗终端产品, 功能性护肤品', '微生物发酵, 交联技术', '酶切法 -> 梯度3D交联', '生物工程, 制药工程'),
      (6, '中集来福士', '91370600MA3C5W006', 5, '烟台', '海工装备, 深海养殖', 1, 'published', 93.9, '世界级海洋工程装备总包商', '深远海开发装备', '钻井平台, 海上风电船, 智能网箱', '深海定位, 抗风浪结构', '浅海装备 -> 深远海智能装备', '船舶与海洋工程, 自动化')
    `);

    db.run(`INSERT INTO enterprise_posted_jobs (enterprise_id, title, enterprise_full_name, major_direction, salary_range, edu_requirement, location, openings, dept_name, benefits, responsibilities, qualifications, exp_requirement) VALUES 
      (1, 'VR全景开发工程师', '山东文旅集团', '虚拟现实技术应用', '12k-18k', '本科及以上', '济南', 5, '数字媒体部', '五险一金, 带薪年假, 定期体检', '负责景区3D场景漫游开发，实现多终端适配。', '熟悉Unity3D或UE4，具备GLSL编写能力。', '2-3年相关工作经验'),
      (2, '嵌入式硬件工程师', '歌尔创客', '软件技术/电子信息', '15k-25k', '硕士', '潍坊', 3, '研发实验室', '极具竞争力的薪酬, 年终奖, 股票期权', 'VR整机底层驱动开发及系统性能调优。', '精通C语言，熟悉Linux内核架构。', '应届优选或1-3年工作经验'),
      (3, '云计算运维专家', '浪潮云数据', '软件技术', '18k-30k', '本科', '济南', 10, '云服务事业部', '六险二金, 餐补, 交通补', '保障政务云平台的高可用性，处理突发故障。', '熟悉OpenStack, K8s, Docker容器化技术。', '5年以上大型运维经验')
    `);

    // 扩充文旅产业链节点数据，包含 tech_sme_count
    db.run(`INSERT INTO chain_nodes (id, chain_id, name, stage, total_count, above_scale, high_tech, tech_sme_count, tech_index) VALUES 
      (1, 1, 'AR/VR硬件', 'upstream', 450, 120, 80, 200, 92),
      (2, 1, '文化IP创意', 'upstream', 800, 50, 120, 450, 75),
      (3, 1, '旅游装备制造', 'upstream', 350, 150, 60, 100, 82),
      (4, 1, '数字内容制作', 'upstream', 600, 80, 200, 300, 88),
      (5, 1, '文旅大数据', 'midstream', 300, 80, 150, 120, 88),
      (6, 1, '智慧景区运营', 'midstream', 550, 200, 90, 180, 80),
      (7, 1, '在线旅游平台', 'midstream', 200, 40, 80, 60, 90),
      (8, 1, '沉浸式体验', 'downstream', 600, 150, 180, 250, 95),
      (9, 1, '研学旅行服务', 'downstream', 400, 60, 30, 150, 70),
      (10, 1, '康养旅游', 'downstream', 320, 100, 40, 120, 78)
    `);

    db.run("INSERT INTO enterprise_nodes (enterprise_id, node_id) VALUES (1, 5), (1, 8), (2, 1)");

    // --- 产教图谱数据扩充 ---
    
    // 1. 标准专业目录 (Majors for graph)
    db.run(`INSERT INTO majors (id, name) VALUES 
      (1, '虚拟现实技术应用'), 
      (2, '软件技术'), 
      (3, '旅游管理'),
      (4, '数字媒体艺术'),
      (5, '广播影视节目制作'),
      (6, '会展策划与管理'),
      (7, '网络直播与运营'),
      (8, '环境艺术设计'),
      (9, '研学旅行管理与服务')
    `);

    // 2. 标准职业 (Occupations)
    // 扩充职业池，确保每个专业都能在职业仓中筛选出若干个对应职业
    db.run(`INSERT INTO occupations (id, code, name, definition, tasks, typical_jobs, majors, major_codes) VALUES 
      (1, '2-02-10-09', '虚拟现实工程技术人员', '从事VR相关架构设计、研发、测试的专业人员', '3D建模、交互开发、性能优化', 'VR开发工程师、交互设计师', '虚拟现实技术应用, 软件技术', '510208, 510203'),
      (2, '4-13-01-03', '全媒体运营师', '综合利用各种媒介技术和渠道，采用数据分析、创意策划等方式，对信息进行加工、匹配、分发、传播、反馈的人员', '内容生产、粉丝管理、数据分析', '新媒体运营、直播场控', '数字媒体艺术, 网络直播与运营', '550103, 560214'),
      (3, '4-13-01-05', '研学旅行指导师', '策划、制定、实施研学旅行课程，指导学生活动的人员', '课程设计、活动组织、安全管理', '研学导师、课程设计师', '旅游管理, 研学旅行管理与服务', '540101, 540105'),
      (4, '2-09-06-08', '数字展示设计师', '从事数字化展厅、展馆的空间形态、视觉传达及多媒体交互设计的人员', '空间设计、交互逻辑、视觉呈现', '展陈设计师、多媒体交互设计', '环境艺术设计, 数字媒体艺术', '550106, 550103'),
      (5, '4-13-01-06', '智慧景区运营师', '运用大数据、物联网等技术手段，对景区资源、服务、管理进行数字化运营与优化的人员', '数据监测、客流调度、智慧营销、应急指挥', '数据运营主管、智慧调度员', '旅游管理, 大数据技术', '540101, 510205'),
      (6, '4-13-01-07', '数字文旅产品策划师', '负责数字化文旅产品的创意策划、内容设计及商业模式构建的专业人员', 'IP挖掘、产品设计、交互策划、商业变现', '文旅策划经理、数字内容编导', '数字媒体艺术, 广播影视节目制作', '550103, 560205'),
      (7, '2-02-10-15', '软件开发工程技术人员', '从事业务系统设计、编码实现、测试部署及技术优化的专业人员', '系统开发、接口设计、版本管理、部署运维', 'Java开发工程师、后端开发工程师', '软件技术, 计算机应用技术', '510203, 510201'),
      (8, '2-02-10-11', 'Web前端开发工程技术人员', '从事Web页面交互、前端架构、组件开发与用户体验优化的专业人员', '页面开发、交互实现、组件封装、性能优化', '前端开发工程师、H5开发工程师', '软件技术, 计算机应用技术, 数字媒体艺术', '510203, 510201, 550103'),
      (9, '2-09-03-13', '数字影视制作人员', '从事影视节目拍摄、后期包装、合成剪辑与数字视效制作的专业人员', '脚本分镜、拍摄执行、后期剪辑、特效包装', '剪辑师、影视后期制作师', '广播影视节目制作, 数字媒体艺术', '560205, 550103'),
      (10, '4-07-07-02', '会展数字化策划师', '负责展会项目数字化传播、活动流程策划与线上线下一体化执行的专业人员', '活动策划、展会统筹、数字传播、招商对接', '会展策划专员、数字会务经理', '会展策划与管理', '540112'),
      (11, '4-07-07-03', '会展运营管理师', '从事会展项目客户服务、现场运营、资源协调与流程管理的专业人员', '现场执行、供应商协同、客户服务、流程优化', '会展运营专员、会务主管', '会展策划与管理, 旅游管理', '540112, 540101'),
      (12, '4-13-01-08', '直播电商运营师', '从事直播选品、排期策划、场控执行、流量投放与复盘优化的专业人员', '直播策划、场控执行、数据复盘、账号运营', '直播运营、直播场控', '网络直播与运营, 广播影视节目制作', '560214, 560205'),
      (13, '4-13-01-09', '直播内容创作师', '从事直播脚本创作、短视频引流内容生产和主播内容包装的专业人员', '内容脚本、镜头设计、直播话术、账号包装', '直播编导、内容创意师', '网络直播与运营, 数字媒体艺术', '560214, 550103'),
      (14, '2-09-06-10', '室内空间设计师', '从事室内空间方案设计、效果表现、施工图深化与材料搭配的专业人员', '方案设计、建模渲染、施工图绘制、软装搭配', '室内设计师、空间设计师', '环境艺术设计', '550106'),
      (15, '2-09-06-11', '展示陈列设计师', '从事商业陈列、展馆展示、品牌空间视觉与展示道具设计的专业人员', '展示设计、陈列规划、道具制作、落地执行', '陈列设计师、品牌展示设计师', '环境艺术设计, 会展策划与管理', '550106, 540112'),
      (16, '4-13-01-10', '研学营地运营师', '从事研学基地活动设计、营地运营管理与课程服务保障的专业人员', '营地管理、课程执行、接待服务、安全保障', '营地运营专员、营地项目主管', '研学旅行管理与服务, 旅游管理', '540105, 540101'),
      (17, '4-13-01-11', '旅游数字化服务师', '从事智慧文旅场景服务设计、游客服务流程优化和数字化平台运营的专业人员', '数字导览、服务设计、客户运营、平台维护', '智慧导览专员、游客服务主管', '旅游管理', '540101'),
      (18, '2-09-06-12', '数字文创设计师', '从事数字视觉创意、文创内容开发、IP衍生设计与品牌传播物料设计的专业人员', '视觉创意、品牌设计、数字物料制作、IP衍生开发', '文创设计师、视觉设计师', '数字媒体艺术, 广播影视节目制作', '550103, 560205'),
      (19, '2-09-03-14', 'XR内容制作师', '从事沉浸式数字内容策划、三维场景制作、XR交互内容集成的专业人员', '内容策划、三维制作、交互集成、场景优化', 'XR内容设计师、沉浸式内容制作师', '虚拟现实技术应用, 广播影视节目制作', '510208, 560205'),
      (20, '2-02-10-16', '软件测试工程技术人员', '从事软件测试方案设计、自动化测试、质量管理与缺陷分析的专业人员', '测试设计、自动化执行、质量分析、缺陷跟踪', '测试工程师、质量保障工程师', '软件技术, 计算机应用技术, 虚拟现实技术应用', '510203, 510201, 510208')
    `);

    // 3. 产业链节点-职业关联
    db.run("INSERT INTO node_occupations (node_id, occupation_id) VALUES (1, 1), (8, 1), (2, 2), (4, 2), (9, 3), (10, 3), (8, 4), (6, 4), (6, 5), (5, 5), (2, 6), (4, 6), (8, 6)");

    // 4. 典型岗位 (Jobs)
    db.run(`INSERT INTO jobs (title, enterprise_id, occupation_id, salary_range, skills) VALUES 
      ('VR交互开发工程师', 1, 1, '12k-20k', 'Unity, C#, Shader'),
      ('短视频内容主管', 1, 2, '8k-15k', '脚本撰写, 视频剪辑, 流量投流'),
      ('直播运营经理', 2, 2, '10k-20k', '直播话术, 选品策略, 场控'),
      ('研学课程研发专员', 1, 3, '6k-10k', '课程开发, 心理学, 控场能力'),
      ('亲子研学导师', 1, 3, '5k-9k', '带团经验, 讲解能力, 急救常识'),
      ('资深展陈设计师', 1, 4, '12k-18k', '3DMax, UE5, 空间渲染'),
      ('多媒体交互开发', 2, 4, '15k-25k', 'Unity, 传感器交互, 串口通信'),
      ('景区大数据运营主管', 1, 5, '15k-25k', '数据分析, 应急调度, 智慧平台操作'),
      ('文旅策划总监', 1, 6, '20k-35k', 'IP策划, 商业模式, 跨界资源整合')
    `);

    // 5. 岗位-专业关联
    db.run(`INSERT INTO job_majors (job_id, major_id) VALUES 
      (1, 1), (1, 2),
      (2, 4), (2, 5),
      (3, 7), (3, 3),
      (4, 9), (4, 3),
      (5, 9), (5, 3),
      (6, 8), (6, 4),
      (7, 1), (7, 2),
      (8, 3), (8, 2),
      (9, 4), (9, 6)
    `);

    // 6. 职业仓详情数据 (Warehouse Jobs)
    // 注入更多维度的虚拟数据，并确保知识/技能要求列出详细的点
    db.run(`INSERT INTO warehouse_jobs (id, occupation_id, title, category, level_name, level_rank, knowledge, skills, career_path, radar_json) VALUES 
      (1, 1, 'VR交互开发高级工程师', '研发类', '高级', 4, 
       '计算机图形学底层原理 (渲染管线/光照模型), C# 高级编程与内存管理, 3D 数学基础 (矩阵/四元数), Unity/Unreal 引擎架构, XR 设备 SDK 集成规范', 
       'Unity3D 复杂交互逻辑开发, Shader 编写与渲染性能优化, 空间算法与物理模拟实现, 多人联机网络同步机制开发, 跨平台 VR/AR 应用部署', 
       '初级工程师->中级->高级->架构师', 
       '{"digital": 95, "expression": 80, "communication": 70, "collaboration": 85, "learning": 98, "problem_solving": 92, "innovation": 90, "health": 80, "ethics": 85, "responsibility": 90}'),
       
      (2, 5, '景区大数据运营主管', '管理类', '高级', 4, 
       '智慧景区评价标准体系 (GB/T), 旅游消费者行为心理学, 大数据统计分析方法论, 景区突发事件应急预案管理, 旅游目的地数字化营销策略', 
       '熟练操作景区综合管控平台 (IOC), 运用Python/BI工具进行客流多维预测, 舆情监测与危机公关处理能力, 跨部门协同调度与资源整合, 制定基于用户画像的精准营销方案', 
       '运营专员->运营主管->景区副总->文旅集团运营总监', 
       '{"digital": 90, "expression": 85, "communication": 88, "collaboration": 92, "learning": 85, "problem_solving": 95, "innovation": 80, "health": 75, "ethics": 90, "responsibility": 95}'),
       
      (3, 3, '高级研学课程设计师', '研发类', '高级', 4,
       '青少年认知发展心理学, 体验式教育理论 (Kolb学习圈), 中小学综合实践活动课程指导纲要, 地方文史与自然科学通识, 课程安全风险评估标准',
       'PBL项目式学习课程开发, 研学手册与教具设计制作, 探究式教学引导话术设计, 课程实施全流程复盘与迭代, 跨学科教育资源整合能力',
       '研学导师->课程设计师->课程研发总监->研学基地校长',
       '{"digital": 70, "expression": 95, "communication": 90, "collaboration": 85, "learning": 92, "problem_solving": 88, "innovation": 95, "health": 80, "ethics": 95, "responsibility": 98}'),

      (4, 2, '文旅新媒体矩阵主编', '运营类', '中级', 3,
       '互联网传播与新媒体运营规律, 品牌IP资产管理与授权逻辑, 广告法与著作权法合规知识, 粉丝社群心理学与运营模型, 各主流平台 (抖音/小红书) 推荐算法机制',
       '爆款短视频脚本创意策划, 多平台内容分发矩阵搭建与维护, 流量数据复盘与投流策略优化, AIGC工具辅助文案与海报生产, 热点话题捕捉与借势营销',
       '内容助理->新媒体编辑->矩阵主编->首席品牌官',
       '{"digital": 95, "expression": 90, "communication": 85, "collaboration": 80, "learning": 98, "problem_solving": 85, "innovation": 98, "health": 70, "ethics": 85, "responsibility": 80}'),

      (5, 1, 'VR系统架构师', '技术类', '专家', 5,
       '分布式虚拟环境通信协议, 硬件驱动开发与性能调优, 软件工程架构设计模式, XR行业技术演进路线',
       'Unity/Unreal引擎底层源码定制, 大规模三维场景LOD优化策略, 实时云渲染架构设计与部署, 多人在线交互同步算法实现, 复杂系统技术难点攻关',
       '高级开发->系统架构师->技术总监 (CTO)',
       '{"digital": 99, "expression": 75, "communication": 70, "collaboration": 80, "learning": 95, "problem_solving": 98, "innovation": 90, "health": 60, "ethics": 80, "responsibility": 85}'),

      (6, 1, 'VR全景摄影师', '内容类', '初级', 2,
       '全景摄影光学原理, PTGui 等拼接软件基础, 视频编码格式与参数设置, 基础色彩学与构图理论',
       'Insta360/GoPro 全景相机操作, 8K全景视频拼接与缝合, 基础调色与去底操作, 漫游平台素材上传与热点添加',
       '摄影助理->全景摄影师->VR影视导演',
       '{"digital": 65, "expression": 75, "communication": 60, "collaboration": 70, "learning": 80, "problem_solving": 65, "innovation": 70, "health": 85, "ethics": 80, "responsibility": 75}'),

      (7, 1, 'VR资源制作专员', '美术类', '中级', 3,
       '三维空间造型基础, PBR材质流程与纹理映射, 3DMax/Maya 基础建模规范, Unity 场景搭建流程',
       '低多边形(LowPoly)模型制作, UV展开与贴图绘制 (Substance Painter), 场景烘焙与灯光布置, 模型资源导入引擎与优化',
       '模型实习生->资源制作专员->3D美术主管',
       '{"digital": 80, "expression": 85, "communication": 65, "collaboration": 80, "learning": 85, "problem_solving": 75, "innovation": 80, "health": 75, "ethics": 80, "responsibility": 80}'),
       
      (8, 4, '数据安全工程师', '技术类', '高级', 4,
       '信息安全等级保护标准, 网络安全防护体系, 数据加密与解密原理, 隐私保护法规(GDPR/个保法), 风险评估方法论',
       '防火墙策略配置与审计, 漏洞扫描与渗透测试, 数据脱敏与加密实施, 安全事件应急响应, 合规性检查与整改',
       '安全专员->安全工程师->安全架构师->首席安全官',
       '{"digital": 95, "expression": 70, "communication": 75, "collaboration": 80, "learning": 90, "problem_solving": 95, "innovation": 85, "health": 70, "ethics": 95, "responsibility": 98}'),
       
      (9, 4, '大数据分析师', '分析类', '中级', 3,
       '统计学基础与假设检验, 机器学习算法原理, SQL与Python数据分析, 数据可视化理论, 业务指标体系构建',
       '数据清洗与预处理, 统计建模与预测分析, Tableau/PowerBI报表制作, A/B测试设计与分析, 数据洞察报告撰写',
       '数据助理->数据分析师->高级分析师->数据科学家',
       '{"digital": 85, "expression": 80, "communication": 85, "collaboration": 75, "learning": 90, "problem_solving": 92, "innovation": 80, "health": 65, "ethics": 85, "responsibility": 90}'),
       
      (10, 2, '电商运营专员', '运营类', '初级', 2,
       '电商平台运营规则, 消费者心理学, 商品上架流程规范, 客服沟通技巧, 基础数据分析方法',
       '商品详情页优化, 客户咨询回复处理, 订单异常处理, 基础数据报表制作, 活动页面配置',
       '客服助理->运营专员->运营主管->运营总监',
       '{"digital": 75, "expression": 80, "communication": 90, "collaboration": 85, "learning": 85, "problem_solving": 75, "innovation": 70, "health": 80, "ethics": 85, "responsibility": 80}'),
       
      (11, 5, '智能控制系统工程师', '技术类', '高级', 4,
       '自动控制原理, PLC编程与调试, 工业通信协议, 传感器技术基础, 系统集成方法论',
       'PLC程序开发与优化, 工业网络配置与维护, 自动化设备调试, 故障诊断与排除, 系统升级改造实施',
       '技术员->控制工程师->系统工程师->技术经理',
       '{"digital": 88, "expression": 70, "communication": 75, "collaboration": 85, "learning": 85, "problem_solving": 90, "innovation": 80, "health": 75, "ethics": 85, "responsibility": 90}'),
       
      (12, 3, '研学安全管理员', '管理类', '中级', 3,
       '研学旅行安全管理规范, 应急救援基础知识, 保险理赔流程, 安全风险评估方法, 学生心理危机识别',
       '安全预案制定与演练, 现场安全巡查与记录, 突发事件应急处置, 安全教育培训组织, 事故调查与报告撰写',
       '安全员->安全主管->安全经理->安全总监',
       '{"digital": 70, "expression": 85, "communication": 90, "collaboration": 88, "learning": 80, "problem_solving": 85, "innovation": 75, "health": 90, "ethics": 95, "responsibility": 98}'),
       
      (13, 1, 'XR应用开发工程师', '研发类', '专家', 5,
       '扩展现实技术体系, 三维引擎底层架构, 空间计算与定位原理, 人机交互设计理论, 跨平台开发框架',
       'XR SDK深度定制开发, 空间锚点与追踪算法优化, 多模态交互系统设计, 端云协同架构实现, 性能瓶颈分析与调优',
       '高级开发->架构师->技术专家->首席技术官',
       '{"digital": 98, "expression": 75, "communication": 70, "collaboration": 80, "learning": 95, "problem_solving": 98, "innovation": 95, "health": 60, "ethics": 85, "responsibility": 90}'),
       
      (14, 4, '云计算运维工程师', '运维类', '中级', 3,
       '云计算基础架构, 容器化技术(Docker/K8s), 网络协议与安全, 监控告警体系, 自动化运维工具',
       '云服务器部署与配置, 容器编排与管理, 系统监控与性能调优, 故障排查与恢复, 自动化脚本编写',
       '运维助理->运维工程师->高级运维->运维专家',
       '{"digital": 90, "expression": 70, "communication": 75, "collaboration": 80, "learning": 85, "problem_solving": 90, "innovation": 80, "health": 70, "ethics": 80, "responsibility": 85}'),
       
      (15, 2, '新媒体内容策划师', '创意类', '中级', 3,
       '新媒体传播规律, 用户画像分析方法, 内容营销理论, 视觉设计基础, 平台算法机制',
       '热点话题挖掘与选题策划, 创意脚本撰写与分镜设计, 多媒体内容制作, 数据分析驱动优化, 品牌调性把控',
       '内容编辑->策划师->创意总监->首席内容官',
       '{"digital": 85, "expression": 95, "communication": 90, "collaboration": 85, "learning": 90, "problem_solving": 85, "innovation": 95, "health": 70, "ethics": 85, "responsibility": 80}'),
       
      (16, 5, '智慧景区产品经理', '产品类', '高级', 4,
       '产品设计方法论, 用户体验设计原则, 智慧旅游行业趋势, 项目管理知识体系, 商业模式创新',
       '用户需求调研与分析, 产品原型设计与评审, 跨部门协调与推进, 数据驱动产品迭代, 商业价值评估',
       '产品助理->产品经理->高级产品经理->产品总监',
       '{"digital": 88, "expression": 90, "communication": 95, "collaboration": 92, "learning": 90, "problem_solving": 92, "innovation": 90, "health": 75, "ethics": 90, "responsibility": 95}'),

      (17, 6, '数字文旅产品主策划', '策划类', '高级', 4,
       '数字文旅产品生命周期管理, 文旅IP商业化逻辑, 交互叙事设计方法, 用户旅程地图分析, 文旅项目招投标基础',
       '数字内容产品方案策划, 需求梳理与原型输出, 视觉与内容团队协同推进, 产品亮点提炼与路演表达, 上线效果复盘优化',
       '策划助理->产品策划师->主策划->产品总监',
       '{"digital": 86, "expression": 92, "communication": 90, "collaboration": 88, "learning": 88, "problem_solving": 86, "innovation": 94, "health": 72, "ethics": 88, "responsibility": 90}'),

      (18, 7, 'Java后端开发工程师', '研发类', '中级', 3,
       'Java语言特性与JVM原理, Spring Boot开发框架, 数据库事务与索引优化, RESTful接口设计规范, Git协作流程',
       '业务接口开发与联调, 数据库表结构设计, 日志排查与性能优化, 单元测试编写, 持续集成发布支持',
       '开发助理->后端工程师->高级工程师->技术负责人',
       '{"digital": 92, "expression": 72, "communication": 76, "collaboration": 84, "learning": 90, "problem_solving": 91, "innovation": 82, "health": 70, "ethics": 84, "responsibility": 90}'),

      (19, 8, '前端交互开发工程师', '研发类', '中级', 3,
       'HTML5/CSS3标准, JavaScript与TypeScript, Vue/React组件化开发, 前端工程化构建流程, 浏览器渲染机制',
       '响应式页面开发, 交互动效实现, 前端组件封装复用, 接口联调与状态管理, 页面性能优化',
       '前端助理->前端工程师->资深前端->前端架构师',
       '{"digital": 90, "expression": 82, "communication": 78, "collaboration": 85, "learning": 88, "problem_solving": 86, "innovation": 85, "health": 72, "ethics": 84, "responsibility": 88}'),

      (20, 9, '影视后期包装师', '内容类', '中级', 3,
       '镜头语言与剪辑节奏, Premiere/After Effects工作流, 影视调色基础, 包装动画设计逻辑, 音画节奏控制方法',
       '视频粗剪与精剪, 栏目包装与片头设计, 字幕音效合成, 成片输出与格式适配, 项目版本归档管理',
       '剪辑助理->后期包装师->高级后期->后期总监',
       '{"digital": 84, "expression": 88, "communication": 75, "collaboration": 80, "learning": 86, "problem_solving": 82, "innovation": 90, "health": 74, "ethics": 84, "responsibility": 86}'),

      (21, 10, '会展数字传播策划专员', '策划类', '中级', 3,
       '会展项目运营流程, 数字营销传播策略, 会务系统工具使用规范, 活动执行预算管理, 客户沟通与提案逻辑',
       '展会活动方案撰写, 宣传节奏排期管理, 线上会务平台配置, 招商资料整理, 现场执行协调与复盘',
       '策划助理->策划专员->项目经理->运营总监',
       '{"digital": 82, "expression": 88, "communication": 90, "collaboration": 88, "learning": 85, "problem_solving": 82, "innovation": 86, "health": 78, "ethics": 88, "responsibility": 90}'),

      (22, 11, '会务执行主管', '运营类', '高级', 4,
       '会展运营SOP体系, 现场动线与人流组织方法, 供应商管理规则, 客户服务管理, 应急响应流程',
       '会务团队排班统筹, 现场执行风险管控, 客户需求沟通协调, 供应商服务验收, 项目复盘与流程优化',
       '执行专员->执行主管->项目经理->运营负责人',
       '{"digital": 76, "expression": 86, "communication": 94, "collaboration": 93, "learning": 82, "problem_solving": 88, "innovation": 78, "health": 80, "ethics": 90, "responsibility": 94}'),

      (23, 12, '直播运营策划师', '运营类', '中级', 3,
       '直播平台规则, 直播转化漏斗模型, 直播排品与节奏设计, 用户增长模型, 直播复盘分析方法',
       '直播脚本排期制定, 直播场次编排与场控, 流量投放优化, 账号数据分析, 直播团队协同复盘',
       '运营助理->直播运营师->策划师->运营总监',
       '{"digital": 88, "expression": 90, "communication": 92, "collaboration": 86, "learning": 88, "problem_solving": 84, "innovation": 90, "health": 75, "ethics": 84, "responsibility": 88}'),

      (24, 13, '直播编导', '创意类', '中级', 3,
       '直播内容策划流程, 镜头设计与节奏控制, 主播人设塑造方法, 短视频引流逻辑, 平台内容审核规范',
       '直播脚本写作, 镜头切换与导播节奏设计, 主播话术优化, 选题创意输出, 内容风格统一把控',
       '内容助理->直播编导->创意主管->内容总监',
       '{"digital": 84, "expression": 96, "communication": 90, "collaboration": 82, "learning": 86, "problem_solving": 80, "innovation": 95, "health": 72, "ethics": 84, "responsibility": 86}'),

      (25, 14, '室内效果表现设计师', '设计类', '中级', 3,
       '室内空间设计原理, 3ds Max/SketchUp建模, V-Ray/Enscape渲染, 材料工艺基础, 人体工程学与空间尺度',
       '方案效果图建模渲染, 空间材质搭配设计, 施工图深化协同, 客户汇报表达, 设计方案优化调整',
       '设计助理->效果设计师->主案设计师->设计总监',
       '{"digital": 82, "expression": 88, "communication": 80, "collaboration": 82, "learning": 84, "problem_solving": 82, "innovation": 90, "health": 76, "ethics": 84, "responsibility": 86}'),

      (26, 15, '商业展示设计师', '设计类', '中级', 3,
       '商业展示陈列原则, 品牌空间设计逻辑, 展示道具材料工艺, 商场动线规划, 视觉营销方法',
       '陈列空间设计, 展示道具打样跟进, 品牌展示方案汇报, 落地执行配合, 门店陈列优化复盘',
       '陈列助理->展示设计师->资深设计师->空间设计总监',
       '{"digital": 80, "expression": 90, "communication": 84, "collaboration": 84, "learning": 82, "problem_solving": 80, "innovation": 88, "health": 78, "ethics": 86, "responsibility": 86}'),

      (27, 16, '研学营地主理人', '运营类', '高级', 4,
       '营地活动运营体系, 青少年活动组织方法, 服务流程标准化, 安全保障制度, 基地资源整合策略',
       '营地课程排期管理, 接待与运营标准制定, 导师与辅导员协同, 活动质量评价改进, 家校沟通与品牌建设',
       '营地助理->运营专员->营地主管->营地主理人',
       '{"digital": 74, "expression": 90, "communication": 94, "collaboration": 92, "learning": 84, "problem_solving": 86, "innovation": 82, "health": 86, "ethics": 92, "responsibility": 96}'),

      (28, 17, '智慧导览服务经理', '服务类', '高级', 4,
       '智慧导览产品体系, 游客服务标准, 旅游服务礼仪, 数字平台运维基础, 用户体验管理方法',
       '数字导览流程优化, 游客咨询服务管理, 平台内容维护更新, 服务数据分析, 客诉处理与服务改进',
       '服务专员->服务主管->服务经理->运营负责人',
       '{"digital": 82, "expression": 92, "communication": 95, "collaboration": 90, "learning": 84, "problem_solving": 86, "innovation": 80, "health": 80, "ethics": 92, "responsibility": 94}'),

      (29, 18, '数字文创视觉设计师', '设计类', '中级', 3,
       '品牌视觉设计体系, 文创产品开发流程, 字体与版式设计, 插画与图形设计基础, 新媒体物料输出规范',
       '品牌KV与海报设计, 数字文创周边设计, 社媒视觉物料制作, IP形象延展设计, 设计规范沉淀',
       '设计助理->视觉设计师->资深设计师->创意总监',
       '{"digital": 86, "expression": 94, "communication": 82, "collaboration": 84, "learning": 86, "problem_solving": 80, "innovation": 94, "health": 74, "ethics": 84, "responsibility": 86}'),

      (30, 19, '沉浸式内容设计师', '内容类', '中级', 3,
       '沉浸式叙事逻辑, XR内容生产流程, 场景互动体验设计, 三维资源整合方法, 多端发布适配规范',
       '沉浸式脚本策划, 场景内容资源整合, XR交互流程设计, 内容测试与优化, 展示方案汇报输出',
       '内容助理->内容设计师->资深设计师->创意监制',
       '{"digital": 88, "expression": 92, "communication": 82, "collaboration": 84, "learning": 88, "problem_solving": 84, "innovation": 96, "health": 74, "ethics": 84, "responsibility": 86}'),

      (31, 20, '自动化测试工程师', '测试类', '中级', 3,
       '软件测试理论, 接口测试与自动化框架, 缺陷生命周期管理, 持续集成测试流程, 质量度量指标体系',
       '测试用例设计与维护, 自动化测试脚本编写, 缺陷定位与跟踪, 测试报告输出, 发布回归验证',
       '测试助理->测试工程师->高级测试->测试经理',
       '{"digital": 90, "expression": 74, "communication": 80, "collaboration": 86, "learning": 88, "problem_solving": 90, "innovation": 78, "health": 72, "ethics": 88, "responsibility": 92}')
    `);

    // 典型任务扩充
    db.run(`INSERT INTO job_tasks (job_id, type, name, description, ability, knowledge_skills, tools, ai_solution) VALUES 
      (1, '核心任务', '3D场景交互逻辑编写', '实现用户在虚拟空间内的物体抓取与触发逻辑', '交互开发能力', '["C#编程", "物理引擎", "射线检测", "事件系统"]', 'Unity3D, Visual Studio', '使用 AI Copilot 自动补全冗余的射线碰撞检测代码'),
      (2, '核心任务', '黄金周客流高峰调度', '基于实时热力图数据，动态调整景区闸机通道与摆渡车频次，疏导拥堵人群。', '运营调度能力', '["数据分析", "资源调配", "应急预案", "决策判断"]', 'IOC大屏, 对讲系统, BI看板', '使用AI预测模型提前2小时预警拥堵节点，自动生成分流方案建议。'),
      (3, '核心任务', '非遗主题研学课程开发', '结合当地非遗项目（如剪纸），设计适合小学生的探究式学习任务书与评价表。', '课程设计能力', '["教学法设计", "活动策划", "评价设计", "非遗文化"]', 'Canva, Word, 思维导图', '利用生成式AI辅助编写课程教案大纲，生成配套的卡通插画素材。'),
      (4, '日常任务', '全网舆情监测与引导', '监控各平台关于景区的用户评价，筛选负面关键词，及时介入回复并引导舆论。', '舆情分析能力', '["关键词挖掘", "情感分析", "危机公关", "内容创作"]', '清博舆情, 微博后台', '部署NLP情感分析机器人，自动分类评论情绪，生成高情商回复草稿。'),
      (5, '技术攻关', '万人并发云渲染架构搭建', '设计支持上万用户同时在线游览的数字孪生景区后端架构，解决延迟与卡顿问题。', '系统架构能力', '["分布式架构", "负载均衡", "GPU虚拟化", "网络优化"]', 'Kubernetes, NVIDIA CloudXR', '应用AI自动扩缩容算法，根据实时并发量动态调整GPU算力资源。'),
      (6, '日常任务', '全景素材采集与拼接', '使用全景相机对景区重点景点进行720度采集，并完成后期拼接去噪。', '图像处理能力', '["摄影技术", "图像拼接", "色彩校正", "后期修图"]', 'PTGui, Photoshop', 'AI自动识别并去除脚架底座，智能优化曝光平衡。'),
      (7, '核心任务', 'VR场景模型资产制作', '根据原画设计稿，制作符合性能要求的低模场景与道具。', '三维建模能力', '["低模制作", "UV展开", "材质绘制", "性能优化"]', '3DMax, Substance Painter', '利用AI纹理生成工具快速生成写实材质贴图。'),
      (8, '核心任务', '企业数据安全合规审计', '定期对企业信息系统进行安全扫描，识别潜在风险点并提出整改建议。', '安全审计能力', '["漏洞扫描", "风险评估", "合规检查", "安全加固"]', 'Nessus, OpenVAS, 合规检查工具', '部署AI驱动的自动化漏洞扫描机器人，智能生成风险评估报告。'),
      (9, '核心任务', '用户行为数据深度挖掘', '通过分析用户浏览、购买等行为数据，构建精准的用户画像和预测模型。', '数据分析能力', '["数据挖掘", "机器学习", "用户画像", "预测建模"]', 'Python, Spark, Tableau', '使用AutoML工具自动选择最优算法，大幅提升建模效率。'),
      (10, '日常任务', '商品上架与页面优化', '负责商品信息录入、图片上传及详情页美化，提升转化率。', '电商运营能力', '["商品管理", "页面设计", "文案撰写", "数据分析"]', '千牛工作台, Photoshop', 'AI智能生成商品标题和描述，自动推荐最佳主图尺寸。'),
      (11, '技术攻关', '工业4.0生产线控制系统升级', '将传统生产线改造为智能化控制系统，实现数据采集和自动调节。', '工控系统设计能力', '["PLC编程", "工业通信", "SCADA系统", "智能控制"]', 'TIA Portal, Profinet, SCADA', '引入边缘AI芯片实现实时质量检测，减少人工干预。'),
      (12, '核心任务', '研学活动全流程安全管理', '从出发前安全教育到活动中的风险管控，确保学生安全。', '安全管理能力', '["安全教育", "风险识别", "应急处置", "人员管理"]', '对讲机, 定位设备, 应急包', '部署AI人脸识别签到系统，实时监测人员位置异常。'),
      (13, '技术攻关', '跨平台XR应用性能优化', '解决不同设备间XR应用的兼容性和性能问题。', '性能优化能力', '["性能分析", "渲染优化", "兼容性调试", "内存管理"]', 'Unity Profiler, RenderDoc', '使用AI性能分析工具自动识别瓶颈并给出优化建议。'),
      (14, '日常任务', '云平台资源监控与调优', '监控云服务器运行状态，及时处理性能问题和故障。', '运维管理能力', '["监控部署", "告警配置", "故障排查", "资源调度"]', 'Prometheus, Grafana, ELK', '配置AI异常检测告警，自动触发扩容或故障转移。'),
      (15, '核心任务', '爆款内容创意策划与执行', '结合热点事件和用户兴趣，策划具有传播力的内容。', '内容策划能力', '["创意构思", "热点捕捉", "内容制作", "传播分析"]', '热点监测工具, 创意协作平台', '利用AI生成创意灵感库，智能匹配用户偏好标签。'),
      (16, '核心任务', '智慧景区产品需求分析与设计', '深入调研用户需求，设计符合景区特色的智慧化产品功能。', '产品设计能力', '["需求调研", "原型设计", "用户研究", "功能规划"]', 'Axure, 用户调研平台', '运用AI用户画像分析，精准定位目标用户群体需求。'),
      (1, '技术攻关', '多人VR协作系统开发', '构建支持多用户同时在线的虚拟协作环境，实现远程协同工作。', '网络开发能力', '["网络编程", "同步算法", "延迟优化", "语音通信"]', 'Photon Unity Networking, WebRTC', '集成AI语音识别与翻译，实现实时跨语言沟通协作。'),
      (1, '核心任务', 'XR设备适配与优化', '针对不同厂商的VR/AR设备进行应用适配和性能优化。', '设备适配能力', '["SDK集成", "设备调试", "性能调优", "兼容性测试"]', 'Oculus SDK, OpenXR, SteamVR', '使用AI设备识别技术自动检测硬件配置并优化渲染参数。'),
      (13, '日常任务', '云端渲染服务运维', '维护XR应用的云端渲染服务，确保稳定性和高可用性。', '服务运维能力', '["云服务部署", "服务监控", "故障恢复", "性能调优"]', 'AWS EC2, Docker, Nginx', '部署AI智能监控系统，自动预测并预防服务中断风险。'),
      (14, '核心任务', '容器化应用部署', '将传统应用改造为容器化部署，提升部署效率和资源利用率。', 'DevOps能力', '["容器化", "CI/CD", "编排管理", "自动化部署"]', 'Docker, Kubernetes, Helm', '使用AI编排优化工具自动调整容器资源配置和调度策略。'),
      (15, '技术攻关', 'AIGC内容生成优化', '优化AI生成内容的质量和相关性，提升用户体验。', 'AI应用能力', '["提示工程", "模型调优", "内容评估", "质量控制"]', 'Stable Diffusion, GPT模型, Midjourney', '构建AI反馈循环系统，持续优化生成模型的输出质量。'),
      (1, '核心任务', '沉浸式体验内容策划', '设计具有教育意义和娱乐性的VR/AR互动体验内容。', '内容策划能力', '["交互设计", "故事构建", "体验优化", "教育游戏化"]', 'Figma, Unity, Miro', '利用AI生成故事脚本和情节分支，提升内容创作效率。'),
      (2, '日常任务', '用户反馈分析与产品改进', '收集并分析用户对景区智慧化服务的使用反馈，提出改进方案。', '产品改进能力', '["反馈收集", "数据分析", "改进方案", "效果跟踪"]', '问卷星, SPSS, Excel', '应用AI情感分析技术自动分类用户反馈情绪和建议。'),
      (7, '技术攻关', '混合现实场景融合技术', '实现真实环境与虚拟元素的无缝融合，提升沉浸感。', 'MR开发能力', '["空间计算", "环境识别", "虚实融合", "交互设计"]', 'ARCore, ARKit, Unreal Engine', '使用AI环境理解技术自动识别和适应真实场景。'),
      (11, '核心任务', '智能生产调度系统设计', '基于AI算法优化生产线上各环节的时间和资源配置。', '系统设计能力', '["生产优化", "调度算法", "资源规划", "系统集成"]', 'MATLAB, Python, MES系统', '集成机器学习算法，动态调整生产计划以应对突发状况。'),
      (16, '日常任务', '竞品分析与市场调研', '定期分析竞争对手的产品功能和市场策略，形成分析报告。', '市场分析能力', '["竞品研究", "数据收集", "报告撰写", "策略建议"]', '艾瑞咨询, 易观千帆, Google Trends', '运用AI文本分析工具快速提取竞品特征和市场趋势。')
    `);

    db.run("INSERT INTO recruitments (openings) VALUES (50)");
    
    // --- 注入 5 条项目招募信息 (本企业发布) ---
    db.run(`INSERT INTO projects (name, enterprise_id, enterprise_full_name, dept, description, leader, contact, tech_field, target_date, budget, status) VALUES 
      ('沉浸式黄河文化数字展厅', 1, '山东文旅集团', '数字文旅事业部', '利用VR/AR技术重现黄河历史变迁，打造沉浸式体验空间。需要完成三维建模、交互程序开发及硬件部署。', '王建设', '13800138001', 'VR/AR, 数字孪生', '2025-10-01', '200万', 'published'),
      ('泰山景区智慧导览小程序升级', 1, '山东文旅集团', '技术研发中心', '针对现有导览系统进行AI升级，增加语音交互助手、AR实景导航及客流热力图分析功能。', '李创新', '13900139002', '移动开发, AI, 大数据', '2025-06-30', '80万', 'published'),
      ('乡村振兴电商直播基地运营方案', 1, '山东文旅集团', '市场营销部', '策划并执行乡村农产品电商直播活动，需要搭建直播间环境，培训学生主播，并进行数据分析与复盘。', '张市场', '13700137003', '电子商务, 新媒体运营', '2025-12-31', '50万', 'published'),
      ('酒店管理系统国产化适配改造', 1, '山东文旅集团', '信息运维部', '将现有的国际品牌酒店管理系统迁移至国产化软硬件环境，确保数据安全与系统稳定运行。', '赵运维', '13600136004', '软件工程, 信创', '2025-08-15', '120万', 'published'),
      ('齐鲁文化非遗数字化通用库建设', 1, '山东文旅集团', '文化创意部', '对山东省内重点非遗项目进行数字化采集、存储与展示，构建高精度的数字资产库。', '孙非遗', '13500135005', '数字媒体, 数据库', '2026-01-01', '150万', 'published')
    `);

    // --- 用户账号配置（前端 users 表：登录身份 + 用户管理分类共用）---
    // 系统管理员 admin / 机构管理员 gly 为操作身份；
    // zy 专业负责人归属「专业负责人用户」分类、xs 学生归属「学生用户」分类，
    // 均可在「系统管理员 > 用户管理」下与演示账号一一对应查看。
    db.run(`
      INSERT INTO users (username, password, role, real_name, status, training_level, major_id, major_ids, industry_ids, phone, email, title) VALUES 
      ('admin', '123456', '系统管理员', '系统管理员', 'active', NULL, NULL, NULL, NULL, '13800000000', '', ''),
      ('zy', '123456', '专业负责人用户', '油气开采运输专业群负责人', 'active', '高等职业教育（本科）', 3, '[2]', '[1]', '13800000002', '', '副教授'),
      ('gly', '123456', '机构管理员', '机构管理员', 'active', NULL, NULL, NULL, NULL, '13800000007', '', '主管')
    `);

    db.run(`
      INSERT INTO professional_lead_majors (user_id, major_code)
      SELECT id, '420401' FROM users WHERE username = 'zy';
      INSERT INTO professional_lead_majors (user_id, major_code)
      SELECT id, '420404' FROM users WHERE username = 'zy';
      INSERT INTO professional_lead_majors (user_id, major_code)
      SELECT id, '420406' FROM users WHERE username = 'zy';
    `);

    // --- 系统角色目录表（系统管理 > 系统角色管理 使用；用户管理按此分类）---
    // permissions 存储该角色可访问的页面权限（JSON 数组，页面 displayName）
    db.run(`
      CREATE TABLE roles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        role_key TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        permissions TEXT DEFAULT '[]',
        is_builtin INTEGER DEFAULT 0,
        sort_order INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 默认三类用户角色（系统管理员本身为操作身份，不在此目录中）
    db.run(`
      INSERT INTO roles (role_key, name, description, permissions, is_builtin, sort_order) VALUES
      ('zyfzr_user', '专业负责人用户', '负责专业建设、人才培养方案研制与专业决策的教师型用户', '["产业画像","产业链图谱","典型企业分析","职业仓","职业与岗位分析","人才培养方案研制","专业教学标准解析（国标）","产教融合全景","专业适配性分析"]', 1, 1),
      ('teacher_user', '教师用户', '承担教学与产教融合任务的教师用户', '["产业画像","产业链图谱","典型企业分析","职业仓","职业与岗位分析","产教融合全景"]', 1, 2),
      ('student_user', '学生用户', '在校学生用户，可查看本专业相关的产业与岗位信息', '["典型企业分析","职业与岗位分析","职业仓"]', 1, 3)
    `);

    // 为三类默认角色补充示例用户，并使真实演示账号对应到相应分类：
    // - 专业负责人用户：zy（即专业负责人演示账号，由上方登录身份行提供）
    // - 教师用户：js001（教师演示账号）
    // - 学生用户：xs（即学生演示账号）
    db.run(`
      INSERT INTO users (username, password, role, real_name, status, training_level, major_ids, industry_ids, phone, email, title) VALUES
      ('js001', '123456', '教师用户', '王老师', 'active', '高等职业教育（专科）', '[1]', '[2]', '13800000022', '', '讲师'),
      ('xs', '123456', '学生用户', '油气储运技术专业学生', 'active', '高等职业教育（专科）', '[3]', '[3]', '13800000010', '', '')
    `);

    // --- 用户应用统计：虚拟登录数据（演示用，前端内存库刷新即重建）---
    // 为演示账号生成近 30 天的登录与在线时长记录，使统计图表与表格有数据可看。
    {
      const mockLoginUsers = ['admin', 'gly', 'zy', 'js001', 'xs'];
      const mockLoginIps = ['192.168.1.23', '10.0.0.45', '172.16.5.12', '192.168.10.8', '192.168.3.66'];
      const mockDevices = ['Windows Chrome', 'macOS Safari', 'Android WebView', 'iPhone Safari', 'iPad Safari'];
      const loginRows: string[] = [];
      mockLoginUsers.forEach((uname, ui) => {
        const recordCount = 20 + ((ui * 7) % 18); // 每用户 20~37 条
        for (let i = 0; i < recordCount; i++) {
          const dayOffset = (i * 3 + ui * 2) % 30; // 0~29 天前
          const hourOffset = (i * 5 + ui) % 11; // 0~10 小时前（叠加在天数上，越近越新）
          const durationSec = 600 + ((i * 137 + ui * 311) % 7200); // 10~130 分钟
          const ip = mockLoginIps[(i + ui) % mockLoginIps.length];
          const dev = mockDevices[(i * 2 + ui) % mockDevices.length];
          loginRows.push(
            `((SELECT id FROM users WHERE username='${uname}'), datetime('now','-${dayOffset} days','-${hourOffset} hours'), NULL, ${durationSec}, '${ip}', '${dev}')`
          );
        }
      });
      if (loginRows.length > 0) {
        db.run(`INSERT INTO user_login_stats (user_id, login_time, logout_time, online_duration, ip_address, device_info) VALUES ${loginRows.join(', ')}`);
      }
    }

    // --- 专业负责人（zy，油气开采运输专业群负责人）研制的人才培养方案样例数据（供专业管理员查看全校人培方案使用）---
    // 专业负责人（zy）研制的人才培养方案样例 —— 与「人才培养方案研制」完全一致的数据模型（培养规格/分类课程/教学保障完整）
      const COMMON_PUBLIC = OIL_GAS_PLAN.curriculum.public;
      const RESERVOIR_PLAN = {
        basic_info: { name: '油气储运技术', code: '420401', category1: '资源环境与安全大类', category2: '石油与天然气类', req: '普通高中毕业或同等学力', duration: '三年' },
        career_orientation: { industry: '油气储运与管道运输业', job_category: ['油气储运工', '油气输送工'], posts: ['油品储运', '管道巡检', '加气站运营', '油库管理'] },
        training_objectives: '本专业培养能够践行社会主义核心价值观，德智体美劳全面发展，掌握油气集输、储存与配送、管道运输等专业知识与技术技能，面向石油和天然气开采业、管道运输业的油气储运工等职业，能够从事油品储运、管道巡检、加气站运营等工作的高技能人才。',
        career_advancement: '毕业生初始可从事油品储运、管道巡检、加气站运营等一线技术岗位；随经验积累可向储运站站长、管道运营主管、安全技术管理等岗位晋升。',
        training_specs: [
          { id: 1, checked: true, desc: '坚决拥护中国共产党领导，树立中国特色社会主义共同理想，践行社会主义核心价值观，具有深厚的爱国情感、国家认同感和中华民族自豪感；崇尚宪法、遵守法律、遵规守纪，自觉维护生态环境安全；具有强烈的社会责任感和参与意识。', ref_job: '油库管理', ref_req: '政治素养、职业道德、安全意识' },
          { id: 2, checked: true, desc: '崇德向善、诚实守信、爱岗敬业，秉持精益求精的工作态度；尊重劳动、热爱劳动，具有质量意识、环保意识、安全意识；具备较强的集体意识和团队协作能力。', ref_job: '油品储运', ref_req: '职业道德、质量意识、团队协作' },
          { id: 3, checked: true, desc: '具有健康的体魄和稳定的心理状态，能够承受工作压力和应对突发事件；具备感受美、表现美、鉴赏美、创造美的能力；掌握高效学习方法，养成规律生活习惯。', ref_job: '管道巡检', ref_req: '身体素质、心理素质、自我管理' },
          { id: 4, checked: true, desc: '理解储运工艺，能够操作输油臂、泵机组完成油品装卸与转输任务，并实时监控工艺参数。', ref_job: '油品储运', ref_req: '储运设备操作、工艺参数控制' },
          { id: 5, checked: true, desc: '理解管道监测原理，能够运用国产化SCADA系统完成长输管道压力、流量远程监控与泄漏预警。', ref_job: '管道巡检', ref_req: 'SCADA系统操作、远程监控、泄漏预警' },
          { id: 6, checked: true, desc: '理解油气计量方法，能够使用流量计、密度计完成油品计量与交接，保证计量准确。', ref_job: '油库管理', ref_req: '计量器具、油品计量、交接计量' },
          { id: 7, checked: true, desc: '理解HSE管理要求，能够执行储运作业安全规程与应急处置，保障人身与设备安全。', ref_job: '加气站运营', ref_req: 'HSE管理、安全规程、应急处置' },
          { id: 8, checked: true, desc: '理解自动化控制技术，能够操作国产化PLC完成储运站场自控系统的调试与维护。', ref_job: '油品储运', ref_req: 'PLC控制、自动化调试' },
          { id: 9, checked: true, desc: '理解绿色低碳理念，能够开展油气储运能耗监测与减排，服务双碳目标。', ref_job: '管道巡检', ref_req: '能耗监测、绿色储运' },
          { id: 10, checked: true, desc: '理解数字化技术，能够运用国产工业软件完成储运生产数据的采集、处理与趋势分析。', ref_job: '油库管理', ref_req: '数据采集、大数据分析' },
        ],
        curriculum: {
          public: COMMON_PUBLIC,
          basic: [
            { id: 201, name: '工程流体力学', type: 'B类(理实一体)', nature: '必修', credit: 4, hours: 80, ref_job: '油品储运', ref_req: '流体力学、管路计算' },
            { id: 202, name: '泵与压缩机', type: 'B类(理实一体)', nature: '必修', credit: 3, hours: 60, ref_job: '管道巡检', ref_req: '泵机操作、设备维护' },
            { id: 203, name: '油库设计与管理', type: 'B类(理实一体)', nature: '必修', credit: 4, hours: 80, ref_job: '油库管理', ref_req: '油库规划、库存管理' },
            { id: 204, name: '储运自动化技术', type: 'B类(理实一体)', nature: '必修', credit: 3, hours: 60, ref_job: '油品储运', ref_req: '自动化控制、SCADA' },
          ],
          core: [
            { id: 301, name: '油气集输技术', type: 'B类(理实一体)', nature: '必修', credit: 6, hours: 120, tasks: '能够操作输油臂、泵机组完成油品装卸与转输；运用SCADA系统监控集输站场压力、流量并调节运行参数；识别管道泄漏风险并联动报警。', content: '1. 理论知识：集输工艺、节点分析、油气分离。2. 技术工具：输油臂、泵机组、国产SCADA系统。3. 前沿技术：管道泄漏智能预警、无人机巡检。4. 实践能力：集输站场仿真操作与参数优化。', ref_job: '油品储运', ref_req: '集输工艺、节点分析' },
            { id: 302, name: '油气管道输送技术', type: 'B类(理实一体)', nature: '必修', credit: 5, hours: 100, tasks: '能够运用国产化PLC完成长输管道站场控制；基于SCADA系统对管网压力、流量远程监控与调节；应用智能巡检技术识别管道风险。', content: '1. 理论知识：长输管道工艺、热力水利计算。2. 技术工具：国产PLC、管道泄漏检测系统。3. 前沿技术：SCADA数据可视化、机器学习泄漏预警。4. 实践能力：管道站场组态与调试。', ref_job: '管道巡检', ref_req: '长输管道、工艺计算' },
            { id: 303, name: '油气储运安全技术', type: 'B类(理实一体)', nature: '必修', credit: 4, hours: 80, tasks: '能够执行油品储运作业安全规程；运用国产化监测设备完成储运过程风险预警；组织油气泄漏应急演练。', content: '1. 理论知识：HSE管理、燃烧爆炸机理。2. 技术工具：可燃气体检测、消防系统。3. 前沿技术：数字孪生应急演练。4. 实践能力：储运安全预案编制与处置。', ref_job: '加气站运营', ref_req: 'HSE管理、应急' },
            { id: 304, name: '城市燃气输配', type: 'B类(理实一体)', nature: '必修', credit: 4, hours: 80, tasks: '能够操作调压装置完成城市燃气输配；运用国产化监控平台完成燃气管网压力调节与泄漏监测。', content: '1. 理论知识：燃气输配、调压工艺。2. 技术工具：调压柜、燃气SCADA。3. 前沿技术：智能燃气表、管网仿真。4. 实践能力：燃气输配系统运维。', ref_job: '加气站运营', ref_req: '燃气输配、调压' },
            { id: 305, name: '油气储运大数据分析', type: 'B类(理实一体)', nature: '必修', credit: 4, hours: 80, tasks: '能够使用国产数据库存储储运生产数据；利用Python（结合国产AI框架）清洗特征并构建能耗与损耗预测模型。', content: '1. 理论知识：大数据概论、统计学。2. 技术工具：达梦数据库、PaddlePaddle。3. 前沿技术：时序预测、数据可视化。4. 实践能力：储运数据库搭建与趋势分析。', ref_job: '油库管理', ref_req: '数据分析、预测' },
          ],
          practice: [
            { id: 401, name: '军训', type: 'C类(纯实践)', nature: '必修', credit: 1, hours: 30 },
            { id: 402, name: '跟岗实习', type: 'C类(纯实践)', nature: '必修', credit: 8, hours: 240, ref_job: '油品储运、管道巡检', ref_req: '现场操作、岗位技能' },
            { id: 403, name: '顶岗实习', type: 'C类(纯实践)', nature: '必修', credit: 16, hours: 480, ref_job: '油库管理、加气站运营', ref_req: '独立操作、综合技能' },
            { id: 404, name: '毕业设计', type: 'C类(纯实践)', nature: '必修', credit: 4, hours: 120, ref_job: '油品储运', ref_req: '毕业设计、专业报告' },
          ],
          other: [
            { id: 501, name: 'HSE管理与清洁生产', type: 'B类(理实一体)', nature: '必修', credit: 2, hours: 32, ref_job: '加气站运营', ref_req: '安全管理、环保' },
            { id: 502, name: '碳捕集与储运技术', type: 'B类(理实一体)', nature: '必修', credit: 2, hours: 32, ref_job: '管道巡检', ref_req: 'CCUS、低碳储运' },
            { id: 503, name: '工业互联网技术', type: 'B类(理实一体)', nature: '必修', credit: 2, hours: 32, ref_job: '油库管理', ref_req: '工业物联网、边缘计算' },
          ],
        },
        assurance: {
          faculty: '按照“四有好老师”要求建设专业教师队伍，学生数与本专业专任教师数比例不高于25:1，双师素质教师占比不低于60%。专任教师队伍职称、年龄结构合理，专业带头人具有副高及以上职称。专任教师具有油气储运技术及相关专业本科及以上学历，每5年累计企业实践不少于6个月。',
          conditions: '本专业应配备专业教室、油气储运仿真实训室、管道输送自动化实训室及校外实训基地。校内实训室配置油品装卸仿真系统、长输管道SCADA监控平台、泵机组及流量计等装置，满足储运工艺与安全生产教学需求。校外实训基地提供不少于6个月实习岗位，落实校企双导师制。',
          resources: '选用体现油气储运技术特色的国家规划教材和活页式、工作手册式新型教材，建设包含石油精神、铁人精神的数字化教学资源库，开发油气储运虚拟仿真软件及数字化教学案例。',
          quality: '学校和二级院系建立专业人才培养质量保障机制，健全教学质量监控管理制度，强化过程评价，吸纳行业企业参与评价，定期开展课程建设与人才培养质量诊断与改进。建立毕业生跟踪反馈机制，定期评价人才培养质量与培养目标达成情况。',
          graduation: '完成规定的实习实训，全部课程考核合格或修满学分，准予毕业。学校可结合办学实际细化学习要求与考核要求，严把毕业出口关。职业培训取得的职业技能等级证书等学习成果可转化为相应学历教育学分。',
        },
      };
      const PETRO_PLAN = {
        basic_info: { name: '石油工程技术', code: '420406', category1: '资源环境与安全大类', category2: '石油与天然气类', req: '普通高中毕业或同等学力', duration: '三年' },
        career_orientation: { industry: '石油和天然气开采业', job_category: ['钻井工', '采油工'], posts: ['钻井施工', '油水井管理', '压裂增产'] },
        training_objectives: '本专业培养能够践行社会主义核心价值观，德智体美劳全面发展，掌握石油钻井、采油、井下作业等专业知识与技术技能，面向石油和天然气开采业的钻井工、采油工等职业，能够从事钻井施工、油水井管理、压裂增产等工作的高技能人才。',
        career_advancement: '毕业生初始可从事钻井施工、油水井管理、压裂增产等一线技术岗位；随经验积累可向钻井队长、采油队技术员、井下作业监督等岗位晋升。',
        training_specs: [
          { id: 1, checked: true, desc: '坚决拥护中国共产党领导，树立中国特色社会主义共同理想，践行社会主义核心价值观，具有深厚的爱国情感、国家认同感和中华民族自豪感；崇尚宪法、遵守法律、遵规守纪。', ref_job: '钻井施工', ref_req: '政治素养、职业道德' },
          { id: 2, checked: true, desc: '崇德向善、诚实守信、爱岗敬业，秉持精益求精的工作态度；尊重劳动、热爱劳动，具有质量意识、环保意识、安全意识；具备较强的集体意识和团队协作能力。', ref_job: '采油工', ref_req: '职业道德、团队协作' },
          { id: 3, checked: true, desc: '具有健康的体魄和稳定的心理状态，能够承受工作压力和应对突发事件；掌握高效学习方法，养成规律生活习惯与严谨行为规范。', ref_job: '压裂增产', ref_req: '身体素质、心理素质' },
          { id: 4, checked: true, desc: '理解钻井工艺，能够操作自动化钻机完成常规钻进与参数控制，并识别井下异常工况。', ref_job: '钻井施工', ref_req: '钻机操作、井控技术' },
          { id: 5, checked: true, desc: '理解采油原理，能够操作智能抽油机完成油井生产管理，并诊断泵效低、供液不足等故障。', ref_job: '采油工', ref_req: '智能采油、工况诊断' },
          { id: 6, checked: true, desc: '理解压裂工艺，能够配合完成油气井压裂与酸化增产作业，并评估增油效果。', ref_job: '压裂增产', ref_req: '压裂工艺、增产' },
          { id: 7, checked: true, desc: '理解井下作业，能够开展检泵、堵水等修井作业，保障油水井正常生产。', ref_job: '油水井管理', ref_req: '井下作业、修井' },
          { id: 8, checked: true, desc: '理解HSE管理要求，能够执行石油作业安全规程与应急处置，保障人身与设备安全。', ref_job: '钻井施工', ref_req: 'HSE管理、应急' },
          { id: 9, checked: true, desc: '理解自动化控制技术，能够操作国产化PLC与SCADA完成站场监控与调试。', ref_job: '采油工', ref_req: '自动化控制、SCADA' },
          { id: 10, checked: true, desc: '理解绿色低碳理念，能够开展石油工程能耗监测与减排，服务双碳目标。', ref_job: '压裂增产', ref_req: '能耗监测、绿色作业' },
        ],
        curriculum: {
          public: COMMON_PUBLIC,
          basic: [
            { id: 201, name: '工程力学', type: 'B类(理实一体)', nature: '必修', credit: 4, hours: 80, ref_job: '钻井施工', ref_req: '工程力学、强度计算' },
            { id: 202, name: '机械设计基础', type: 'B类(理实一体)', nature: '必修', credit: 3, hours: 60, ref_job: '油水井管理', ref_req: '机械原理、设备结构' },
            { id: 203, name: '工程流体力学', type: 'B类(理实一体)', nature: '必修', credit: 3, hours: 60, ref_job: '压裂增产', ref_req: '流体力学、压裂液' },
            { id: 204, name: '油层物理', type: 'B类(理实一体)', nature: '必修', credit: 4, hours: 80, ref_job: '采油工', ref_req: '油层物理、渗流' },
          ],
          core: [
            { id: 301, name: '石油钻井技术', type: 'B类(理实一体)', nature: '必修', credit: 6, hours: 120, tasks: '能够操作国产自动化钻机进行常规钻进；利用国产钻井监控系统实时采集井下压力、温度数据；运用边缘计算网关初步分析井下异常工况。', content: '1. 理论知识：钻井工程基础、岩石破碎力学、井控技术。2. 技术工具：顶驱自动化系统、国产压力传感器。3. 前沿技术：工业互联网、边缘计算实时优化。4. 实践能力：自动化钻机仿真与故障诊断。', ref_job: '钻井施工', ref_req: '钻井工艺、井控' },
            { id: 302, name: '采油工程', type: 'B类(理实一体)', nature: '必修', credit: 5, hours: 100, tasks: '能够配置智能抽油机控制系统；利用数字孪生构建油井生产虚拟模型；基于国产工控软件分析示功图诊断故障并调整参数。', content: '1. 理论知识：采油原理、渗流力学、节点分析。2. 技术工具：智能抽油机、国产DCS。3. 前沿技术：数字孪生、AIGC工艺方案。4. 实践能力：智能采油仿真运维。', ref_job: '采油工', ref_req: '采油原理、生产管理' },
            { id: 303, name: '井下作业技术', type: 'B类(理实一体)', nature: '必修', credit: 5, hours: 100, tasks: '能够使用国产修井设备完成检泵、堵水等作业；运用国产仿真系统完成复杂井况处置预演。', content: '1. 理论知识：修井工艺、完井技术。2. 技术工具：修井机、国产仿真平台。3. 前沿技术：数字化井场、物联网。4. 实践能力：井下作业现场处置。', ref_job: '油水井管理', ref_req: '修井、检泵' },
            { id: 304, name: '提高采收率技术', type: 'B类(理实一体)', nature: '必修', credit: 4, hours: 80, tasks: '能够根据油藏特性选择提高采收率方法；操作智能注水/注聚系统精确控制注入参数；在线评估驱油效果。', content: '1. 理论知识：剩余油分布、化学驱原理。2. 技术工具：智能注入泵、在线粘度仪。3. 前沿技术：纳米驱油、大数据EOR预测。4. 实践能力：EOR方案设计与模拟。', ref_job: '压裂增产', ref_req: 'EOR、压裂' },
            { id: 305, name: '石油工程大数据分析', type: 'B类(理实一体)', nature: '必修', credit: 4, hours: 80, tasks: '能够使用国产数据库存储生产数据；利用国产AI框架清洗特征并构建产量预测模型。', content: '1. 理论知识：大数据概论、统计学。2. 技术工具：达梦数据库、PaddlePaddle。3. 前沿技术：Transformer时序预测。4. 实践能力：生产数据库与预测模型。', ref_job: '钻井施工', ref_req: '数据分析、预测' },
          ],
          practice: [
            { id: 401, name: '军训', type: 'C类(纯实践)', nature: '必修', credit: 1, hours: 30 },
            { id: 402, name: '跟岗实习', type: 'C类(纯实践)', nature: '必修', credit: 8, hours: 240, ref_job: '钻井施工、采油工', ref_req: '现场操作、岗位技能' },
            { id: 403, name: '顶岗实习', type: 'C类(纯实践)', nature: '必修', credit: 16, hours: 480, ref_job: '井下作业、压裂增产', ref_req: '独立操作、综合技能' },
            { id: 404, name: '毕业设计', type: 'C类(纯实践)', nature: '必修', credit: 4, hours: 120, ref_job: '采油工', ref_req: '毕业设计、专业报告' },
          ],
          other: [
            { id: 501, name: 'HSE管理与清洁生产', type: 'B类(理实一体)', nature: '必修', credit: 2, hours: 32, ref_job: '钻井施工', ref_req: '安全管理、环保' },
            { id: 502, name: 'CCUS与低碳石油工程', type: 'B类(理实一体)', nature: '必修', credit: 2, hours: 32, ref_job: '压裂增产', ref_req: 'CCUS、低碳' },
            { id: 503, name: '工业互联网技术', type: 'B类(理实一体)', nature: '必修', credit: 2, hours: 32, ref_job: '采油工', ref_req: '工业物联网、边缘计算' },
          ],
        },
        assurance: {
          faculty: '按照“四有好老师”要求建设专业教师队伍，学生数与本专业专任教师数比例不高于25:1，双师素质教师占比不低于60%。专业带头人具有副高及以上职称，专任教师具有石油工程技术及相关专业本科及以上学历，每5年累计企业实践不少于6个月。',
          conditions: '本专业应配备专业教室、钻井仿真实训室、采油仿真实训室及校外实训基地。校内实训室配置自动化钻机模拟装置、采油生产SCADA监控系统、压裂模拟平台等，满足钻井与采油工艺教学需求。校外实训基地提供不少于6个月实习岗位，落实校企双导师制。',
          resources: '选用体现石油工程技术特色的国家规划教材和活页式、工作手册式新型教材，建设包含石油精神、铁人精神的数字化教学资源库，开发钻井与采油虚拟仿真软件及数字化教学案例。',
          quality: '学校和二级院系建立专业人才培养质量保障机制，健全教学质量监控管理制度，强化过程评价，吸纳行业企业参与评价，定期开展课程建设与人才培养质量诊断与改进。建立毕业生跟踪反馈机制，定期评价人才培养质量与培养目标达成情况。',
          graduation: '完成规定的实习实训，全部课程考核合格或修满学分，准予毕业。学校可结合办学实际细化学习要求与考核要求，严把毕业出口关。职业培训取得的职业技能等级证书等学习成果可转化为相应学历教育学分。',
        },
      };
      try {
        const toStorage = (p: any) => ({
          basic_info: JSON.stringify(p.basic_info),
          career_orientation: JSON.stringify(p.career_orientation),
          training_objectives: JSON.stringify({ training_objectives: p.training_objectives, career_advancement: p.career_advancement }),
          training_specs: JSON.stringify(p.training_specs),
          curriculum: JSON.stringify(p.curriculum),
          assurance: JSON.stringify(p.assurance),
        });
        const planSeeds: any[] = [
          { name: '油气储运技术', status: 'published', data: toStorage(RESERVOIR_PLAN) },
          { name: '油气智能开采技术', status: 'submitted', data: toStorage(OIL_GAS_PLAN) },
          { name: '石油工程技术', status: 'draft', data: toStorage(PETRO_PLAN) },
        ];
        const updateTimes = ['2026-08-20 10:00:00', '2026-08-22 14:30:00', '2026-08-25 09:15:00'];
        planSeeds.forEach((pl, i) => {
          db.run(
            `INSERT INTO major_plan_developments (id, major_id, status, basic_info, career_orientation, training_objectives, training_specs, curriculum, assurance, update_time) VALUES (?, (SELECT id FROM majors WHERE name = ?), ?, ?, ?, ?, ?, ?, ?, ?)`,
            [i + 1, pl.name, pl.status, pl.data.basic_info, pl.data.career_orientation, pl.data.training_objectives, pl.data.training_specs, pl.data.curriculum, pl.data.assurance, updateTimes[i]]
          );
        });
      } catch (e) { console.warn('seed plan demo failed', e); }

      // --- 演示：系统管理员发给专业负责人(zy)的人培方案整改建议 ---
      try {
        db.run(`
          INSERT INTO major_plan_suggestions (major_code, major_name, from_user, from_role, to_user, suggestion, status, created_at) VALUES
          ('420404', '油气智能开采技术', 'admin', '系统管理员', 'zy', '该专业人培方案的"培养规格"中智能开采装备操作相关表述偏薄弱，建议补充油气智能开采数字孪生、国产化工业软件实操等能力要求；同时"课程设置"建议增设《油气智能开采数据分析》课程，强化数据与智能素养。', 'pending', '2026-08-26 09:30:00')
        `);
      } catch (e) { console.warn('seed suggestion demo failed', e); }

    // 实习记录（已随学生角色清理移除）

    // 实习日志与签到数据（已随学生角色清理移除）

    // 实习签到数据（已随学生角色清理移除）

    // --- 注入项目认领数据 (专业负责人 zy 认领项目) ---
    db.run(`
      INSERT INTO project_claims (project_id, claimer_id, status) VALUES 
      (1, 3, 'claimed') -- 负责人认领
    `);

    // 项目申请演示数据已随学生角色清理而移除

    // --- 注入教师人才库示例数据 (状态设为 published) ---
    db.run(`
      INSERT INTO talent_pool_teachers (user_id, real_name, title, research_direction, expertise, achievements, honors, email, status) VALUES 
      (99, '李教授', '教授', '旅游大数据', '数据挖掘', '国家级课题1项', '省级教学名师', 'li@edu.cn', 'published')
    `);

    // 学生人才库演示数据已随学生角色清理而移除

    // 学生手动项目经历演示数据已随学生角色清理而移除

    isSeeding = false;
    persistDB();
    return db;
  } catch (err) {
    dbPromise = null; // 初始化失败时重置，允许重试
    console.error("SQL.js Init Error:", err);
    throw new Error("无法初始化本地数据库，请检查 CDN 连接。");
  }
}

export function query(sql: string, params: any[] = []) {
  if (!db) return [];
  try {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const results = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  } catch (e) {
    console.warn("SQL Query Error:", sql, e);
    return [];
  }
}

export function run(sql: string, params: any[] = []) {
  if (!db) return false;
  try {
    db.run(sql, params);
    if (!isSeeding) persistDB();
    return true;
  } catch (e) {
    console.error("SQL Run Error:", sql, e);
    return false;
  }
}

let _industryDataCache: any = null;

// ============================================================================
// 专业与产业匹配模块数据源（克拉玛依市）
// 数据源：spec.mveri.org.cn（职业教育专业智能决策平台）同源数据，
// 与本地 INDUSTRY_CASE_DATA 完全一致（5565 家企业 / 4 区 / 14 产业链 / 181 节点）。
// ============================================================================

// 构建专业与产业匹配模块所需的 IndustryData（克拉玛依市）
export async function getIndustryData(): Promise<any> {
  if (_industryDataCache) return _industryDataCache;
  const { INDUSTRY_CASE_DATA } = await import('./components/industryData');
  _industryDataCache = INDUSTRY_CASE_DATA;
  return _industryDataCache;
}

// 典型企业分析检索（克拉玛依产业链企业，支持关键词/规模/产业链筛选 + 分页）
// 企业基础字段来自产业链节点 companies；工商详情由 hash 确定性生成（与 spec 平台一致）
export async function queryXinjiangEnterprises(filter: {
  keyword?: string;
  size?: string;
  chain?: string;
  limit?: number;
  offset?: number;
}): Promise<{ total: number; rows: any[] }> {
  const data = await getIndustryData();

  // 从产业链节点汇总企业（按名称去重，记录所属产业链/节点）
  const list: any[] = [];
  const seen = new Set<string>();
  (data.chains || []).forEach((chain: any) => {
    (chain.nodes || []).forEach((node: any) => {
      (node.companies || []).forEach((c: any) => {
        if (!c || seen.has(c.name)) return;
        seen.add(c.name);
        list.push({
          name: c.name,
          size: c.size,
          insured: c.insured || 0,
          chainName: chain.name,
          nodeName: node.name,
        });
      });
    });
  });

  const filtered = list.filter((c) => {
    if (filter.keyword && !c.name.includes(filter.keyword)) return false;
    if (filter.size && !(c.size || '').includes(filter.size)) return false;
    if (filter.chain && c.chainName !== filter.chain) return false;
    return true;
  });

  const total = filtered.length;
  const limit = filter.limit ?? 20;
  const offset = filter.offset ?? 0;
  const rows = filtered.slice(offset, offset + limit).map((c) => {
    const d = getEnterpriseProfile(c);
    return {
      id: d.uscc,
      name: c.name,
      size: c.size,
      insured: c.insured,
      chainName: c.chainName,
      nodeName: c.nodeName,
      ...d,
    };
  });

  return { total, rows };
}

// 典型企业分析筛选维度（产业链 / 规模）枚举
export async function getEnterpriseFacets(): Promise<{ chains: string[]; sizes: string[] }> {
  const data = await getIndustryData();
  const chains = (data.chains || []).map((c: any) => c.name);
  return { chains, sizes: ['大型', '中型', '小型', '微型'] };
}

export function resetIndustryDataCache() {
  _industryDataCache = null;
}

// ============================================================================
// 用户登录统计功能
// ============================================================================

// 记录用户登录
export function recordLogin(userId: number, ipAddress?: string, deviceInfo?: string): number {
  const result = run(
    'INSERT INTO user_login_stats (user_id, login_time, ip_address, device_info) VALUES (?, datetime("now"), ?, ?)',
    [userId, ipAddress || '', deviceInfo || '']
  );
  return result ? 1 : 0;
}

// 记录用户登出（更新在线时长）
export function recordLogout(userId: number): number {
  // 查找该用户最近的登录记录且未登出
  const loginRecords = query(
    'SELECT id, login_time FROM user_login_stats WHERE user_id = ? AND logout_time IS NULL ORDER BY login_time DESC LIMIT 1',
    [userId]
  );
  
  if (loginRecords.length === 0) return 0;
  
  const record = loginRecords[0];
  const loginTime = new Date(record.login_time);
  const logoutTime = new Date();
  const onlineDuration = Math.floor((logoutTime.getTime() - loginTime.getTime()) / 1000); // 秒
  
  run(
    'UPDATE user_login_stats SET logout_time = datetime("now"), online_duration = ? WHERE id = ?',
    [onlineDuration, record.id]
  );
  return onlineDuration;
}

// 获取用户登录统计（按角色）
export function getUserLoginStatsByRole(): any[] {
  const sql = `
    SELECT 
      u.role,
      COUNT(uls.id) as login_count,
      SUM(uls.online_duration) as total_online_time,
      AVG(uls.online_duration) as avg_online_time,
      COUNT(DISTINCT u.id) as user_count
    FROM user_login_stats uls
    JOIN users u ON uls.user_id = u.id
    GROUP BY u.role
  `;
  return query(sql);
}

// 获取用户登录统计（按用户）
export function getUserLoginStatsByUser(userId?: number): any[] {
  let sql = `
    SELECT 
      u.id,
      u.username,
      u.role,
      u.real_name,
      COUNT(uls.id) as login_count,
      SUM(uls.online_duration) as total_online_time,
      AVG(uls.online_duration) as avg_online_time,
      MAX(uls.login_time) as last_login_time
    FROM user_login_stats uls
    JOIN users u ON uls.user_id = u.id
  `;
  
  if (userId) {
    sql += ` WHERE u.id = ${userId}`;
  }
  
  sql += ` GROUP BY u.id ORDER BY login_count DESC`;
  
  return query(sql);
}

// 获取用户登录统计（按日期）
export function getUserLoginStatsByDate(days: number = 30): any[] {
  const sql = `
    SELECT 
      DATE(login_time) as login_date,
      COUNT(*) as login_count,
      SUM(online_duration) as total_online_time
    FROM user_login_stats
    WHERE login_time >= datetime('now', '-${days} days')
    GROUP BY DATE(login_time)
    ORDER BY login_date DESC
  `;
  return query(sql);
}
