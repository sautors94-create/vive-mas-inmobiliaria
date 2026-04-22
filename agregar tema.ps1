$htmlFiles = Get-ChildItem -Path "public" -Recurse -Filter "*.html"
$script = @"
<script>
(function(){try{var t=JSON.parse(localStorage.getItem('vm_tema')||'{}');if(t.primary){var s=document.createElement('style');s.textContent=':root{--primary:'+t.primary+' !important;--primary-light:'+t.primaryLight+' !important;--accent:'+t.accent+' !important;--accent-dark:'+t.accentDark+' !important;--bg-dark:'+t.bgDark+' !important}';document.head.appendChild(s);}}catch(e){}})();
</script>
"@

foreach ($file in $htmlFiles) {
    $content = Get-Content $file.FullName -Raw -Encoding UTF8
    if ($content -notmatch 'vm_tema') {
        $content = $content -replace '<head>', "<head>`n$script"
        Set-Content $file.FullName $content -Encoding UTF8
        Write-Host "Actualizado: $($file.Name)"
    } else {
        Write-Host "Ya tiene tema: $($file.Name)"
    }
}
Write-Host "Listo!"