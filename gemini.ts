
import { GoogleGenAI } from "@google/genai";

const getAI = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export async function generateMajorIntro(majorName: string, sectionName: string) {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `你是一名资深的中国职业教育专家。请为“${majorName}”专业的“${sectionName}”模块撰写一份高质量的介绍。
      要求：
      1. 符合产教融合政策背景。
      2. 包含行业前沿技术趋势（如数字孪生、AI应用等）。
      3. 语气专业、严谨，适合放在学校官网或评估文档中。
      4. 字数约 300 字。
      5. 直接输出正文，不要包含任何引导性话语。`,
    });
    return response.text || "未能生成内容，请重试。";
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw new Error("AI 服务连接异常，请检查网络或 API 状态。");
  }
}

export async function analyzeProjectMatch(projectDesc: string, majorDesc: string) {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `分析以下企业项目需求与专业培养目标的适配度：
      项目需求：${projectDesc}
      专业背景：${majorDesc}
      请输出：1. 适配分值（0-100）；2. 核心匹配点；3. 建议的合作模式。
      输出格式：JSON。`,
      config: { responseMimeType: "application/json" }
    });
    return response.text;
  } catch (error) {
    return null;
  }
}

export async function diagnoseTrainingPlan(planData: any, region: string) {
  try {
    const ai = getAI();
    const prompt = `
      你是一位教育部职业教育专家评估员。请根据提供的“${planData.basic_info}”专业人才培养方案，结合"${region}"的区域产业背景，进行严格诊断。
      
      以下是方案详细内容：
      1. 培养目标：${planData.training_goals}
      2. 课程体系：${planData.curriculum}
      3. 师资力量：${planData.faculty}
      4. 教学资源：${planData.resources}
      5. 职业面向：${planData.career_orientation}

      请务必从以下三个特定维度进行深度分析：
      
      维度一：【目标契合度】（产业-职业-岗位能力图谱 vs 培养目标）
      维度二：【规模匹配度】（专业人才培养规模 vs 产业人才需求量）
      维度三：【支撑力分析】（师资及教学资源 vs 人才培养目标支撑度）

      请返回一个纯 JSON 对象（不要包含 Markdown 格式），结构如下：
      {
        "totalScore": number, // 0-100
        "dimensions": [
          { "name": "目标契合度", "score": number, "comment": "简评" },
          { "name": "规模匹配度", "score": number, "comment": "简评" },
          { "name": "支撑力分析", "score": number, "comment": "简评" }
        ],
        "suggestions": [
          { "title": "问题点标题", "content": "详细优化建议..." }
        ],
        "optimizedPreview": {
          "training_goals": "优化后的培养目标段落...",
          "curriculum": "优化后的课程体系建议..."
        }
      }
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    
    return response.text;
  } catch (error) {
    console.error("Diagnosis Error:", error);
    throw new Error("诊断服务暂时不可用，请稍后重试。");
  }
}

export async function generatePlanContent(section: string, contextData: any) {
  try {
    const ai = getAI();
    let prompt = "";
    let responseMimeType = "text/plain";
    
    if (section === 'objectives') {
      prompt = `
        作为职业教育课程专家，请为“${contextData.majorName}”专业撰写人才培养目标。
        职业面向信息：${JSON.stringify(contextData.careerInfo)}。
        要求：
        1. 涵盖知识目标、能力目标、素质（价值观）目标。
        2. 描述需具体对应到上述职业面向的典型岗位。
        3. 字数约 400 字，分段清晰，语气严谨规范。
        4. 直接输出内容。
      `;
    } else if (section === 'tasks') {
      prompt = `
        请为课程“${contextData.courseName}”设计典型工作任务。
        该课程属于“${contextData.majorName}”专业。
        要求：列出3-5个具体的、基于真实工作流程的任务描述。
        直接输出列表文本。
      `;
    } else if (section === 'course_content') {
      prompt = `
        请为课程“${contextData.courseName}”设计主要的教学内容及要求。
        该课程属于“${contextData.majorName}”专业。
        要求：内容具体，涵盖核心知识点和技能点，符合职业教育特点。
        直接输出文本。
      `;
    } else if (section === 'assurance') {
      prompt = `
        作为职业教育专家，请为“${contextData.majorName}”专业撰写“${contextData.topic}”部分的保障机制描述。
        要求：符合产教融合背景，语气专业，约200字。
        直接输出内容。
      `;
    } else if (section === 'curriculum_list') {
      responseMimeType = "application/json";
      prompt = `
        作为职业教育课程专家，请为“${contextData.majorName}”专业设计“${contextData.courseCategory}”模块的课程列表。
        职业面向参考：${contextData.career}。
        请生成 6-8 门符合中国职业教育标准的代表性课程。
        
        请返回 JSON 数组，每个对象包含：
        - name: 课程名称
        - type: 课程类型 (A类/B类/C类)
        - nature: 课程性质 (必修/选修)
        - credit: 学分 (数值, 2-6之间)
        - hours: 学时 (数值, 32-96之间)
        - tasks: 典型工作任务简述 (20字以内)
        - content: 核心教学内容简述 (20字以内)
      `;
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: { responseMimeType: responseMimeType }
    });
    return response.text;
  } catch (error) {
    console.error("AI Generation Error", error);
    return "生成失败，请稍后重试。";
  }
}

export async function generateAdaptabilityAnalysis(majorName: string, inputData: any) {
  try {
    const ai = getAI();
    const prompt = `
      作为职业教育产教融合专家，请根据以下${majorName}专业的输入数据，进行【专业与职业匹配度分析】。
      
      输入数据：
      1. 培养目标与职业面向：${inputData.goals}
      2. 主要就业岗位：${inputData.jobs}
      3. 课程体系与能力培养：${inputData.curriculum}
      4. 师资条件：${inputData.faculty}
      5. 实训条件：${inputData.facilities}
      6. 历史就业数据：${inputData.history}

      请生成一份分析报告，必须包含以下内容：
      1. 基于“职业面向-岗位-能力-课程”逻辑链条的深度诊断。
      2. 针对 10 个核心能力维度（数字技能、理解表达、沟通交流、合作协作、自我学习、解决问题、创新创造、身心健康、文明道德、社会责任）的匹配情况简述。
      3. 具体的专业建设优化建议（至少 3 条）。

      请直接输出分析报告正文，约 300 字，分点陈述，语气专业。
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error("Analysis Error", error);
    return "AI 分析服务暂不可用。";
  }
}

