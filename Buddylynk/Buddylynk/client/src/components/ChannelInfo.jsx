import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    ArrowLeft,
    Edit2,
    MoreVertical,
    Link as LinkIcon,
    Bell,
    BellOff,
    Users,
    Shield,
    Settings,
    Copy,
    QrCode,
    ChevronRight,
    Trash2,
    LogOut,
    Share2
} from "lucide-react";
import { SafeImage } from "./SafeImage";
import ChannelEdit from "./ChannelEdit";
import InviteLinksScreen from "./InviteLinksScreen";
import SubscribersList from "./SubscribersList";

const ChannelInfo = ({ 
    isOpen, 
    onClose, 
    group, 
    user, 
    onSaveGroup,
    onDeleteGroup, 
    onLeaveGroup,
    onNavigateToSettings,
    onGroupUpdated
}) => {
    const [notificationsEnabled, setNotificationsEnabled] = useState(true);
    const [showMoreMenu, setShowMoreMenu] = useState(false);
    const [copied, setCopied] = useState(false);
    const [showEditPage, setShowEditPage] = useState(false);
    const [showInviteLinks, setShowInviteLinks] = useState(false);
    const [showSubscribers, setShowSubscribers] = useState(false);
    const [currentGroup, setCurrentGroup] = useState(group);

    // Update currentGroup when group prop changes
    if (group?.groupId !== currentGroup?.groupId || group?.inviteCode !== currentGroup?.inviteCode) {
        setCurrentGroup(group);
    }

    const isCreator = currentGroup?.creatorId === user?.userId;
    const isAdmin = currentGroup?.admins?.includes(user?.userId);
    const isMember = currentGroup?.members?.includes(user?.userId);
    const canManageInviteLink = isCreator || isAdmin; // Only owner and admins can see/manage invite link
    
    // Generate invite link - use inviteCode if available (allows revokable links)
    const getInviteUrl = () => {
        if (currentGroup?.inviteCode) {
            return `${window.location.origin}/invite/${currentGroup.inviteCode}`;
        }
        return `${window.location.origin}/groups/${currentGroup?.groupId}`;
    };
    
    const inviteLink = getInviteUrl();

    const handleInviteLinkUpdated = (updatedGroup) => {
        setCurrentGroup(updatedGroup);
        onGroupUpdated?.(updatedGroup);
    };

    const handleCopyLink = async () => {
        try {
            await navigator.clipboard.writeText(inviteLink);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error("Failed to copy:", err);
        }
    };

    const handleShare = async () => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: group?.name,
                    text: `Join ${group?.name} on Buddylynk!`,
                    url: inviteLink
                });
            } catch (err) {
                console.error("Share failed:", err);
            }
        } else {
            handleCopyLink();
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/50 z-50 md:pl-72"
                    />

                    {/* Channel Info Panel - Slide from right */}
                    <motion.div
                        initial={{ x: "100%" }}
                        animate={{ x: 0 }}
                        exit={{ x: "100%" }}
                        transition={{ type: "spring", damping: 25, stiffness: 200 }}
                        className="fixed inset-y-0 right-0 w-full md:w-[420px] md:ml-72 bg-[#111b21] z-50 flex flex-col overflow-hidden"
                    >
                        {/* Header */}
                        <div className="bg-[#202c33] px-4 py-3 flex items-center gap-4">
                            <button
                                onClick={onClose}
                                className="text-[#aebac1] hover:text-white p-1 transition-colors"
                            >
                                <ArrowLeft className="w-6 h-6" />
                            </button>
                            <h2 className="text-white text-lg font-medium flex-1">Channel info</h2>
                            
                            {isCreator && (
                                <button
                                    onClick={() => setShowEditPage(true)}
                                    className="text-[#aebac1] hover:text-white p-2 transition-colors"
                                >
                                    <Edit2 className="w-5 h-5" />
                                </button>
                            )}
                        </div>

                        {/* Scrollable Content */}
                        <div className="flex-1 overflow-y-auto">
                            {/* Profile Section */}
                            <div className="bg-[#111b21] px-4 py-8 flex flex-col items-center">
                                {/* Large Profile Photo */}
                                <div className="w-32 h-32 rounded-full overflow-hidden mb-4 ring-4 ring-[#2a3942]">
                                    {group?.coverImage ? (
                                        <SafeImage
                                            src={group.coverImage}
                                            alt={group.name}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-full bg-gradient-to-br from-primary/30 to-secondary/30 flex items-center justify-center">
                                            <Users className="w-16 h-16 text-primary/60" />
                                        </div>
                                    )}
                                </div>

                                {/* Channel Name */}
                                <h1 className="text-2xl font-semibold text-white mb-1 text-center">
                                    {group?.name}
                                </h1>

                                {/* Subtitle */}
                                <p className="text-[#8696a0] text-sm">
                                    {group?.type === 'channel' ? 'Public channel' : 'Group'} · {group?.memberCount || 0} {(group?.memberCount || 0) === 1 ? 'subscriber' : 'subscribers'}
                                </p>
                            </div>

                            {/* Divider */}
                            <div className="h-2 bg-[#0b141a]" />

                            {/* Description Section */}
                            {group?.description && (
                                <>
                                    <div className="bg-[#111b21] px-4 py-4">
                                        <p className="text-white text-sm leading-relaxed">
                                            {group.description}
                                        </p>
                                        <p className="text-[#8696a0] text-xs mt-2">
                                            Created by {group.creatorName || 'Unknown'}
                                        </p>
                                    </div>
                                    <div className="h-2 bg-[#0b141a]" />
                                </>
                            )}

                            {/* Info Section */}
                            <div className="bg-[#111b21]">
                                <div className="px-4 py-3">
                                    <h3 className="text-[#8696a0] text-sm font-medium uppercase tracking-wide">
                                        Info
                                    </h3>
                                </div>

                                {/* Invite Link - Only visible to owner and administrators */}
                                {canManageInviteLink && (
                                    <button
                                        onClick={() => setShowInviteLinks(true)}
                                        className="w-full flex items-center gap-4 px-4 py-3 hover:bg-[#202c33] transition-colors"
                                    >
                                        <div className="w-10 h-10 rounded-full bg-[#00a884]/20 flex items-center justify-center">
                                            <LinkIcon className="w-5 h-5 text-[#00a884]" />
                                        </div>
                                        <div className="flex-1 text-left">
                                            <p className="text-white text-sm">Invite link</p>
                                            <p className="text-[#8696a0] text-xs truncate max-w-[250px]">
                                                {inviteLink.replace(window.location.origin, 'buddylynk.com')}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <QrCode className="w-5 h-5 text-[#8696a0]" />
                                            <Copy className="w-5 h-5 text-[#8696a0]" />
                                        </div>
                                    </button>
                                )}

                                {/* Notifications Toggle */}
                                <button
                                    onClick={() => setNotificationsEnabled(!notificationsEnabled)}
                                    className="w-full flex items-center gap-4 px-4 py-3 hover:bg-[#202c33] transition-colors"
                                >
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                        notificationsEnabled ? 'bg-[#00a884]/20' : 'bg-[#8696a0]/20'
                                    }`}>
                                        {notificationsEnabled ? (
                                            <Bell className="w-5 h-5 text-[#00a884]" />
                                        ) : (
                                            <BellOff className="w-5 h-5 text-[#8696a0]" />
                                        )}
                                    </div>
                                    <div className="flex-1 text-left">
                                        <p className="text-white text-sm">Notifications</p>
                                        <p className="text-[#8696a0] text-xs">
                                            {notificationsEnabled ? 'On' : 'Off'}
                                        </p>
                                    </div>
                                    {/* Toggle Switch */}
                                    <div className={`w-11 h-6 rounded-full p-0.5 transition-colors ${
                                        notificationsEnabled ? 'bg-[#00a884]' : 'bg-[#3b4a54]'
                                    }`}>
                                        <motion.div
                                            className="w-5 h-5 bg-white rounded-full shadow-md"
                                            animate={{ x: notificationsEnabled ? 20 : 0 }}
                                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                        />
                                    </div>
                                </button>
                            </div>

                            {/* Divider */}
                            <div className="h-2 bg-[#0b141a]" />

                            {/* Members Section */}
                            <div className="bg-[#111b21]">
                                <div className="px-4 py-3">
                                    <h3 className="text-[#8696a0] text-sm font-medium uppercase tracking-wide">
                                        Members
                                    </h3>
                                </div>

                                {/* Subscribers - Clickable for creator/admins to see all subscribers */}
                                {(isCreator || isAdmin) ? (
                                    <button 
                                        onClick={() => setShowSubscribers(true)}
                                        className="w-full flex items-center gap-4 px-4 py-3 hover:bg-[#202c33] transition-colors"
                                    >
                                        <div className="w-10 h-10 rounded-full bg-[#00a884]/20 flex items-center justify-center">
                                            <Users className="w-5 h-5 text-[#00a884]" />
                                        </div>
                                        <div className="flex-1 text-left">
                                            <p className="text-white text-sm">Subscribers</p>
                                            <p className="text-[#8696a0] text-xs">
                                                {currentGroup?.memberCount || currentGroup?.members?.length || 0} {(currentGroup?.memberCount || currentGroup?.members?.length || 0) === 1 ? 'subscriber' : 'subscribers'}
                                            </p>
                                        </div>
                                        <ChevronRight className="w-5 h-5 text-[#8696a0]" />
                                    </button>
                                ) : (
                                    <div className="w-full flex items-center gap-4 px-4 py-3">
                                        <div className="w-10 h-10 rounded-full bg-[#00a884]/20 flex items-center justify-center">
                                            <Users className="w-5 h-5 text-[#00a884]" />
                                        </div>
                                        <div className="flex-1 text-left">
                                            <p className="text-white text-sm">Subscribers</p>
                                            <p className="text-[#8696a0] text-xs">
                                                {currentGroup?.memberCount || currentGroup?.members?.length || 0} {(currentGroup?.memberCount || currentGroup?.members?.length || 0) === 1 ? 'subscriber' : 'subscribers'}
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* Administrators - Only for owner/admins to see */}
                                {isCreator && (
                                    <button className="w-full flex items-center gap-4 px-4 py-3 hover:bg-[#202c33] transition-colors">
                                        <div className="w-10 h-10 rounded-full bg-[#5865f2]/20 flex items-center justify-center">
                                            <Shield className="w-5 h-5 text-[#5865f2]" />
                                        </div>
                                        <div className="flex-1 text-left">
                                            <p className="text-white text-sm">Administrators</p>
                                        </div>
                                        <span className="text-[#8696a0] text-sm mr-2">
                                            {(group?.admins?.length || 0) + 1}
                                        </span>
                                        <ChevronRight className="w-5 h-5 text-[#8696a0]" />
                                    </button>
                                )}

                                {/* Channel Settings - Only for creator */}
                                {isCreator && (
                                    <button 
                                        onClick={onNavigateToSettings}
                                        className="w-full flex items-center gap-4 px-4 py-3 hover:bg-[#202c33] transition-colors"
                                    >
                                        <div className="w-10 h-10 rounded-full bg-[#8696a0]/20 flex items-center justify-center">
                                            <Settings className="w-5 h-5 text-[#8696a0]" />
                                        </div>
                                        <div className="flex-1 text-left">
                                            <p className="text-white text-sm">Channel settings</p>
                                        </div>
                                        <ChevronRight className="w-5 h-5 text-[#8696a0]" />
                                    </button>
                                )}
                            </div>

                            {/* Divider */}
                            <div className="h-2 bg-[#0b141a]" />

                            {/* Leave Section - Only for non-creator members */}
                            {isMember && !isCreator && (
                                <div className="bg-[#111b21] pb-8">
                                    <button
                                        onClick={onLeaveGroup}
                                        className="w-full flex items-center gap-4 px-4 py-3 hover:bg-[#202c33] transition-colors"
                                    >
                                        <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                                            <LogOut className="w-5 h-5 text-red-400" />
                                        </div>
                                        <p className="text-red-400 text-sm">Leave channel</p>
                                    </button>
                                </div>
                            )}
                        </div>
                    </motion.div>

                    {/* Channel Edit Page */}
                    <ChannelEdit
                        isOpen={showEditPage}
                        onClose={() => setShowEditPage(false)}
                        group={currentGroup}
                        currentUserId={user?.userId}
                        onSave={async (data) => {
                            await onSaveGroup?.(data);
                            setShowEditPage(false);
                        }}
                        onDelete={() => {
                            setShowEditPage(false);
                            onDeleteGroup?.();
                        }}
                    />

                    {/* Invite Links Screen */}
                    <InviteLinksScreen
                        isOpen={showInviteLinks}
                        onClose={() => setShowInviteLinks(false)}
                        group={currentGroup}
                        onInviteLinkUpdated={handleInviteLinkUpdated}
                    />

                    {/* Subscribers List */}
                    <SubscribersList
                        isOpen={showSubscribers}
                        onClose={() => setShowSubscribers(false)}
                        group={currentGroup}
                        currentUserId={user?.userId}
                        onMemberRemoved={() => {
                            // Refresh group data after member removal
                            onGroupUpdated?.(currentGroup);
                        }}
                    />
                </>
            )}
        </AnimatePresence>
    );
};

export default ChannelInfo;
