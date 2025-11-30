# Data Cleanup Scripts for Launch

## 🚀 Pre-Launch Cleanup Options

### Option 1: Complete Cleanup (Nuclear Option) ☢️
**Deletes EVERYTHING - All users, posts, messages, media**

```bash
node scripts/cleanup-all-data.js
```

**What it does:**
- ✅ Deletes ALL items from all DynamoDB tables
- ✅ Deletes ALL files from S3 bucket
- ✅ Keeps table structure intact
- ⚠️ **CANNOT BE UNDONE!**

**When to use:**
- Fresh start for production launch
- Complete reset needed
- No data worth keeping

---

### Option 2: Test Data Cleanup (Safer) 🧹
**Only deletes test accounts and their data**

```bash
node scripts/cleanup-test-data.js
```

**What it does:**
- ✅ Deletes only test users (superman, guddi, etc.)
- ✅ Deletes posts/messages from test users
- ✅ Keeps real user data
- ✅ Preserves S3 files (manual cleanup if needed)

**When to use:**
- Want to keep some real users
- Remove test accounts only
- Safer pre-launch cleanup

**To customize:**
Edit `TEST_USERNAMES` array in `cleanup-test-data.js`:
```javascript
const TEST_USERNAMES = [
    'superman',
    'superman1',
    'guddi',
    'test',
    'demo',
    // Add your test usernames here
];
```

---

### Option 3: Manual S3 Cleanup Only 📦

```bash
# Using AWS CLI
aws s3 rm s3://buddylynk-media-bucket-2024 --recursive
```

**What it does:**
- ✅ Deletes all files from S3
- ✅ Keeps DynamoDB data
- ✅ Frees up storage space

---

## 📋 Pre-Launch Checklist

Before running cleanup:

1. **Backup Important Data** (if any)
   - Export any data you want to keep
   - Save important user information

2. **Update Test Usernames**
   - Edit `cleanup-test-data.js`
   - Add all test account usernames

3. **Choose Your Option**
   - Complete cleanup for fresh start
   - Test data cleanup to keep real users

4. **Run the Script**
   ```bash
   cd server
   node scripts/cleanup-all-data.js
   # OR
   node scripts/cleanup-test-data.js
   ```

5. **Verify Cleanup**
   ```bash
   node scripts/check-posts-table.js
   ```

---

## 🔒 Safety Features

### Complete Cleanup Script:
- Requires typing "DELETE ALL DATA" to confirm
- Shows progress for each table
- Provides detailed summary

### Test Data Cleanup Script:
- Only deletes specified test users
- Preserves database structure
- Safer for partial cleanup

---

## 📊 What Gets Deleted

### DynamoDB Tables:
- ✅ Buddylynk_Users (all user accounts)
- ✅ Buddylynk_Posts (all posts)
- ✅ Buddylynk_Messages (all messages)
- ✅ Buddylynk_Groups (all groups)
- ✅ Buddylynk_Notifications (all notifications)
- ✅ Buddylynk_PostViews (all view tracking)

### S3 Bucket:
- ✅ All uploaded images
- ✅ All uploaded videos
- ✅ Profile pictures
- ✅ Group cover images
- ✅ Post media files

### Pages That Will Be Empty:
- ✅ **Home Feed** - No posts to display
- ✅ **Search Page** - No users to find
- ✅ **Groups Page** - No groups available
- ✅ **Profile Pages** - No posts, no followers
- ✅ **Saved Posts** - Empty saved list
- ✅ **Messages** - No conversations
- ✅ **Notifications** - No notifications
- ✅ **Suggested Friends** - No users to suggest

---

## 🚨 Important Notes

1. **Cannot Undo** - Once deleted, data is gone forever
2. **Backup First** - Save any important data before cleanup
3. **Test Environment** - Test scripts in dev environment first
4. **AWS Costs** - Cleanup reduces storage costs
5. **Fresh Start** - Perfect for production launch

---

## 🎯 Recommended Approach for Launch

1. Run test data cleanup first:
   ```bash
   node scripts/cleanup-test-data.js
   ```

2. Verify what's left:
   ```bash
   node scripts/check-posts-table.js
   ```

3. If needed, run complete cleanup:
   ```bash
   node scripts/cleanup-all-data.js
   ```

4. Verify everything is clean:
   ```bash
   node scripts/check-posts-table.js
   ```

---

## 💡 Tips

- Run cleanup during off-peak hours
- Notify users if keeping any data
- Test scripts in development first
- Keep scripts for future use
- Document what was deleted

---

## 🆘 Need Help?

If something goes wrong:
1. Check AWS Console for table status
2. Verify S3 bucket contents
3. Check script error messages
4. Tables remain intact (only data deleted)
5. Can recreate tables if needed

---

**Ready to launch? Choose your cleanup option and go! 🚀**