export async function generateEmploymentAnalysis(majorName: string, inputData: any) {
  try {
    const ai = getAI();
    // inputData contains raw counts and calculated rates
    const prompt = `
      作为职业教育就业指导专家，请根据以下${majorName}专业的就业数据进行深度分析。
      
      基础数据：
      - 毕业生总数：${inputData.graduatesCount}人
      - 已就业：${inputData.employedCount}人
      - 升学：${inputData.educationCount}人
      - 未就业：${inputData.unemployedCount}人
      - 稳定就业（1年+）：${inputData.stableCount}人
      - 频繁换岗：${inputData.changedCount}人
      
      关键指标（已计算）：
      - 就业率：${inputData.rates.employment}%
      - 升学率：${inputData.rates.education}%
      - 专业对口率：${inputData.rates.match}%

      请生成一份分析报告，包含：
      1. 【核心竞争力评价】：结合对口率和稳定就业人数，评价本专业毕业生的市场认可度。
      2. 【同类院校横向对比视角】：模拟同类院校平均水平，指出本专业的优势或差距。
      3. 【未来趋势与建议】：基于数据现状，提出2条具体的促就业或教学调整建议。

      请直接输出分析报告正文，约 300 字，语气专业，数据驱动。
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error("Employment Analysis Error", error);
    return "AI 就业分析服务暂不可用。";
  }
}
