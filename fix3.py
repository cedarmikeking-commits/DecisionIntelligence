with open(r'e:/@产品原型/2026.5.25专业智能决策平台--专业负责人/components/IndustrialChainAnalysis.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Find and replace the enterprise table ternary block
# Replace the entire block from "{selectedChainNode.topEnterprises?.length ? (" to ") : null}" with {selectedChainNode.topEnterprises?.length && (
old = "{selectedChainNode.topEnterprises?.length ? ("
new = "{selectedChainNode.topEnterprises?.length && ("

if old in content:
    content = content.replace(old, new, 1)
    print(f"Replaced first occurrence of {repr(old)}")

# Now replace the closing ) : null} with just ))}
old2 = ") : null}"
new2 = "))"
count = content.count(old2)
print(f"Found {count} occurrences of {repr(old2)}")
if count > 0:
    content = content.replace(old2, new2, 1)
    print("Replaced first ) : null} with ))")
    
with open(r'e:/@产品原型/2026.5.25专业智能决策平台--专业负责人/components/IndustrialChainAnalysis.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Done")
