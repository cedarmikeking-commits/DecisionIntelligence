with open(r'e:/@产品原型/2026.5.25专业智能决策平台--专业负责人/components/IndustrialChainAnalysis.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()
for i in range(1600, 1615):
    print(f"{i+1:4d}: {repr(lines[i])}")
