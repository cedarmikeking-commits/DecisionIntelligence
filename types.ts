
export enum RoleType {
  ADMIN = '系统管理员',
  PRO_LEAD = '专业负责人',
  ORG_ADMIN = '机构管理员',
  STUDENT = '学生',
  ACADEMIC_ADMIN = '专业管理员',
  INFO_CENTER = '用户管理'
}

export interface NavItem {
  name: string;
  children?: NavItem[];
  icon?: string;
  displayName?: string; // 用于显示的名称，如果未设置则使用 name
}

export type ModuleAccent = 'slate' | 'blue' | 'emerald' | 'violet' | 'amber' | 'indigo';

export interface NavModule {
  moduleName: string;
  icon?: string;
  accent?: ModuleAccent;
  items: NavItem[];
}

export interface RoleConfig {
  role: RoleType;
  modules: NavModule[];
}

// 职业诊断系统所需的数据模型
export interface ProgramInputData {
  majorName: string;
  trainingGoal: string;
  courseStructure: string;
  practicalHours: number;
  coreCompetencies: string;
}

export interface ChartDataPoint {
  subject: string;
  demand: number; // 岗位需求
  supply: number; // 人才供给
  fullMark: number;
}

export interface HeatmapCell {
  major: string;
  skill: string;
  intensity: number; // 0-100 coverage
}

export interface BaseDiagnosisResult {
  supplyVsDemand: ChartDataPoint[];
  structureConclusion: {
    lacking: string[];
    excess: string[];
    overallMatch: string;
  };
  gapRadarData: ChartDataPoint[]; // Subset for critical gaps
  gapConclusion: string;
}

export interface ClusterDiagnosisResult extends BaseDiagnosisResult {
  heatmapData: HeatmapCell[];
  majors: string[];
  skills: string[];
  overlapConclusion: {
    homogeneity: string;
    duplication: string;
    synergy: string;
  };
  suggestions: {
    scale: string;
    courses: string;
    resources: string;
    synergy: string;
  };
}

export interface SingleMajorDiagnosisResult extends BaseDiagnosisResult {
  suggestions: {
    vocationalOrientation: string;
    trainingSpecs: string;
    courseStructure: string;
    practicalRatio: string;
    focus: string;
    resourceSupport: string;
    qualityAssurance: string;
  };
}

export type DiagnosisResult = ClusterDiagnosisResult | SingleMajorDiagnosisResult;
