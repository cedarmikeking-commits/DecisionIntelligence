with open(r'e:/@产品原型/2026.5.25专业智能决策平台--专业负责人/components/IndustrialChainAnalysis.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

old = """                      </tbody>
                    </table>
                  </div>
                ) : null}
              </div>

              {/* 专业与岗位"""

new_text = """                      </tbody>
                    </table>
                  </div>
                ) : null}
              </div>

              {/* 专业与岗位"""

if old in content:
    content = content.replace(old, new_text, 1)
    with open(r'e:/@产品原型/2026.5.25专业智能决策平台--专业负责人/components/IndustrialChainAnalysis.tsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Fixed!")
else:
    idx = content.find(") : null}")
    print(f"Not found. Searching for ') : null}}'")
    if idx >= 0:
        print(repr(content[idx-80:idx+80]))
