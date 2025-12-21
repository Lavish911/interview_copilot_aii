import React, { useState, useRef, useEffect } from 'react';
import { Layers, StopCircle, Monitor } from 'lucide-react';

const ScreenWatcher = ({ onFrameUpdate }) => {
    const [isSharing, setIsSharing] = useState(false);
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const streamRef = useRef(null);

    const startCapture = async () => {
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: { cursor: "always" },
                audio: false
            });

            videoRef.current.srcObject = stream;
            streamRef.current = stream;
            setIsSharing(true);

            // Handle stream stop (e.g. user clicks "Stop Sharing" in browser UI)
            stream.getVideoTracks()[0].onended = () => {
                stopCapture();
            };

        } catch (err) {
            console.error("Error starting screen capture:", err);
        }
    };

    const stopCapture = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
        setIsSharing(false);
        onFrameUpdate(null); // Clear frame
    };

    useEffect(() => {
        let intervalId;

        if (isSharing && videoRef.current && canvasRef.current) {
            intervalId = setInterval(() => {
                const video = videoRef.current;
                const canvas = canvasRef.current;

                if (video.readyState === video.HAVE_ENOUGH_DATA) {
                    const context = canvas.getContext('2d');
                    canvas.width = video.videoWidth;
                    canvas.height = video.videoHeight;

                    // Draw video frame to canvas
                    context.drawImage(video, 0, 0, canvas.width, canvas.height);

                    // Convert to base64 (JPEG 0.7 quality is good balance)
                    const frameData = canvas.toDataURL('image/jpeg', 0.6);
                    onFrameUpdate(frameData);
                }
            }, 3000); // Capture every 3 seconds to avoid spamming
        }

        return () => clearInterval(intervalId);
    }, [isSharing, onFrameUpdate]);

    return (
        <div className="flex flex-col gap-2 p-4 bg-slate-900 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold text-slate-400 uppercase flex items-center gap-2">
                    <Monitor size={16} /> Vision Input
                </h3>
                {isSharing && <span className="text-xs text-green-400 animate-pulse">● Live</span>}
            </div>

            <video ref={videoRef} autoPlay playsInline muted className="hidden" />
            <canvas ref={canvasRef} className="hidden" />

            {!isSharing ? (
                <button
                    onClick={startCapture}
                    className="flex items-center justify-center gap-2 w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                    <Layers size={16} /> Share Screen Context
                </button>
            ) : (
                <button
                    onClick={stopCapture}
                    className="flex items-center justify-center gap-2 w-full py-2 bg-red-600/20 hover:bg-red-600/40 text-red-400 border border-red-600/50 rounded-lg text-sm font-medium transition-colors"
                >
                    <StopCircle size={16} /> Stop Vision
                </button>
            )}

            <p className="text-xs text-slate-500 mt-1">
                {isSharing
                    ? "AI is watching your screen for technical questions."
                    : "Share your Interview/IDE window to give the AI visual context."}
            </p>
        </div>
    );
};

export default ScreenWatcher;
