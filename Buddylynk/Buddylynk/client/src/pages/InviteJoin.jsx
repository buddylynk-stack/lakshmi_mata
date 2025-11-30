import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { motion } from "framer-motion";
import { Users, ArrowLeft, Loader2 } from "lucide-react";
import { SafeImage } from "../components/SafeImage";
import axios from "axios";

const InviteJoin = () => {
    const { inviteCode } = useParams();
    const { user } = useAuth();
    const navigate = useNavigate();
    const toast = useToast();
    const [group, setGroup] = useState(null);
    const [loading, setLoading] = useState(true);
    const [joining, setJoining] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchGroupByInvite();
    }, [inviteCode]);

    const fetchGroupByInvite = async () => {
        setLoading(true);
        setError(null);
        try {
            const token = localStorage.getItem("token");
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            const res = await axios.get(`/api/groups/invite/${inviteCode}`, { headers });
            setGroup(res.data);
        } catch (error) {
            console.error("Error fetching group:", error);
            if (error.response?.status === 404) {
                setError("This invite link is invalid or has expired.");
            } else {
                setError("Failed to load group information.");
            }
        } finally {
            setLoading(false);
        }
    };

    const handleJoin = async () => {
        if (!user) {
            toast.warning("Please login to join this channel");
            navigate("/login");
            return;
        }

        setJoining(true);
        try {
            const token = localStorage.getItem("token");
            await axios.post(`/api/groups/invite/${inviteCode}/join`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            toast.success(`Joined ${group.name}!`);
            navigate(`/groups/${group.groupId}`);
        } catch (error) {
            console.error("Error joining group:", error);
            if (error.response?.data?.message === "Already a member") {
                toast.info("You're already a member of this channel");
                navigate(`/groups/${group.groupId}`);
            } else {
                toast.error(error.response?.data?.message || "Failed to join channel");
            }
        } finally {
            setJoining(false);
        }
    };

    if (loading) {
        return (
            <div className="fixed inset-0 md:pl-72 flex items-center justify-center dark:bg-[#0b141a] bg-gray-100">
                <div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="fixed inset-0 md:pl-72 flex flex-col items-center justify-center dark:bg-[#0b141a] bg-gray-100 p-4">
                <div className="text-center max-w-md">
                    <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
                        <Users className="w-10 h-10 text-red-400" />
                    </div>
                    <h2 className="text-xl font-semibold dark:text-white text-gray-900 mb-2">
                        Invalid Invite Link
                    </h2>
                    <p className="dark:text-gray-400 text-gray-600 mb-6">
                        {error}
                    </p>
                    <button
                        onClick={() => navigate("/groups")}
                        className="px-6 py-3 bg-[#00a884] hover:bg-[#06cf9c] text-white font-medium rounded-xl transition-colors"
                    >
                        Browse Channels
                    </button>
                </div>
            </div>
        );
    }

    const isMember = group?.isMember;

    return (
        <div className="fixed inset-0 md:pl-72 flex flex-col dark:bg-[#0b141a] bg-gray-100">
            {/* Header */}
            <div className="dark:bg-[#202c33] bg-white px-4 py-3 flex items-center gap-3 border-b dark:border-[#2a3942] border-gray-200">
                <button
                    onClick={() => navigate(-1)}
                    className="dark:text-[#aebac1] text-gray-600 dark:hover:text-white hover:text-gray-900 p-1"
                >
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <h2 className="text-lg font-medium dark:text-white text-gray-900">
                    Join Channel
                </h2>
            </div>

            {/* Content */}
            <div className="flex-1 flex flex-col items-center justify-center p-6">
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="max-w-sm w-full text-center"
                >
                    {/* Channel Avatar */}
                    <div className="w-28 h-28 rounded-full overflow-hidden mx-auto mb-4 ring-4 ring-[#2a3942]">
                        {group?.coverImage ? (
                            <SafeImage
                                src={group.coverImage}
                                alt={group.name}
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <div className="w-full h-full bg-gradient-to-br from-primary/30 to-secondary/30 flex items-center justify-center">
                                <Users className="w-14 h-14 text-primary/60" />
                            </div>
                        )}
                    </div>

                    {/* Channel Name */}
                    <h1 className="text-2xl font-bold dark:text-white text-gray-900 mb-1">
                        {group?.name}
                    </h1>

                    {/* Channel Info */}
                    <p className="dark:text-[#8696a0] text-gray-600 text-sm mb-2">
                        {group?.type === 'channel' ? 'Public channel' : 'Group'} · {group?.memberCount || 0} {(group?.memberCount || 0) === 1 ? 'subscriber' : 'subscribers'}
                    </p>

                    {/* Description */}
                    {group?.description && (
                        <p className="dark:text-gray-400 text-gray-600 text-sm mb-6 max-w-xs mx-auto">
                            {group.description}
                        </p>
                    )}

                    {/* Join Button */}
                    {isMember ? (
                        <button
                            onClick={() => navigate(`/groups/${group.groupId}`)}
                            className="w-full py-3 bg-[#00a884] hover:bg-[#06cf9c] text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
                        >
                            Open Channel
                        </button>
                    ) : (
                        <button
                            onClick={handleJoin}
                            disabled={joining}
                            className="w-full py-3 bg-[#00a884] hover:bg-[#06cf9c] text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {joining ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Joining...
                                </>
                            ) : (
                                <>
                                    <Users className="w-5 h-5" />
                                    Join Channel
                                </>
                            )}
                        </button>
                    )}

                    {/* Created by */}
                    <p className="dark:text-[#8696a0] text-gray-500 text-xs mt-4">
                        Created by {group?.creatorName || 'Unknown'}
                    </p>
                </motion.div>
            </div>
        </div>
    );
};

export default InviteJoin;
