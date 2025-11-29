@echo off
echo ========================================
echo Buddylynk S3 Deployment Script
echo ========================================
echo.

echo [1/4] Building React app...
call npm run build
if errorlevel 1 (
    echo Build failed!
    exit /b 1
)
echo Build complete!
echo.

echo [2/4] Deploying to S3...
aws s3 sync dist/ s3://buddylynk.com --delete
if errorlevel 1 (
    echo Deployment failed! Make sure AWS CLI is configured.
    exit /b 1
)
echo.

echo [3/4] Setting cache headers...
aws s3 sync dist/ s3://buddylynk.com --cache-control "public, max-age=31536000" --exclude "index.html" --delete
aws s3 cp dist/index.html s3://buddylynk.com/index.html --cache-control "no-cache"
echo.

echo [4/4] Invalidating CloudFront cache (optional)...
echo Enter your CloudFront Distribution ID (or press Enter to skip):
set /p DIST_ID=
if not "%DIST_ID%"=="" (
    aws cloudfront create-invalidation --distribution-id %DIST_ID% --paths "/*"
    echo CloudFront cache invalidated!
)
echo.

echo ========================================
echo Deployment Complete!
echo Your site is live at: https://buddylynk.com
echo ========================================
pause
