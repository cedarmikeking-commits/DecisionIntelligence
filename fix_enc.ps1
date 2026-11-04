$enc = New-Object System.Text.UTF8Encoding $false
$content = [System.IO.File]::ReadAllText('E:\@产品原型\2026.5.25专业智能决策平台--专业负责人\components\MajorIndustrySettingPage.tsx', $enc)
[System.IO.File]::WriteAllText('E:\@产品原型\2026.5.25专业智能决策平台--专业负责人\components\MajorIndustrySettingPage.tsx', $content, $enc)
Write-Host 'Done'