import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { useEffect } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { SocketProvider } from "./context/SocketContext";
import { NotificationProvider } from "./context/NotificationContext";
import { ToastProvider } from "./context/ToastContext";
import { cleanupOldStorage } from "./utils/cleanupStorage";
import Login from "./pages/Login";
import Home from "./pages/Home";
import Search from "./pages/Search";
import Chat from "./pages/Chat";
import Groups from "./pages/Groups";
import GroupDetail from "./pages/GroupDetail";
import InviteJoin from "./pages/InviteJoin";
import Create from "./pages/Create";
import ProfileNew from "./pages/ProfileNew";
import EditProfile from "./pages/EditProfile";
import Settings from "./pages/Settings";
import Saved from "./pages/Saved";
import CompleteProfile from "./pages/CompleteProfile";
import SuggestedFriends from "./pages/SuggestedFriends";
import PostDetail from "./pages/PostDetail";
import Navbar from "./components/Navbar";
import IncomingCallOverlay from "./components/IncomingCallOverlay";

const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-white">Loading...</div>;
  return user ? children : <Navigate to="/login" />;
};

const AppRoutes = () => {
  const { user } = useAuth();
  
  // Cleanup old localStorage data once on mount
  useEffect(() => {
    cleanupOldStorage();
  }, []);
  
  return (
    <>
      {user && <Navbar />}
      {user && <IncomingCallOverlay />}
      <Routes>
        <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
        <Route path="/complete-profile" element={<PrivateRoute><CompleteProfile /></PrivateRoute>} />
        <Route path="/suggested-friends" element={<PrivateRoute><SuggestedFriends /></PrivateRoute>} />
        <Route path="/" element={<PrivateRoute><Home /></PrivateRoute>} />
        <Route path="/post/:postId" element={<PrivateRoute><PostDetail /></PrivateRoute>} />
        <Route path="/search" element={<PrivateRoute><Search /></PrivateRoute>} />
        <Route path="/chat" element={<PrivateRoute><Chat /></PrivateRoute>} />
        <Route path="/groups" element={<PrivateRoute><Create /></PrivateRoute>} />
        <Route path="/groups/:id" element={<PrivateRoute><GroupDetail /></PrivateRoute>} />
        <Route path="/invite/:inviteCode" element={<PrivateRoute><InviteJoin /></PrivateRoute>} />
        <Route path="/profile/:id" element={<PrivateRoute><ProfileNew /></PrivateRoute>} />
        <Route path="/edit-profile" element={<PrivateRoute><EditProfile /></PrivateRoute>} />
        <Route path="/settings" element={<PrivateRoute><Settings /></PrivateRoute>} />
        <Route path="/saved" element={<PrivateRoute><Saved /></PrivateRoute>} />
      </Routes>
    </>
  );
};

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <SocketProvider>
          <NotificationProvider>
            <ToastProvider>
              <Router>
                <AppRoutes />
              </Router>
            </ToastProvider>
          </NotificationProvider>
        </SocketProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
