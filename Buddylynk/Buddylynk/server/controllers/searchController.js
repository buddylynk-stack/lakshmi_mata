const { ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { docClient } = require("../config/db");

const search = async (req, res) => {
    const { q } = req.query;
    if (!q) return res.json({ users: [], posts: [] });

    try {
        // Simple scan for MVP (Production would use OpenSearch or GSI)
        const usersCmd = new ScanCommand({ TableName: "Buddylynk_Users" });
        const postsCmd = new ScanCommand({ TableName: "Buddylynk_Posts" });

        const [usersRes, postsRes] = await Promise.all([
            docClient.send(usersCmd),
            docClient.send(postsCmd),
        ]);

        const users = usersRes.Items.filter(u =>
            u.username.toLowerCase().includes(q.toLowerCase()) ||
            u.email.toLowerCase().includes(q.toLowerCase())
        );

        const posts = postsRes.Items.filter(p =>
            p.content.toLowerCase().includes(q.toLowerCase())
        );

        res.json({ users, posts });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

module.exports = { search };
