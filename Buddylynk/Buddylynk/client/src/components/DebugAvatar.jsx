import { useAuth } from "../context/AuthContext";

export const DebugAvatar = () => {
    const { user } = useAuth();
    
    console.log("🔍 User Avatar Debug:", {
        avatar: user?.avatar,
        username: user?.username,
        userId: user?.userId,
        fullUser: user
    });
    
    return null;
};
