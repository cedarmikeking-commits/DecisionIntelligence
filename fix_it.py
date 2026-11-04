path = r'e:/@产品原型/2026.5.25专业智能决策平台--专业负责人/components/IndustrialChainAnalysis.tsx'
with open(path, 'r', encoding='utf-8', errors='replace') as f:
    content = f.read()
# Find the first occurrence of "</div>\n{/* 专业" and insert ) after the </div>
target = "</div>\n{/* 专业与岗位"
pos = content.find(target)
if pos >= 0:
    div_end = content.rfind("</div>", 0, pos + len(target))
    insert_pos = div_end + 6
    content = content[:insert_pos] + "\n)" + content[insert_pos:]
    print("Found and fixed!")
else:
    # Try without newline
    target2 = "</div>{/* 专业与岗位"
    pos2 = content.find(target2)
    if pos2 >= 0:
        div_end2 = content.rfind("</div>", 0, pos2)
        insert2 = div_end2 + 6
        content = content[:insert2] + ")" + content[insert2:]
        print("Found (no newline) and fixed!")
    else:
        print("NOT FOUND. Trying simple search...")
        print("Content sample around key area:")
        idx = content.find("专业与岗位")
        print(f"专业与岗位 at {idx}")
        print(repr(content[idx-50:idx+20]))
        idx2 = content.find("</div>")
        print(f"First </div> at {idx2}")
        print(repr(content[idx2:idx2+20]))
        print("NOT fixed - manual review needed")
        # Write unchanged
with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Done")
