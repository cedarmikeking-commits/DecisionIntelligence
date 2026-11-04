path = r'E:\@产品原型\2026.5.25专业智能决策平台--专业负责人\components\IndustrialChainAnalysis.tsx'
with open(path, 'r', encoding='utf-8') as f:
    c = f.read()

# Fix 1: selectedChainNode.topEnterprises?.length && ( → selectedChainNode.topEnterprises?.length > 0 ? (
c = c.replace(
    'selectedChainNode.topEnterprises?.length && (',
    'selectedChainNode.topEnterprises?.length > 0 ? (',
    1
)
print('Fix 1 done')

# Fix 2: Add ) after </tbody> closing in enterprise table ternary
# Find the </tbody> that closes enterprise table and add ) there
# The pattern: </tbody>\n</table>\n</div>\n)) : null}
# We need ))\n</tbody>\n</table>\n</div>\n{professional
# Change: ))\n</tbody>\n</table>\n</div>\n{profession → ))\n</tbody>\n</table>\n</div>\n)\n{profession
c = c.replace(
    '</tbody>\n</table>\n</div>\n{profession',
    '</tbody>\n</table>\n</div>\n)\n{profession',
    1
)
print('Fix 2 done')

with open(path, 'w', encoding='utf-8') as f:
    f.write(c)
print('File saved')
