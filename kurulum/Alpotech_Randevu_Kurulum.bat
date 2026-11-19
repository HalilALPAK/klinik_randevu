@echo off
rem Alpotech Randevu kurulumu: cift tiklayin. Masaustune "Alpotech Randevu" simgesi koyar.
rem Bu dosyanin alt kismi PowerShell kodudur; tek dosya olarak kopyalanabilir.
set "KURULUM_DOSYASI=%~f0"
set "KURULUM_ADRES=%~1"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$k = [IO.File]::ReadAllText($env:KURULUM_DOSYASI, [Text.Encoding]::UTF8); iex (($k -split '\r?\n:POWERSHELL\r?\n', 2)[1])"
exit /b
:POWERSHELL
$ErrorActionPreference = "Stop"
$VarsayilanAdres = "192.168.1.37:8091"   # sunucunun şimdiki adresi; klinikte sabit IP verilince değişecek

function Dur([string]$mesaj) {
    Write-Host ""
    Write-Host $mesaj -ForegroundColor Red
    Read-Host "Kapatmak için Enter'a basın" | Out-Null
    exit 1
}

# Klinik paneli kurulumuyla aynı klasör ve aynı adres dosyası (kurulum/Alpotech_Klinik_Kurulum.bat)
$klasor = Join-Path $env:LOCALAPPDATA "AlpotechKlinik"
New-Item -ItemType Directory -Force $klasor | Out-Null
$kayitliAdres = Join-Path $klasor "adres.txt"
if (Test-Path $kayitliAdres) { $VarsayilanAdres = (Get-Content $kayitliAdres -Raw).Trim() }

Write-Host "=== Alpotech Randevu kurulumu ===" -ForegroundColor Cyan
$Adres = $env:KURULUM_ADRES
if (-not $Adres) {
    Write-Host "Sunucu adresi: $VarsayilanAdres"
    $Adres = Read-Host "Doğruysa Enter'a basın, değiştiyse yeni adresi yazın"
    if (-not $Adres) { $Adres = $VarsayilanAdres }
}
$Adres = $Adres.Trim().TrimEnd("/")
if ($Adres -notmatch "^https?://") { $Adres = "http://$Adres" }
if ($Adres -notmatch "^https?://[^/\s]+$") { Dur "Adres anlaşılamadı: $Adres" }
$PanelAdresi = "$Adres/"
$RandevuAdresi = "$Adres/randevu/"

# Sunucu cevap veriyor mu, randevu yayında mı? Logoyu da simge yapmak için buradan alıyoruz.
Write-Host "Sunucuya bağlanılıyor: $RandevuAdresi"
$logo = Join-Path $klasor "logo.png"
try {
    Invoke-WebRequest -Uri "$Adres/logo.png" -OutFile $logo -UseBasicParsing -TimeoutSec 10
} catch {
    Dur ("Sunucuya ulaşılamadı: $PanelAdresi`n" +
         "- Bilgisayar kliniğin modemine (Wi-Fi ya da kablo) bağlı mı?`n" +
         "- Sunucu açık mı?`n" +
         "- Adres değiştiyse bu dosyayı yeniden çalıştırıp yeni adresi yazın.")
}
try {
    $sayfa = Invoke-WebRequest -Uri $RandevuAdresi -UseBasicParsing -TimeoutSec 10
    if ($sayfa.Content -notmatch "Alpotech Randevu") { throw "randevu sayfası değil" }
} catch {
    Dur ("Sunucu açık ama randevu yayında değil: $RandevuAdresi`n" +
         "Sunucuda randevu kurulumu (7. betik) çalıştırılmalı.")
}
Set-Content -Path $kayitliAdres -Value ($Adres -replace "^https?://", "") -Encoding ASCII

# logo.png -> randevu.ico (256x256, PNG içeren ICO). Diğer simgelerden ayrılsın diye sağ altta "R" rozeti var.
Add-Type -AssemblyName System.Drawing
$ikon = Join-Path $klasor "randevu.ico"
$kaynak = [System.Drawing.Image]::FromFile($logo)
$kare = New-Object System.Drawing.Bitmap 256, 256
$g = [System.Drawing.Graphics]::FromImage($kare)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAlias
$oran = [Math]::Min(256 / $kaynak.Width, 256 / $kaynak.Height)
$w = [int]($kaynak.Width * $oran); $h = [int]($kaynak.Height * $oran)
$g.DrawImage($kaynak, [int]((256 - $w) / 2), [int]((256 - $h) / 2), $w, $h)
$g.FillEllipse((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(181, 82, 60))), 150, 150, 104, 104)
$g.DrawEllipse((New-Object System.Drawing.Pen ([System.Drawing.Color]::White), 6), 150, 150, 104, 104)
$yazi = New-Object System.Drawing.Font "Segoe UI", 54, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
$bicim = New-Object System.Drawing.StringFormat
$bicim.Alignment = [System.Drawing.StringAlignment]::Center
$bicim.LineAlignment = [System.Drawing.StringAlignment]::Center
$g.DrawString("R", $yazi, [System.Drawing.Brushes]::White, (New-Object System.Drawing.RectangleF 150, 152, 104, 104), $bicim)
$g.Dispose(); $kaynak.Dispose()
$ms = New-Object System.IO.MemoryStream
$kare.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
$kare.Dispose()
$png = $ms.ToArray()
$fs = [System.IO.File]::Create($ikon)
$bw = New-Object System.IO.BinaryWriter $fs
$bw.Write([UInt16]0); $bw.Write([UInt16]1); $bw.Write([UInt16]1)
$bw.Write([Byte]0); $bw.Write([Byte]0); $bw.Write([Byte]0); $bw.Write([Byte]0)
$bw.Write([UInt16]1); $bw.Write([UInt16]32)
$bw.Write([UInt32]$png.Length); $bw.Write([UInt32]22)
$bw.Write($png)
$bw.Close()

# Tarayıcı: Edge (Windows 10/11'de hazır gelir), yoksa Chrome
$tarayici = @(
    "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $tarayici) { Dur "Edge ya da Chrome bulunamadı." }
$argumanlar = "--app=$RandevuAdresi --start-maximized"

$kabuk = New-Object -ComObject WScript.Shell
$masaustu = [Environment]::GetFolderPath("Desktop")
$baslat = [Environment]::GetFolderPath("Programs")

$kisayol = Join-Path $masaustu "Alpotech Randevu.lnk"
$lnk = $kabuk.CreateShortcut($kisayol)
$lnk.TargetPath = $tarayici
$lnk.Arguments = $argumanlar
$lnk.IconLocation = "$ikon,0"
$lnk.Description = "Alpotech Randevu ($RandevuAdresi)"
$lnk.Save()
Copy-Item $kisayol (Join-Path $baslat "Alpotech Randevu.lnk") -Force

Write-Host ""
Write-Host "Tamam. Masaüstüne 'Alpotech Randevu' simgesi kondu. Şimdi açılıyor." -ForegroundColor Green
if (-not $env:KURULUM_PANELI_ACMA) { Start-Process -FilePath $tarayici -ArgumentList $argumanlar }
Start-Sleep -Seconds 4
