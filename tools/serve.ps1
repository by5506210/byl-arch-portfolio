# Minimal dependency-free static file server for local preview.
# Uses a raw TCP listener (no admin / URL-ACL needed, unlike HttpListener).
# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File tools/serve.ps1 -Port 8026
param(
  [int]$Port = 8026,
  [string]$Root = "$PSScriptRoot\.."
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path $Root).Path

$mime = @{
  '.html' = 'text/html; charset=utf-8'
  '.css'  = 'text/css; charset=utf-8'
  '.js'   = 'text/javascript; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'
  '.webp' = 'image/webp'
  '.jpg'  = 'image/jpeg'
  '.jpeg' = 'image/jpeg'
  '.png'  = 'image/png'
  '.gif'  = 'image/gif'
  '.svg'  = 'image/svg+xml'
  '.mp4'  = 'video/mp4'
  '.webm' = 'video/webm'
  '.woff' = 'font/woff'
  '.woff2'= 'font/woff2'
  '.ico'  = 'image/x-icon'
}

$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
$listener.Start()
Write-Host "Serving $root at http://localhost:$Port/  (Ctrl+C to stop)"

while ($true) {
  $client = $listener.AcceptTcpClient()
  try {
    $stream = $client.GetStream()
    $reader = [System.IO.StreamReader]::new($stream, [System.Text.Encoding]::ASCII)
    $requestLine = $reader.ReadLine()
    if (-not $requestLine) { continue }
    # Drain the remaining request headers.
    while (($line = $reader.ReadLine()) -ne $null -and $line -ne '') { }

    $rawUrl = ($requestLine -split ' ')[1]
    $path = [System.Uri]::UnescapeDataString(($rawUrl -split '\?')[0])
    if ([string]::IsNullOrEmpty($path) -or $path -eq '/') { $path = '/index.html' }

    $rel = $path.TrimStart('/') -replace '/', '\'
    $full = [System.IO.Path]::GetFullPath((Join-Path $root $rel))

    if ($full.StartsWith($root) -and (Test-Path $full -PathType Leaf)) {
      $ext = [System.IO.Path]::GetExtension($full).ToLower()
      $ctype = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { 'application/octet-stream' }
      $body = [System.IO.File]::ReadAllBytes($full)
      $status = '200 OK'
    } else {
      $ctype = 'text/plain; charset=utf-8'
      $body = [System.Text.Encoding]::UTF8.GetBytes('404 Not Found')
      $status = '404 Not Found'
    }

    $head = "HTTP/1.1 $status`r`nContent-Type: $ctype`r`nContent-Length: $($body.Length)`r`nCache-Control: no-cache`r`nConnection: close`r`n`r`n"
    $headBytes = [System.Text.Encoding]::ASCII.GetBytes($head)
    $stream.Write($headBytes, 0, $headBytes.Length)
    $stream.Write($body, 0, $body.Length)
    $stream.Flush()
  } catch {
    # Ignore per-connection errors and keep serving.
  } finally {
    $client.Close()
  }
}
