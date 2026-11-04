# -*- coding: gbk -*-
path = r'e:/@产品原型/2026.5.25专业智能决策平台--专业负责人/components/IndustrialChainAnalysis.tsx'
with open(path, encoding='gbk', errors='replace') as f:
    content = f.read()

# Strategy: insert ) before the second </div> that follows the enterprise table close
# Current: ))</div>
# Target: ))</div>    lines = content.split('\n')
# Find the lines we care about

# Simply: insert ) on a new line after the </div> that closes the enterprise table container div
# Find the pattern:
# </table>
# </div>
# ))
# </div>
# </div>
# {/* 专业与岗位...
# Insert ) before the </div> that appears twice in a row

# Count occurrences of </div>
# Find the second-last </div> in the table section
# Let's find </div> followed by the second </div> near the table area

# The fix: the enterprise table conditional render (selectedChainNode && (...)) doesn't close properly
# We need to add a ) somewhere to balance the selectedChainNode && (
# Add ) at the point where </div> closes the table container div
# The cleanest fix: add ) on a new line right before the "专业与岗位" section

# Find "</div>" followed by "\n\n{/* 专业与岗位" and insert )
old_pattern = "</div>\n\n{/* 专业与岗位"
new_pattern = "</div>\n)\n\n{/* 专业与岗位"
if old_pattern in content:
    content = content.replace(old_pattern, new_pattern, 1)
    print("Fixed! Added ) before 专业与岗位 section")
else:
    # Try single newline
    old2 = "</div>\n{/* 专业"
    idx = content.find("</div>\n{/* 专业")
    print(f"Pattern not found. Trying search. Found at: {idx}")
    if idx < 0:
        print("Still not found. Let me search differently")
        idx2 = content.find("/* 专业与岗位")
        print(f"专业岗位 section starts at: {idx2}")
        # Find the </div> just before it
        # Get last 200 chars before this
        if idx2 > 0:
            snippet = content[idx2-200:idx2]
            print(repr(snippet))
            # Find </div> in snippet
            di = snippet.rfind("</div>")
            if di >= 0:
                print(f"Found </div> at offset {di} in snippet")
                print(repr(snippet[di:]))
                print("Will insert ) after this </div>")
                # Build the fixed content
                insert_at = idx2 - (200 - di) + len("</div>")
                content = content[:insert_at] + "\n)" + content[insert_at:]
                print(f"Inserted ) at position {insert_at}")

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Saved")
