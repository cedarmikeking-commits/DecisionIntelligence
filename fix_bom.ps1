$path = 'E:\@产品原型\2026.5.25专业智能决策平台--专业负责人\components\MajorIndustrySettingPage.tsx'
$bytes = [System.IO.File]::ReadAllBytes($path)
if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
    $newBytes = $bytes[3..($bytes.Length-1)]
    [System.IO.File]::WriteAllBytes($path, $newBytes)
    Write-Host 'BOM removed'
} else {
    Write-Host 'No BOM found'
}