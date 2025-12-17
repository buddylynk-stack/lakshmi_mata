import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Phone, Video, Mic, MicOff, VideoOff, PhoneOff } from "lucide-react";
import { useToast } from "../context/ToastContext";

const CallModal = ({ 
    isOpen, 
    onClose, 
    callType, // "voice" or "video"
    caller,
    receiver,
    socket,
    isIncoming = false,
    incomingOffer = null
}) => {
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);
    const [callStatus, setCallStatus] = useState(isIncoming ? "incoming" : "calling");
    const [callDuration, setCallDuration] = useState(0);
    const toast = useToast();
    
    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);
    const peerConnectionRef = useRef(null);
    const localStreamRef = useRef(null);
    const callTimerRef = useRef(null);
    const ringtoneRef = useRef(null);
    const ringtoneIntervalRef = useRef(null);

    // Play ringtone for incoming calls
    useEffect(() => {
        if (isOpen && isIncoming && callStatus === "incoming") {
            playRingtone();
        }
        return () => stopRingtone();
    }, [isOpen, isIncoming, callStatus]);

    const playRingtone = () => {
        try {
            // Create audio context for ringtone
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            ringtoneRef.current = audioContext;
            
            const playTone = () => {
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();
                
                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);
                
                oscillator.frequency.value = 440; // A4 note
                oscillator.type = 'sine';
                
                gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
                
                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.5);
            };
            
            // Play immediately and then every 2 seconds
            playTone();
            ringtoneIntervalRef.current = setInterval(playTone, 2000);
        } catch (error) {
            console.error("Error playing ringtone:", error);
        }
    };

    const stopRingtone = () => {
        if (ringtoneIntervalRef.current) {
            clearInterval(ringtoneIntervalRef.current);
            ringtoneIntervalRef.current = null;
        }
        if (ringtoneRef.current) {
            ringtoneRef.current.close();
            ringtoneRef.current = null;
        }
    };

    useEffect(() => {
        if (isOpen && !isIncoming) {
            initializeCall();
        }

        return () => {
            cleanup();
        };
    }, [isOpen]);

    useEffect(() => {
        if (!socket) return;

        socket.on("call:answer", handleCallAnswer);
        socket.on("call:ice-candidate", handleIceCandidate);
        socket.on("call:ended", handleCallEnded);

        return () => {
            socket.off("call:answer");
            socket.off("call:ice-candidate");
            socket.off("call:ended");
        };
    }, [socket]);

    const initializeCall = async () => {
        try {
            // Get user media
            const stream = await navigator.mediaDevices.getUserMedia({
                video: callType === "video",
                audio: true
            });

            localStreamRef.current = stream;
            if (localVideoRef.current && callType === "video") {
                localVideoRef.current.srcObject = stream;
            }

            // Create peer connection with STUN/TURN servers for better connectivity
            const configuration = {
                iceServers: [
                    // Google STUN servers
                    { urls: "stun:stun.l.google.com:19302" },
                    { urls: "stun:stun1.l.google.com:19302" },
                    { urls: "stun:stun2.l.google.com:19302" },
                    { urls: "stun:stun3.l.google.com:19302" },
                    { urls: "stun:stun4.l.google.com:19302" },
                    // Public TURN servers (for NAT traversal)
                    {
                        urls: "turn:openrelay.metered.ca:80",
                        username: "openrelayproject",
                        credential: "openrelayproject"
                    },
                    {
                        urls: "turn:openrelay.metered.ca:443",
                        username: "openrelayproject",
                        credential: "openrelayproject"
                    }
                ],
                iceCandidatePoolSize: 10
            };
            
            peerConnectionRef.current = new RTCPeerConnection(configuration);

            // Add local stream to peer connection
            stream.getTracks().forEach(track => {
                peerConnectionRef.current.addTrack(track, stream);
            });

            // Handle remote stream
            peerConnectionRef.current.ontrack = (event) => {
                if (remoteVideoRef.current) {
                    remoteVideoRef.current.srcObject = event.streams[0];
                }
            };

            // Handle ICE candidates
            peerConnectionRef.current.onicecandidate = (event) => {
                if (event.candidate && socket) {
                    socket.emit("call:ice-candidate", {
                        to: receiver.userId,
                        candidate: event.candidate
                    });
                }
            };

            // Create and send offer
            const offer = await peerConnectionRef.current.createOffer();
            await peerConnectionRef.current.setLocalDescription(offer);

            socket.emit("call:offer", {
                to: receiver.userId,
                offer,
                callType,
                caller: {
                    userId: caller.userId,
                    username: caller.username,
                    avatar: caller.avatar
                }
            });

        } catch (error) {
            console.error("Error initializing call:", error);
            toast.error("Could not access camera/microphone");
            onClose();
        }
    };

    const handleCallAnswer = async ({ answer }) => {
        try {
            await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));
            setCallStatus("connected");
            startCallTimer();
        } catch (error) {
            console.error("Error handling answer:", error);
        }
    };

    const handleIceCandidate = async ({ candidate }) => {
        try {
            await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (error) {
            console.error("Error adding ICE candidate:", error);
        }
    };

    const handleCallEnded = () => {
        cleanup();
        onClose();
    };

    const startCallTimer = () => {
        callTimerRef.current = setInterval(() => {
            setCallDuration(prev => prev + 1);
        }, 1000);
    };

    const formatDuration = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const toggleMute = () => {
        if (localStreamRef.current) {
            const audioTrack = localStreamRef.current.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                setIsMuted(!audioTrack.enabled);
            }
        }
    };

    const toggleVideo = () => {
        if (localStreamRef.current && callType === "video") {
            const videoTrack = localStreamRef.current.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                setIsVideoOff(!videoTrack.enabled);
            }
        }
    };

    const endCall = () => {
        if (socket) {
            socket.emit("call:end", { to: isIncoming ? caller.userId : receiver.userId });
        }
        cleanup();
        onClose();
    };

    const answerCall = async () => {
        stopRingtone(); // Stop ringtone when answering
        
        try {
            // Get user media
            const stream = await navigator.mediaDevices.getUserMedia({
                video: callType === "video",
                audio: true
            });

            localStreamRef.current = stream;
            if (localVideoRef.current && callType === "video") {
                localVideoRef.current.srcObject = stream;
            }

            // Create peer connection
            const configuration = {
                iceServers: [
                    { urls: "stun:stun.l.google.com:19302" },
                    { urls: "stun:stun1.l.google.com:19302" },
                    {
                        urls: "turn:openrelay.metered.ca:80",
                        username: "openrelayproject",
                        credential: "openrelayproject"
                    }
                ],
                iceCandidatePoolSize: 10
            };
            
            peerConnectionRef.current = new RTCPeerConnection(configuration);

            // Add local stream
            stream.getTracks().forEach(track => {
                peerConnectionRef.current.addTrack(track, stream);
            });

            // Handle remote stream
            peerConnectionRef.current.ontrack = (event) => {
                if (remoteVideoRef.current) {
                    remoteVideoRef.current.srcObject = event.streams[0];
                }
            };

            // Handle ICE candidates
            peerConnectionRef.current.onicecandidate = (event) => {
                if (event.candidate && socket) {
                    socket.emit("call:ice-candidate", {
                        to: caller.userId,
                        candidate: event.candidate
                    });
                }
            };

            // Set remote description from offer
            await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(incomingOffer));

            // Create and send answer
            const answer = await peerConnectionRef.current.createAnswer();
            await peerConnectionRef.current.setLocalDescription(answer);

            socket.emit("call:answer", {
                to: caller.userId,
                answer
            });

            setCallStatus("connected");
            startCallTimer();
        } catch (error) {
            console.error("Error answering call:", error);
            toast.error("Could not access camera/microphone");
            onClose();
        }
    };

    const declineCall = () => {
        if (socket) {
            socket.emit("call:end", { to: caller.userId });
        }
        cleanup();
        onClose();
    };

    const cleanup = () => {
        stopRingtone();
        
        if (callTimerRef.current) {
            clearInterval(callTimerRef.current);
        }
        
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop());
        }
        
        if (peerConnectionRef.current) {
            peerConnectionRef.current.close();
        }
    };

    if (!isOpen) return null;

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
        >
            <div className="relative w-full h-full max-w-6xl max-h-screen p-4">
                {/* Remote Video (Full Screen) */}
                {callType === "video" && (
                    <video
                        ref={remoteVideoRef}
                        autoPlay
                        playsInline
                        className="w-full h-full object-cover rounded-lg"
                    />
                )}

                {/* Voice Call UI */}
                {callType === "voice" && (
                    <div className="flex flex-col items-center justify-center h-full">
                        <img
                            src={isIncoming ? caller?.avatar : receiver?.avatar}
                            alt={isIncoming ? caller?.username : receiver?.username}
                            className="w-32 h-32 rounded-full mb-6 ring-4 ring-white/20"
                            onError={(e) => {
                                e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(isIncoming ? caller?.username : receiver?.username)}&background=random`;
                            }}
                        />
                        <h2 className="text-white text-2xl font-semibold mb-2">
                            {isIncoming ? caller?.username : receiver?.username}
                        </h2>
                        <p className="text-gray-400 text-lg">
                            {callStatus === "calling" && "Calling..."}
                            {callStatus === "incoming" && "Incoming call..."}
                            {callStatus === "connected" && formatDuration(callDuration)}
                        </p>
                    </div>
                )}

                {/* Local Video (Picture in Picture) */}
                {callType === "video" && (
                    <div className="absolute top-8 right-8 w-48 h-36 bg-gray-900 rounded-lg overflow-hidden shadow-2xl">
                        <video
                            ref={localVideoRef}
                            autoPlay
                            playsInline
                            muted
                            className="w-full h-full object-cover"
                        />
                    </div>
                )}

                {/* Call Info Overlay (for video calls) */}
                {callType === "video" && (
                    <div className="absolute top-8 left-8 text-white">
                        <h2 className="text-xl font-semibold mb-1">
                            {isIncoming ? caller?.username : receiver?.username}
                        </h2>
                        <p className="text-sm text-gray-300">
                            {callStatus === "calling" && "Calling..."}
                            {callStatus === "incoming" && "Incoming video call..."}
                            {callStatus === "connected" && formatDuration(callDuration)}
                        </p>
                    </div>
                )}

                {/* Controls */}
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4">
                    {/* Incoming Call - Accept/Decline buttons */}
                    {isIncoming && callStatus === "incoming" ? (
                        <>
                            {/* Decline Call */}
                            <motion.button
                                whileTap={{ scale: 0.9 }}
                                onClick={declineCall}
                                className="p-5 rounded-full bg-red-500 hover:bg-red-600 transition-colors"
                            >
                                <PhoneOff className="w-7 h-7 text-white" />
                            </motion.button>

                            {/* Accept Call */}
                            <motion.button
                                whileTap={{ scale: 0.9 }}
                                onClick={answerCall}
                                className="p-5 rounded-full bg-green-500 hover:bg-green-600 transition-colors"
                            >
                                <Phone className="w-7 h-7 text-white" />
                            </motion.button>
                        </>
                    ) : (
                        <>
                            {/* Mute Button */}
                            <motion.button
                                whileTap={{ scale: 0.9 }}
                                onClick={toggleMute}
                                className={`p-4 rounded-full ${isMuted ? 'bg-red-500' : 'bg-gray-700'} hover:bg-opacity-80 transition-colors`}
                            >
                                {isMuted ? <MicOff className="w-6 h-6 text-white" /> : <Mic className="w-6 h-6 text-white" />}
                            </motion.button>

                            {/* Video Toggle (only for video calls) */}
                            {callType === "video" && (
                                <motion.button
                                    whileTap={{ scale: 0.9 }}
                                    onClick={toggleVideo}
                                    className={`p-4 rounded-full ${isVideoOff ? 'bg-red-500' : 'bg-gray-700'} hover:bg-opacity-80 transition-colors`}
                                >
                                    {isVideoOff ? <VideoOff className="w-6 h-6 text-white" /> : <Video className="w-6 h-6 text-white" />}
                                </motion.button>
                            )}

                            {/* End Call Button */}
                            <motion.button
                                whileTap={{ scale: 0.9 }}
                                onClick={endCall}
                                className="p-5 rounded-full bg-red-500 hover:bg-red-600 transition-colors"
                            >
                                <PhoneOff className="w-7 h-7 text-white" />
                            </motion.button>
                        </>
                    )}
                </div>
            </div>
        </motion.div>
    );
};

export default CallModal;
