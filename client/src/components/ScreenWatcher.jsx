import React, { useState, useRef, useEffect } from 'react';
import { Layers, StopCircle, Monitor } from 'lucide-react';

const ScreenWatcher = ({ onFrameUpdate }) => {
    const [isSharing, setIsSharing] = useState(false);
    const [captureError, setCaptureError] = useState("");
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const streamRef = useRef(null);

    const startCapture = async () => {
        setCaptureError("");
        if (!navigator.mediaDevices?.getDisplayMedia) {
            setCaptureError("⚠️ Screen capture not supported on this device/browser.");
            return;
        }
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
            setCaptureError(err.name === 'NotAllowedError'
                ? "⚠️ Permission denied — allow screen sharing to use vision."
                : "⚠️ Could not start screen capture.");
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
        <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-[11px] font-bold tracking-widest uppercase text-slate-500 flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-sky-500/10 flex items-center justify-center text-sky-400"><Monitor size={14} /></span> Screen vision
                </h3>
                {isSharing && <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">● Live</span>}
            </div>

            <video ref={videoRef} autoPlay playsInline muted className="hidden" />
            <canvas ref={canvasRef} className="hidden" />

            {!isSharing ? (
                <button
                    onClick={startCapture}
                    className="w-full py-2.5 rounded-lg bg-[#0A0A0A] dark:bg-white text-white dark:text-black text-[13px] font-medium"
                >
                    Share screen
                </button>
            ) : (
                <button
                    onClick={stopCapture}
                    className="w-full py-2.5 rounded-lg border text-[13px] font-medium"
                    style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)' }}
                >
                    Stop sharing
                </button>
            )}

            {captureError && (
                <p className="mt-3 text-xs font-semibold text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">{captureError}</p>
            )}

            <p className="text-xs text-slate-500 mt-3 leading-relaxed">
                {isSharing
                    ? "AI sees your screen and combines it with your voice."
                    : "Share your interview or code window so the AI understands the question."}
            </p>
        </div>
    );
};

export default ScreenWatcher;
