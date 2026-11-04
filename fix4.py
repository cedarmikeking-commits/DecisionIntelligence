with open(r'e:/@产品原型/2026.5.25专业智能决策平台--专业负责人/components/IndustrialChainAnalysis.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Strategy: simplify - replace the selectedChainNode && wrapper div block with {selectedChainNode.topEnterprises && (div...)} pattern
# The current structure has:
# {selectedChainNode && (
#   <div className="mt-6 space-y-6">
#     enterprise table with ternary that closes with ) : null}
#   </div>
# )}
# This needs:
#   1. Change enterprise ternary : null} ->  (no change, just )) }
#   2. Change selectedChainNode && ( -> {selectedChainNode && (
#   3. Remove the </div>} after enterprise table
#   4. Change the final )} to </div>}
# Actually, the cleanest: just change the </tbody> closing line
# Let me find the exact lines

# The </tbody> at enterprise table section closes after )) map
# Let me change the enterprise table ternary </tbody> to )}</tbody>
old = "                        </tbody>\n                    </table>\n                  </div>\n                ))\n              </div>\n              \n              {/* 专业与岗位"

new = "                        </tbody>\n                    </table>\n                  </div>\n                ))}\n\n              {/* 专业与岗位"

if old in content:
    content = content.replace(old, new, 1)
    print("Replaced!")
else:
    print("Not found. Searching...")
    idx = content.find("</tbody>")
    print(f"First </tbody> at index {idx}")
    # Try the shorter version
    idx2 = content.find("))")
    print(f"First )) at index {idx2}")
    
with open(r'e:/@产品原型/2026.5.25专业智能决策平台--专业负责人/components/IndustrialChainAnalysis.tsx', 'w') as f:
    f.write(content)
