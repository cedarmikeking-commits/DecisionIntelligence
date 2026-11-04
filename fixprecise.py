path = r'e:/@产品原型/2026.5.25专业智能决策平台--专业负责人/components/IndustrialChainAnalysis.tsx'
with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()
print(f'File has {len(lines)} lines, total {sum(len(l) for l in lines)} chars')
# Find the problem area: look for </tbody> followed by </table> followed by </div> followed by ))
# Lines around 1605-1610 (1-indexed, so 0-indexed 1604-1609)
for i in range(1604, 1611):
    print(f'L{i+1}: {repr(lines[i].rstrip())}')
