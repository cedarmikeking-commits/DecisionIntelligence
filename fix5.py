import codecs
path = r'e:/@产品原型/2026.5.25专业智能决策平台--专业负责人/components/IndustrialChainAnalysis.tsx'
with codecs.open(path, 'r', 'gbk', errors='replace') as f:
    content = f.read()
print(f"Read {len(content)} chars")
# Step 1
old1 = "{selectedChainNode.topEnterprises?.length ? ("
new1 = "{selectedChainNode.topEnterprises?.length && ("
c1 = content.count(old1)
print(f"Found {c1}x enterprise ternary condition")
if c1 > 0:
    content = content.replace(old1, new1, 1)
    print("Step1 done")
# Step 2
old2 = ") : null}"
new2 = ")}"
c2 = content.count(old2)
print(f"Found {c2}x ') : null}}'")
if c2 > 0:
    content = content.replace(old2, new2, 1)
    print("Step2 done")
with codecs.open(path, 'w', 'gbk') as f:
    f.write(content)
print("Saved")
