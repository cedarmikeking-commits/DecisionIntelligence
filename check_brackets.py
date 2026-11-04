import re

lines = open(r'e:/@产品原型/2026.5.25专业智能决策平台--专业负责人/components/IndustrialChainAnalysis.tsx','r',encoding='utf-8').readlines()

def remove_strings(s):
    s = re.sub(r'"[^"]*"', '', s)
    s = re.sub(r"'[^']*'", '', s)
    return s

depth = 0
maxd = 0
maxl = 0

for i, l in enumerate(lines, 1):
    s = remove_strings(l)
    # Count JSX expression braces only
    # Only count standalone {} that are NOT adjacent to HTML tags
    # We need to count { and } that are JSX expression delimiters
    opens = s.count('{')
    closes = s.count('}')
    # However, className={...} - the {...} is an expression, not a tag
    # But for the purpose of "is the JSX tree balanced", we count all {}
    # The issue is that <div> counts as { for our purposes? No.
    
    for c in s:
        if c == '{':
            depth += 1
        elif c == '}':
            depth -= 1
            if depth < 0:
                print(f'Line {i}: too many closes, depth={depth}, text: {l.strip()[:60]}')
                depth = 0
    if depth > maxd:
        maxd = depth
        maxl = i

print(f'Max depth {maxd} at line {maxl}')
print(f'Final depth at EOF: {depth}')
