# This script finds the exact enterprise table ternary close and fixes it
# Problem: selectedChainNode.topEnterprises && ( ... </tbody>\n</table>\n</div>\n)) ... 
# Fix: selectedChainNode.topEnterprises && ( ... </tbody>\n</table>\n</div>\n)... 
# Action: remove ONE </div>\n before {/*{alert, and fix ternary close 

# Strategy: search for the ENTERPRISE table tbody close pattern and remove the </div> before it

# Read entire file
path = r'e:\@产品原型\2026.5.25专业智能决策平台--专业负责人\components\IndustrialChainAnalysis.tsx'
with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find the line with "overflow-x-auto" className that's part of enterprise table (not popup)
# and the lines around tbody close
# The enterprise table has: <div className="overflow-x-auto">
# and closes with </tbody>

found_lines = []
for i, l in enumerate(lines):
    if 'overflow-x-auto' in l and 'fixed' not in l and 'overflow-y-auto' not in l:
        found_lines.append((i, l.rstrip()))

print(f"Found {len(found_lines)} overflow-x-auto divs")
for idx, line in found_lines:
    print(f"  L{idx+1}: {line[:80]}")

# Find tbody close lines
tbody_lines = [(i, l) for i, l in enumerate(lines) if '</tbody>' in l]
print(f"\nFound {len(tbody_lines)} tbody close lines:")
for i, l in tbody_lines:
    print(f"  L{i+1}: {l.rstrip()}")
