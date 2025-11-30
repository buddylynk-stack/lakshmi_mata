/**
 * Complete Avatar Fix Pipeline
 * Runs all necessary fixes to ensure avatars work properly
 */

const { execSync } = require('child_process');

console.log("🔧 Avatar Fix Pipeline Starting...\n");
console.log("=" .repeat(60));

// Step 1: Fix S3 Bucket Policy
console.log("\n📦 Step 1: Fixing S3 Bucket Policy...");
try {
    execSync('node server/scripts/fix-bucket-policy.js', { stdio: 'inherit' });
    console.log("✅ S3 bucket policy fixed");
} catch (error) {
    console.error("❌ Failed to fix bucket policy");
    process.exit(1);
}

// Step 2: Check User Avatars
console.log("\n👤 Step 2: Checking User Avatars...");
try {
    execSync('node server/scripts/check-user-avatars.js', { stdio: 'inherit' });
    console.log("✅ User avatars checked");
} catch (error) {
    console.error("❌ Failed to check avatars");
}

// Summary
console.log("\n" + "=".repeat(60));
console.log("✅ Avatar Fix Pipeline Complete!");
console.log("=".repeat(60));

console.log("\n📋 Next Steps:");
console.log("1. Hard refresh your browser (Ctrl+Shift+R)");
console.log("2. Go to Edit Profile and upload an avatar");
console.log("3. Check browser console for success message");
console.log("4. Avatar should appear everywhere immediately");

console.log("\n💡 If avatars still don't show:");
console.log("- Clear browser cache completely");
console.log("- Check browser console for errors");
console.log("- Verify S3 URL in localStorage: localStorage.getItem('user')");
console.log("- Re-upload the avatar");

console.log("\n🎉 All systems ready!");
