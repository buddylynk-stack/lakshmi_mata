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
import ConfirmModal from "./ConfirmModal";

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
    const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
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
                        className="fixed inset-y-0 right-0 w-full md:w-[420px] md:ml-72 dark:bg-[#111b21] bg-gray-50 z-50 flex flex-col overflow-hidden"
                    >
                        {/* Header */}
                        <div className="dark:bg-[#202c33] bg-white px-4 py-3 flex items-center gap-4 border-b dark:border-transparent border-gray-200">
                            <button
                                onClick={onClose}
                                className="dark:text-[#aebac1] text-gray-600 dark:hover:text-white hover:text-gray-900 p-1 transition-colors"
                            >
                                <ArrowLeft className="w-6 h-6" />
                            </button>
                            <h2 className="dark:text-white text-gray-900 text-lg font-medium flex-1">Channel info</h2>
                            
                            {isCreator && (
                                <button
                                    onClick={() => setShowEditPage(true)}
                                    className="dark:text-[#aebac1] text-gray-600 dark:hover:text-white hover:text-gray-900 p-2 transition-colors"
                                >
                                    <Edit2 className="w-5 h-5" />
                                </button>
                            )}
                            
                            {/* Three dots menu for non-creator members */}
                            {isMember && !isCreator && (
                                <div className="relative">
                                    <button
                                        onClick={() => setShowMoreMenu(!showMoreMenu)}
                                        className="dark:text-[#aebac1] text-gray-600 dark:hover:text-white hover:text-gray-900 p-2 transition-colors"
                                    >
                                        <MoreVertical className="w-5 h-5" />
                                    </button>
                                    
                                    {/* Dropdown Menu */}
                                    <AnimatePresence>
                                        {showMoreMenu && (
                                            <>
                                                <motion.div
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    exit={{ opacity: 0 }}
                                                    onClick={() => setShowMoreMenu(false)}
                                                    className="fixed inset-0 z-10"
                                                />
                                                <motion.div
                                                    initial={{ opacity: 0, scale: 0.95, y: -10 }}
                                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                                    exit={{ opacity: 0, scale: 0.95, y: -10 }}
                                                    className="absolute right-0 top-full mt-1 dark:bg-[#233138] bg-white rounded-lg shadow-xl z-20 min-w-[180px] overflow-hidden border dark:border-transparent border-gray-200"
                                                >
                                                    <button
                                                        onClick={() => {
                                                            setShowMoreMenu(false);
                                                            setShowLeaveConfirm(true);
                                                        }}
                                                        className="w-full flex items-center gap-3 px-4 py-3 text-red-500 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-[#182229] transition-colors"
                                                    >
                                                        <LogOut className="w-5 h-5" />
                                                        <span className="text-sm">Leave channel</span>
                                                    </button>
                                                </motion.div>
                                            </>
                                        )}
                                    </AnimatePresence>
                                </div>
                            )}
                        </div>

                        {/* Scrollable Content */}
                        <div className="flex-1 overflow-y-auto">
                            {/* Profile Section */}
                            <div className="dark:bg-[#111b21] bg-gray-50 px-4 py-8 flex flex-col items-center">
                                {/* Large Profile Photo */}
                                <div className="w-32 h-32 rounded-full overflow-hidden mb-4 ring-4 dark:ring-[#2a3942] ring-gray-200">
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
                                <h1 className="text-2xl font-semibold dark:text-white text-gray-900 mb-1 text-center">
                                    {group?.name}
                                </h1>

                                {/* Subtitle */}
                                <p className="dark:text-[#8696a0] text-gray-500 text-sm">
                                    {group?.type === 'channel' ? 'Public channel' : 'Group'} · {group?.memberCount || 0} {(group?.memberCount || 0) === 1 ? 'subscriber' : 'subscribers'}
                                </p>
                            </div>

                            {/* Divider */}
                            <div className="h-2 dark:bg-[#0b141a] bg-gray-100" />

                            {/* Description Section */}
                            {group?.description && (
                                <>
                                    <div className="dark:bg-[#111b21] bg-white px-4 py-4">
                                        <p className="dark:text-white text-gray-900 text-sm leading-relaxed">
                                            {group.description}
                                        </p>
                                        <p className="dark:text-[#8696a0] text-gray-500 text-xs mt-2">
                                            Created by {group.creatorName || 'Unknown'}
                                        </p>
                                    </div>
                                    <div className="h-2 dark:bg-[#0b141a] bg-gray-100" />
                                </>
                            )}

                            {/* Info Section */}
                            <div className="dark:bg-[#111b21] bg-white">
                                <div className="px-4 py-3">
                                    <h3 className="dark:text-[#8696a0] text-gray-500 text-sm font-medium uppercase tracking-wide">
                                        Info
                                    </h3>
                                </div>

                                {/* Invite Link - Only visible to owner and administrators */}
                                {canManageInviteLink && (
                                    <button
                                        onClick={() => setShowInviteLinks(true)}
                                        className="w-full flex items-center gap-4 px-4 py-3 hover:bg-gray-100 dark:hover:bg-[#202c33] transition-colors"
                                    >
                                        <div className="w-10 h-10 rounded-full bg-[#00a884]/20 flex items-center justify-center">
                                            <LinkIcon className="w-5 h-5 text-[#00a884]" />
                                        </div>
                                        <div className="flex-1 text-left">
                                            <p className="dark:text-white text-gray-900 text-sm">Invite link</p>
                                            <p className="dark:text-[#8696a0] text-gray-500 text-xs truncate max-w-[250px]">
                                                {inviteLink.replace(window.location.origin, 'buddylynk.com')}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <QrCode className="w-5 h-5 dark:text-[#8696a0] text-gray-400" />
                                            <Copy className="w-5 h-5 dark:text-[#8696a0] text-gray-400" />
                                        </div>
                                    </button>
                                )}

                                {/* Notifications Toggle */}
                                <button
                                    onClick={() => setNotificationsEnabled(!notificationsEnabled)}
                                    className="w-full flex items-center gap-4 px-4 py-3 hover:bg-gray-100 dark:hover:bg-[#202c33] transition-colors"
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
                                        <p className="dark:text-white text-gray-900 text-sm">Notifications</p>
                                        <p className="dark:text-[#8696a0] text-gray-500 text-xs">
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
                            <div className="h-2 dark:bg-[#0b141a] bg-gray-100" />

                            {/* Members Section */}
                            <div className="dark:bg-[#111b21] bg-white">
                                <div className="px-4 py-3">
                                    <h3 className="dark:text-[#8696a0] text-gray-500 text-sm font-medium uppercase tracking-wide">
                                        Members
                                    </h3>
                                </div>

                                {/* Subscribers - Clickable for creator/admins to see all subscribers */}
                                {(isCreator || isAdmin) ? (
                                    <button 
                                        onClick={() => setShowSubscribers(true)}
                                        className="w-full flex items-center gap-4 px-4 py-3 hover:bg-gray-100 dark:hover:bg-[#202c33] transition-colors"
                                    >
                                        <div className="w-10 h-10 rounded-full bg-[#00a884]/20 flex items-center justify-center">
                                            <Users className="w-5 h-5 text-[#00a884]" />
                                        </div>
                                        <div className="flex-1 text-left">
                                            <p className="dark:text-white text-gray-900 text-sm">Subscribers</p>
                                            <p className="dark:text-[#8696a0] text-gray-500 text-xs">
                                                {currentGroup?.memberCount || currentGroup?.members?.length || 0} {(currentGroup?.memberCount || currentGroup?.members?.length || 0) === 1 ? 'subscriber' : 'subscribers'}
                                            </p>
                                        </div>
                                        <ChevronRight className="w-5 h-5 dark:text-[#8696a0] text-gray-400" />
                                    </button>
                                ) : (
                                    <div className="w-full flex items-center gap-4 px-4 py-3">
                                        <div className="w-10 h-10 rounded-full bg-[#00a884]/20 flex items-center justify-center">
                                            <Users className="w-5 h-5 text-[#00a884]" />
                                        </div>
                                        <div className="flex-1 text-left">
                                            <p className="dark:text-white text-gray-900 text-sm">Subscribers</p>
                                            <p className="dark:text-[#8696a0] text-gray-500 text-xs">
                                                {currentGroup?.memberCount || currentGroup?.members?.length || 0} {(currentGroup?.memberCount || currentGroup?.members?.length || 0) === 1 ? 'subscriber' : 'subscribers'}
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* Administrators - Only for owner/admins to see */}
                                {isCreator && (
                                    <button className="w-full flex items-center gap-4 px-4 py-3 hover:bg-gray-100 dark:hover:bg-[#202c33] transition-colors">
                                        <div className="w-10 h-10 rounded-full bg-[#5865f2]/20 flex items-center justify-center">
                                            <Shield className="w-5 h-5 text-[#5865f2]" />
                                        </div>
                                        <div className="flex-1 text-left">
                                            <p className="dark:text-white text-gray-900 text-sm">Administrators</p>
                                        </div>
                                        <span className="dark:text-[#8696a0] text-gray-500 text-sm mr-2">
                                            {(group?.admins?.length || 0) + 1}
                                        </span>
                                        <ChevronRight className="w-5 h-5 dark:text-[#8696a0] text-gray-400" />
                                    </button>
                                )}

                                {/* Channel Settings - Only for creator */}
                                {isCreator && (
                                    <button 
                                        onClick={onNavigateToSettings}
                                        className="w-full flex items-center gap-4 px-4 py-3 hover:bg-gray-100 dark:hover:bg-[#202c33] transition-colors"
                                    >
                                        <div className="w-10 h-10 rounded-full bg-[#8696a0]/20 flex items-center justify-center">
                                            <Settings className="w-5 h-5 text-[#8696a0]" />
                                        </div>
                                        <div className="flex-1 text-left">
                                            <p className="dark:text-white text-gray-900 text-sm">Channel settings</p>
                                        </div>
                                        <ChevronRight className="w-5 h-5 dark:text-[#8696a0] text-gray-400" />
                                    </button>
                                )}
                            </div>

                            {/* Bottom padding */}
                            <div className="h-8 dark:bg-[#111b21] bg-gray-50" />
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

                    {/* Leave Channel Confirmation Modal */}
                    <ConfirmModal
                        isOpen={showLeaveConfirm}
                        onClose={() => setShowLeaveConfirm(false)}
                        onConfirm={() => {
                            setShowLeaveConfirm(false);
                            onLeaveGroup?.();
                        }}
                        title="Leave Channel?"
                        message={`Are you sure you want to leave "${currentGroup?.name}"? You will no longer receive updates from this channel.`}
                        confirmText="Leave"
                        cancelText="Cancel"
                        type="danger"
                    />
                </>
            )}
        </AnimatePresence>
    );
};

export default ChannelInfo;
