import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Monitor, Eye } from 'lucide-react';

const ScreenWatcher = ({ onFrameUpdate, onAnalyzeScreen }) => {
    const [isSharing, setIsSharing] = useState(false);
    const [captureError, setCaptureError] = useState("");
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const streamRef = useRef(null);

    const captureCurrentFrame = useCallback(() => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
            const context = canvas.getContext('2d');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            const frameData = canvas.toDataURL('image/jpeg', 0.6);
            onFrameUpdate(frameData);
            return frameData;
        }
        return null;
    }, [onFrameUpdate]);

    const stopCapture = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
        setIsSharing(false);
        onFrameUpdate(null);
    }, [onFrameUpdate]);

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

    useEffect(() => {
        if (!isSharing) return;
        const intervalId = setInterval(captureCurrentFrame, 3000);
        return () => clearInterval(intervalId);
    }, [isSharing, captureCurrentFrame]);

    useEffect(() => {
        return () => stopCapture();
    }, [stopCapture]);

    return (
        <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-[11px] font-bold tracking-widest uppercase text-slate-500 flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-sky-500/10 flex items-center justify-center text-sky-400">
                        <Monitor size={14} />
                    </span>
                    Screen vision
                </h3>
                {isSharing && (
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                        ● Live
                    </span>
                )}
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
                <div className="flex gap-2">
                    {onAnalyzeScreen && (
                        <button
                            onClick={() => {
                                const frame = captureCurrentFrame();
                                if (frame) onAnalyzeScreen(frame);
                            }}
                            className="flex-1 py-2.5 rounded-lg bg-[#0A0A0A] dark:bg-white text-white dark:text-black text-[13px] font-medium flex items-center justify-center gap-1.5"
                        >
                            <Eye size={14} />
                            Analyze screen
                        </button>
                    )}
                    <button
                        onClick={stopCapture}
                        className="flex-1 py-2.5 rounded-lg border text-[13px] font-medium"
                        style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)' }}
                    >
                        Stop sharing
                    </button>
                </div>
            )}

            {captureError && (
                <p className="mt-3 text-xs font-semibold text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
                    {captureError}
                </p>
            )}

            <p className="text-xs text-slate-500 mt-3 leading-relaxed">
                {isSharing
                    ? "AI sees your screen and combines it with your voice or analyzes on click."
                    : "Share your interview or code window so the AI understands the visual question."}
            </p>
        </div>
    );
};

export default ScreenWatcher;
