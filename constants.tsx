import { RoleType, RoleConfig } from './types';

// 三大业务模块，按角色聚合
// 产业分析：产业画像、产业链图谱、典型企业分析（产业链详情已合并至产业链图谱页下方）
// 产业需求分析：岗位需求分析、岗位能力画像（职业仓）
// 专业决策：人才培养方案研制、专业人才培养诊断、专业教学标准解析（国标）、产教融合全景
export const ROLE_CONFIGS: RoleConfig[] = [
  {
    // 系统管理员：平台最高权限角色，负责系统管理、全校看板与区域产业分析
    role: RoleType.ADMIN,
    modules: [
      {
        moduleName: '系统管理',
        icon: 'fa-shield-alt',
        accent: 'slate',
        items: [
          { name: '系统权限列表', icon: 'fa-list-check' },
          { name: '系统角色管理', icon: 'fa-user-shield' },
          { name: '用户管理', icon: 'fa-users-cog' },
          {
            name: '系统属性管理',
            icon: 'fa-sliders',
            children: [
              { name: '年级管理', icon: 'fa-calendar-alt' },
              { name: '班级管理', icon: 'fa-users' },
              { name: '组织架构管理', icon: 'fa-sitemap' }
            ]
          }
        ]
      },
      {
        moduleName: '全校看板',
        icon: 'fa-gauge-high',
        accent: 'emerald',
        items: [
          { name: '专业建设看板', icon: 'fa-chart-line' },
          { name: '用户应用统计', icon: 'fa-chart-pie' }
        ]
      },
      {
        moduleName: '区域产业分析',
        icon: 'fa-industry',
        accent: 'blue',
        items: [
          { name: '产业画像', icon: 'fa-chart-pie' },
          { name: '产业链图谱', icon: 'fa-sitemap' },
          { name: '典型企业分析', icon: 'fa-database' },
          { name: '职业面向', icon: 'fa-table-cells' }
        ]
      }
    ]
  },
  {
    role: RoleType.PRO_LEAD,
    modules: [
      {
        moduleName: '工作台',
        icon: 'fa-gauge-high',
        accent: 'emerald',
        items: [
          { name: '专业列表', icon: 'fa-list-check' },
          { name: '专业群管理', icon: 'fa-layer-group' }
        ]
      },
      {
        moduleName: '区域产业分析',
        icon: 'fa-chart-pie',
        accent: 'blue',
        items: [
          { name: '产业画像', icon: 'fa-chart-pie' },
          { name: '产业链图谱', icon: 'fa-sitemap' },
          { name: '典型企业分析', icon: 'fa-database' },
          { name: '职业面向', icon: 'fa-table-cells' }
        ]
      },
      {
        moduleName: '产业人才需求分析',
        icon: 'fa-briefcase',
        accent: 'emerald',
        items: [
          { name: '职业仓', icon: 'fa-briefcase', displayName: '岗位能力画像（职业仓）' },
          { name: '职业与岗位分析', icon: 'fa-project-diagram', displayName: '岗位需求分析' },
          { name: '岗位能力矩阵', icon: 'fa-table-cells', displayName: '岗位能力矩阵' }
        ]
      },
      {
        moduleName: '岗课图谱',
        icon: 'fa-diagram-project',
        accent: 'blue',
        items: [
          { name: '岗课关系图谱', icon: 'fa-circle-nodes' }
        ]
      },
      {
        moduleName: '实训图谱',
        icon: 'fa-warehouse',
        accent: 'blue',
        items: [
          { name: '实训-能力图谱', icon: 'fa-sitemap' },
          { name: '岗课训数据字典', icon: 'fa-book' }
        ]
      },
      {
        moduleName: '师资画像',
        icon: 'fa-chalkboard-user',
        accent: 'blue',
        items: [
          { name: '师资结构画像', icon: 'fa-users-gear' }
        ]
      },
      {
        moduleName: '专业决策',
        icon: 'fa-clipboard-check',
        accent: 'violet',
        items: [
          { name: '人才培养画像', icon: 'fa-user-graduate' },
          { name: '人才培养方案研制', icon: 'fa-vial' },
          { name: '专业教学标准解析（国标）', icon: 'fa-book' },
          { name: '产教融合全景', icon: 'fa-project-diagram' }
        ]
      },
      {
        moduleName: '专业诊断智能体',
        icon: 'fa-robot',
        accent: 'indigo',
        items: [
          { name: '专业诊断智能体', icon: 'fa-comment-dots' }
        ]
      },
      {
        moduleName: '专业建设管理',
        icon: 'fa-sliders-h',
        accent: 'amber',
        items: [
          { name: '专业整改意见管理', icon: 'fa-inbox' },
          { name: '专业版本管理', icon: 'fa-code-branch' }
        ]
      }
    ]
  },
  {
    role: RoleType.ORG_ADMIN,
    modules: [
      {
        moduleName: '系统管理',
        icon: 'fa-shield-alt',
        accent: 'slate',
        items: [
          { name: '用户管理', icon: 'fa-users-cog' }
        ]
      },
      {
        moduleName: '产业分析',
        icon: 'fa-chart-pie',
        accent: 'blue',
        items: [
          { name: '产业画像', icon: 'fa-chart-pie' },
          { name: '产业链图谱', icon: 'fa-sitemap' },
          { name: '典型企业分析', icon: 'fa-database' }
        ]
      },
      {
        moduleName: '产业需求分析',
        icon: 'fa-briefcase',
        accent: 'emerald',
        items: [
          { name: '职业与岗位分析', icon: 'fa-project-diagram', displayName: '岗位需求分析' },
          { name: '职业仓', icon: 'fa-briefcase', displayName: '岗位能力画像（职业仓）' }
        ]
      },
      {
        moduleName: '专业决策',
        icon: 'fa-clipboard-check',
        accent: 'violet',
        items: [
          { name: '人才培养画像', icon: 'fa-user-graduate' },
          { name: '人才培养方案研制', icon: 'fa-vial' },
          { name: '专业教学标准解析（国标）', icon: 'fa-book' },
          { name: '产教融合全景', icon: 'fa-project-diagram' }
        ]
      }
    ]
  },
  {
    // 学生：归属于油气储运技术专业，仅可查看本专业相关的典型企业分析、岗位需求分析与岗位能力画像
    role: RoleType.STUDENT,
    modules: [
      {
        moduleName: '我的专业',
        icon: 'fa-user-graduate',
        accent: 'emerald',
        items: [
          { name: '典型企业分析', icon: 'fa-database' }
        ]
      },
      {
        moduleName: '就业与岗位',
        icon: 'fa-briefcase',
        accent: 'blue',
        items: [
          { name: '职业与岗位分析', icon: 'fa-project-diagram', displayName: '岗位需求分析' },
          { name: '职业仓', icon: 'fa-briefcase', displayName: '岗位能力画像（职业仓）' }
        ]
      }
    ]
  },
  {
    // 专业管理员：专业建设看板权限，可查看全校专业群、专业分布及专业与产业匹配情况
    role: RoleType.ACADEMIC_ADMIN,
    modules: [
      {
        moduleName: '工作台',
        icon: 'fa-gauge-high',
        accent: 'emerald',
        items: [
          { name: '专业建设看板', icon: 'fa-chart-line' },
          { name: '专业列表', icon: 'fa-list-check' },
          { name: '专业群管理', icon: 'fa-layer-group' },
          { name: '专业负责人管理', icon: 'fa-user-tie', displayName: '教师专业权限' }
        ]
      },
      {
        moduleName: '专业与产业匹配',
        icon: 'fa-clipboard-check',
        accent: 'violet',
        items: [
          { name: '产业画像', icon: 'fa-chart-pie' },
          { name: '产业链图谱', icon: 'fa-sitemap' },
          { name: '典型企业分析', icon: 'fa-database' }
        ]
      }
    ]
  },
  {
    // 用户管理：负责全校的组织机构管理与用户管理
    role: RoleType.INFO_CENTER,
    modules: [
      {
        moduleName: '系统管理',
        icon: 'fa-shield-alt',
        accent: 'slate',
        items: [
          { name: '组织架构管理', icon: 'fa-sitemap' },
          { name: '专业负责人管理', icon: 'fa-user-tie', displayName: '用户权限管理' },
          { name: '用户应用统计', icon: 'fa-chart-line' }
        ]
      }
    ]
  }
];
