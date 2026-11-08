<!DOCTYPE html>
@php
    $brandingSettings = \App\Support\PerformanceCache::getSystemBranding();
    $systemName = $brandingSettings['system_name'] ?: config('app.name', 'Maaldhis');
    $systemFavicon = !empty($brandingSettings['system_favicon']) ? $brandingSettings['system_favicon'] : '/favicon.ico';
@endphp
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="csrf-token" content="{{ csrf_token() }}">
        <title inertia>{{ $systemName }}</title>
        <link rel="icon" id="system-favicon" href="{{ $systemFavicon }}">
        <link rel="shortcut icon" id="system-shortcut-icon" href="{{ $systemFavicon }}">
        <link rel="apple-touch-icon" href="/pwa-icon.svg">
        <link rel="manifest" href="/manifest.json">
        <meta name="theme-color" content="#4F46E5">
        <meta name="apple-mobile-web-app-capable" content="yes">
        <meta name="apple-mobile-web-app-status-bar-style" content="default">
        <meta name="apple-mobile-web-app-title" content="{{ $systemName }}">
        
        <!-- Fonts -->
        <link rel="preconnect" href="https://fonts.bunny.net">
        <link href="https://fonts.bunny.net/css?family=inter:400,500,600,700,800&display=swap" rel="stylesheet" />

        <!-- Scripts -->
        @viteReactRefresh
        @vite(['resources/js/app.jsx', 'resources/js/index.css'])
        @inertiaHead
    </head>
    <body class="font-sans antialiased bg-background text-foreground">
        @inertia
    </body>
</html>
